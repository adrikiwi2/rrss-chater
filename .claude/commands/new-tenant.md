# Crear nuevo tenant en FlowLab

Eres un asistente de provisioning para FlowLab. Tu tarea es crear un nuevo tenant en la base de datos de produccion (Turso).

## Datos que necesitas del usuario

Pregunta estos datos si no te los han dado:
1. **Nombre** del tenant (nombre de empresa)
2. **Email** para login
3. **Password** para login

## Conexion a Turso prod

Usa `@libsql/client` con las env vars del proyecto:
- URL: `process.env.TURSO_DATABASE_URL_PROD` (lee de `.env.local`)
- Token: `process.env.TURSO_AUTH_TOKEN` (lee de `.env.local`)

Lee las env vars con:
```js
require('dotenv').config({ path: '.env.local' });
```

## Schema de la tabla

```sql
CREATE TABLE tenants (
  id TEXT PRIMARY KEY,           -- nanoid(21)
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,   -- bcrypt hash (cost 12)
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Procedimiento

1. Genera un ID con `nanoid(21)` — usa el paquete `nanoid` ya instalado en el proyecto
2. Hashea la password con `bcryptjs` (cost 12) — ya instalado en el proyecto
3. Ejecuta el INSERT en Turso prod
4. Verifica con un SELECT que el tenant se creo correctamente
5. Muestra al usuario las credenciales:
   - URL: https://flowlab-eta.vercel.app/login
   - Email: el que eligieron
   - Password: la que eligieron

## Ejemplo de script

```js
const { createClient } = require('@libsql/client');
const bcrypt = require('bcryptjs');
const { nanoid } = require('nanoid');
require('dotenv').config({ path: '.env.local' });

const db = createClient({
  url: process.env.TURSO_DATABASE_URL_PROD,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const id = nanoid(21);
const hash = bcrypt.hashSync('PASSWORD', 12);

db.execute({
  sql: 'INSERT INTO tenants (id, name, email, password_hash) VALUES (?, ?, ?, ?)',
  args: [id, 'NAME', 'EMAIL', hash],
}).then(() => db.execute({ sql: 'SELECT id, name, email, created_at FROM tenants WHERE id = ?', args: [id] }))
  .then(r => console.log('Tenant creado:', r.rows[0]));
```

## Despues de crear

- Informa al usuario que ya puede hacer login en https://flowlab-eta.vercel.app/login
- Sugiere usar `/new-flow` para crear un flujo conversacional para este tenant
- Actualiza `.hub/status.md` anadiendo el tenant a la tabla "Tenants en produccion"
