"use client";

import { useEffect, useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Plus,
  GitBranch,
  ChevronRight,
  Activity,
  LogOut,
  User,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import type { Flow } from "@/lib/types";

type FlowSummary = Flow & {
  category_count: number;
  simulation_count: number;
};

interface TenantInfo {
  id: string;
  name: string;
  email: string;
}

export function Sidebar() {
  const [flows, setFlows] = useState<FlowSummary[]>([]);
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [collapsed, setCollapsed] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  const activeFlowId =
    pathname.startsWith("/flow/") ? pathname.split("/")[2] : null;

  const fetchFlows = useCallback(async () => {
    const res = await fetch("/api/flows");
    if (res.ok) {
      const data = await res.json();
      setFlows(data);
    }
  }, []);

  const fetchTenant = useCallback(async () => {
    const res = await fetch("/api/auth/me");
    if (res.ok) {
      const data = await res.json();
      setTenant(data);
    }
  }, []);

  useEffect(() => {
    fetchFlows();
    fetchTenant();
  }, [fetchFlows, fetchTenant, pathname]);

  const createFlow = async () => {
    setIsCreating(true);
    try {
      const res = await fetch("/api/flows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Untitled Flow" }),
      });
      const flow = await res.json();
      await fetchFlows();
      router.push(`/flow/${flow.id}`);
    } finally {
      setIsCreating(false);
    }
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  if (collapsed) {
    return (
      <aside className="flex h-screen w-[52px] flex-shrink-0 flex-col items-center border-r border-border bg-base-1 py-3">
        {/* Brand icon */}
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15">
          <Activity size={16} className="text-accent" />
        </div>

        {/* Expand button */}
        <button
          onClick={() => setCollapsed(false)}
          className="mt-3 rounded-md p-1.5 text-text-muted transition-colors hover:bg-base-2 hover:text-text-secondary"
          title="Expand sidebar"
        >
          <PanelLeftOpen size={16} />
        </button>

        {/* New flow */}
        <button
          onClick={createFlow}
          disabled={isCreating}
          className="mt-2 rounded-md p-1.5 text-text-muted transition-colors hover:bg-accent/10 hover:text-accent disabled:opacity-50"
          title="New Flow"
        >
          <Plus size={16} />
        </button>

        {/* Flow icons */}
        <nav className="mt-2 flex flex-1 flex-col items-center gap-1 overflow-y-auto">
          {flows.map((flow) => {
            const isActive = flow.id === activeFlowId;
            return (
              <button
                key={flow.id}
                onClick={() => router.push(`/flow/${flow.id}`)}
                className={`rounded-md p-1.5 transition-all ${
                  isActive
                    ? "bg-accent/10 text-accent"
                    : "text-text-muted hover:bg-base-2 hover:text-text-secondary"
                }`}
                title={flow.name}
              >
                <GitBranch size={15} />
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="mt-auto flex flex-col items-center gap-1 pt-2">
          {tenant && (
            <div
              className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/10"
              title={`${tenant.name} (${tenant.email})`}
            >
              <User size={13} className="text-accent" />
            </div>
          )}
          <button
            onClick={logout}
            className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-base-2 hover:text-text-secondary"
            title="Sign out"
          >
            <LogOut size={13} />
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex h-screen w-[260px] flex-shrink-0 flex-col border-r border-border bg-base-1">
      {/* Brand */}
      <div className="flex items-center gap-2.5 border-b border-border px-5 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15">
          <Activity size={16} className="text-accent" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-bold tracking-tight text-text-primary">
            FlowLab
          </h1>
          <p className="text-[10px] font-medium uppercase tracking-widest text-text-muted">
            Conversation Router
          </p>
        </div>
        <button
          onClick={() => setCollapsed(true)}
          className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-base-2 hover:text-text-secondary"
          title="Collapse sidebar"
        >
          <PanelLeftClose size={16} />
        </button>
      </div>

      {/* New Flow */}
      <div className="px-3 pt-3">
        <button
          onClick={createFlow}
          disabled={isCreating}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border-bright px-3 py-2 text-xs font-medium text-text-secondary transition-all hover:border-accent/40 hover:bg-accent-glow hover:text-accent disabled:opacity-50"
        >
          <Plus size={14} />
          New Flow
        </button>
      </div>

      {/* Flow List */}
      <nav className="mt-2 flex-1 overflow-y-auto px-2 pb-4">
        {flows.length === 0 && (
          <p className="px-3 py-6 text-center text-xs text-text-muted">
            No flows yet
          </p>
        )}
        {flows.map((flow) => {
          const isActive = flow.id === activeFlowId;
          return (
            <button
              key={flow.id}
              onClick={() => router.push(`/flow/${flow.id}`)}
              className={`group mb-0.5 flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition-all ${
                isActive
                  ? "bg-accent/10 text-text-primary"
                  : "text-text-secondary hover:bg-base-2 hover:text-text-primary"
              }`}
            >
              <GitBranch
                size={14}
                className={`flex-shrink-0 ${isActive ? "text-accent" : "text-text-muted group-hover:text-text-secondary"}`}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium">{flow.name}</p>
                {flow.description && (
                  <p className="truncate text-[10px] text-text-secondary">
                    {flow.description}
                  </p>
                )}
                <p className="text-[10px] text-text-muted">
                  {flow.category_count} categories · {flow.simulation_count} sims
                </p>
              </div>
              <ChevronRight
                size={12}
                className={`flex-shrink-0 transition-transform ${
                  isActive
                    ? "text-accent"
                    : "text-transparent group-hover:text-text-muted"
                }`}
              />
            </button>
          );
        })}
      </nav>

      {/* Footer with tenant info */}
      <div className="border-t border-border px-3 py-3">
        {tenant ? (
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-accent/10">
              <User size={13} className="text-accent" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-text-primary">
                {tenant.name}
              </p>
              <p className="truncate text-[10px] text-text-muted">
                {tenant.email}
              </p>
            </div>
            <button
              onClick={logout}
              className="flex-shrink-0 rounded-md p-1.5 text-text-muted transition-colors hover:bg-base-2 hover:text-text-secondary"
              title="Sign out"
            >
              <LogOut size={13} />
            </button>
          </div>
        ) : (
          <p className="text-center text-[10px] font-medium uppercase tracking-widest text-text-muted">
            {flows.length} flow{flows.length !== 1 ? "s" : ""}
          </p>
        )}
      </div>
    </aside>
  );
}
