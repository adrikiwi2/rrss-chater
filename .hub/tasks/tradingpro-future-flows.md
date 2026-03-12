# TradingPro — Flows futuros (backlog)

**Tenant:** Tradingpro (`xQBjnyhFY1oPtmFtDn7U5`)
**Prioridad:** BAJA (pendiente de que el flow de Telegram Leads esté operativo)

---

## 1. Seguidores Instagram

**Canal:** Instagram DMs
**Tipo:** Outbound
**Descripción:** Contactar a nuevos seguidores del perfil de TradingPro en Instagram. Mensaje de bienvenida automatizado + clasificación de intención + derivación a producto.

---

## 2. LinkedIn — Contactos y engagement

**Canal:** LinkedIn
**Tipo:** Outbound / Semi-inbound
**Descripción:** Tres fuentes de leads desde LinkedIn:
- **Contactos directos** de TradingPro: outreach a conexiones existentes
- **Perfiles que dan like a publicaciones**: detectar interés y contactar
- **Personas que ven el perfil de TradingPro**: señal de curiosidad, iniciar conversación

Nota: requiere evaluar qué APIs/herramientas permiten acceder a estos datos (LinkedIn es restrictivo con automatizaciones).

---

## 3. WhatsApp — Seguimiento y venta cruzada a clientes

**Canal:** WhatsApp
**Tipo:** Outbound a clientes existentes
**Descripción:** Dar seguimiento a clientes actuales (alumnos de cursos, miembros PROINVESTOR) para:
- Seguimiento de satisfacción
- Upsell de productos complementarios (ej: alumno de curso gratuito → curso de pago, miembro mensual → anual)
- Cross-sell (ej: alumno de trading → mentoría inversión, Darwinex)
- Renovaciones de membresía

Nota: requiere evaluar integración WhatsApp Business API (Composio u otra herramienta).

---

## 4. Automatización de publicaciones en Redes Sociales

**Canal:** Instagram, LinkedIn, Twitter/X, etc.
**Tipo:** Automatización de contenido (no conversacional)
**Descripción:** Programar y automatizar publicaciones en redes sociales de TradingPro. No es un flow conversacional de FlowLab, pero es una necesidad de automatización del tenant.

Nota: fuera del scope actual de FlowLab (que es conversacional). Evaluar herramientas externas o si tiene sentido extender FlowLab.

---

## 5. Prospección para nuevos afiliados

**Canal:** Email / LinkedIn / DMs
**Tipo:** Outbound
**Descripción:** Contactar potenciales afiliados (influencers financieros, creadores de contenido, educadores) para que recomienden TradingPro a su audiencia. Incluye:
- Identificación de candidatos
- Outreach con propuesta de afiliación
- Seguimiento y negociación de condiciones
- Darwinex como ejemplo de modelo afiliado exitoso (referidos)

---

## Dependencias comunes

- **Telegram Leads** (flow urgente) debe funcionar primero como referencia
- Evaluar soporte de canales en Composio: Instagram DMs (ya funciona), WhatsApp, LinkedIn, Telegram
- Cada flow necesitará su propio diseño de categories, templates, extract fields
