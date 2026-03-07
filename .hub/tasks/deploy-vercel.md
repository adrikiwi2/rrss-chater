---
id: deploy-vercel
title: Primer deploy a produccion en Vercel
status: done
priority: high
created: 2026-03-07
---

## Checklist
- [x] Migrar DB local a Turso (`turso db create flowlab --from-file flowlab.db`)
- [x] Instalar Vercel CLI y hacer login
- [x] Linkear proyecto (`vercel link`)
- [x] Configurar env vars en Vercel Dashboard (TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, JWT_SECRET, ADMIN_SECRET, GEMINI_API_KEY)
- [x] Ejecutar `vercel --prod` — deploy exitoso
- [ ] Verificar login y flujo completo en produccion
