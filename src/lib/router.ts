import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  buildClassificationPrompt,
  buildConversationHistory,
} from "./prompt-builder";
import type { FlowWithDetails, SimMessage, InferenceResult } from "./types";

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
    needs_human: parsed.needs_human ?? false,
    needs_human_reason: parsed.needs_human_reason ?? null,
    extracted_info: parsed.extracted_info ?? {},
    suggested_template_id: parsed.suggested_template_id ?? null,
  } as InferenceResult;
}
