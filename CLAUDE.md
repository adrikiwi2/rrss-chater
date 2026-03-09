# FlowLab

Plataforma multi-tenant para disenar, simular y ejecutar flujos de conversacion con IA sobre canales reales (Instagram, WhatsApp).

## Stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **UI:** React 19, Tailwind CSS 4, Lucide icons. Dark theme. Sin librerias de componentes.
- **DB:** SQLite via @libsql/client (local: `file:flowlab.db`, prod: Turso)
- **Auth:** JWT (jose) + bcryptjs. Cookie-based para web, Bearer token para clientes externos.
- **LLM:** Google Gemini (`gemini-3.1-flash-lite-preview`) via @google/generative-ai
- **Messaging:** Composio SDK (`@composio/core`) para leer/enviar DMs de Instagram via API
- **IDs:** nanoid

## Arquitectura

```
src/
  app/
    (dashboard)/          # Layout con Sidebar colapsable
      flow/[flowId]/      # Pestanas: Designer | Simulate | Live
      page.tsx            # Dashboard root
    api/
      admin/              # tenants, seed, composio-connections, agent-cycle — protegidos con ADMIN_SECRET
      auth/               # login, logout, me, token
      flows/              # CRUD flows + publish + scan
      categories/         # CRUD categories
      extract-fields/     # CRUD extract fields
      templates/          # CRUD templates
      inference/          # POST — clasificacion con Gemini
      simulations/        # CRUD simulations
      leads/              # GET leads, POST resolve
      outbox/             # GET pending, POST approve/reject
      connect-instagram/  # GET check connection, POST initiate OAuth, GET callback
    login/                # Login page
  components/
    sidebar.tsx           # Panel lateral colapsable (minimizado por defecto)
    flow-designer.tsx     # Categorias + templates inline + extract fields
    simulation-panel.tsx  # Chat simulado + inferencia multiple + persistencia
    live-panel.tsx        # Pestana Live: connect instagram, publish toggle, scan inbox, approval queue, needs_human, leads table
    ai-result-card.tsx    # Tarjeta resultado inferencia (colapsable con ?) + banner needs_human
    agent-config-panel.tsx # Panel read-only de agent_config (stages, flags, policy rules)
    chat-bubble.tsx       # Burbuja de mensaje
    role-switcher.tsx     # Switcher rol A/B/inference
  lib/
    db.ts                 # Conexion SQLite, schema, queries, migraciones
    auth.ts               # JWT sign/verify, cookies
    get-tenant.ts         # Extraer tenant_id de cookie o Bearer header
    router.ts             # classifyConversation() — llama a Gemini
    prompt-builder.ts     # Construye prompt con categorias, templates, fields + needs_human
    composio.ts           # Cliente Composio: listConversations, listMessages, sendTextMessage, initiateConnection
    agent-cycle.ts        # Ciclo de ejecucion: poll → import → inference → enqueue outbox
    types.ts              # Interfaces TypeScript
```

## Modelo de datos

### Core (diseno de flujos)
- **Tenant** → tiene muchos Flows (aislamiento total)
- **Flow** → tiene Categories, ExtractFields, Templates, Simulations. Columnas `agent_config` (JSON, nullable, admin-only) e `is_published` (boolean).
- **Category** → reglas de clasificacion, color. Tiene Templates asociados.
- **Template** → body con variables {{var}}, vinculado a una Category
- **ExtractField** → campo que Gemini debe extraer de la conversacion
- **Simulation** → mensajes (JSON blob) + mapa de inferencias (msgId → InferenceResult)

### Agent (conversaciones reales)
- **Lead** → contacto descubierto por canal, vinculado a tenant + flow. Flags `needs_human`, `stage`, `owner`.
- **Message** → mensaje in/out de un lead, con resultado de inferencia opcional. Deduplicado por `platform_message_id`.
- **ConversationState** → stage + flags JSON + contadores por lead.
- **Outbox** → cola de mensajes pendientes de aprobacion. Status: pending → sent/rejected/failed.
- **LeadEvent** → audit trail de cambios de stage y acciones.
- **ComposioConnection** → cuenta de Composio vinculada a un tenant (channel, account_id, user_id, platform_user_id).

