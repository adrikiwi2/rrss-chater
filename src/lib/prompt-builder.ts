import type { Flow, Category, ExtractField, Template, SimMessage } from "./types";

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
  conversationHistory: string
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
- needs_human should be true when: the conversation is ambiguous or doesn't clearly fit any category, the prospect asks something unexpected or outside the scope of available templates, there are signs of frustration or conflict, or the automated response would be inadequate. When needs_human is false, needs_human_reason must be null
- extracted_info fields should be null if the information is not found in the conversation${hasTemplates ? `
- suggested_template_id MUST be a template id from the detected category that best matches the current point in the conversation, or null. If needs_human is true, suggested_template_id should be null` : ""}
- Respond ONLY with the JSON object, no additional text`;
}
