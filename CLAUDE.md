# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**facilito** (repo name: lemon-tax) is an Ecuadorian personal income tax declaration web app. It imports electronic invoices (facturas XML) from Gmail via Supabase Edge Functions, categorizes them per SRI rules, and generates official SRI files (JSON for portal upload, Excel GP Form + GSP Annex).

Production: https://lemontax.vercel.app

## Commands

```bash
npm run dev          # Vite dev server with HMR
npm run build        # Production build → dist/
npm run lint         # ESLint (eslint .)
npm run preview      # Preview production build locally

npx supabase functions deploy gmail-sync   # Deploy edge function
```

No test suite is configured. Frontend auto-deploys on push to `main` via Vercel.

## Architecture

```
Browser (React 19 + Vite 7)
  ├── Auth: Google OAuth via Supabase (gmail.readonly scope)
  ├── App.jsx → viewport check → LemonTaxDesktop.jsx (<768px → LemonTaxMobile.jsx)
  ├── Supabase client calls (facturas, perfil, gmail_tokens tables)
  └── triggerSync() → POST to Edge Function

Supabase Edge Function (gmail-sync, Deno/TypeScript)
  ├── Refreshes Google OAuth token from stored refresh_token
  ├── Searches Gmail for SRI invoice emails (XML/ZIP attachments)
  ├── Parses 3 XML formats: CDATA, HTML-encoded, direct
  ├── Categorizes via regex → Claude Haiku fallback for "Otros"
  └── Upserts into facturas (conflict key: user_id + clave_acceso)
```

### Key Files

- `src/App.jsx` — Root: AuthProvider + mobile/desktop routing
- `src/auth.jsx` — AuthContext: Google OAuth, triggerSync(), session management
- `src/LemonTaxDesktop.jsx` — Main desktop UI (dashboard, facturas, declaración, conectar tabs)
- `src/LemonTaxMobile.jsx` — Mobile counterpart
- `src/LoginScreen.jsx` — 3-step onboarding + Google login
- `src/sriExport.js` — Excel generation (Formulario GP + Anexo GSP) using SheetJS
- `src/supabase.js` — Supabase client init
- `supabase/functions/gmail-sync/index.ts` — Edge function (Gmail sync + XML parsing + AI categorization)

## Database Tables (Supabase Postgres with RLS)

- **facturas** — `user_id, emisor, ruc, fecha, monto, categoria, es_deducible_sri, clave_acceso, fuente(gmail|manual)`. Upsert conflict key: `user_id,clave_acceso`
- **gmail_tokens** — `user_id, refresh_token, last_sync`
- **perfil** — `user_id, cedula, nombre, salario_mensual, otros_ingresos, cargas_familiares, enfermedad_catastrofica`

## SRI Tax Categories

| Category | SRI Concepto | GP Form Field | JSON key for portal |
|---|---|---|---|
| Vivienda | 3310 | campo 106 / casillero 776 | `"3310"` |
| Educación | 5040 | campo 107 / casillero 773 | `"5040"` |
| Salud | 3290 | campo 108 / casillero 774 | `"3290"` |
| Vestimenta | 3320 | campo 109 / casillero 777 | `"3320"` |
| Alimentación | 3300 | campo 110 / casillero 775 | `"3300"` |
| Turismo | 3325 | campo 111 / casillero 796 | `"3325"` |
| Total | 3330 | casillero 797 | `"3330"` |
| Otros | — | Not deductible | Not included |

SRI JSON upload format: `{ "detallesDeclaracion": { "3310": "5760", ... } }` — values are strings, omit zeros.

## Coding Patterns

- **No CSS framework** — inline styles with design tokens object (`const C = { bg, surface, ... }`) at top of each component
- **State management** — plain React useState + useContext (AuthContext in auth.jsx), no external state library
- **Supabase pattern** — parallel fetches on mount via `Promise.all`, upserts with `onConflict`
- **Edge function categorization** — regex rules first, Claude Haiku API fallback for unmatched items
- **SRI XML parsing** — handles CDATA, HTML-encoded (`&lt;`), and direct XML formats

## Branding

- Name: **facilito** (always lowercase)
- Colors: `#0D1F14` (dark green bg), `#F5E642` (yellow accent), `#4CAF82` (green accent)
- Fonts: Syne (headings 700/800), DM Sans (body 400-700)
- Tone: friendly, no intimidating tax jargon. Key copy: "Declarar, facilito."

## Supabase Edge Function Secrets

Required in Supabase Dashboard (Settings → Edge Functions → Secrets):
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — for Gmail OAuth token refresh
- `ANTHROPIC_API_KEY` — for Claude Haiku fallback categorization
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — auto-set by Supabase
