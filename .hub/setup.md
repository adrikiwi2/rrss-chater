# Setup

## Requisitos
- Node.js 18+
- npm

## Instalacion
```bash
npm install
```

## Variables de entorno (.env.local)
```
GEMINI_API_KEY=<tu api key de Google>
TURSO_DATABASE_URL=file:flowlab.db
TURSO_AUTH_TOKEN=
JWT_SECRET=<secret para JWT>
ADMIN_SECRET=<secret para endpoints admin>
```

## Desarrollo
```bash
npm run dev   # localhost:3000
```

## Produccion (Vercel + Turso)
- DB: libsql://flowlab-adrikiwi2.aws-eu-west-1.turso.io
- Env vars se configuran en Vercel Dashboard > Settings > Environment Variables
- Deploy automatico con cada push a master

## Crear tenant
```bash
curl -X POST https://<dominio>/api/admin/tenants \
  -H "Authorization: Bearer $ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"name": "Cliente", "email": "email@client.com", "password": "pass"}'
```

## Seed de datos de ejemplo
```bash
curl -X POST https://<dominio>/api/admin/seed \
  -H "Authorization: Bearer $ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"tenant_id": "<id>"}'
```
