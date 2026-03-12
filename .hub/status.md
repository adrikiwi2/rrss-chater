# Estado del proyecto — 2026-03-10

## Situacion actual
- MVP local **completo**: auth, flow designer, simulacion con inferencia Gemini
- DB migrada a Turso: `libsql://flowlab-adrikiwi2.aws-eu-west-1.turso.io`
- **Desplegado en produccion**: https://flowlab-eta.vercel.app
- Repo conectado a Vercel con auto-deploy en cada push a master
- Repo remoto: https://github.com/adrikiwi2/flowlab.git

## Cambio de arquitectura (2026-03-09)
- **flowlab-agent descartado**: la app local (FastAPI + PyInstaller + CDP/Playwright) se abandona
- **Composio como canal de ejecucion**: SDK `@composio/core` server-side para leer/enviar DMs de Instagram via API

## Novedades (2026-03-10)
- **Light/Dark theme**: toggle en sidebar (Sol/Luna) via `next-themes`. Paleta light completa con CSS variables. Persiste en localStorage, respeta `prefers-color-scheme`. Todos los componentes se adaptan automaticamente via tokens semanticos (`bg-base-*`, `text-text-*`, etc.). Clave: usar `@theme` (no `@theme inline`) en Tailwind v4 para que las utilidades referencien `var()` y las overrides de `html.light` cascadeen correctamente.
- **Sidebar de simulaciones colapsable**: panel de lista de simulations minimizable a 40px con icono toggle (`PanelLeftClose`/`PanelLeftOpen`). Chat area ocupa todo el ancho al colapsar.
- **Knowledge Base**: nueva tabla `knowledge_docs` para documentos de referencia (PDF o texto plano) a nivel de flow
- **Category mode**: categorias ahora tienen `mode` (`template`|`knowledge`). En modo knowledge, el agente genera respuestas libres consultando los documentos del flow en vez de sugerir templates
- **Pipeline de 2 pasos**: clasificacion (existente) + generacion con knowledge (nuevo). Gemini recibe PDFs como `inlineData` multimodal y textos en prompt
- **UI Knowledge Base**: seccion en Designer para subir PDFs y crear documentos de texto. Toggle de mode en cada categoria (solo visible si hay docs)
- **Simulation + Live**: respuestas generadas se muestran como "Knowledge Response" en result cards y "AI Generated" en outbox
- **API**: `GET/POST /api/knowledge-docs`, `GET/PUT/DELETE /api/knowledge-docs/:docId`
- **InferenceResult ampliado**: nuevo campo `generated_response` para respuestas de knowledge mode
- **IberoExpress flow reconfigurado en local + prod**:
  - System prompt completo con info de empresa, marcas, cobertura, links utiles
  - 11 categorias (antes 8): +Consulta de producto (knowledge), +HORECA (template), +Recetas/uso (knowledge)
  - 2 knowledge docs: catalogo congelados + recetas
  - 15 templates (antes 13): +2 HORECA, 6 existentes reescritos (cobertura geografica, links)
  - 7 extract fields limpios (antes 10 con redundancias): nombre_negocio, nombre_contacto, telefono, email, ubicacion, tipo_negocio, productos_interes
  - Eliminada categoria "need_human" espuria en prod
- **Prompt de clasificacion mejorado**: `needs_human` ya NO escala por falta de cualificacion (B2B vs B2C). En su lugar, el agente responde la pregunta y anade pregunta de cualificacion automaticamente
- **Knowledge prompt con cualificacion**: cuando el tipo de usuario es desconocido, la respuesta generada incluye pregunta de cualificacion al final ("¿Tienes un negocio o es para consumo personal?")
- **PDF upload limit**: validacion frontend 3MB (limite real Vercel serverless 4.5MB con expansion base64)

