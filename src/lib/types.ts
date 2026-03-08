export interface Tenant {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  is_active: number;
  created_at: string;
}

export interface Flow {
  id: string;
  tenant_id: string;
  name: string;
  description: string;
  system_prompt: string;
  role_a_label: string;
  role_b_label: string;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  flow_id: string;
  name: string;
  color: string;
  rules: string;
  sort_order: number;
}

export interface ExtractField {
  id: string;
  flow_id: string;
  field_name: string;
  field_type: "text" | "email" | "number" | "date";
  description: string;
}

export interface Template {
  id: string;
  flow_id: string;
  category_id: string | null;
  name: string;
  body: string;
  created_at: string;
}

export interface SimMessage {
  id: string;
  role: "a" | "b";
  body: string;
  timestamp: string;
}

export interface Simulation {
  id: string;
  flow_id: string;
  title: string;
  messages_json: string;
  last_result_json: string | null;
  detected_status: string | null;
  created_at: string;
  updated_at: string;
}

export interface InferenceResult {
  detected_status: string;
  reasoning: string;
  needs_human: boolean;
  needs_human_reason: string | null;
  extracted_info: Record<string, string | null>;
  suggested_template_id?: string | null;
}

export interface FlowWithDetails extends Flow {
  categories: Category[];
  extract_fields: ExtractField[];
  templates: Template[];
}
