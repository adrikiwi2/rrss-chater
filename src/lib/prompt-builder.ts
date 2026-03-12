import type { Flow, Category, ExtractField, Template, SimMessage, KnowledgeDoc } from "./types";

export function buildConversationHistory(
  messages: SimMessage[],
  roleALabel: string,
  roleBLabel: string
): string {
  return messages
    .map((m, i) => {
      const label = m.role === "a" ? roleALabel : roleBLabel;
      return `[${i + 1}] From: ${label}\n${m.body}`;
    })
    .join("\n---\n");
}

export function buildClassificationPrompt(
  flow: Flow,
  categories: Category[],
  extractFields: ExtractField[],
  templates: Template[],
  conversationHistory: string,
  usedTemplateIds: string[] = []
): string {
  const categoryRules = categories
    .map((c) => `- STATUS: "${c.name}" → ${c.rules}`)
    .join("\n");

  const extractionFields =
    extractFields.length > 0
      ? extractFields
          .map(
            (f) =>
              `"${f.field_name}": "${f.field_type} | null"  // ${f.description}`
          )
          .join(",\n      ")
      : '"notes": "string | null"  // Any additional observations';

  const validStatuses = categories.map((c) => `"${c.name}"`).join(", ");

  // Build templates section grouped by category
  const templatesByCategory = categories
    .map((cat) => {
      const catTemplates = templates.filter((t) => t.category_id === cat.id);
      if (catTemplates.length === 0) return null;
      const tplLines = catTemplates
        .map((t) => `  [${t.id}] "${t.name}": "${t.body}"`)
        .join("\n");
      return `- Category "${cat.name}":\n${tplLines}`;
    })
    .filter(Boolean)
    .join("\n");

  const hasTemplates = templatesByCategory.length > 0;

  return `${flow.system_prompt || "You are an intelligent conversation router. Analyze conversations and classify them based on the rules provided."}

Your task is to analyze the following conversation and classify its current status.

CONVERSATION:
${conversationHistory}

CLASSIFICATION RULES:
${categoryRules}

VALID STATUS VALUES: ${validStatuses}
${hasTemplates ? `
RESPONSE TEMPLATES:
${templatesByCategory}
` : ""}
RESPOND EXCLUSIVELY IN JSON FORMAT WITH THIS EXACT STRUCTURE:
{
  "detected_status": "one of the valid status values above",
  "reasoning": "Technical explanation of why this status was chosen, referencing specific parts of the conversation",
  "suggested_stage": "A short label (2-3 words) describing the current stage of progress in this conversation toward its goal. Examples: 'recepción', 'extracción datos', 'validación', 'propuesta generada', 'pendiente aprobación', 'cualificación', 'recogida datos', 'cierre'. Use your judgement based on the conversation flow and system prompt context.",
  "needs_human": true or false,
  "needs_human_reason": "Brief explanation of why a human should review this conversation, or null if not needed",
  "extracted_info": {
      ${extractionFields}
  }${hasTemplates ? `,
  "suggested_template_id": "the id of the most appropriate template for the current conversation state, or null if none fits"` : ""}
}

IMPORTANT:
- detected_status MUST be one of the valid status values listed above
- reasoning should be concise but specific
- needs_human should be true ONLY when: there are signs of frustration or conflict, the prospect asks something completely outside the scope of all categories, or the situation genuinely requires human judgement (e.g. complaints, complex negotiations). When needs_human is false, needs_human_reason must be null
- needs_human should be FALSE when: the user type is unknown (business vs consumer), the conversation is early and lacks context, or the question can be answered with available templates/knowledge. Lack of qualification is NOT a reason to escalate — answer the question and ask a qualifying question instead
- extracted_info fields should be null if the information is not found in the conversation${hasTemplates ? `
- suggested_template_id MUST be a template id from the detected category that best matches the current point in the conversation, or null. If needs_human is true, suggested_template_id should be null
- NEVER suggest a template that has already been used in this conversation${usedTemplateIds.length > 0 ? `. Already used template IDs: ${usedTemplateIds.join(", ")}` : ""}` : ""}
- Respond ONLY with the JSON object, no additional text`;
}

export function buildKnowledgePrompt(
  flow: Flow,
  conversationHistory: string,
  textDocs: KnowledgeDoc[]
): string {
  const textDocsSection = textDocs
    .filter((d) => d.doc_type === "text" && d.content_text)
    .map((d) => `--- DOCUMENT: ${d.name} ---\n${d.content_text}\n--- END ---`)
    .join("\n\n");

  return `${flow.system_prompt || "You are a helpful assistant."}

CONVERSATION:
${conversationHistory}

${textDocsSection ? `REFERENCE DOCUMENTS:\n${textDocsSection}\n` : ""}
Using the reference documents and any attached files as your knowledge base, generate a response for the last message in the conversation.
- Respond ONLY with information present in the provided documents
- If the information is not available, say so honestly and offer alternatives if any exist in the documents
- Match the tone and language of the conversation
- Be concise (direct message format, not email)
- If the conversation does not yet reveal whether the user is a business (store, restaurant, distributor) or an end consumer, answer their question AND end with a brief qualifying question like "¿Tienes un negocio o es para consumo personal?"

Respond ONLY with the message text, no JSON or extra formatting.`;
}
