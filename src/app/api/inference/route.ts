import { NextResponse } from "next/server";
import { getFlowById, getKnowledgeDocsWithContent } from "@/lib/db";
import { getTenantId } from "@/lib/get-tenant";
import { classifyConversation, generateKnowledgeResponse } from "@/lib/router";
import { dispatch } from "@/lib/alert-dispatcher";
import type { SimMessage } from "@/lib/types";

export async function POST(request: Request) {
  const tenantId = await getTenantId();
  const body = await request.json();
  const { flow_id, messages, fire_alerts = true } = body as {
    flow_id: string;
    messages: SimMessage[];
    fire_alerts?: boolean;
  };

  if (!flow_id || !messages || messages.length === 0) {
    return NextResponse.json(
      { error: "flow_id and non-empty messages array required" },
      { status: 400 }
    );
  }

  const flow = await getFlowById(flow_id, tenantId);
  if (!flow) {
    return NextResponse.json({ error: "Flow not found" }, { status: 404 });
  }

  if (flow.categories.length === 0) {
    return NextResponse.json(
      { error: "Flow has no categories defined. Add at least one category before running inference." },
      { status: 400 }
    );
  }

  try {
    const result = await classifyConversation(flow, messages);

    // If detected category has mode="knowledge", generate a knowledge-based response
    const detectedCategory = flow.categories.find(
      (c) => c.name === result.detected_status
    );
    if (detectedCategory?.mode === "knowledge" && !result.needs_human) {
      const docs = await getKnowledgeDocsWithContent(flow_id);
      if (docs.length > 0) {
        const generatedText = await generateKnowledgeResponse(flow, messages, docs);
        result.generated_response = generatedText;
        result.suggested_template_id = null;
      }
    }

    // Fire alert events (same as agent-cycle, but from simulation)
    // fire_alerts=false disables dispatch — use to avoid noise during UI testing
    if (fire_alerts) {
      const time = new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
      const simPayload = {
        lead_name: "🧪 Simulación",
        flow_name: flow.name,
        category: result.detected_status || "",
        time,
      };

      dispatch(tenantId, flow_id, "inference.executed", simPayload).catch(() => {});

      if (result.needs_human) {
        dispatch(tenantId, flow_id, "needs_human", {
          ...simPayload,
          needs_human_reason: result.needs_human_reason || "",
        }).catch(() => {});
      }

      if (!result.needs_human) {
        const extracted = result.extracted_info ?? {};
        if (extracted.telefono || extracted.email) {
          const qualifiedPayload: Record<string, string> = {
            ...simPayload,
            category_name: result.detected_status || "",
          };
          for (const [k, v] of Object.entries(extracted)) {
            qualifiedPayload[k] = v ?? "";
          }
          dispatch(tenantId, flow_id, "lead.qualified", qualifiedPayload).catch(() => {});
        }
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Inference failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