## Autenticacion

- **Web (UI):** Cookie HttpOnly `flowlab_token` (JWT HS256, 30 dias). Set via `POST /api/auth/login`.
- **Clientes externos:** `POST /api/auth/token` devuelve JWT como JSON. Usar con header `Authorization: Bearer <token>`.
- **Middleware:** acepta cookie o Bearer token. Inyecta `x-tenant-id` en headers para downstream.
- **Admin:** endpoints `/api/admin/*` usan `Authorization: Bearer ADMIN_SECRET`.

## Flujo de inferencia (simulacion y produccion)

El pipeline es identico en simulacion y en produccion:

1. Mensajes (simulados o reales via Composio) se formatean como `SimMessage[]`
2. `prompt-builder.ts` construye prompt con: system_prompt + conversacion + reglas + templates + fields + instruccion needs_human + usedTemplateIds (para no repetir)
3. Gemini responde JSON: `{ detected_status, reasoning, needs_human, needs_human_reason, extracted_info, suggested_template_id }`
4. En simulacion: resultado se muestra en UI
5. En produccion: si needs_human → escalar lead. Si suggested_template → encolar en outbox para aprobacion humana.

## Ciclo de ejecucion (agent-cycle.ts)

Para cada flow publicado con composio_connection activa:

1. `listConversations()` via Composio SDK
2. Por cada conversacion: `listMessages()`, identificar lead, upsert en DB
3. Importar mensajes nuevos (deduplicacion por `platform_message_id`)
4. Hard limit: si `inbound_count >= agent_config.max_interactions` → escalar a needs_human
5. Si hay nuevos inbound y lead NO esta en `needs_human`: ejecutar `classifyConversation()` con `usedTemplateIds`
6. Si `needs_human` → marcar lead, no responder
7. Si `suggested_template_id` → encolar en outbox como `pending` (human-in-the-loop)
8. Humano aprueba/rechaza desde la pestana Live

Trigger: boton "Scan Inbox" en UI (POST /api/flows/:id/scan) o admin cron (POST /api/admin/agent-cycle).

## agent_config

Columna JSON en `flows`, admin-only. Define como el agente procesa conversaciones reales.

```json
{
  "channel": "instagram",
  "mode": "outreach",
  "stages": ["outreach_sent", "replied", "engaged", "converted", "needs_human"],
  "initial_stage": "outreach_sent",
  "flags": ["cta_sent"],
  "policy_rules": [{ "when": {...}, "then": {...} }],
  "max_interactions": 4,
  "confidence_threshold": 0.7
}
```

## Comandos

```bash
npm run dev       # Servidor desarrollo (localhost:3000)
npm run build     # Build produccion
npm run start     # Servidor produccion
npm run lint      # ESLint
```

## Convenciones

- Todas las rutas API validan tenant_id desde cookie JWT o Bearer token
- Los endpoints admin usan Bearer token (ADMIN_SECRET)
- Los componentes usan `"use client"` cuando tienen estado
- Edicion inline con blur-to-save (sin boton guardar explicito)
- Las simulaciones persisten multiples inferencias en `last_result_json` como mapa `{ msgId: InferenceResult }`
- `needs_human` es un flag de sistema ortogonal a las categories — el LLM siempre lo evalua
- `agent_config` es null por defecto (flow solo simulacion). Con valor → flow publicable
- `is_published` activa el ciclo de ejecucion para un flow
- Los mensajes propuestos se encolan en outbox (pending) — nunca se envian automaticamente
- Leads en `needs_human` no se re-procesan en scans sucesivos (mensajes si se importan)
- Resolve de un lead: humano elige stage del agent_config, needs_human=0, owner=bot
- OAuth self-service: `POST /api/connect-instagram` genera magic link via Composio, callback guarda la conexion. Env var `COMPOSIO_AUTH_CONFIG_ID` requerida.
- `max_interactions` hard limit: implementado directamente en agent-cycle.ts, no requiere policy engine
- Template non-repetition: prompt-builder recibe `usedTemplateIds` para instruir al LLM a no re-sugerir
