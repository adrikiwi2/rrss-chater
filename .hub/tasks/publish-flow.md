---
title: Publish flow + ciclo de ejecucion + approval UI
status: done
priority: high
tags: [composio, frontend, backend]
---

## Completado (2026-03-09)

- [x] Columna `is_published` (INTEGER) en flows via migration safe
- [x] Pestana **Live** en UI del flow (Designer | Simulate | Live)
- [x] Toggle Publish/Unpublish con validaciones (agent_config + categories + composio_connection)
- [x] `lib/agent-cycle.ts`: ciclo completo (poll → import → inference → enqueue)
- [x] Boton **Scan Inbox** en pestana Live (POST /api/flows/:id/scan)
- [x] Outbox con status `pending` — mensajes NO se envian automaticamente
- [x] **Approval UI**: tarjeta por mensaje con clasificacion + template + Approve & Send / Reject
- [x] Endpoint `POST /api/outbox/:id` (approve → send via Composio + persist message, reject → mark rejected)
- [x] **Needs Human Review**: leads escalados con razon explicativa
- [x] **Resolve**: boton con selector de stage del agent_config → needs_human=0, owner=bot
- [x] Guard: leads en needs_human se saltan inference en scans sucesivos (mensajes si se importan)
- [x] Endpoint `GET /api/leads?flow_id=` y `GET /api/outbox?flow_id=`
- [x] Probado end-to-end: 13 convs, 47 msgs, 5 inferences, 6 leads, 3 needs_human, 1 queued
