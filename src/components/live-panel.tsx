"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Radio,
  Send,
  X,
  AlertTriangle,
  User,
  MessageSquare,
  Check,
  RefreshCw,
  Users,
  Instagram,
  ExternalLink,
  Unplug,
} from "lucide-react";
import type { InferenceResult, Category, Template } from "@/lib/types";

interface Lead {
  id: string;
  platform_handle: string;
  display_name: string;
  stage: string;
  needs_human: number;
  needs_human_reason: string | null;
  updated_at: string;
}

interface OutboxItem {
  id: string;
  lead_id: string;
  channel: string;
  action: string;
  payload_json: string;
  status: string;
  created_at: string;
  lead_display_name: string;
  lead_platform_handle: string;
}

interface LivePanelProps {
  flowId: string;
  isPublished: boolean;
  onTogglePublish: (published: boolean) => void;
  categories: Category[];
  templates: Template[];
  agentConfig: string | null;
}

export function LivePanel({
  flowId,
  isPublished,
  onTogglePublish,
  categories,
  templates,
  agentConfig,
}: LivePanelProps) {
  const stages: string[] = agentConfig
    ? (JSON.parse(agentConfig).stages ?? [])
    : [];
  const [outbox, setOutbox] = useState<OutboxItem[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [hasConnection, setHasConnection] = useState<boolean | null>(null);
  const [connecting, setConnecting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [outboxRes, leadsRes, connRes] = await Promise.all([
        fetch(`/api/outbox?flow_id=${flowId}`),
        fetch(`/api/leads?flow_id=${flowId}`),
        fetch(`/api/connect-instagram`),
      ]);
      if (outboxRes.ok) setOutbox(await outboxRes.json());
      if (leadsRes.ok) setLeads(await leadsRes.json());
      if (connRes.ok) {
        const connData = await connRes.json();
        setHasConnection(connData.connected);
      }
    } finally {
      setLoading(false);
    }
  }, [flowId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleConnectInstagram = async () => {
    setConnecting(true);
    try {
      const res = await fetch("/api/connect-instagram", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.redirectUrl) {
        window.open(data.redirectUrl, "_blank");
      }
    } finally {
      setConnecting(false);
    }
  };

  const handleAction = async (outboxId: string, action: "approve" | "reject") => {
    setActionLoading(outboxId);
    try {
      const res = await fetch(`/api/outbox/${outboxId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        setOutbox((prev) => prev.filter((o) => o.id !== outboxId));
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleScan = async () => {
    setScanning(true);
    setScanResult(null);
    try {
      const res = await fetch(`/api/flows/${flowId}/scan`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setScanResult(
          `Scanned ${data.conversations} conversations: ${data.newMessages} new messages, ${data.inferencesRun} inferences, ${data.messagesSent} queued`
        );
        await fetchData();
      } else {
        setScanResult(`Error: ${data.error}`);
      }
    } catch (err) {
      setScanResult(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setScanning(false);
    }
  };

  const needsHumanLeads = leads.filter((l) => l.needs_human);

  return (
    <div className="space-y-6">
      {/* Instagram connection */}
      {hasConnection !== null && (
        <div className={`flex items-center justify-between rounded-xl border p-4 ${
          hasConnection
            ? "border-emerald-500/20 bg-emerald-500/5"
            : "border-amber-500/20 bg-amber-500/5"
        }`}>
          <div className="flex items-center gap-3">
            <Instagram size={16} className={hasConnection ? "text-emerald-400" : "text-amber-400"} />
            <div>
              <p className="text-sm font-medium text-text-primary">
                {hasConnection ? "Instagram connected" : "Instagram not connected"}
              </p>
              <p className="text-xs text-text-muted">
                {hasConnection
                  ? "Your account is linked and ready to process messages"
                  : "Connect your Instagram account to go live"}
              </p>
            </div>
          </div>
          {!hasConnection && (
            <button
              onClick={handleConnectInstagram}
              disabled={connecting}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-purple-500/20 to-pink-500/20 px-4 py-2 text-xs font-semibold text-purple-300 transition-all hover:from-purple-500/30 hover:to-pink-500/30 disabled:opacity-50"
            >
              {connecting ? (
                <RefreshCw size={12} className="animate-spin" />
              ) : (
                <ExternalLink size={12} />
              )}
              Connect Instagram
            </button>
          )}
          {hasConnection && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-400">
              <Unplug size={12} />
              Connected
            </div>
          )}
        </div>
      )}

      {/* Publish toggle */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-base-2 p-4">
        <div className="flex items-center gap-3">
          <div
            className={`h-3 w-3 rounded-full ${
              isPublished
                ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"
                : "bg-text-muted"
            }`}
          />
          <div>
            <p className="text-sm font-medium text-text-primary">
              {isPublished ? "Flow is live" : "Flow is offline"}
            </p>
            <p className="text-xs text-text-muted">
              {isPublished
                ? "The agent cycle will process incoming messages"
                : "Publish to start processing real conversations"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isPublished && (
            <button
              onClick={handleScan}
              disabled={scanning}
              className="flex items-center gap-1.5 rounded-lg bg-accent/15 px-4 py-2 text-xs font-semibold text-accent transition-colors hover:bg-accent/25 disabled:opacity-50"
            >
              {scanning ? (
                <RefreshCw size={12} className="animate-spin" />
              ) : (
                <Radio size={12} />
              )}
              {scanning ? "Scanning..." : "Scan Inbox"}
            </button>
          )}
          <button
            onClick={() => onTogglePublish(!isPublished)}
            className={`rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
              isPublished
                ? "border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                : "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
            }`}
          >
            {isPublished ? "Unpublish" : "Publish"}
          </button>
        </div>
      </div>

      {/* Scan result */}
      {scanResult && (
        <div className="rounded-lg border border-accent/20 bg-accent/5 px-4 py-2.5 text-xs text-accent">
          {scanResult}
        </div>
      )}

      {/* Pending approvals */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Send size={14} className="text-accent" />
            <h3 className="text-sm font-semibold text-text-primary">
              Pending Approvals
            </h3>
            {outbox.length > 0 && (
              <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-bold text-accent">
                {outbox.length}
              </span>
            )}
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-text-muted hover:bg-base-2 hover:text-text-secondary transition-colors"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {outbox.length === 0 ? (
          <div className="rounded-xl border border-border bg-base-2 p-8 text-center">
            <Radio size={24} className="mx-auto mb-2 text-text-muted" />
            <p className="text-xs text-text-muted">
              No pending messages to review
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {outbox.map((item) => (
              <OutboxCard
                key={item.id}
                item={item}
                categories={categories}
                templates={templates}
                loading={actionLoading === item.id}
                onApprove={() => handleAction(item.id, "approve")}
                onReject={() => handleAction(item.id, "reject")}
              />
            ))}
          </div>
        )}
      </div>

      {/* Needs human */}
      {needsHumanLeads.length > 0 && (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle size={14} className="text-amber-400" />
            <h3 className="text-sm font-semibold text-text-primary">
              Needs Human Review
            </h3>
            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-400">
              {needsHumanLeads.length}
            </span>
          </div>
          <div className="space-y-2">
            {needsHumanLeads.map((lead) => (
              <NeedsHumanCard
                key={lead.id}
                lead={lead}
                stages={stages}
                onResolved={fetchData}
              />
            ))}
          </div>
        </div>
      )}

      {/* Leads summary */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <Users size={14} className="text-text-muted" />
          <h3 className="text-sm font-semibold text-text-primary">
            Leads
          </h3>
          <span className="text-xs text-text-muted">({leads.length})</span>
        </div>
        {leads.length === 0 ? (
          <p className="text-xs text-text-muted">
            No leads yet. Publish the flow and run the agent cycle to discover conversations.
          </p>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-base-2">
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-widest text-text-muted">
                    Contact
                  </th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-widest text-text-muted">
                    Stage
                  </th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-widest text-text-muted">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2">
                      <span className="text-xs text-text-primary">
                        @{lead.display_name || lead.platform_handle}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="rounded bg-base-3 px-2 py-0.5 text-[10px] font-mono text-text-secondary">
                        {lead.stage}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {lead.needs_human ? (
                        <span className="flex items-center gap-1 text-[10px] text-amber-400">
                          <AlertTriangle size={10} />
                          needs human
                        </span>
                      ) : (
                        <span className="text-[10px] text-emerald-400">active</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Needs Human Card ─────────────────────────────────────────────────

function NeedsHumanCard({
  lead,
  stages,
  onResolved,
}: {
  lead: Lead;
  stages: string[];
  onResolved: () => void;
}) {
  const [resolving, setResolving] = useState(false);
  const [selectedStage, setSelectedStage] = useState(stages[0] || "new");
  const [loading, setLoading] = useState(false);

  const handleResolve = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: selectedStage }),
      });
      if (res.ok) onResolved();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
      <div className="flex items-start gap-3">
        <User size={14} className="mt-0.5 shrink-0 text-amber-400" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-text-primary">
              @{lead.display_name || lead.platform_handle}
            </p>
            {!resolving && (
              <button
                onClick={() => setResolving(true)}
                className="rounded-md bg-amber-500/15 px-2.5 py-1 text-[10px] font-semibold text-amber-400 transition-colors hover:bg-amber-500/25"
              >
                Resolve
              </button>
            )}
          </div>
          {lead.needs_human_reason && (
            <p className="mt-0.5 text-[11px] text-amber-300/70 leading-relaxed">
              {lead.needs_human_reason}
            </p>
          )}

          {/* Resolve form */}
          {resolving && (
            <div className="mt-3 flex items-center gap-2">
              <select
                value={selectedStage}
                onChange={(e) => setSelectedStage(e.target.value)}
                className="rounded-md border border-amber-500/30 bg-base-1 px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-amber-400/50"
              >
                {stages.length > 0 ? (
                  stages.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="new">new</option>
                    <option value="replied">replied</option>
                    <option value="engaged">engaged</option>
                    <option value="converted">converted</option>
                  </>
                )}
              </select>
              <button
                onClick={handleResolve}
                disabled={loading}
                className="flex items-center gap-1 rounded-md bg-emerald-500/20 px-2.5 py-1.5 text-[10px] font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/30 disabled:opacity-50"
              >
                {loading ? (
                  <RefreshCw size={10} className="animate-spin" />
                ) : (
                  <Check size={10} />
                )}
                Confirm
              </button>
              <button
                onClick={() => setResolving(false)}
                className="rounded-md px-2 py-1.5 text-[10px] text-text-muted hover:text-text-secondary"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Outbox Card ──────────────────────────────────────────────────────

function OutboxCard({
  item,
  categories,
  templates,
  loading,
  onApprove,
  onReject,
}: {
  item: OutboxItem;
  categories: Category[];
  templates: Template[];
  loading: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const payload = JSON.parse(item.payload_json);
  const inferenceResult: InferenceResult | null = payload.inference_result;
  const matchedCategory = inferenceResult
    ? categories.find((c) => c.name === inferenceResult.detected_status)
    : null;
  const statusColor = matchedCategory?.color || "#6366f1";
  const template = payload.template_id
    ? templates.find((t) => t.id === payload.template_id)
    : null;

  return (
    <div className="overflow-hidden rounded-xl border border-accent/20 bg-gradient-to-br from-accent/5 via-transparent to-violet/5">
      <div className="p-4">
        {/* Lead info */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User size={13} className="text-text-muted" />
            <span className="text-xs font-medium text-text-primary">
              @{item.lead_display_name || item.lead_platform_handle}
            </span>
          </div>
          <span className="text-[10px] text-text-muted">
            {new Date(item.created_at).toLocaleString()}
          </span>
        </div>

        {/* Classification */}
        {inferenceResult && (
          <>
            <div className="mb-2 flex items-center gap-2">
              <div
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: statusColor, boxShadow: `0 0 6px ${statusColor}60` }}
              />
              <span className="font-mono text-xs font-semibold" style={{ color: statusColor }}>
                {inferenceResult.detected_status}
              </span>
            </div>
            <p className="mb-3 text-[11px] leading-relaxed text-text-secondary">
              {inferenceResult.reasoning}
            </p>
          </>
        )}

        {/* Proposed message */}
        <div className="rounded-lg border border-accent/15 bg-accent/5 p-3">
          <div className="mb-1.5 flex items-center gap-1.5">
            <MessageSquare size={12} className="text-accent" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-accent">
              {template ? template.name : "Message to send"}
            </span>
          </div>
          <p className="text-[11px] leading-relaxed text-text-primary">
            {payload.text}
          </p>
        </div>

        {/* Actions */}
        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            onClick={onReject}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-50"
          >
            <X size={12} />
            Reject
          </button>
          <button
            onClick={onApprove}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/30 disabled:opacity-50"
          >
            {loading ? (
              <RefreshCw size={12} className="animate-spin" />
            ) : (
              <Check size={12} />
            )}
            Approve & Send
          </button>
        </div>
      </div>
    </div>
  );
}
