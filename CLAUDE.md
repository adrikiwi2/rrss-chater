# FlowLab

Plataforma multi-tenant para disenar, simular y testear flujos de conversacion con IA.

## Stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **UI:** React 19, Tailwind CSS 4, Lucide icons. Dark theme. Sin librerias de componentes.
- **DB:** SQLite via @libsql/client (local: `file:flowlab.db`, prod: Turso)
- **Auth:** JWT (jose) + bcryptjs, cookie-based, multi-tenant
- **LLM:** Google Gemini (`gemini-3.1-flash-lite-preview`) via @google/generative-ai
- **IDs:** nanoid

## Arquitectura

```
src/
  app/
    (dashboard)/          # Layout con Sidebar colapsable
      flow/[flowId]/      # Pestanas: Designer | Simulate
      page.tsx            # Dashboard root
    api/
      admin/              # tenants (POST), seed (POST) — protegidos con ADMIN_SECRET
      auth/               # login, logout, me
      flows/              # CRUD flows
      categories/         # CRUD categories
      extract-fields/     # CRUD extract fields
      templates/          # CRUD templates
      inference/          # POST — clasificacion con Gemini
      simulations/        # CRUD simulations
    login/                # Login page
  components/
    sidebar.tsx           # Panel lateral colapsable (minimizado por defecto)
    flow-designer.tsx     # Categorias + templates inline + extract fields
    simulation-panel.tsx  # Chat simulado + inferencia multiple + persistencia
    ai-result-card.tsx    # Tarjeta resultado inferencia (colapsable con ?)
    chat-bubble.tsx       # Burbuja de mensaje
    role-switcher.tsx     # Switcher rol A/B/inference
  lib/
    db.ts                 # Conexion SQLite, schema, queries
    auth.ts               # JWT sign/verify, cookies
    get-tenant.ts         # Extraer tenant_id de la cookie
    router.ts             # classifyConversation() — llama a Gemini
    prompt-builder.ts     # Construye prompt con categorias, templates, fields
    types.ts              # Interfaces TypeScript
```

## Modelo de datos

- **Tenant** → tiene muchos Flows (aislamiento total)
- **Flow** → tiene Categories, ExtractFields, Templates, Simulations
- **Category** → reglas de clasificacion, color. Tiene Templates asociados.
- **Template** → body con variables {{var}}, vinculado a una Category
- **ExtractField** → campo que Gemini debe extraer de la conversacion
- **Simulation** → mensajes (JSON blob) + mapa de inferencias (msgId → InferenceResult)

## Flujo de inferencia

1. Frontend envia `POST /api/inference` con `{ flow_id, messages }`
2. Backend carga el flow completo (categorias, templates, fields)
3. `prompt-builder.ts` construye prompt con: system_prompt + conversacion + reglas + templates agrupados por categoria + fields
4. Gemini responde JSON: `{ detected_status, reasoning, extracted_info, suggested_template_id }`
5. Frontend inserta el template sugerido como mensaje del rol A y muestra tarjeta de decision

## Comandos

```bash
npm run dev       # Servidor desarrollo (localhost:3000)
npm run build     # Build produccion
npm run start     # Servidor produccion
npm run lint      # ESLint
```

## Convenciones

- Todas las rutas API validan tenant_id desde cookie JWT
- Los endpoints admin usan Bearer token (ADMIN_SECRET)
- Los componentes usan `"use client"` cuando tienen estado
- Edicion inline con blur-to-save (sin boton guardar explicito)
- Las simulaciones persisten multiples inferencias en `last_result_json` como mapa `{ msgId: InferenceResult }`
