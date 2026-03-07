# Estado del proyecto — 2026-03-07

## Situacion actual
- MVP local **completo**: auth, flow designer, simulacion con inferencia Gemini
- DB migrada a Turso: `libsql://flowlab-adrikiwi2.aws-eu-west-1.turso.io`
- **Desplegado en produccion**: https://flowlab-eta.vercel.app
- Repo conectado a Vercel con auto-deploy en cada push a master
- Repo remoto: https://github.com/adrikiwi2/flowlab.git

## Pendiente
1. Verificar login y flujo completo en produccion

## Tenants en produccion
| Tenant | Email | Flow | Contexto |
|---|---|---|---|
| Test | test@test.com | — | Tenant de pruebas |
| IberoExpress | ibero@test.com | Leads Organicos (inbound) | Distribucion de alimentos, 8 cats, 13 tpls, 10 fields |
| Tradingpro | tradingpro@test.com | Outreach Inversiones | Asesoria bursatil outreach, 7 cats, 7 tpls, 8 fields |
| Analog | lucia.analog@test.com | Outreach Booking Artistas | Agencia musical, outreach a promotores, 4 cats, 5 tpls, 6 fields |
| DistroNow | distronow@test.com | Outreach Artistas IG | Management/A&R via Instagram, 9 cats, 9 tpls, 7 fields |

## Datos en la DB (produccion)
| Tabla | Registros |
|---|---|
| tenants | 5 |
| flows | 4 |
| categories | 28 |
| templates | 34 |
| extract_fields | 31 |
| simulations | 3 |

## Infraestructura
| Entorno | DB | Config |
|---|---|---|
| Local | `file:flowlab.db` | `.env.local` |
| Produccion | `libsql://flowlab-adrikiwi2.aws-eu-west-1.turso.io` | Vercel env vars |
