import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  buildClassificationPrompt,
  buildConversationHistory,
  buildKnowledgePrompt,
} from "./prompt-builder";
import type { FlowWithDetails, SimMessage, InferenceResult, KnowledgeDoc } from "./types";

export async function classifyConversation(
  flow: FlowWithDetails,
  messages: SimMessage[],
  usedTemplateIds: string[] = []
): Promise<InferenceResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your_gemini_api_key_here") {
    throw new Error("GEMINI_API_KEY not configured in .env.local");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite-preview" });

  const historyString = buildConversationHistory(
    messages,
    flow.role_a_label,
    flow.role_b_label
  );

  const prompt = buildClassificationPrompt(
    flow,
    flow.categories,
    flow.extract_fields,
    flow.templates,
    historyString,
    usedTemplateIds
  );

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  // Extract JSON — handle markdown-wrapped responses
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  const parsed = jsonMatch
    ? JSON.parse(jsonMatch[0])
    : JSON.parse(text);

  return {
    detected_status: parsed.detected_status,
    reasoning: parsed.reasoning,
    suggested_stage: parsed.suggested_stage ?? null,
    needs_human: parsed.needs_human ?? false,
    needs_human_reason: parsed.needs_human_reason ?? null,
    extracted_info: parsed.extracted_info ?? {},
    suggested_template_id: parsed.suggested_template_id ?? null,
  } as InferenceResult;
}

export async function generateKnowledgeResponse(
  flow: FlowWithDetails,
  messages: SimMessage[],
  docs: KnowledgeDoc[]
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your_gemini_api_key_here") {
    throw new Error("GEMINI_API_KEY not configured in .env.local");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite-preview" });

  const historyString = buildConversationHistory(
    messages,
    flow.role_a_label,
    flow.role_b_label
  );

  // Build multimodal parts: PDFs as inline data, text docs in prompt
  const textDocs = docs.filter((d) => d.doc_type === "text");
  const pdfDocs = docs.filter((d) => d.doc_type === "pdf" && d.content_pdf_b64);

  const parts: ({ inlineData: { mimeType: string; data: string } } | { text: string })[] = [];

  for (const pdf of pdfDocs) {
    parts.push({
      inlineData: {
        mimeType: "application/pdf",
        data: pdf.content_pdf_b64!,
      },
    });
  }

  parts.push({
    text: buildKnowledgePrompt(flow, historyString, textDocs),
  });

  const result = await model.generateContent(parts);
  return result.response.text();
}
