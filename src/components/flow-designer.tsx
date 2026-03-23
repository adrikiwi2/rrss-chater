"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Plus,
  Trash2,
  Palette,
  FileText,
  Database,
  MessageSquare,
  ChevronRight as ChevronRightIcon,
  BookOpen,
  Upload,
  FileType,
  Type,
  ArrowLeft,
  ChevronRight,
  Layers,
} from "lucide-react";
import type { Category, ExtractField, Template, KnowledgeDoc } from "@/lib/types";

type DesignerView = "dashboard" | "categories" | "templates" | "knowledge" | "fields";

interface FlowDesignerProps {
  flowId: string;
  categories: Category[];
  extractFields: ExtractField[];
  templates: Template[];
  knowledgeDocs: KnowledgeDoc[];
  onUpdate: () => void;
}

const PRESET_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f59e0b", "#22c55e", "#06b6d4", "#3b82f6",
];

export function FlowDesigner({
  flowId,
  categories,
  extractFields,
  templates,
  knowledgeDocs,
  onUpdate,
}: FlowDesignerProps) {
  const [view, setView] = useState<DesignerView>("dashboard");
  const [savingId, setSavingId] = useState<string | null>(null);
  const hasKnowledge = knowledgeDocs.length > 0;

  const addCategory = async () => {
    await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        flow_id: flowId,
        name: "new_category",
        color: PRESET_COLORS[categories.length % PRESET_COLORS.length],
      }),
    });
    onUpdate();
  };

  const updateCategory = useCallback(
    async (id: string, data: Partial<Category>) => {
      setSavingId(id);
      await fetch(`/api/categories/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      setSavingId(null);
      onUpdate();
    },
    [onUpdate]
  );

  const deleteCategory = async (id: string) => {
    await fetch(`/api/categories/${id}`, { method: "DELETE" });
    onUpdate();
  };

  const addField = async () => {
    await fetch("/api/extract-fields", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flow_id: flowId, field_name: "new_field", field_type: "text" }),
    });
    onUpdate();
  };

  const updateField = async (id: string, data: Partial<ExtractField>) => {
    await fetch(`/api/extract-fields/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    onUpdate();
  };

  const deleteField = async (id: string) => {
    await fetch(`/api/extract-fields/${id}`, { method: "DELETE" });
    onUpdate();
  };

  const addTemplate = async (categoryId: string) => {
    await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flow_id: flowId, name: "New Template", body: "", category_id: categoryId }),
    });
    onUpdate();
  };

  const updateTemplate = async (id: string, data: Partial<Template>) => {
    await fetch(`/api/templates/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    onUpdate();
  };

  const deleteTemplate = async (id: string) => {
    await fetch(`/api/templates/${id}`, { method: "DELETE" });
    onUpdate();
  };

  /* ── Dashboard ── */
  if (view === "dashboard") {
    return (
      <DesignerDashboard
        categories={categories}
        templates={templates}
        knowledgeDocs={knowledgeDocs}
        extractFields={extractFields}
        onNavigate={setView}
      />
    );
  }

  /* ── Detail Views ── */
  const SECTION_META: Record<Exclude<DesignerView, "dashboard">, { label: string; icon: React.ElementType; color: string }> = {
    categories: { label: "Classification Categories", icon: Palette, color: "text-accent" },
    templates:  { label: "Templates",                 icon: MessageSquare, color: "text-violet" },
    knowledge:  { label: "Knowledge Base",            icon: BookOpen, color: "text-emerald-400" },
    fields:     { label: "Extract Fields",            icon: Database, color: "text-blue-400" },
  };

  const meta = SECTION_META[view as Exclude<DesignerView, "dashboard">];
  const Icon = meta.icon;

  return (
    <div className="space-y-5">
      {/* Detail header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setView("dashboard")}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-text-muted transition-all hover:border-border-bright hover:text-text-secondary"
          >
            <ArrowLeft size={13} />
            Overview
          </button>
          <div className="flex items-center gap-2">
            <Icon size={15} className={meta.color} />
            <h2 className="text-sm font-semibold text-text-primary">{meta.label}</h2>
          </div>
        </div>

        {/* Section-specific add buttons */}
        {view === "categories" && (
          <button
            onClick={addCategory}
            className="flex items-center gap-1.5 rounded-lg border border-border-bright px-3 py-1.5 text-xs font-medium text-text-secondary transition-all hover:border-accent/40 hover:text-accent"
          >
            <Plus size={13} />
            Add Category
          </button>
        )}
        {view === "knowledge" && (
          <KnowledgeAddButtons flowId={flowId} onUpdate={onUpdate} />
        )}
        {view === "fields" && (
          <button
            onClick={addField}
            className="flex items-center gap-1.5 rounded-lg border border-border-bright px-3 py-1.5 text-xs font-medium text-text-secondary transition-all hover:border-blue-400/40 hover:text-blue-400"
          >
            <Plus size={13} />
            Add Field
          </button>
        )}
      </div>

      {/* Section content */}
      {view === "categories" && (
        <div className="space-y-2">
          {categories.length === 0 ? (
            <EmptySection message="No categories defined. Add at least one to enable AI classification." />
          ) : (
            categories.map((cat) => (
              <CategoryRow
                key={cat.id}
                flowId={flowId}
                category={cat}
                templates={templates.filter((t) => t.category_id === cat.id)}
                isSaving={savingId === cat.id}
                hasKnowledge={hasKnowledge}
                hideTemplates
                onUpdate={updateCategory}
                onDelete={deleteCategory}
                onFlowUpdate={onUpdate}
              />
            ))
          )}
        </div>
      )}

      {view === "templates" && (
        <TemplatesSection
          categories={categories}
          templates={templates}
          onAdd={addTemplate}
          onUpdate={updateTemplate}
          onDelete={deleteTemplate}
        />
      )}

      {view === "knowledge" && (
        <div>
          <p className="mb-3 text-xs text-text-muted">
            Documents the AI can reference when a category uses Knowledge mode.
          </p>
          {knowledgeDocs.length === 0 ? (
            <EmptySection message="No documents uploaded. Add PDFs or text to enable knowledge-based responses." />
          ) : (
            <div className="space-y-2">
              {knowledgeDocs.map((doc) => (
                <KnowledgeDocRow key={doc.id} doc={doc} onUpdate={onUpdate} />
              ))}
            </div>
          )}
        </div>
      )}

      {view === "fields" && (
        <div>
          <p className="mb-3 text-xs text-text-muted">
            Fields the AI should extract from conversations (e.g., email, phone, budget).
          </p>
          {extractFields.length === 0 ? (
            <EmptySection message="No extract fields. The AI will only classify, not extract data." />
          ) : (
            <div className="space-y-2">
              {extractFields.map((field) => (
                <FieldRow
                  key={field.id}
                  field={field}
                  onUpdate={updateField}
                  onDelete={deleteField}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Designer Dashboard ────────────────────────── */

function DesignerDashboard({
  categories,
  templates,
  knowledgeDocs,
  extractFields,
  onNavigate,
}: {
  categories: Category[];
  templates: Template[];
  knowledgeDocs: KnowledgeDoc[];
  extractFields: ExtractField[];
  onNavigate: (view: DesignerView) => void;
}) {
  const knowledgeCats = categories.filter((c) => c.mode === "knowledge").length;
  const templateCats = categories.length - knowledgeCats;
  const catsWithTemplates = categories.filter((c) =>
    templates.some((t) => t.category_id === c.id)
  ).length;
  const pdfs = knowledgeDocs.filter((d) => d.doc_type === "pdf").length;
  const texts = knowledgeDocs.filter((d) => d.doc_type !== "pdf").length;

  // Template-mode categories with 0 templates (needs attention)
  const emptyCats = categories.filter(
    (c) => c.mode !== "knowledge" && !templates.some((t) => t.category_id === c.id)
  ).length;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2 pb-1">
        <Layers size={14} className="text-text-muted" />
        <span className="text-xs font-semibold uppercase tracking-widest text-text-muted">
          Flow Design Overview
        </span>
      </div>

      {/* 2×2 Bento grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">

        {/* Categories card */}
        <DashCard
          onClick={() => onNavigate("categories")}
          icon={Palette}
          iconColor="text-accent"
          hoverBorder="hover:border-accent/30"
          label="Categories"
          count={categories.length}
          unit={categories.length === 1 ? "category" : "categories"}
          status={categories.length > 0 ? "ok" : "warn"}
          statusLabel={categories.length > 0 ? "Configured" : "Required for inference"}
        >
          {categories.length > 0 ? (
            <div className="space-y-2">
              {/* Color dots */}
              <div className="flex flex-wrap gap-1.5">
                {categories.slice(0, 10).map((c) => (
                  <div
                    key={c.id}
                    title={c.name}
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: c.color }}
                  />
                ))}
                {categories.length > 10 && (
                  <span className="text-[10px] text-text-muted">+{categories.length - 10}</span>
                )}
              </div>
              <p className="text-[11px] text-text-muted">
                {templateCats} template · {knowledgeCats} knowledge
              </p>
            </div>
          ) : (
            <p className="text-[11px] text-text-muted">Add categories to enable AI classification</p>
          )}
        </DashCard>

        {/* Templates card */}
        <DashCard
          onClick={() => onNavigate("templates")}
          icon={MessageSquare}
          iconColor="text-violet"
          hoverBorder="hover:border-violet/30"
          label="Templates"
          count={templates.length}
          unit={templates.length === 1 ? "template" : "templates"}
          status={emptyCats > 0 ? "warn" : templates.length > 0 ? "ok" : "muted"}
          statusLabel={
            emptyCats > 0
              ? `${emptyCats} ${emptyCats === 1 ? "category" : "categories"} without template`
              : templates.length > 0
              ? `Across ${catsWithTemplates} ${catsWithTemplates === 1 ? "category" : "categories"}`
              : "No templates yet"
          }
        >
          {templates.length > 0 ? (
            <div className="space-y-1">
              {templates.slice(0, 3).map((t) => {
                const cat = categories.find((c) => c.id === t.category_id);
                return (
                  <div key={t.id} className="flex items-center gap-2 min-w-0">
                    {cat && (
                      <div
                        className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                        style={{ backgroundColor: cat.color }}
                      />
                    )}
                    <span className="truncate text-[11px] text-text-muted">{t.name}</span>
                  </div>
                );
              })}
              {templates.length > 3 && (
                <p className="text-[11px] text-text-muted">+{templates.length - 3} more</p>
              )}
            </div>
          ) : (
            <p className="text-[11px] text-text-muted">Response templates for template-mode categories</p>
          )}
        </DashCard>

        {/* Knowledge card */}
        <DashCard
          onClick={() => onNavigate("knowledge")}
          icon={BookOpen}
          iconColor="text-emerald-400"
          hoverBorder="hover:border-emerald-400/30"
          label="Knowledge Base"
          count={knowledgeDocs.length}
          unit={knowledgeDocs.length === 1 ? "document" : "documents"}
          status={knowledgeDocs.length > 0 ? "ok" : "muted"}
          statusLabel={
            knowledgeDocs.length > 0
              ? `${pdfs} PDF · ${texts} text`
              : "Optional — enables knowledge mode"
          }
        >
          {knowledgeDocs.length > 0 ? (
            <div className="space-y-1">
              {knowledgeDocs.slice(0, 3).map((d) => (
                <div key={d.id} className="flex items-center gap-2 min-w-0">
                  {d.doc_type === "pdf" ? (
                    <FileType size={11} className="flex-shrink-0 text-red-400" />
                  ) : (
                    <FileText size={11} className="flex-shrink-0 text-emerald-400" />
                  )}
                  <span className="truncate text-[11px] text-text-muted">{d.name}</span>
                </div>
              ))}
              {knowledgeDocs.length > 3 && (
                <p className="text-[11px] text-text-muted">+{knowledgeDocs.length - 3} more</p>
              )}
            </div>
          ) : (
            <p className="text-[11px] text-text-muted">Upload PDFs or text for AI knowledge responses</p>
          )}
        </DashCard>

        {/* Extract Fields card */}
        <DashCard
          onClick={() => onNavigate("fields")}
          icon={Database}
          iconColor="text-blue-400"
          hoverBorder="hover:border-blue-400/30"
          label="Extract Fields"
          count={extractFields.length}
          unit={extractFields.length === 1 ? "field" : "fields"}
          status={extractFields.length > 0 ? "ok" : "muted"}
          statusLabel={extractFields.length > 0 ? "Active extraction" : "Optional — extracts lead data"}
        >
          {extractFields.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {extractFields.slice(0, 6).map((f) => (
                <span
                  key={f.id}
                  className="rounded-full border border-border bg-base-2 px-2 py-0.5 font-mono text-[10px] text-text-muted"
                >
                  {f.field_name}
                </span>
              ))}
              {extractFields.length > 6 && (
                <span className="text-[10px] text-text-muted">+{extractFields.length - 6}</span>
              )}
            </div>
          ) : (
            <p className="text-[11px] text-text-muted">Fields the AI extracts from conversations</p>
          )}
        </DashCard>
      </div>
    </div>
  );
}

/* ── Dash Card ─────────────────────────────────── */

function DashCard({
  onClick,
  icon: Icon,
  iconColor,
  hoverBorder,
  label,
  count,
  unit,
  status,
  statusLabel,
  children,
}: {
  onClick: () => void;
  icon: React.ElementType;
  iconColor: string;
  hoverBorder: string;
  label: string;
  count: number;
  unit: string;
  status: "ok" | "warn" | "muted";
  statusLabel: string;
  children: React.ReactNode;
}) {
  const statusDot = status === "ok"
    ? "bg-green-400"
    : status === "warn"
    ? "bg-amber-400"
    : "bg-base-3";

  return (
    <div
      onClick={onClick}
      className={`group cursor-pointer rounded-xl border border-border bg-base-1 p-5 transition-all duration-200 hover:bg-base-2 hover:shadow-lg ${hoverBorder}`}
      style={{ transform: "translateZ(0)" }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.transform = "scale(1.01)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.transform = "scale(1)"; }}
    >
      {/* Top row */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon size={15} className={iconColor} />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
            {label}
          </span>
        </div>
        <ChevronRight
          size={14}
          className={`text-text-muted transition-all duration-200 group-hover:translate-x-0.5 group-hover:${iconColor}`}
        />
      </div>

      {/* KPI */}
      <div className="mb-4">
        <span className="text-4xl font-bold leading-none text-text-primary">{count}</span>
        <span className="ml-2 text-sm text-text-muted">{unit}</span>
      </div>

      {/* Preview content */}
      <div className="mb-4 min-h-[36px]">{children}</div>

      {/* Status footer */}
      <div className="flex items-center gap-1.5 border-t border-border pt-3">
        <div className={`h-1.5 w-1.5 rounded-full ${statusDot}`} />
        <span className="text-[10px] text-text-muted">{statusLabel}</span>
      </div>
    </div>
  );
}

/* ── Templates Section ─────────────────────────── */

function TemplatesSection({
  categories,
  templates,
  onAdd,
  onUpdate,
  onDelete,
}: {
  categories: Category[];
  templates: Template[];
  onAdd: (categoryId: string) => void;
  onUpdate: (id: string, data: Partial<Template>) => void;
  onDelete: (id: string) => void;
}) {
  const templateCategories = categories.filter((c) => c.mode !== "knowledge");

  if (templateCategories.length === 0) {
    return (
      <EmptySection message="No template-mode categories. Switch a category to template mode to add response templates." />
    );
  }

  return (
    <div className="space-y-4">
      {templateCategories.map((cat) => {
        const catTemplates = templates.filter((t) => t.category_id === cat.id);
        return (
          <div key={cat.id} className="rounded-xl border border-border bg-base-1 overflow-hidden">
            {/* Category header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div
                  className="h-3 w-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: cat.color }}
                />
                <span className="font-mono text-sm font-medium text-text-primary">{cat.name}</span>
                <span className="rounded-full bg-base-3 px-2 py-0.5 text-[10px] font-mono text-text-muted">
                  {catTemplates.length}
                </span>
              </div>
              <button
                onClick={() => onAdd(cat.id)}
                className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-text-muted transition-all hover:bg-base-3 hover:text-accent"
              >
                <Plus size={11} />
                Add
              </button>
            </div>

            {/* Templates list */}
            {catTemplates.length === 0 ? (
              <div className="px-4 py-4 text-center">
                <p className="text-[11px] text-text-muted">
                  No templates for this category.{" "}
                  <button
                    onClick={() => onAdd(cat.id)}
                    className="cursor-pointer text-accent hover:underline"
                  >
                    Add one
                  </button>
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {catTemplates.map((tpl) => (
                  <div key={tpl.id} className="px-4 py-2.5">
                    <TemplateRow template={tpl} onUpdate={onUpdate} onDelete={onDelete} />
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Empty Section ─────────────────────────────── */

function EmptySection({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border-bright bg-base-1/50 px-4 py-8 text-center">
      <p className="text-xs text-text-muted">{message}</p>
    </div>
  );
}

/* ── Knowledge Add Buttons ─────────────────────── */

function KnowledgeAddButtons({ flowId, onUpdate }: { flowId: string; onUpdate: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const MAX_FILE_SIZE = 3 * 1024 * 1024;

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      alert(`PDF too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum is 3MB.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("flow_id", flowId);
      formData.append("name", file.name.replace(/\.pdf$/i, ""));
      formData.append("file", file);
      const res = await fetch("/api/knowledge-docs", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Upload failed" }));
        alert(err.error || "Upload failed");
        return;
      }
      onUpdate();
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleAddText = async () => {
    await fetch("/api/knowledge-docs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flow_id: flowId, name: "New Document", content_text: "" }),
    });
    onUpdate();
  };

  return (
    <div className="flex items-center gap-1.5">
      <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={handlePdfUpload} />
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="flex items-center gap-1.5 rounded-lg border border-border-bright px-3 py-1.5 text-xs font-medium text-text-secondary transition-all hover:border-emerald-400/40 hover:text-emerald-400 disabled:opacity-50"
      >
        <Upload size={13} />
        {uploading ? "Uploading..." : "Upload PDF"}
      </button>
      <button
        onClick={handleAddText}
        className="flex items-center gap-1.5 rounded-lg border border-border-bright px-3 py-1.5 text-xs font-medium text-text-secondary transition-all hover:border-emerald-400/40 hover:text-emerald-400"
      >
        <Type size={13} />
        Add Text
      </button>
    </div>
  );
}

