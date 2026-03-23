"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Clock, CheckCircle2, XCircle, Inbox } from "lucide-react";
import { FlowDesigner } from "@/components/flow-designer";
import { SimulationPanel } from "@/components/simulation-panel";
import { LivePanel } from "@/components/live-panel";
import { AlertsPanel } from "@/components/alerts-panel";
import { AgentConfigPanel } from "@/components/agent-config-panel";
import { OverviewPanel } from "@/components/overview-panel";
import type { FlowWithDetails } from "@/lib/types";

type Section = "overview" | "outbox" | "simulate" | "design" | "logs" | "config";

function FlowPageInner() {
  const { flowId } = useParams<{ flowId: string }>();
  const searchParams = useSearchParams();
  const section = (searchParams.get("s") as Section) || "outbox";

  const [flow, setFlow] = useState<FlowWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [roleA, setRoleA] = useState("");
  const [roleB, setRoleB] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [fireAlerts, setFireAlerts] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(`flowlab_sim_alerts_${flowId}`) === "true";
  });

  const handleToggleAlerts = (value: boolean) => {
    setFireAlerts(value);
    localStorage.setItem(`flowlab_sim_alerts_${flowId}`, String(value));
  };

  const fetchFlow = useCallback(async () => {
    const res = await fetch(`/api/flows/${flowId}`);
    if (!res.ok) return;
    const data: FlowWithDetails = await res.json();
    setFlow(data);
    setRoleA(data.role_a_label);
    setRoleB(data.role_b_label);
    setSystemPrompt(data.system_prompt);
    setLoading(false);
  }, [flowId]);

  useEffect(() => {
    fetchFlow();
  }, [fetchFlow]);

  const saveField = async (field: string, value: string) => {
    await fetch(`/api/flows/${flowId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
  };

  const handleTogglePublish = async (published: boolean) => {
    const res = await fetch(`/api/flows/${flowId}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published }),
    });
    if (res.ok) fetchFlow();
  };

  if (loading || !flow) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in flex h-full flex-col">
      {/* Minimal header */}
      <div className="flex flex-shrink-0 items-center justify-between border-b border-border px-6 py-3">
        <h1 className="text-sm font-semibold text-text-primary">{flow.name}</h1>
        {flow.is_published && (
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-medium text-emerald-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            Live
          </span>
        )}
      </div>

      {/* Section content */}
      <div className={`min-h-0 flex-1 ${section === "simulate" ? "overflow-hidden" : "overflow-y-auto"}`}>
        {section === "overview" && (
          <div className="p-6">
            <OverviewPanel flowId={flowId} />
          </div>
        )}

        {section === "outbox" && (
          <div className="p-6">
            <OutboxSection flowId={flowId} />
          </div>
        )}

        {section === "simulate" && (
          <div className="h-full">
            <SimulationPanel
              flowId={flowId}
              roleALabel={roleA || "Company"}
              roleBLabel={roleB || "Prospect"}
              categories={flow.categories}
              templates={flow.templates}
              fireAlerts={fireAlerts}
              onToggleAlerts={handleToggleAlerts}
            />
          </div>
        )}

        {section === "design" && (
          <div className="p-6">
            <FlowDesigner
              flowId={flowId}
              categories={flow.categories}
              extractFields={flow.extract_fields}
              templates={flow.templates}
              knowledgeDocs={flow.knowledge_docs}
              variables={flow.variables ?? []}
              onUpdate={fetchFlow}
            />
          </div>
        )}

        {section === "logs" && (
          <div className="p-6">
            <AlertsPanel
              flowId={flowId}
              fireAlerts={fireAlerts}
              onToggleAlerts={handleToggleAlerts}
            />
          </div>
        )}

        {section === "config" && (
          <div className="p-6">
            <div className="max-w-2xl space-y-6">
              {/* Role labels + system prompt */}
              <div className="rounded-lg border border-border bg-base-0 p-5">
                <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-text-muted">
                  Configuración del flow
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-text-muted">
                      Role A Label
                    </label>
                    <input
                      value={roleA}
                      onChange={(e) => setRoleA(e.target.value)}
                      onBlur={() =>
                        roleA !== flow.role_a_label &&
                        saveField("role_a_label", roleA)
                      }
                      className="w-full rounded-md border border-border bg-base-1 px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-accent/40"
                      placeholder="Company"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-text-muted">
                      Role B Label
                    </label>
                    <input
                      value={roleB}
                      onChange={(e) => setRoleB(e.target.value)}
                      onBlur={() =>
                        roleB !== flow.role_b_label &&
                        saveField("role_b_label", roleB)
                      }
                      className="w-full rounded-md border border-border bg-base-1 px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-accent/40"
                      placeholder="Prospect"
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-text-muted">
                    System Prompt
                  </label>
                  <textarea
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    onBlur={() =>
                      systemPrompt !== flow.system_prompt &&
                      saveField("system_prompt", systemPrompt)
                    }
                    rows={8}
                    className="w-full resize-none rounded-md border border-border bg-base-1 px-3 py-2 font-mono text-xs leading-relaxed text-text-primary outline-none transition-colors focus:border-accent/40"
                    placeholder="You are an intelligent conversation router..."
                  />
                </div>
              </div>

              {/* Publish toggle */}
              <div className="rounded-lg border border-border bg-base-0 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-text-primary">
                      Estado del flow
                    </p>
                    <p className="mt-0.5 text-xs text-text-muted">
                      {flow.is_published
                        ? "Live — procesando conversaciones reales"
                        : "Solo simulación"}
                    </p>
                  </div>
                  <button
                    onClick={() => handleTogglePublish(!flow.is_published)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                      flow.is_published
                        ? "border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                        : "border-emerald-500/30 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"
                    }`}
                  >
                    {flow.is_published ? "Unpublish" : "Go Live"}
                  </button>
                </div>
              </div>

              {/* Agent config (read-only) */}
              {flow.agent_config && (
                <div className="rounded-lg border border-border bg-base-0 p-5">
                  <AgentConfigPanel configJson={flow.agent_config} />
                </div>
              )}
            </div>

            {/* Live panel for Instagram connection */}
            <div className="mt-6 max-w-2xl">
              <LivePanel
                flowId={flowId}
                isPublished={!!flow.is_published}
                onTogglePublish={handleTogglePublish}
                categories={flow.categories}
                templates={flow.templates}
                agentConfig={flow.agent_config}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Outbox Section ──────────────────────────── */

interface OutboxItem {
  id: string;
  lead_id: string;
  channel: string;
  action: string;
  payload_json: string;
  status: string;
  created_at: string;
}

function OutboxSection({ flowId }: { flowId: string }) {
  const [items, setItems] = useState<OutboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const fetchOutbox = useCallback(async () => {
    const res = await fetch(`/api/outbox?flow_id=${flowId}`);
    if (res.ok) setItems(await res.json());
    setLoading(false);
  }, [flowId]);

  useEffect(() => { fetchOutbox(); }, [fetchOutbox]);

  const act = async (id: string, action: "approve" | "reject") => {
    setActing(id);
    await fetch(`/api/outbox/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    await fetchOutbox();
    setActing(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-4">
      {/* Disclaimer banner */}
      <div className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${
        items.length > 0
          ? "border-amber-500/30 bg-amber-500/10"
          : "border-border bg-base-1"
      }`}>
        <Inbox size={15} className={items.length > 0 ? "text-amber-400" : "text-text-muted"} />
        <p className={`text-sm font-medium ${items.length > 0 ? "text-amber-300" : "text-text-muted"}`}>
          {items.length > 0
            ? `${items.length} mensaje${items.length > 1 ? "s" : ""} pendiente${items.length > 1 ? "s" : ""} de aprobación`
            : "Sin mensajes pendientes"}
        </p>
      </div>

      {/* Items */}
      {items.length > 0 && (
        <div className="space-y-3">
          {items.map((item) => {
            const payload = JSON.parse(item.payload_json) as {
              text?: string;
              template_name?: string;
              generated?: boolean;
              inference_result?: { detected_status?: string };
            };
            return (
              <div key={item.id} className="rounded-lg border border-border bg-base-0 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Clock size={12} className="text-amber-400" />
                  <span className="text-[11px] font-medium uppercase tracking-widest text-amber-400">
                    Pendiente
                  </span>
                  {payload.template_name && (
                    <span className="ml-auto rounded-full border border-border bg-base-2 px-2 py-0.5 text-[10px] text-text-muted">
                      {payload.template_name}
                    </span>
                  )}
                  {payload.generated && (
                    <span className="ml-auto rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-400">
                      AI generado
                    </span>
                  )}
                  {payload.inference_result?.detected_status && (
                    <span className="rounded-full border border-border bg-base-2 px-2 py-0.5 text-[10px] text-text-muted">
                      {payload.inference_result.detected_status}
                    </span>
                  )}
                </div>
                <p className="mb-4 text-sm leading-relaxed text-text-primary">
                  {payload.text || "—"}
                </p>
                <div className="flex gap-2">
                  <button
                    disabled={acting === item.id}
                    onClick={() => act(item.id, "approve")}
                    className="flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400 transition-all hover:bg-emerald-500/20 disabled:opacity-50"
                  >
                    <CheckCircle2 size={12} />
                    Aprobar y enviar
                  </button>
                  <button
                    disabled={acting === item.id}
                    onClick={() => act(item.id, "reject")}
                    className="flex items-center gap-1.5 rounded-md border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 transition-all hover:bg-red-500/20 disabled:opacity-50"
                  >
                    <XCircle size={12} />
                    Rechazar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function FlowPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
        </div>
      }
    >
      <FlowPageInner />
    </Suspense>
  );
}
