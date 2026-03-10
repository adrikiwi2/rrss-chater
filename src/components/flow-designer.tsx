"use client";

import { useState, useCallback, useRef } from "react";
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
} from "lucide-react";
import type { Category, ExtractField, Template, KnowledgeDoc } from "@/lib/types";

interface FlowDesignerProps {
  flowId: string;
  categories: Category[];
  extractFields: ExtractField[];
  templates: Template[];
  knowledgeDocs: KnowledgeDoc[];
  onUpdate: () => void;
}

const PRESET_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#ef4444",
  "#f59e0b",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
];

export function FlowDesigner({
  flowId,
  categories,
  extractFields,
  templates,
  knowledgeDocs,
  onUpdate,
}: FlowDesignerProps) {
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
      body: JSON.stringify({
        flow_id: flowId,
        field_name: "new_field",
        field_type: "text",
      }),
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

  return (
    <div className="space-y-8">
      {/* Knowledge Base */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen size={15} className="text-emerald-400" />
            <h3 className="text-sm font-semibold text-text-primary">
              Knowledge Base
            </h3>
            <span className="rounded-full bg-base-3 px-2 py-0.5 text-[10px] font-mono text-text-muted">
              {knowledgeDocs.length}
            </span>
          </div>
          <KnowledgeAddButtons flowId={flowId} onUpdate={onUpdate} />
        </div>

        <p className="mb-3 text-xs text-text-muted">
          Documents the AI can reference when a category uses Knowledge mode (PDFs, text).
        </p>

        {knowledgeDocs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border-bright bg-base-1/50 px-4 py-6 text-center">
            <p className="text-xs text-text-muted">
              No documents uploaded. Add PDFs or text to enable knowledge-based responses.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {knowledgeDocs.map((doc) => (
              <KnowledgeDocRow
                key={doc.id}
                doc={doc}
                onUpdate={onUpdate}
              />
            ))}
          </div>
        )}
      </section>

      {/* Categories */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Palette size={15} className="text-accent" />
            <h3 className="text-sm font-semibold text-text-primary">
              Classification Categories
            </h3>
            <span className="rounded-full bg-base-3 px-2 py-0.5 text-[10px] font-mono text-text-muted">
              {categories.length}
            </span>
          </div>
          <button
            onClick={addCategory}
            className="flex items-center gap-1.5 rounded-lg border border-border-bright px-3 py-1.5 text-xs font-medium text-text-secondary transition-all hover:border-accent/40 hover:text-accent"
          >
            <Plus size={13} />
            Add Category
          </button>
        </div>

        {categories.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border-bright bg-base-1/50 px-4 py-8 text-center">
            <p className="text-xs text-text-muted">
              No categories defined. Add at least one to enable AI classification.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {categories.map((cat) => (
              <CategoryRow
                key={cat.id}
                flowId={flowId}
                category={cat}
                templates={templates.filter((t) => t.category_id === cat.id)}
                isSaving={savingId === cat.id}
                hasKnowledge={hasKnowledge}
                onUpdate={updateCategory}
                onDelete={deleteCategory}
                onFlowUpdate={onUpdate}
              />
            ))}
          </div>
        )}
      </section>

      {/* Extract Fields */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database size={15} className="text-violet" />
            <h3 className="text-sm font-semibold text-text-primary">
              Extract Fields
            </h3>
            <span className="rounded-full bg-base-3 px-2 py-0.5 text-[10px] font-mono text-text-muted">
              {extractFields.length}
            </span>
          </div>
          <button
            onClick={addField}
            className="flex items-center gap-1.5 rounded-lg border border-border-bright px-3 py-1.5 text-xs font-medium text-text-secondary transition-all hover:border-violet/40 hover:text-violet"
          >
            <Plus size={13} />
            Add Field
          </button>
        </div>

        <p className="mb-3 text-xs text-text-muted">
          Fields the AI should extract from conversations (e.g., email, phone,
          budget).
        </p>

        {extractFields.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border-bright bg-base-1/50 px-4 py-6 text-center">
            <p className="text-xs text-text-muted">
              No extract fields. The AI will only classify, not extract data.
            </p>
          </div>
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
      </section>
    </div>
  );
}

/* ── Knowledge Add Buttons ─────────────────────── */

function KnowledgeAddButtons({
  flowId,
  onUpdate,
}: {
  flowId: string;
  onUpdate: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB (base64 expands ~33%, Vercel limit is 4.5MB)

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      alert(`PDF too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum is 3MB. Try compressing or reducing images in the PDF.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("flow_id", flowId);
      formData.append("name", file.name.replace(/\.pdf$/i, ""));
      formData.append("file", file);
      const res = await fetch("/api/knowledge-docs", {
        method: "POST",
        body: formData,
      });
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
      body: JSON.stringify({
        flow_id: flowId,
        name: "New Document",
        content_text: "",
      }),
    });
    onUpdate();
  };

  return (
    <div className="flex items-center gap-1.5">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={handlePdfUpload}
      />
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

function KnowledgeDocRow({
  doc,
  onUpdate,
}: {
  doc: KnowledgeDoc;
  onUpdate: () => void;
}) {
  const [name, setName] = useState(doc.name);
  const [expanded, setExpanded] = useState(false);
  const [contentText, setContentText] = useState<string | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);

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
              value={contentText || ""}
              onChange={(e) => setContentText(e.target.value)}
              onBlur={saveContent}
              rows={6}
              className="w-full resize-none rounded-md border border-border bg-base-0 px-3 py-2 font-mono text-xs leading-relaxed text-text-primary outline-none transition-colors focus:border-emerald-400/40"
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
  onUpdate,
  onDelete,
  onFlowUpdate,
}: {
  flowId: string;
  category: Category;
  templates: Template[];
  isSaving: boolean;
  hasKnowledge: boolean;
  onUpdate: (id: string, data: Partial<Category>) => Promise<void>;
  onDelete: (id: string) => void;
  onFlowUpdate: () => void;
}) {
  const [name, setName] = useState(category.name);
  const [rules, setRules] = useState(category.rules);
  const [expanded, setExpanded] = useState(true);
  const [showTemplates, setShowTemplates] = useState(false);

  const isKnowledgeMode = category.mode === "knowledge";

  const saveField = (field: string, value: string) => {
    onUpdate(category.id, { [field]: value });
  };

  const toggleMode = () => {
    const newMode = isKnowledgeMode ? "template" : "knowledge";
    onUpdate(category.id, { mode: newMode });
  };

  const addTemplate = async () => {
    await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        flow_id: flowId,
        name: "New Template",
        body: "",
        category_id: category.id,
      }),
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
        {/* Color picker */}
        <div className="relative">
          <div
            className="h-4 w-4 rounded-full cursor-pointer ring-2 ring-offset-1 ring-offset-base-1"
            style={{
              backgroundColor: category.color,
              boxShadow: `0 0 0 2px var(--color-base-1), 0 0 0 4px ${category.color}`,
            }}
          />
          <input
            type="color"
            value={category.color}
            onChange={(e) => onUpdate(category.id, { color: e.target.value })}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </div>

        {/* Name */}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name !== category.name && saveField("name", name)}
          className="flex-1 bg-transparent font-mono text-sm font-medium text-text-primary outline-none placeholder:text-text-muted"
          placeholder="category_name"
        />

        {/* Mode badge */}
        {isKnowledgeMode && (
          <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
            <BookOpen size={10} />
            Knowledge
          </span>
        )}

        {/* Template count badge (only in template mode) */}
        {!isKnowledgeMode && templates.length > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-base-3 px-2 py-0.5 text-[10px] font-mono text-text-muted">
            <MessageSquare size={10} />
            {templates.length}
          </span>
        )}

        {/* Status */}
        {isSaving && (
          <span className="text-[10px] text-accent">saving...</span>
        )}

        {/* Expand / Delete */}
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

      {/* Rules + Templates/Knowledge (expandable) */}
      {expanded && (
        <div className="border-t border-border px-4 py-3">
          <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-text-muted">
            Classification Rules
          </label>
          <textarea
            value={rules}
            onChange={(e) => setRules(e.target.value)}
            onBlur={() => rules !== category.rules && saveField("rules", rules)}
            rows={3}
            className="w-full resize-none rounded-md border border-border bg-base-0 px-3 py-2 font-mono text-xs leading-relaxed text-text-primary outline-none transition-colors focus:border-accent/40"
            placeholder='Describe when to classify as this status, e.g.: "The prospect explicitly expresses interest, asks for pricing, or requests a demo."'
          />

          {/* Mode toggle */}
          {hasKnowledge && (
            <div className="mt-3 flex items-center gap-2">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
                Response mode
              </label>
              <button
                onClick={toggleMode}
                className={`rounded-md px-2.5 py-1 text-[10px] font-semibold transition-all ${
                  !isKnowledgeMode
                    ? "bg-accent/15 text-accent"
                    : "bg-base-3 text-text-muted hover:text-text-secondary"
                }`}
              >
                Templates
              </button>
              <button
                onClick={toggleMode}
                className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[10px] font-semibold transition-all ${
                  isKnowledgeMode
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "bg-base-3 text-text-muted hover:text-text-secondary"
                }`}
              >
                <BookOpen size={10} />
                Knowledge
              </button>
            </div>
          )}

          {/* Templates section (only in template mode) */}
          {!isKnowledgeMode && (
            <div className="mt-3">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setShowTemplates(!showTemplates)}
                  className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-text-muted transition-colors hover:text-text-secondary"
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
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-text-muted transition-all hover:bg-base-3 hover:text-accent"
                  >
                    <Plus size={11} />
                    Add
                  </button>
                )}
              </div>
              {showTemplates && (
                <div className="mt-1.5 space-y-1.5">
                  {templates.map((tpl) => (
                    <TemplateRow
                      key={tpl.id}
                      template={tpl}
                      onUpdate={updateTemplate}
                      onDelete={deleteTemplate}
                    />
                  ))}
                  {templates.length === 0 && (
                    <div className="rounded-md border border-dashed border-border bg-base-0/50 px-3 py-3 text-center">
                      <p className="text-[11px] text-text-muted">
                        No templates for this category.
                      </p>
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
                When classified as this category, the AI will generate a response using the Knowledge Base documents instead of suggesting a template.
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
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onBlur={() => body !== template.body && onUpdate(template.id, { body })}
        rows={2}
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
        onBlur={() =>
          fieldName !== field.field_name &&
          onUpdate(field.id, { field_name: fieldName })
        }
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
        onBlur={() =>
          description !== field.description &&
          onUpdate(field.id, { description })
        }
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
