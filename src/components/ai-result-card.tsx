"use client";

import { MessageSquare } from "lucide-react";
import type { InferenceResult, Category, Template } from "@/lib/types";

interface AiResultCardProps {
  result: InferenceResult;
  categories: Category[];
  templates: Template[];
}

export function AiResultCard({ result, categories, templates }: AiResultCardProps) {
  const matchedCategory = categories.find(
    (c) => c.name === result.detected_status
  );
  const statusColor = matchedCategory?.color || "#6366f1";

  const suggestedTemplate = result.suggested_template_id && templates
    ? templates.find((t) => t.id === result.suggested_template_id)
    : null;

  const extractedEntries = Object.entries(result.extracted_info || {}).filter(
    ([, v]) => v != null
  );

  return (
    <div className="animate-slide-up mx-auto w-full max-w-[90%] my-3">
      <div className="relative overflow-hidden rounded-xl border border-accent/20 bg-gradient-to-br from-accent/10 via-violet/8 to-accent/5">
        {/* Glow effect */}
        <div className="pointer-events-none absolute -inset-px rounded-xl bg-gradient-to-br from-accent/20 via-transparent to-violet/20 blur-sm" />

        {/* Scan line animation */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl">
          <div
            className="h-8 w-full bg-gradient-to-b from-transparent via-accent/5 to-transparent"
            style={{ animation: "scan-line 3s ease-in-out infinite" }}
          />
        </div>

        <div className="relative p-4">
          {/* Status */}
          <div className="mb-3 flex items-center gap-2.5">
            <div
              className="h-2.5 w-2.5 rounded-full"
              style={{
                backgroundColor: statusColor,
                boxShadow: `0 0 8px ${statusColor}60`,
              }}
            />
            <span
              className="font-mono text-sm font-semibold"
              style={{ color: statusColor }}
            >
              {result.detected_status}
            </span>
          </div>

          {/* Reasoning */}
          <p className="mb-3 text-xs leading-relaxed text-text-secondary">
            {result.reasoning}
          </p>

          {/* Suggested Template */}
          {suggestedTemplate && (
            <div className="mb-3 rounded-lg border border-accent/15 bg-accent/5 p-3">
              <div className="mb-1.5 flex items-center gap-1.5">
                <MessageSquare size={12} className="text-accent" />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-accent">
                  Suggested Template
                </span>
              </div>
              <p className="text-[11px] font-medium text-text-primary">
                {suggestedTemplate.name}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-text-secondary">
                {suggestedTemplate.body}
              </p>
            </div>
          )}

          {/* Extracted info */}
          {extractedEntries.length > 0 && (
            <div className="space-y-1.5 border-t border-accent/10 pt-3">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
                Extracted
              </span>
              {extractedEntries.map(([key, value]) => (
                <div key={key} className="flex items-center gap-2">
                  <span className="font-mono text-[11px] text-text-muted">
                    {key}:
                  </span>
                  <span className="font-mono text-[11px] text-accent">
                    {value}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
