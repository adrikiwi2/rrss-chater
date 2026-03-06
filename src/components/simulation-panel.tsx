"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { nanoid } from "nanoid";
import {
  Plus,
  Save,
  Zap,
  Trash2,
  MessageCircle,
  Send,
  Loader2,
  HelpCircle,
} from "lucide-react";
import { ChatBubble } from "./chat-bubble";
import { AiResultCard } from "./ai-result-card";
import { RoleSwitcher } from "./role-switcher";
import type {
  Simulation,
  SimMessage,
  InferenceResult,
  Category,
  Template,
} from "@/lib/types";

interface SimulationPanelProps {
  flowId: string;
  roleALabel: string;
  roleBLabel: string;
  categories: Category[];
  templates: Template[];
}

export function SimulationPanel({
  flowId,
  roleALabel,
  roleBLabel,
  categories,
  templates,
}: SimulationPanelProps) {
  const [simulations, setSimulations] = useState<Simulation[]>([]);
  const [activeSimId, setActiveSimId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SimMessage[]>([]);
  const [viewMode, setViewMode] = useState<"a" | "b" | "inference">("b");
  const [inputText, setInputText] = useState("");
  const [isInferring, setIsInferring] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsaved, setHasUnsaved] = useState(false);

  // Map of msgId -> InferenceResult for each inference that generated a message
  const [inferenceByMsgId, setInferenceByMsgId] = useState<Record<string, InferenceResult>>({});
  // Set of msgIds whose result cards are expanded
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());

  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Fetch simulations
  const fetchSims = useCallback(async () => {
    const res = await fetch(`/api/simulations?flow_id=${flowId}`);
    const data = await res.json();
    setSimulations(data);
  }, [flowId]);

  useEffect(() => {
    fetchSims();
  }, [fetchSims]);

  // Load a simulation
  const loadSim = (sim: Simulation) => {
    setActiveSimId(sim.id);
    setMessages(JSON.parse(sim.messages_json || "[]"));

    // Load inference results map
    if (sim.last_result_json) {
      try {
        const parsed = JSON.parse(sim.last_result_json);
        // Handle both old format (single result) and new format (map)
        if (parsed.detected_status) {
          // Old format — single result, no msg association
          setInferenceByMsgId({});
        } else {
          setInferenceByMsgId(parsed);
        }
      } catch {
        setInferenceByMsgId({});
      }
    } else {
      setInferenceByMsgId({});
    }

    setExpandedResults(new Set());
    setHasUnsaved(false);
  };

  // New simulation
  const newSim = () => {
    setActiveSimId(null);
    setMessages([]);
    setInferenceByMsgId({});
    setExpandedResults(new Set());
    setHasUnsaved(false);
    setInputText("");
  };

  // Send message
  const sendMessage = () => {
    if (!inputText.trim() || viewMode === "inference") return;

    const msg: SimMessage = {
      id: nanoid(),
      role: viewMode,
      body: inputText.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, msg]);
    setInputText("");
    setHasUnsaved(true);
    setExpandedResults(new Set());
    setTimeout(scrollToBottom, 50);
  };

  // Handle view mode change — collapse all result cards
  const handleModeChange = (mode: "a" | "b" | "inference") => {
    if (mode !== "inference") {
      setExpandedResults(new Set());
    }
    setViewMode(mode);
  };

  // Toggle a specific result card
  const toggleResult = (msgId: string) => {
    setExpandedResults((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) {
        next.delete(msgId);
      } else {
        next.add(msgId);
      }
      return next;
    });
  };

  // Run inference
  const runInference = async () => {
    if (messages.length === 0 || categories.length === 0) return;

    setIsInferring(true);
    setViewMode("inference");

    try {
      const res = await fetch("/api/inference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flow_id: flowId, messages }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Inference failed");
      }

      const result: InferenceResult = await res.json();

      // Insert suggested template as role A message and link inference
      if (result.suggested_template_id && templates) {
        const tpl = templates.find((t) => t.id === result.suggested_template_id);
        if (tpl) {
          const msgId = nanoid();
          const msg: SimMessage = {
            id: msgId,
            role: "a",
            body: tpl.body,
            timestamp: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, msg]);
          setInferenceByMsgId((prev) => ({ ...prev, [msgId]: result }));
          setExpandedResults((prev) => new Set(prev).add(msgId));
        }
      }

      setHasUnsaved(true);
      setTimeout(scrollToBottom, 50);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Inference failed");
    } finally {
      setIsInferring(false);
    }
  };

  // Get the latest inference result (for detected_status in save payload)
  const latestResult = (() => {
    const ids = Object.keys(inferenceByMsgId);
    if (ids.length === 0) return null;
    // Find the last inferred message in message order
    for (let i = messages.length - 1; i >= 0; i--) {
      if (inferenceByMsgId[messages[i].id]) {
        return inferenceByMsgId[messages[i].id];
      }
    }
    return null;
  })();

  // Save simulation
  const saveSim = async () => {
    setIsSaving(true);
    try {
      const payload = {
        flow_id: flowId,
        title:
          messages.length > 0
            ? messages[0].body.slice(0, 50)
            : "Empty simulation",
        messages_json: JSON.stringify(messages),
        last_result_json: Object.keys(inferenceByMsgId).length > 0
          ? JSON.stringify(inferenceByMsgId)
          : null,
        detected_status: latestResult?.detected_status || null,
      };

      if (activeSimId) {
        await fetch(`/api/simulations/${activeSimId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        const res = await fetch("/api/simulations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const sim = await res.json();
        setActiveSimId(sim.id);
        await fetch(`/api/simulations/${sim.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      setHasUnsaved(false);
      fetchSims();
    } finally {
      setIsSaving(false);
    }
  };

  // Delete simulation
  const deleteSim = async (id: string) => {
    await fetch(`/api/simulations/${id}`, { method: "DELETE" });
    if (activeSimId === id) newSim();
    fetchSims();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      runInference();
    }
  };

  return (
    <div className="flex h-[calc(100vh-220px)] min-h-[400px] gap-4">
      {/* Simulation List */}
      <div className="flex w-56 flex-shrink-0 flex-col rounded-xl border border-border bg-base-1">
        <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
          <span className="text-xs font-semibold text-text-secondary">
            Simulations
          </span>
          <button
            onClick={newSim}
            className="rounded-md p-1 text-text-muted transition-all hover:bg-base-3 hover:text-accent"
          >
            <Plus size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-1.5">
          {simulations.length === 0 && (
            <p className="px-2 py-4 text-center text-[11px] text-text-muted">
              No saved simulations
            </p>
          )}
          {simulations.map((sim) => {
            const isActive = sim.id === activeSimId;
            const statusCategory = categories.find(
              (c) => c.name === sim.detected_status
            );
            return (
              <div
                key={sim.id}
                className={`group mb-0.5 flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 transition-all ${
                  isActive
                    ? "bg-accent/10 text-text-primary"
                    : "text-text-secondary hover:bg-base-2"
                }`}
                onClick={() => loadSim(sim)}
              >
                <MessageCircle size={12} className="flex-shrink-0 text-text-muted" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-medium">
                    {sim.title || "Untitled"}
                  </p>
                  {sim.detected_status && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <div
                        className="h-1.5 w-1.5 rounded-full"
                        style={{
                          backgroundColor:
                            statusCategory?.color || "#6366f1",
                        }}
                      />
                      <span className="font-mono text-[9px] text-text-muted">
                        {sim.detected_status}
                      </span>
                    </div>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSim(sim.id);
                  }}
                  className="rounded p-0.5 text-transparent transition-all group-hover:text-text-muted group-hover:hover:text-danger"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex flex-1 flex-col rounded-xl border border-border bg-base-1">
        {/* Toolbar */}
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <RoleSwitcher
            activeMode={viewMode}
            onModeChange={handleModeChange}
            roleALabel={roleALabel}
            roleBLabel={roleBLabel}
          />

          <div className="flex items-center gap-2">
            {hasUnsaved && (
              <span className="mr-1 text-[10px] text-warning">unsaved</span>
            )}
            <button
              onClick={runInference}
              disabled={isInferring || messages.length === 0 || categories.length === 0}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-accent to-violet px-3 py-1.5 text-xs font-semibold text-white transition-all hover:shadow-md hover:shadow-accent/20 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isInferring ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Zap size={13} />
              )}
              Infer
            </button>
            <button
              onClick={saveSim}
              disabled={isSaving || messages.length === 0}
              className="flex items-center gap-1.5 rounded-lg border border-border-bright px-3 py-1.5 text-xs font-medium text-text-secondary transition-all hover:border-accent/40 hover:text-accent disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Save size={13} />
              Save
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-text-muted">
              <MessageCircle size={28} className="mb-2 opacity-40" />
              <p className="text-xs">
                Start typing as{" "}
                <span className="font-semibold text-accent">{roleALabel}</span>{" "}
                or{" "}
                <span className="font-semibold text-text-secondary">
                  {roleBLabel}
                </span>
              </p>
              <p className="mt-1 text-[10px]">
                Switch roles with the control above. Ctrl+Enter to run inference.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg, i) => {
                const result = inferenceByMsgId[msg.id];
                const isExpanded = expandedResults.has(msg.id);

                return (
                  <div key={msg.id}>
                    {/* Inference widget above the generated message */}
                    {result && (
                      isExpanded ? (
                        <div className="mb-2">
                          <AiResultCard
                            result={result}
                            categories={categories}
                            templates={templates}
                          />
                          <div className="flex justify-center -mt-1 mb-1">
                            <button
                              onClick={() => toggleResult(msg.id)}
                              className="text-[10px] text-text-muted hover:text-accent transition-colors"
                            >
                              collapse
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-center py-1 mb-1">
                          <button
                            onClick={() => toggleResult(msg.id)}
                            className="group flex items-center gap-1.5 rounded-full border border-accent/20 bg-accent/5 px-3 py-1.5 text-[11px] font-medium text-accent/70 transition-all hover:border-accent/40 hover:bg-accent/10 hover:text-accent"
                          >
                            <HelpCircle size={13} />
                            <span
                              className="font-mono text-[10px]"
                              style={{ color: categories.find((c) => c.name === result.detected_status)?.color }}
                            >
                              {result.detected_status}
                            </span>
                          </button>
                        </div>
                      )
                    )}
                    <ChatBubble
                      body={msg.body}
                      role={msg.role}
                      roleLabel={msg.role === "a" ? roleALabel : roleBLabel}
                      timestamp={msg.timestamp}
                      index={i}
                    />
                  </div>
                );
              })}

              {isInferring && (
                <div className="flex justify-center py-4">
                  <div className="flex items-center gap-2 rounded-full bg-accent/10 px-4 py-2 text-xs text-accent">
                    <Loader2 size={13} className="animate-spin" />
                    Analyzing conversation...
                  </div>
                </div>
              )}
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-border px-4 py-3">
          {viewMode === "inference" ? (
            <div className="flex items-center justify-center rounded-lg bg-base-0 px-4 py-3 text-xs text-text-muted">
              <Zap size={13} className="mr-2 text-accent" />
              Inference mode — switch to a role to send messages
            </div>
          ) : (
            <div
              className={`flex items-end gap-2 rounded-lg border bg-base-0 px-3 py-2 transition-colors ${
                viewMode === "a"
                  ? "border-accent/30"
                  : "border-border"
              }`}
            >
              <span
                className={`mb-1 text-[10px] font-bold uppercase tracking-widest ${
                  viewMode === "a" ? "text-accent" : "text-text-muted"
                }`}
              >
                {viewMode === "a" ? roleALabel : roleBLabel}
              </span>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                className="flex-1 resize-none bg-transparent text-sm text-text-primary outline-none"
                placeholder="Type a message..."
              />
              <button
                onClick={sendMessage}
                disabled={!inputText.trim()}
                className="mb-0.5 rounded-md p-1.5 text-text-muted transition-all hover:bg-accent/10 hover:text-accent disabled:opacity-30"
              >
                <Send size={15} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
