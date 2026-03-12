# Disenar y crear un flow conversacional en FlowLab

Eres un disenador de flujos conversacionales para FlowLab. Tu tarea es entender el caso de uso del cliente, disenar un flujo completo (categories, templates, extract fields, knowledge docs) y crearlo en la base de datos de produccion.

## Conexion a Turso prod

Usa `@libsql/client` con las env vars del proyecto:
```js
const { createClient } = require('@libsql/client');
const { nanoid } = require('nanoid');
require('dotenv').config({ path: '.env.local' });

const db = createClient({
  url: process.env.TURSO_DATABASE_URL_PROD,
  authToken: process.env.TURSO_AUTH_TOKEN,
});
```

## Paso 1: Entender el caso de uso

Pregunta al usuario (si no te lo ha dicho):

1. **Tenant**: para que tenant es el flow? Lista los existentes si no lo sabe:
   ```sql
   SELECT id, name, email FROM tenants WHERE is_active = 1
   ```

2. **Contexto del negocio**: que vende o hace la empresa?

3. **Canal y origen**: por donde entran los leads? (Instagram, WhatsApp, Telegram, etc.). Es inbound (el lead llega por su cuenta) o outbound (la empresa contacta primero)?

4. **Primer mensaje**: cual es el primer mensaje de la conversacion? Lo envia el bot o el lead?

5. **Objetivo de conversion**: que accion queremos que haga el lead? (registrarse, agendar llamada, comprar, etc.)

6. **Tono**: informal/tuteo, profesional/usted, o mixto?

7. **Productos/servicios**: lista de lo que ofrecen con precios si aplica

8. **Escalacion**: cuando escalar a humano?

## Paso 2: Disenar el flujo

Con la info del usuario, propone:

### Categories (buckets de clasificacion)
Cada category necesita:
- **name**: nombre descriptivo corto
- **rules**: descripcion en lenguaje natural de cuando aplica esta categoria. Gemini usa esto para clasificar
- **mode**: `template` (respuesta predefinida) o `knowledge` (respuesta libre consultando docs)
- **color**: hex color para UI

Colores sugeridos por tipo:
- Positivo/interes: `#22c55e` (verde)
- Agendar/convertir: `#3b82f6` (azul)
- Preguntas/info: `#f59e0b` (amarillo)
- Esceptico/objecion: `#f97316` (naranja)
- Rechazo: `#ef4444` (rojo)
- Ambiguo/neutro: `#8b5cf6` (morado)

### Templates (1+ por category en mode=template)
Cada template necesita:
- **name**: nombre descriptivo
- **body**: texto de respuesta con variables `{{variable}}`
- **category_id**: vinculado a una category

Variables comunes: `{{nombre}}`, `{{empresa}}`, `{{link}}`, `{{precio}}`

### Extract Fields (datos a extraer)
Campos que Gemini debe intentar extraer de cada mensaje:
- **field_name**: snake_case
- **field_type**: `text` (siempre text por ahora)
- **description**: que buscar

Campos universales utiles: nombre, sentimiento, objecion_principal

### Knowledge Docs (opcional, para categories en mode=knowledge)
Si el agente necesita responder preguntas libres sobre productos/servicios:
- **doc_type**: `text` o `pdf`
- **content_text**: contenido del documento
- Knowledge docs son a nivel de flow (todas las categories knowledge los consultan)

### System Prompt
Prompt que define la personalidad y contexto del agente. Incluir:
- Quien es el agente (empresa, rol)
- Tono de comunicacion
- Objetivo de la conversacion
- Restricciones (que NO debe hacer)

## Paso 3: Confirmar con el usuario

Presenta el diseno completo en formato tabla:

**Flow:** nombre + descripcion
**System Prompt:** (mostrar completo)

**Categories:**
| # | Nombre | Mode | Rules (resumen) | Color |
|---|---|---|---|---|

**Templates:**
| # | Nombre | Category | Body (resumen) |
|---|---|---|---|

**Extract Fields:**
| # | Campo | Descripcion |
|---|---|---|

**Knowledge Docs:**
| # | Nombre | Tipo | Contenido (resumen) |
|---|---|---|---|

Pide confirmacion antes de insertar.

## Paso 4: Insertar en Turso prod

Ejecuta los INSERTs en este orden (por foreign keys):
1. Flow
2. Categories
3. Templates (necesitan category_id)
4. Extract Fields
5. Knowledge Docs

### Schema de las tablas

