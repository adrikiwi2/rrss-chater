# Crear flow "Leads Telegram" para Tradingpro

**Prioridad:** URGENTE
**Tenant:** Tradingpro (`xQBjnyhFY1oPtmFtDn7U5`)
**Fecha:** 2026-03-12

## Contexto

Tradingpro quiere un nuevo flow para leads que entran via Telegram tras ver publicidad en Instagram/Facebook. El ad es genérico sobre TradingPro (no menciona un producto concreto). Al entrar en el canal de Telegram, el bot envía un mensaje de bienvenida tipo "¿En qué puedo ayudarte?".

El primer gancho comercial son **3 meses gratuitos del canal privado de pago** (TradingRoom diaria con Álvaro y José, portfolio compartido).

## Info recopilada

Ver detalle completo de productos, precios y contexto en → [tradingpro-flow-context.md](./tradingpro-flow-context.md)

### Respuestas confirmadas
1. **Ad genérico** — no menciona producto concreto
2. **Objetivo de conversión** — ofrecer 3 meses gratis del canal privado de Telegram (de pago) como gancho. Incluye TradingRoom diaria + portfolio TradingPro
3. **Link de registro/checkout** — ❓ PENDIENTE: ¿hay link de registro para los 3 meses gratis? ¿O se gestiona manualmente?

### Pendiente de cliente
- **Ejemplos de interacciones reales** — necesitamos que nos pasen conversaciones reales de este canal para diseñar categories y templates con precisión
- **Link de registro para 3 meses gratis** del canal privado de Telegram

### Info recopilada (2026-03-12)
- Perfiles completos de Álvaro y José Basagoiti (fundadores, hermanos, imparten clases y gestionan portfolio)
- Info completa de Darwinex (broker recomendado, canal de ingresos por referidos)
- Todos los links de productos, Darwinex, registro, etc. guardados en context para usar en templates
- Ver [tradingpro-flow-context.md](./tradingpro-flow-context.md) para detalle completo

### Preguntas pendientes (bloquean diseño del flow)
4. **Tono** — ¿Tuteo informal o profesional? (el copy de la web mezcla ambos, tiende a informal)
5. **Escalación** — ¿Escalar a humano solo si pide hablar con alguien? ¿También si hot lead con intención de compra seria?
6. **Templates vs Knowledge** — ¿El agente debe responder preguntas sobre productos (precios, contenido, diferencias entre cursos) en modo knowledge consultando docs? ¿O templates cerrados?
7. **Producto a priorizar** — ¿Siempre empujar primero los 3 meses gratis como gancho? ¿O depende de lo que pregunte el lead?

## Productos TradingPro (para diseñar categories)

| Producto | Precio | URL |
|---|---|---|
| Más que Mercados (curso gratuito) | Gratis (registro) | tradingpro.app/formacion/mas-que-mercados |
| Curso Inversión y Trading | 1.590€ (oferta, PVP 2.070€) | tradingpro.app/formacion/cursos/inversion-y-trading |
| Programa Mentoría Inversión | 1.590€ (oferta, PVP 2.070€) | tradingpro.app/formacion/cursos/programa-mentoria-inversion |
| Miniclases gratis (videos) | Gratis | tradingpro.app/formacion/videos |
| Membresía PROINVESTOR | 100€/mes · 540€/sem · 960€/año | tradingpro.app/membresia-trading-tradingpro |
| **3 meses canal privado gratis** | Gratis (gancho) | ❓ link pendiente |

## Pasos para crear el flow

1. Resolver preguntas pendientes (4-7)
2. Diseñar categories + rules
3. Crear templates con variables
4. Definir extract fields
5. Decidir si usar knowledge docs (info detallada de productos) o solo templates
6. Crear flow via API o directamente en Turso prod
7. (Futuro) Configurar agent_config + conexión canal Telegram

## Acceso directo a Turso prod

```bash
# Leer
node -e "
const { createClient } = require('@libsql/client');
const db = createClient({
  url: 'libsql://flowlab-adrikiwi2.aws-eu-west-1.turso.io',
  authToken: '<TOKEN>'
});
db.execute('SELECT ...').then(r => console.log(r.rows));
"
```

Token: se obtiene con `turso db tokens create flowlab` (expira, regenerar si falla).

## Notas
- Tradingpro ya tiene un flow existente "Outreach Inversiones" (outbound frío, no publicado). Este nuevo flow es diferente: inbound templado via ads
- El tenant ya existe en prod con credenciales `tradingpro@test.com`
- FlowLab aún no soporta Telegram como canal (solo Instagram via Composio). Habría que evaluar si Composio soporta Telegram o buscar alternativa
