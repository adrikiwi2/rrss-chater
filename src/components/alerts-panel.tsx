"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Bell,
  BellOff,
  MessageSquare,
  Zap,
  AlertTriangle,
  User,
  CheckCircle,
  XCircle,
  RefreshCw,
  Radio,
} from "lucide-react";

interface AlertRule {
  id: string;
  event_type: string;
  conditions: string | null;
  template: string;
  is_active: number;
  dest_name: string;
  provider: string;
  destination_id: string;
}

interface AlertDestination {
  id: string;
  name: string;
  provider: string;
  config: string;
  is_active: number;
}

interface AlertLog {
  id: string;
  rule_id: string;
  status: string;
  payload: string | null;
  created_at: string;
  event_type: string;
  dest_name: string;
}

interface AlertsPanelProps {
  flowId: string;
  fireAlerts: boolean;
  onToggleAlerts: (value: boolean) => void;
}

const EVENT_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  "inference.executed": { label: "Inference", icon: Zap, color: "text-violet-400" },
  "message.sent": { label: "Message Sent", icon: MessageSquare, color: "text-blue-400" },
  "needs_human": { label: "Needs Human", icon: AlertTriangle, color: "text-amber-400" },
  "lead.qualified": { label: "Lead Qualified", icon: User, color: "text-green-400" },
  "message.received": { label: "Message Received", icon: Radio, color: "text-text-muted" },
};

