"use client";

import { useEffect, useState } from "react";
import { Users, MessageSquare, AlertTriangle, Activity } from "lucide-react";
import type { Lead } from "@/lib/db";

interface OverviewData {
  leads: Lead[];
  stages: string[];
  heatmap: Record<string, Record<string, number>>;
  stats: {
    total_leads: number;
    needs_human: number;
    active: number;
    total_messages: number;
  };
}

const DOW_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const HOUR_LABELS = Array.from({ length: 24 }, (_, i) =>
  i === 0 ? "12a" : i < 12 ? `${i}a` : i === 12 ? "12p" : `${i - 12}p`
);

function stageColor(stage: string): string {
  const map: Record<string, string> = {
    new: "bg-zinc-700 text-zinc-300",
    outreach_sent: "bg-blue-500/15 text-blue-400",
    replied: "bg-violet-500/15 text-violet-400",
    engaged: "bg-amber-500/15 text-amber-400",
    converted: "bg-emerald-500/15 text-emerald-400",
    needs_human: "bg-red-500/15 text-red-400",
  };
  return map[stage] ?? "bg-zinc-700/50 text-zinc-400";
}

function LeadCard({ lead }: { lead: Lead }) {
  const initials = (lead.display_name || lead.platform_handle)
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="group flex cursor-default flex-col gap-2 rounded-lg border border-border bg-base-1 p-3 transition-colors hover:border-border-bright hover:bg-base-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-accent/15 text-[10px] font-semibold text-accent">
            {initials}
          </div>
          <span className="truncate text-xs font-medium text-text-primary">
            {lead.display_name || lead.platform_handle}
          </span>
        </div>
        {!!lead.needs_human && (
          <span className="flex-shrink-0 rounded-full bg-red-500/15 px-1.5 py-0.5 text-[9px] font-medium text-red-400">
            HUM
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <span className="text-[9px] font-medium uppercase tracking-wide text-text-muted">
          {lead.channel}
        </span>
        <span className="text-text-muted">·</span>
        <span className="truncate text-[9px] text-text-muted">
          @{lead.platform_handle}
        </span>
      </div>
    </div>
  );
}

function KanbanBoard({
  leads,
  stages,
}: {
  leads: Lead[];
  stages: string[];
}) {
  const byStage: Record<string, Lead[]> = {};
  for (const s of stages) byStage[s] = [];
  for (const lead of leads) {
    const s = lead.stage && byStage[lead.stage] !== undefined ? lead.stage : stages[0];
    byStage[s]?.push(lead);
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {stages.map((stage) => {
        const items = byStage[stage] ?? [];
        return (
          <div key={stage} className="flex w-52 flex-shrink-0 flex-col gap-2">
            {/* Column header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${stageColor(stage)}`}
                >
                  {stage.replace(/_/g, " ")}
                </span>
              </div>
              <span className="text-[10px] font-medium text-text-muted">
                {items.length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex flex-col gap-1.5">
              {items.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border py-4 text-center">
                  <span className="text-[11px] text-text-muted">Sin leads</span>
                </div>
              ) : (
                items.map((lead) => <LeadCard key={lead.id} lead={lead} />)
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Heatmap({
  heatmap,
}: {
  heatmap: Record<string, Record<string, number>>;
}) {
  // Find max value for color scaling
  let maxVal = 0;
  for (const dow of Object.values(heatmap)) {
    for (const cnt of Object.values(dow)) {
      if (cnt > maxVal) maxVal = cnt;
    }
  }

  function cellOpacity(val: number): string {
    if (!val || maxVal === 0) return "bg-base-3";
    const pct = val / maxVal;
    if (pct < 0.2) return "bg-accent/15";
    if (pct < 0.4) return "bg-accent/30";
    if (pct < 0.6) return "bg-accent/50";
    if (pct < 0.8) return "bg-accent/70";
    return "bg-accent";
  }

  // Show hours 0-23 across the top, days down the side
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const dows = [1, 2, 3, 4, 5, 6, 0]; // Mon–Sun

  return (
    <div className="overflow-x-auto">
      <div className="inline-block min-w-full">
        {/* Hour labels */}
        <div className="mb-1 flex">
          <div className="w-8 flex-shrink-0" />
          {hours.map((h) => (
            <div
              key={h}
              className="w-[22px] flex-shrink-0 text-center text-[8px] text-text-muted"
            >
              {h % 4 === 0 ? HOUR_LABELS[h] : ""}
            </div>
          ))}
        </div>

        {/* Rows */}
        {dows.map((dow) => (
          <div key={dow} className="mb-1 flex items-center">
            <div className="w-8 flex-shrink-0 text-[9px] text-text-muted">
              {DOW_LABELS[dow]}
            </div>
            {hours.map((h) => {
              const val = heatmap[String(dow)]?.[String(h)] ?? 0;
              return (
                <div
                  key={h}
                  title={val ? `${DOW_LABELS[dow]} ${HOUR_LABELS[h]}: ${val} msgs` : undefined}
                  className={`mr-0.5 h-4 w-[20px] flex-shrink-0 rounded-[3px] transition-colors ${cellOpacity(val)}`}
                />
              );
            })}
          </div>
        ))}

        {/* Legend */}
        <div className="mt-2 flex items-center gap-1">
          <span className="text-[9px] text-text-muted">Menos</span>
          {["bg-base-3", "bg-accent/15", "bg-accent/30", "bg-accent/50", "bg-accent/70", "bg-accent"].map(
            (cls, i) => (
              <div key={i} className={`h-3 w-3 rounded-[2px] ${cls}`} />
            )
          )}
          <span className="text-[9px] text-text-muted">Más</span>
        </div>
      </div>
    </div>
  );
}

export function OverviewPanel({ flowId }: { flowId: string }) {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/flows/${flowId}/overview`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [flowId]);

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
      </div>
    );
  }

  if (!data) {
    return (
      <p className="text-sm text-text-muted">Error cargando el overview.</p>
    );
  }

  const kpis = [
    {
      icon: Users,
      label: "Leads totales",
      value: data.stats.total_leads,
      color: "text-accent",
    },
    {
      icon: Activity,
      label: "Activos",
      value: data.stats.active,
      color: "text-emerald-400",
    },
    {
      icon: AlertTriangle,
      label: "Needs human",
      value: data.stats.needs_human,
      color: "text-red-400",
    },
    {
      icon: MessageSquare,
      label: "Mensajes",
      value: data.stats.total_messages,
      color: "text-violet-400",
    },
  ];

  return (
    <div className="animate-fade-in space-y-8">
      {/* KPI bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpis.map(({ icon: Icon, label, value, color }) => (
          <div
            key={label}
            className="rounded-lg border border-border bg-base-1 p-4"
          >
            <div className="flex items-center gap-2">
              <Icon className={`h-3.5 w-3.5 ${color}`} />
              <span className="text-[10px] font-medium uppercase tracking-widest text-text-muted">
                {label}
              </span>
            </div>
            <p className={`mt-2 text-2xl font-semibold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Kanban */}
      <div>
        <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-text-muted">
          Pipeline de leads
        </h2>
        {data.leads.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-10 text-center">
            <p className="text-sm text-text-muted">
              No hay leads en este flow aún.
            </p>
          </div>
        ) : (
          <KanbanBoard leads={data.leads} stages={data.stages} />
        )}
      </div>

      {/* Heatmap */}
      <div>
        <h2 className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-text-muted">
          Actividad por día y hora
        </h2>
        <p className="mb-3 text-[11px] text-text-muted">
          Mensajes inbound según hora y día de la semana
        </p>
        {data.stats.total_messages === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-10 text-center">
            <p className="text-sm text-text-muted">
              Sin datos de mensajes aún.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-base-1 p-5">
            <Heatmap heatmap={data.heatmap} />
          </div>
        )}
      </div>
    </div>
  );
}
