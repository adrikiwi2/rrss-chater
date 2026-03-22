"use client";

import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Activity,
  Plus,
  ChevronDown,
  LogOut,
  User,
  Sun,
  Moon,
  LayoutDashboard,
  MessageSquare,
  Layers,
  ScrollText,
  Settings2,
  GitBranch,
  PanelLeftClose,
  PanelLeftOpen,
  Check,
} from "lucide-react";
import type { Flow } from "@/lib/types";

const SECTIONS = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "conversation", label: "Conversación", icon: MessageSquare },
  { key: "design", label: "Diseño", icon: Layers },
  { key: "logs", label: "Logs", icon: ScrollText },
  { key: "config", label: "Config", icon: Settings2 },
] as const;

type SectionKey = (typeof SECTIONS)[number]["key"];

type FlowSummary = Flow & {
  category_count: number;
  simulation_count: number;
};

interface TenantInfo {
  id: string;
  name: string;
  email: string;
}

function SidebarInner() {
  const [flows, setFlows] = useState<FlowSummary[]>([]);
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [collapsed, setCollapsed] = useState(true);
  const [flowDropdownOpen, setFlowDropdownOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  const pathParts = pathname.split("/");
  const activeFlowId =
    pathParts[1] === "flow" && pathParts[2] ? pathParts[2] : null;
  const activeSection = (searchParams.get("s") as SectionKey) || "conversation";
  const activeFlow = flows.find((f) => f.id === activeFlowId);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setFlowDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const fetchFlows = useCallback(async () => {
    const res = await fetch("/api/flows");
    if (res.ok) setFlows(await res.json());
  }, []);

  const fetchTenant = useCallback(async () => {
    const res = await fetch("/api/auth/me");
    if (res.ok) setTenant(await res.json());
  }, []);

  useEffect(() => {
    fetchFlows();
    fetchTenant();
  }, [fetchFlows, fetchTenant, pathname]);

  const navigateToSection = (section: SectionKey) => {
    if (!activeFlowId) return;
    router.push(`/flow/${activeFlowId}?s=${section}`);
  };

  const navigateToFlow = (flowId: string) => {
    setFlowDropdownOpen(false);
    router.push(`/flow/${flowId}?s=${activeSection}`);
  };

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
      router.push(`/flow/${flow.id}?s=conversation`);
    } finally {
      setIsCreating(false);
    }
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  // Collapsed sidebar
  if (collapsed) {
    return (
      <aside className="flex h-screen w-[52px] flex-shrink-0 flex-col items-center border-r border-border bg-base-1 py-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/15">
          <Activity size={14} className="text-accent" />
        </div>
        <button
          onClick={() => setCollapsed(false)}
          className="mt-3 rounded-md p-1.5 text-text-muted transition-colors hover:bg-base-2 hover:text-text-secondary"
          title="Expand sidebar"
        >
          <PanelLeftOpen size={15} />
        </button>
        <nav className="mt-3 flex flex-1 flex-col items-center gap-0.5">
          {SECTIONS.map(({ key, icon: Icon }) => {
            const isActive = activeSection === key && !!activeFlowId;
            return (
              <button
                key={key}
                onClick={() => navigateToSection(key)}
                disabled={!activeFlowId}
                title={key}
                className={`rounded-md p-1.5 transition-colors disabled:opacity-30 ${
                  isActive
                    ? "bg-accent/10 text-accent"
                    : "text-text-muted hover:bg-base-2 hover:text-text-secondary"
                }`}
              >
                <Icon size={15} />
              </button>
            );
          })}
        </nav>
        <div className="mt-auto flex flex-col items-center gap-1 pt-2">
          {tenant && (
            <div
              className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/10"
              title={tenant.email}
            >
              <User size={13} className="text-accent" />
            </div>
          )}
          {mounted && (
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-base-2"
              title="Toggle theme"
            >
              {theme === "dark" ? <Sun size={13} /> : <Moon size={13} />}
            </button>
          )}
          <button
            onClick={logout}
            className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-base-2"
            title="Sign out"
          >
            <LogOut size={13} />
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex h-screen w-[240px] flex-shrink-0 flex-col border-r border-border bg-base-1">
      {/* Brand + switchers */}
      <div className="space-y-1 border-b border-border p-3">
        {/* Brand row */}
        <div className="flex items-center gap-2 px-1 py-0.5">
          <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-accent/15">
            <Activity size={13} className="text-accent" />
          </div>
          <span className="flex-1 text-xs font-bold tracking-tight text-text-primary">
            FlowLab
          </span>
          <button
            onClick={() => setCollapsed(true)}
            className="rounded-md p-1 text-text-muted transition-colors hover:bg-base-2 hover:text-text-secondary"
            title="Collapse sidebar"
          >
            <PanelLeftClose size={14} />
          </button>
        </div>

        {/* Flow switcher */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setFlowDropdownOpen(!flowDropdownOpen)}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-base-2"
          >
            <GitBranch size={13} className="flex-shrink-0 text-text-muted" />
            <span className="flex-1 truncate text-xs font-medium text-text-primary">
              {activeFlow?.name ??
                (activeFlowId ? "Cargando..." : "Selecciona un flow")}
            </span>
            <ChevronDown
              size={12}
              className={`flex-shrink-0 text-text-muted transition-transform ${
                flowDropdownOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {flowDropdownOpen && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-border bg-base-1 shadow-lg">
              {flows.map((flow) => (
                <button
                  key={flow.id}
                  onClick={() => navigateToFlow(flow.id)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-base-2"
                >
                  <span className="flex-1 truncate text-text-primary">
                    {flow.name}
                  </span>
                  {flow.id === activeFlowId && (
                    <Check size={11} className="flex-shrink-0 text-accent" />
                  )}
                </button>
              ))}
              <div className="border-t border-border">
                <button
                  onClick={() => {
                    setFlowDropdownOpen(false);
                    createFlow();
                  }}
                  disabled={isCreating}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-text-muted transition-colors hover:bg-base-2 hover:text-text-secondary disabled:opacity-50"
                >
                  <Plus size={11} />
                  Nuevo flow
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Section nav */}
      <nav className="flex-1 overflow-y-auto p-2">
        {SECTIONS.map(({ key, label, icon: Icon }) => {
          const isActive = activeSection === key && !!activeFlowId;
          return (
            <button
              key={key}
              onClick={() => navigateToSection(key)}
              disabled={!activeFlowId}
              className={`mb-0.5 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-medium transition-all disabled:opacity-30 ${
                isActive
                  ? "bg-accent/10 text-text-primary"
                  : "text-text-secondary hover:bg-base-2 hover:text-text-primary"
              }`}
            >
              <Icon
                size={14}
                className={`flex-shrink-0 ${isActive ? "text-accent" : "text-text-muted"}`}
              />
              {label}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-border px-3 py-3">
        {tenant && (
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
            {mounted && (
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="flex-shrink-0 rounded-md p-1.5 text-text-muted transition-colors hover:bg-base-2"
                title="Toggle theme"
              >
                {theme === "dark" ? <Sun size={13} /> : <Moon size={13} />}
              </button>
            )}
            <button
              onClick={logout}
              className="flex-shrink-0 rounded-md p-1.5 text-text-muted transition-colors hover:bg-base-2"
              title="Sign out"
            >
              <LogOut size={13} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

export function Sidebar() {
  return (
    <Suspense
      fallback={
        <aside className="flex h-screen w-[240px] flex-shrink-0 border-r border-border bg-base-1" />
      }
    >
      <SidebarInner />
    </Suspense>
  );
}