export function AlertsPanel({ flowId, fireAlerts, onToggleAlerts }: AlertsPanelProps) {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [destinations, setDestinations] = useState<AlertDestination[]>([]);
  const [logs, setLogs] = useState<AlertLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await fetch(`/api/flows/${flowId}/alerts`);
      if (res.ok) {
        const data = await res.json();
        setRules(data.rules ?? []);
        setDestinations(data.destinations ?? []);
        setLogs(data.logs ?? []);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [flowId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Group rules by event_type
  const rulesByEvent = rules.reduce<Record<string, AlertRule[]>>((acc, r) => {
    if (!acc[r.event_type]) acc[r.event_type] = [];
    acc[r.event_type].push(r);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* ── Simulation Alerts Toggle ── */}
      <section className="rounded-xl border border-border bg-base-1 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">Simulation Alerts</h3>
            <p className="mt-1 text-xs text-text-muted leading-relaxed">
              When enabled, each inference from the Simulate tab fires real alert rules —
              useful for testing the notification pipeline.
              Lead name will appear as <span className="font-mono text-accent">🧪 Simulación</span>.
            </p>
          </div>
          <button
            onClick={() => onToggleAlerts(!fireAlerts)}
            className={`flex cursor-pointer flex-shrink-0 items-center gap-2 rounded-lg border px-4 py-2 text-xs font-semibold transition-all ${
              fireAlerts
                ? "border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                : "border-border-bright bg-base-2 text-text-muted hover:border-accent/30 hover:text-text-secondary"
            }`}
          >
            {fireAlerts ? <Bell size={13} /> : <BellOff size={13} />}
            {fireAlerts ? "ON" : "OFF"}
          </button>
        </div>
      </section>

      {/* ── Active Rules ── */}
      <section className="rounded-xl border border-border bg-base-1 overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-text-muted">
            Alert Rules
          </h3>
          <span className="rounded-full bg-base-2 px-2 py-0.5 text-[10px] font-medium text-text-muted">
            {rules.length} rule{rules.length !== 1 ? "s" : ""}
          </span>
        </div>

        {rules.length === 0 ? (
          <div className="px-5 py-8 text-center text-xs text-text-muted">
            No alert rules configured for this flow.
            <br />
            <span className="text-[11px] opacity-60">Contact an admin to add rules.</span>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {Object.entries(rulesByEvent).map(([eventType, eventRules]) => {
              const meta = EVENT_META[eventType] ?? { label: eventType, icon: Bell, color: "text-text-muted" };
              const Icon = meta.icon;
              return (
                <div key={eventType} className="px-5 py-3.5">
                  <div className="mb-2.5 flex items-center gap-2">
                    <Icon size={13} className={meta.color} />
                    <span className={`text-xs font-semibold ${meta.color}`}>{meta.label}</span>
                    <span className="font-mono text-[10px] text-text-muted">{eventType}</span>
                  </div>
                  <div className="space-y-2 pl-5">
                    {eventRules.map((rule) => {
                      const dest = destinations.find((d) => d.id === rule.destination_id);
                      let conditionLabel = "";
                      if (rule.conditions) {
                        try {
                          const c = JSON.parse(rule.conditions) as { field: string; op: string; value: string };
                          conditionLabel = `if ${c.field} ${c.op} "${c.value}"`;
                        } catch {
                          conditionLabel = "custom condition";
                        }
                      }
                      return (
                        <div
                          key={rule.id}
                          className="flex items-start justify-between gap-3 rounded-lg border border-border bg-base-0 px-3 py-2.5"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-text-primary">
                                → {rule.dest_name}
                              </span>
                              {!rule.is_active && (
                                <span className="rounded-full bg-base-3 px-1.5 py-0.5 text-[9px] text-text-muted">
                                  inactive
                                </span>
                              )}
                            </div>
                            {conditionLabel && (
                              <p className="mt-0.5 font-mono text-[10px] text-text-muted">
                                {conditionLabel}
                              </p>
                            )}
                            <p className="mt-1 truncate font-mono text-[10px] text-text-muted opacity-70">
                              {rule.template.length > 80
                                ? rule.template.slice(0, 80) + "…"
                                : rule.template}
                            </p>
                          </div>
                          <div className="flex flex-shrink-0 items-center gap-1.5">
                            <span className="rounded-full border border-border px-2 py-0.5 text-[9px] font-medium text-text-muted uppercase">
                              {dest?.provider ?? rule.provider}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Destinations ── */}
      <section className="rounded-xl border border-border bg-base-1 overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-text-muted">
            Destinations
          </h3>
          <span className="rounded-full bg-base-2 px-2 py-0.5 text-[10px] font-medium text-text-muted">
            {destinations.length}
          </span>
        </div>

        {destinations.length === 0 ? (
          <div className="px-5 py-8 text-center text-xs text-text-muted">
            No destinations configured for this tenant.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {destinations.map((dest) => (
              <div key={dest.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`h-1.5 w-1.5 rounded-full ${
                      dest.is_active ? "bg-green-400" : "bg-base-3"
                    }`}
                  />
                  <span className="text-xs font-medium text-text-primary">{dest.name}</span>
                </div>
                <span className="rounded-full border border-border px-2 py-0.5 text-[9px] font-medium text-text-muted uppercase">
                  {dest.provider}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Recent Logs ── */}
      <section className="rounded-xl border border-border bg-base-1 overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-text-muted">
            Recent Logs
          </h3>
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-[10px] text-text-muted transition-all hover:text-accent disabled:opacity-40"
          >
            <RefreshCw size={11} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {logs.length === 0 ? (
          <div className="px-5 py-8 text-center text-xs text-text-muted">
            No alert logs yet. Run an inference with Alerts ON to test the pipeline.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {logs.map((log) => {
              const meta = EVENT_META[log.event_type] ?? { label: log.event_type, icon: Bell, color: "text-text-muted" };
              const Icon = meta.icon;
              const isSuccess = log.status === "success";
              const date = new Date(log.created_at);
              const timeLabel = date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
              const dateLabel = date.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" });

              return (
                <div key={log.id} className="flex items-center gap-3 px-5 py-2.5">
                  {isSuccess ? (
                    <CheckCircle size={13} className="flex-shrink-0 text-green-400" />
                  ) : (
                    <XCircle size={13} className="flex-shrink-0 text-red-400" />
                  )}
                  <Icon size={12} className={`flex-shrink-0 ${meta.color}`} />
                  <div className="min-w-0 flex-1">
                    <span className="text-xs text-text-primary">{meta.label}</span>
                    <span className="mx-1.5 text-text-muted">→</span>
                    <span className="text-xs text-text-secondary">{log.dest_name}</span>
                    {!isSuccess && log.payload && (() => {
                      try {
                        const p = JSON.parse(log.payload) as { error?: string };
                        return p.error ? (
                          <span className="ml-2 font-mono text-[10px] text-red-400 opacity-80">
                            {p.error.slice(0, 60)}
                          </span>
                        ) : null;
                      } catch { return null; }
                    })()}
                  </div>
                  <span className="flex-shrink-0 text-[10px] text-text-muted">
                    {dateLabel} {timeLabel}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
