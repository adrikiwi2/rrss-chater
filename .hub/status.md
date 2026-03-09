# Estado del proyecto — 2026-03-09

## Situacion actual
- MVP local **completo**: auth, flow designer, simulacion con inferencia Gemini
- DB migrada a Turso: `libsql://flowlab-adrikiwi2.aws-eu-west-1.turso.io`
- **Desplegado en produccion**: https://flowlab-eta.vercel.app
- Repo conectado a Vercel con auto-deploy en cada push a master
- Repo remoto: https://github.com/adrikiwi2/flowlab.git

## Cambio de arquitectura (2026-03-09)
- **flowlab-agent descartado**: la app local (FastAPI + PyInstaller + CDP/Playwright) se abandona
- **Composio como canal de ejecucion**: SDK `@composio/core` server-side para leer/enviar DMs de Instagram via API

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
1. **Deploy a produccion**: push a master con las nuevas features, configurar `COMPOSIO_API_KEY` + `COMPOSIO_AUTH_CONFIG_ID` en Vercel env vars
2. **Policy engine completo**: portar logica de stages/flags/policy_rules desde flowlab-agent (max_interactions ya implementado)
3. **Dashboard de conversaciones**: vista detallada de leads con historial de mensajes
4. **Cron automatico**: Vercel Cron o webhook de Composio para ejecutar ciclo sin boton manual

## Tenants en produccion
| Tenant | Email | Flow | Contexto | agent_config |
|---|---|---|---|---|
| Test | test@test.com | Soporte Tecnico | Tenant de pruebas | instagram, 5 stages |
| IberoExpress | ibero@test.com | Leads Organicos (inbound) | Distribucion de alimentos, 8 cats, 13 tpls, 10 fields | — |

## Conexiones Composio (local)
| Tenant | Channel | Account ID | Platform Username |
|---|---|---|---|
| Test | instagram | ca_398R9hYOETo6 | theory.exe |

## Infraestructura
| Entorno | DB | Config |
|---|---|---|
| Local | `file:flowlab.db` | `.env.local` |
| Produccion | `libsql://flowlab-adrikiwi2.aws-eu-west-1.turso.io` | Vercel env vars |
