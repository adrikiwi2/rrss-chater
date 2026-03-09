---
title: Integrar Composio SDK en FlowLab server
status: done
priority: high
tags: [composio, backend]
---

## Completado (2026-03-09)

- [x] `npm install @composio/core`
- [x] `lib/composio.ts`: `listConversations()`, `listMessages()`, `sendTextMessage()`
- [x] Env vars: `COMPOSIO_API_KEY`, toolkit version `20260223_00` en init
- [x] Tabla `composio_connections` en schema (tenant_id, channel, composio_account_id, composio_user_id, platform_user_id, platform_username, is_active)
- [x] Endpoint admin `GET/POST/DELETE /api/admin/composio-connections`
- [x] Conexion de prueba registrada para tenant Test (ca_398R9hYOETo6, theory.exe)
