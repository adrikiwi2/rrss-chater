---
title: Portar policy engine completo a TypeScript
status: todo
priority: medium
tags: [backend]
---

## Objetivo
Portar la logica restante de `flowlab-agent/agent/policy_engine.py` a TypeScript en `lib/policy-engine.ts`.

## Ya implementado
- `max_interactions` hard limit: en `agent-cycle.ts`, si inbound count >= config escala a needs_human
- `needs_human` del LLM: ya manejado en agent-cycle.ts
- Template non-repetition: `usedTemplateIds` pasado a prompt-builder

## Logica pendiente
1. Evaluar `policy_rules` en orden (first match wins):
   - Condiciones (`when`): `detected_status`, `interaction_count_gte`, flags custom
   - Acciones (`then`): `template`, `set_flag`, `advance_to`, `escalate`
2. Fallback: usar `suggested_template_id` del LLM si existe
3. Default: `do_nothing`

## Integracion
- Llamar desde `agent-cycle.ts` entre la inferencia y el enqueue en outbox
- Usar `conversation_state` para leer/escribir flags e interaction_count
- Actualizar `lead.stage` segun `advance_to`