/* ── Knowledge Doc Row ─────────────────────────── */

function KnowledgeDocRow({ doc, onUpdate }: { doc: KnowledgeDoc; onUpdate: () => void }) {
  const [name, setName] = useState(doc.name);
  const [expanded, setExpanded] = useState(false);
  const [contentText, setContentText] = useState<string | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [contentText]);

  const saveName = async () => {
    if (name !== doc.name) {
      await fetch(`/api/knowledge-docs/${doc.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      onUpdate();
    }
  };

  const saveContent = async () => {
    if (contentText !== null) {
      await fetch(`/api/knowledge-docs/${doc.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content_text: contentText }),
      });
    }
  };

  const handleExpand = async () => {
    if (!expanded && doc.doc_type === "text" && contentText === null) {
      setLoadingContent(true);
      try {
        const res = await fetch(`/api/knowledge-docs/${doc.id}`);
        const data = await res.json();
        setContentText(data.content_text || "");
      } finally {
        setLoadingContent(false);
      }
    }
    setExpanded(!expanded);
  };

  const handleDelete = async () => {
    await fetch(`/api/knowledge-docs/${doc.id}`, { method: "DELETE" });
    onUpdate();
  };

  const isPdf = doc.doc_type === "pdf";

  return (
    <div className="rounded-lg border border-border bg-base-1 transition-all hover:border-border-bright">
      <div className="flex items-center gap-3 px-4 py-3">
        {isPdf ? (
          <FileType size={14} className="text-red-400 shrink-0" />
        ) : (
          <FileText size={14} className="text-emerald-400 shrink-0" />
        )}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={saveName}
          className="flex-1 bg-transparent font-mono text-sm font-medium text-text-primary outline-none placeholder:text-text-muted"
          placeholder="Document name"
        />
        <span className="rounded-full bg-base-3 px-2 py-0.5 text-[9px] font-mono uppercase text-text-muted">
          {doc.doc_type}
        </span>
        {!isPdf && (
          <button
            onClick={handleExpand}
            className="rounded-md p-1.5 text-text-muted transition-all hover:bg-base-3 hover:text-text-secondary"
          >
            <FileText size={13} />
          </button>
        )}
        <button
          onClick={handleDelete}
          className="rounded-md p-1.5 text-text-muted transition-all hover:bg-danger/10 hover:text-danger"
        >
          <Trash2 size={13} />
        </button>
      </div>
      {expanded && !isPdf && (
        <div className="border-t border-border px-4 py-3">
          {loadingContent ? (
            <p className="text-xs text-text-muted">Loading...</p>
          ) : (
            <textarea
              ref={textareaRef}
              value={contentText || ""}
              onChange={(e) => setContentText(e.target.value)}
              onBlur={saveContent}
              rows={1}
              style={{ overflow: "hidden" }}
              className="w-full resize-none rounded-md border border-border bg-base-0 px-3 py-2 text-xs leading-relaxed text-text-primary outline-none transition-colors focus:border-emerald-400/40"
              placeholder="Paste or type your reference content here..."
            />
          )}
        </div>
      )}
    </div>
  );
}

