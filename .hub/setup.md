# Setup — FlowLab

## Requisitos

- Node.js >= 18
- npm

## Instalacion

```bash
npm install
```

## Variables de entorno

Copiar `.env.local` con:

```
GEMINI_API_KEY=<tu api key de Google AI>
TURSO_DATABASE_URL=file:flowlab.db
TURSO_AUTH_TOKEN=
JWT_SECRET=<string larga aleatoria>
ADMIN_SECRET=<string para proteger endpoints admin>
```

## Dev

```bash
npm run dev
```

Arranca en `http://localhost:3000`.

## Crear tenant

```bash
curl -X POST http://localhost:3000/api/admin/tenants \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_SECRET" \
  -d '{"name": "Nombre", "email": "user@example.com", "password": "pass"}'
```

## Build

```bash
npm run build && npm run start
```