## Novedades (2026-03-09)
- **Composio integrado**: modulo `lib/composio.ts`, tabla `composio_connections`, endpoint admin CRUD
- **Pestana Live**: tercera pestana en la vista de flow (Designer | Simulate | Live)
- **Publish/Unpublish**: toggle en UI con validaciones (agent_config + categories + composio connection)
- **Scan Inbox**: boton que ejecuta el ciclo de ejecucion para un flow: poll conversations → import messages → inference Gemini → encolar en outbox
- **Approval UI**: tarjetas con clasificacion + template propuesto, botones Approve & Send / Reject
- **Needs Human Review**: leads escalados con razon. Boton Resolve con selector de stage del agent_config
- **Guard anti-duplicados**: leads en needs_human no se re-procesan en scans sucesivos (mensajes si se importan)
- **Columna `is_published`** en flows (migration safe)
- **Probado end-to-end en local**: 13 conversaciones, 47 mensajes importados, 5 inferencias, 1 mensaje encolado
- **OAuth self-service**: flujo Connect Instagram en Live tab via Composio magic link (`connectedAccounts.initiate`). Endpoints: `GET/POST /api/connect-instagram` + callback. Boton en UI que abre la autorizacion en nueva pestana, callback guarda la conexion automaticamente.
- **max_interactions**: hard limit implementado en `agent-cycle.ts` — si inbound count >= config, escala a needs_human
- **Template non-repetition**: `usedTemplateIds` pasado a prompt-builder, Gemini instruido a no re-sugerir templates ya usadas
- **Password reset**: test@test.com reseteado a `test1234` en DB local

## Novedades previas (2026-03-08)
- `needs_human` flag con evaluacion en cada inferencia
- Bearer token auth para clientes externos
- `agent_config` columna JSON en flows (admin-only)
- Schema extendido: 5 tablas agent + composio_connections

## Pendiente
1. **🔴 Flow "Leads Telegram" para Tradingpro**: nuevo flow inbound via ads IG/FB → Telegram. Gancho: 3 meses gratis canal privado. Pendiente: ejemplos de interacciones reales del cliente + resolver preguntas de diseño (tono, escalacion, knowledge vs templates). Ver [task](tasks/tradingpro-telegram-flow.md) y [contexto](tasks/tradingpro-flow-context.md)
2. **Policy engine completo**: portar logica de stages/flags/policy_rules desde flowlab-agent (max_interactions ya implementado)
3. **Dashboard de conversaciones**: vista detallada de leads con historial de mensajes
4. **Cron automatico**: Vercel Cron o webhook de Composio para ejecutar ciclo sin boton manual
5. **Catalogo completo IberoExpress**: anadir producto seco al knowledge doc (solo congelados por ahora)
6. **Tradingpro backlog** (baja prioridad): 5 flows futuros — seguidores IG, LinkedIn (contactos/likes/visitas), WhatsApp seguimiento clientes, automatizacion RRSS, prospeccion afiliados. Ver [backlog](tasks/tradingpro-future-flows.md)

## Tenants en produccion
| Tenant | Email | Flow | Contexto | agent_config |
|---|---|---|---|---|
| Test | test@test.com | Soporte Tecnico | Tenant de pruebas | instagram, 5 stages |
| IberoExpress | ibero@test.com | Leads Organicos (inbound) | 11 cats (2 knowledge), 15 tpls, 2 knowledge docs, 7 fields | — |
| Tradingpro | tradingpro@test.com | Outreach Inversiones (existente, no publicado) | 7 cats (template), 7 tpls, 8 fields, 0 knowledge docs | — |
| Tradingpro | tradingpro@test.com | Leads Telegram (PENDIENTE) | Flow nuevo: inbound via ads → Telegram. En diseño | — |

## Conexiones Composio (local)
| Tenant | Channel | Account ID | Platform Username |
|---|---|---|---|
| Test | instagram | ca_398R9hYOETo6 | theory.exe |

## Infraestructura
| Entorno | DB | Config |
|---|---|---|
| Local | `file:flowlab.db` | `.env.local` |
| Produccion | `libsql://flowlab-adrikiwi2.aws-eu-west-1.turso.io` | Vercel env vars |