/* ── Category Row ─────────────────────────────── */

function CategoryRow({
  flowId,
  category,
  templates,
  isSaving,
  hasKnowledge,
  hideTemplates = false,
  onUpdate,
  onDelete,
  onFlowUpdate,
}: {
  flowId: string;
  category: Category;
  templates: Template[];
  isSaving: boolean;
  hasKnowledge: boolean;
  hideTemplates?: boolean;
  onUpdate: (id: string, data: Partial<Category>) => Promise<void>;
  onDelete: (id: string) => void;
  onFlowUpdate: () => void;
}) {
  const [name, setName] = useState(category.name);
  const [rules, setRules] = useState(category.rules);
  const [expanded, setExpanded] = useState(true);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const rulesRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = rulesRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [rules]);

  const isKnowledgeMode = category.mode === "knowledge";

  const saveField = (field: string, value: string) => {
    onUpdate(category.id, { [field]: value });
  };

  const toggleMode = () => {
    onUpdate(category.id, { mode: isKnowledgeMode ? "template" : "knowledge" });
  };

  const addTemplate = async () => {
    await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flow_id: flowId, name: "New Template", body: "", category_id: category.id }),
    });
    setShowTemplates(true);
    onFlowUpdate();
  };

  const updateTemplate = async (id: string, data: Partial<Template>) => {
    await fetch(`/api/templates/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    onFlowUpdate();
  };

  const deleteTemplate = async (id: string) => {
    await fetch(`/api/templates/${id}`, { method: "DELETE" });
    onFlowUpdate();
  };

  return (
    <div className="rounded-lg border border-border bg-base-1 transition-all hover:border-border-bright">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="relative">
          <div
            className="h-4 w-4 rounded-full cursor-pointer"
            style={{ boxShadow: `0 0 0 2px var(--color-base-1), 0 0 0 4px ${category.color}` }}
          />
          <input
            type="color"
            value={category.color}
            onChange={(e) => onUpdate(category.id, { color: e.target.value })}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name !== category.name && saveField("name", name)}
          className="flex-1 bg-transparent font-mono text-sm font-medium text-text-primary outline-none placeholder:text-text-muted"
          placeholder="category_name"
        />
        {isKnowledgeMode && (
          <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
            <BookOpen size={10} />
            Knowledge
          </span>
        )}
        {!isKnowledgeMode && templates.length > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-base-3 px-2 py-0.5 text-[10px] font-mono text-text-muted">
            <MessageSquare size={10} />
            {templates.length}
          </span>
        )}
        {isSaving && <span className="text-[10px] text-accent">saving...</span>}
        <button
          onClick={() => setExpanded(!expanded)}
          className="rounded-md p-1.5 text-text-muted transition-all hover:bg-base-3 hover:text-text-secondary"
        >
          <FileText size={13} />
        </button>
        <button
          onClick={() => onDelete(category.id)}
          className="rounded-md p-1.5 text-text-muted transition-all hover:bg-danger/10 hover:text-danger"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Body */}
      {expanded && (
        <div className="border-t border-border px-4 py-3">
          {/* Classification Rules — collapsible */}
          <button
            onClick={() => setRulesOpen((v) => !v)}
            className="mb-1.5 flex cursor-pointer items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-text-muted transition-colors hover:text-text-secondary"
          >
            <ChevronRightIcon
              size={11}
              className={`transition-transform ${rulesOpen ? "rotate-90" : ""}`}
            />
            Classification Rules
          </button>
          {rulesOpen && (
            <textarea
              ref={rulesRef}
              value={rules}
              onChange={(e) => setRules(e.target.value)}
              onBlur={() => rules !== category.rules && saveField("rules", rules)}
              rows={1}
              style={{ overflow: "hidden" }}
              className="mb-3 w-full resize-none rounded-md border border-border bg-base-0 px-3 py-2 text-xs leading-relaxed text-text-primary outline-none transition-colors focus:border-accent/40"
              placeholder='Describe when to classify as this status, e.g.: "The prospect explicitly expresses interest..."'
            />
          )}

          {/* Mode toggle */}
          {hasKnowledge && (
            <div className="mt-2 flex items-center gap-2">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
                Response mode
              </label>
              <button
                onClick={toggleMode}
                className={`rounded-md px-2.5 py-1 text-[10px] font-semibold transition-all ${
                  !isKnowledgeMode ? "bg-accent/15 text-accent" : "bg-base-3 text-text-muted hover:text-text-secondary"
                }`}
              >
                Templates
              </button>
              <button
                onClick={toggleMode}
                className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[10px] font-semibold transition-all ${
                  isKnowledgeMode ? "bg-emerald-500/15 text-emerald-400" : "bg-base-3 text-text-muted hover:text-text-secondary"
                }`}
              >
                <BookOpen size={10} />
                Knowledge
              </button>
            </div>
          )}

          {/* Templates (only if not hidden and not knowledge mode) */}
          {!hideTemplates && !isKnowledgeMode && (
            <div className="mt-3">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setShowTemplates(!showTemplates)}
                  className="flex cursor-pointer items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-text-muted transition-colors hover:text-text-secondary"
                >
                  <ChevronRightIcon
                    size={11}
                    className={`transition-transform ${showTemplates ? "rotate-90" : ""}`}
                  />
                  Templates ({templates.length})
                </button>
                {showTemplates && (
                  <button
                    onClick={addTemplate}
                    className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-text-muted transition-all hover:bg-base-3 hover:text-accent"
                  >
                    <Plus size={11} />
                    Add
                  </button>
                )}
              </div>
              {showTemplates && (
                <div className="mt-1.5 space-y-1.5">
                  {templates.map((tpl) => (
                    <TemplateRow key={tpl.id} template={tpl} onUpdate={updateTemplate} onDelete={deleteTemplate} />
                  ))}
                  {templates.length === 0 && (
                    <div className="rounded-md border border-dashed border-border bg-base-0/50 px-3 py-3 text-center">
                      <p className="text-[11px] text-text-muted">No templates for this category.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Knowledge mode info */}
          {isKnowledgeMode && (
            <div className="mt-3 rounded-md border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5">
              <p className="text-[11px] leading-relaxed text-emerald-300/80">
                The AI will generate a free response using the Knowledge Base documents instead of suggesting a template.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Template Row ────────────────────────────── */

function TemplateRow({
  template,
  onUpdate,
  onDelete,
}: {
  template: Template;
  onUpdate: (id: string, data: Partial<Template>) => void;
  onDelete: (id: string) => void;
}) {
  const [name, setName] = useState(template.name);
  const [body, setBody] = useState(template.body);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }); // run on every render so initial load with existing body also sizes correctly

  return (
    <div className="group rounded-md border border-border bg-base-0 px-3 py-2">
      <div className="flex items-center gap-2">
        <MessageSquare size={11} className="flex-shrink-0 text-text-muted" />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name !== template.name && onUpdate(template.id, { name })}
          className="flex-1 bg-transparent text-xs font-medium text-text-primary outline-none placeholder:text-text-muted"
          placeholder="Template name"
        />
        <button
          onClick={() => onDelete(template.id)}
          className="rounded p-1 text-transparent transition-all group-hover:text-text-muted group-hover:hover:text-danger"
        >
          <Trash2 size={11} />
        </button>
      </div>
      <textarea
        ref={bodyRef}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onBlur={() => body !== template.body && onUpdate(template.id, { body })}
        rows={1}
        style={{ overflow: "hidden" }}
        className="mt-1.5 w-full resize-none bg-transparent text-[11px] leading-relaxed text-text-secondary outline-none placeholder:text-text-muted"
        placeholder="Write template text..."
      />
    </div>
  );
}

/* ── Field Row ────────────────────────────────── */

function FieldRow({
  field,
  onUpdate,
  onDelete,
}: {
  field: ExtractField;
  onUpdate: (id: string, data: Partial<ExtractField>) => void;
  onDelete: (id: string) => void;
}) {
  const [fieldName, setFieldName] = useState(field.field_name);
  const [description, setDescription] = useState(field.description);

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-base-1 px-4 py-3">
      <input
        value={fieldName}
        onChange={(e) => setFieldName(e.target.value)}
        onBlur={() => fieldName !== field.field_name && onUpdate(field.id, { field_name: fieldName })}
        className="w-32 bg-transparent font-mono text-xs font-medium text-text-primary outline-none"
        placeholder="field_name"
      />
      <select
        value={field.field_type}
        onChange={(e) => onUpdate(field.id, { field_type: e.target.value as ExtractField["field_type"] })}
        className="rounded-md border border-border bg-base-0 px-2 py-1 text-xs text-text-secondary outline-none"
      >
        <option value="text">text</option>
        <option value="email">email</option>
        <option value="number">number</option>
        <option value="date">date</option>
      </select>
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onBlur={() => description !== field.description && onUpdate(field.id, { description })}
        className="flex-1 bg-transparent text-xs text-text-secondary outline-none"
        placeholder="Description for the AI..."
      />
      <button
        onClick={() => onDelete(field.id)}
        className="rounded-md p-1.5 text-text-muted transition-all hover:bg-danger/10 hover:text-danger"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}