```sql
-- Flow
INSERT INTO flows (id, tenant_id, name, description, system_prompt, role_a_label, role_b_label)
VALUES (nanoid, tenant_id, name, desc, prompt, 'Agente', 'Lead');

-- Category
INSERT INTO categories (id, flow_id, name, color, rules, sort_order, mode)
VALUES (nanoid, flow_id, name, color, rules, order, 'template'|'knowledge');

-- Template
INSERT INTO templates (id, flow_id, category_id, name, body)
VALUES (nanoid, flow_id, cat_id, name, body);

-- Extract Field
INSERT INTO extract_fields (id, flow_id, field_name, field_type, description)
VALUES (nanoid, flow_id, field, 'text', desc);

-- Knowledge Doc (text)
INSERT INTO knowledge_docs (id, flow_id, name, doc_type, content_text, sort_order)
VALUES (nanoid, flow_id, name, 'text', content, order);
```

Todos los IDs son `nanoid(21)`.

Genera todos los nanoids al inicio del script y guarda la relacion category_id → template para vincularlos correctamente.

### Ejemplo de script completo

```js
const { createClient } = require('@libsql/client');
const { nanoid } = require('nanoid');
require('dotenv').config({ path: '.env.local' });

const db = createClient({
  url: process.env.TURSO_DATABASE_URL_PROD,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function main() {
  const TENANT_ID = '...';
  const FLOW_ID = nanoid(21);

  // Categories
  const cats = {
    interesado: nanoid(21),
    rechazo: nanoid(21),
    // ... etc
  };

  // Templates
  const tpls = {
    resp_interesado: nanoid(21),
    // ... etc
  };

  // --- INSERT Flow ---
  await db.execute({
    sql: `INSERT INTO flows (id, tenant_id, name, description, system_prompt, role_a_label, role_b_label)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [FLOW_ID, TENANT_ID, 'Flow Name', 'Description', 'System prompt...', 'Agente', 'Lead'],
  });

  // --- INSERT Categories ---
  const catRows = [
    [cats.interesado, FLOW_ID, 'Interesado', '#22c55e', 'Rules...', 0, 'template'],
    // ...
  ];
  for (const row of catRows) {
    await db.execute({
      sql: 'INSERT INTO categories (id, flow_id, name, color, rules, sort_order, mode) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: row,
    });
  }

  // --- INSERT Templates ---
  const tplRows = [
    [tpls.resp_interesado, FLOW_ID, cats.interesado, 'Respuesta a interesado', 'Body con {{nombre}}...'],
    // ...
  ];
  for (const row of tplRows) {
    await db.execute({
      sql: 'INSERT INTO templates (id, flow_id, category_id, name, body) VALUES (?, ?, ?, ?, ?)',
      args: row,
    });
  }

  // --- INSERT Extract Fields ---
  const fields = [
    [nanoid(21), FLOW_ID, 'nombre', 'text', 'Nombre del lead'],
    // ...
  ];
  for (const row of fields) {
    await db.execute({
      sql: 'INSERT INTO extract_fields (id, flow_id, field_name, field_type, description) VALUES (?, ?, ?, ?, ?)',
      args: row,
    });
  }

  // --- Verify ---
  const flow = await db.execute({ sql: 'SELECT * FROM flows WHERE id = ?', args: [FLOW_ID] });
  const catCount = await db.execute({ sql: 'SELECT COUNT(*) as n FROM categories WHERE flow_id = ?', args: [FLOW_ID] });
  const tplCount = await db.execute({ sql: 'SELECT COUNT(*) as n FROM templates WHERE flow_id = ?', args: [FLOW_ID] });
  const fieldCount = await db.execute({ sql: 'SELECT COUNT(*) as n FROM extract_fields WHERE flow_id = ?', args: [FLOW_ID] });

  console.log('Flow:', flow.rows[0]);
  console.log('Categories:', catCount.rows[0]);
  console.log('Templates:', tplCount.rows[0]);
  console.log('Fields:', fieldCount.rows[0]);
}

main().catch(console.error);
```

## Paso 5: Post-creacion

1. Verifica que el flow aparece en la UI: `https://flowlab-eta.vercel.app` (login como el tenant)
2. Sugiere al usuario probar con simulaciones antes de publicar
3. Crea o actualiza la task en `.hub/tasks/` con el contexto del flow
4. Actualiza `.hub/status.md` con el nuevo flow en la tabla de tenants
5. Si hay info extensa del caso de uso, guardala en `.hub/tasks/<tenant>-flow-context.md` para referencia futura
