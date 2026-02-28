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
  ├── App.jsx → AuthProvider → onboarding gate → BrowserRouter → Routes
  │     ├── !user → LoginScreen
  │     ├── user && !onboardingCompletado → <Onboarding> (full screen, no router)
  │     └── user && onboardingCompletado → Layout (DesktopLayout | MobileLayout)
  │           ├── / → DashboardPage
  │           ├── /obligaciones → ObligacionesPage
  │           ├── /obligaciones/iva/:year/:mes → IvaDeclaracionPage       ← va ANTES del patrón genérico
  │           ├── /obligaciones/iva-semestral/:anio/:semestre → IvaSemestralPage  ← ídem
  │           ├── /obligaciones/gastos-personales/:anio → GastosPersonalesPage   ← ídem
  │           ├── /obligaciones/:tipo/:year/:periodo → ObligacionDetallePage
  │           ├── /facturas → FacturasPage
  │           ├── /historial → HistorialPage
  │           └── /ajustes → AjustesPage
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

- `src/App.jsx` — Root: AuthProvider + onboarding gate + BrowserRouter + Routes
- `src/auth.jsx` — AuthContext: Google OAuth, triggerSync(), session management
- `src/LoginScreen.jsx` — Google login screen
- `src/sriExport.js` — Excel generation (Formulario GP + Anexo GSP) using SheetJS
- `src/supabase.js` — Supabase client init
- `src/theme.js` — Design tokens (C), catColors, catIcons, CANASTA, TIPOS_CONTRIBUYENTE, OBLIGACIONES_POR_TIPO, DIAS_VENCIMIENTO
- `supabase/functions/gmail-sync/index.ts` — Edge function (Gmail sync + XML parsing + AI categorization)

#### Hooks
- `src/hooks/usePerfil.js` — Reads/writes `perfil` table. Returns `{ perfil, tipoContribuyente, regimen, novenoDigitoRuc, onboardingCompletado, loading, savePerfil, updatePerfil, refetch }`
- `src/hooks/useObligaciones.js` — Generates obligations list with due dates from 9th RUC digit. Returns `{ obligaciones, loading }`
- `src/hooks/useIsMobile.js` — Returns boolean, breakpoint at 768px

#### Layouts (use react-router-dom `<Outlet />`)
- `src/layouts/DesktopLayout.jsx` — Dark green sidebar, 5 nav tabs, user avatar, logout
- `src/layouts/MobileLayout.jsx` — Phone frame, status bar, bottom tab bar

#### Pages
- `src/pages/DashboardPage.jsx` — Stats, upcoming obligations widget, recent invoices, top categories. **TODO 3:** widget amarillo debajo de obligaciones urgentes si hay facturas sin clasificar del año AGP (`sinClasificarAgp`), navega a GastosPersonalesPage. El map de facturas incluye `esVenta: f.es_venta` para filtrar correctamente.
- `src/pages/ObligacionesPage.jsx` — TarjetaPerfilTributario + obligations grouped by urgency. **TODO 3:** carga recuento de facturas sin clasificar del año AGP y estado de `declaraciones_agp`; enriquece la obligación AGP con `ctaLabel` dinámico ("Clasificar mis facturas (N pendientes)" / "Ver resumen y generar formularios" / "Ver detalle") y sobreescribe `estado` a `"presentada"` si corresponde.
- `src/pages/ObligacionDetallePage.jsx` — Detail view with route protection (redirects if tipo doesn't match tipoContribuyente)
- `src/pages/IvaDeclaracionPage.jsx` — **TODO 1** Declaración mensual IVA (Form 104). Aplica a: `dependencia_con_extras`, `freelancer_general`, `arrendador_general`. Carga compras (es_venta=null/false) y ventas (es_venta=true) del período, calcula IVA, modal Form 104 pre-llenado. Guarda en `declaraciones_iva` con `tipo='mensual'`, `periodo='YYYY-MM'`.
- `src/pages/IvaSemestralPage.jsx` — **TODO 2** Declaración semestral IVA (Form 104-A). Solo para `rimpe_emprendedor`. Período: S1 = enero–junio (vence julio), S2 = julio–diciembre (vence enero año siguiente). Incluye: tabla desglosada mes a mes (ventas base, IVA cobrado, compras total, IVA pagado, saldo mensual), gráfico de barras recharts (Ventas vs Compras por mes), totales consolidados, modal Form 104-A pre-llenado, marcar como presentada. Guarda en `declaraciones_iva` con `tipo='semestral'`, `periodo='YYYY-S1'` o `'YYYY-S2'`.
- `src/pages/GastosPersonalesPage.jsx` — **TODO 3** ✅ AGP completo en `/obligaciones/gastos-personales/:anio`. 4 secciones: (1) facturas sin clasificar del año — 5 botones de categoría + "No es gasto personal", clasifican en Supabase con animación fade-out; (2) resumen por categoría (Salud/Educación/Alimentación/Vivienda/Vestimenta) con totales y barra de progreso hacia el límite `min(50% ingresos brutos, $15,817)`; (3) ahorro estimado = efectivo × 15% + motivacional si hay pendientes; (4) botones Formulario GP / Anexo GSP / Generar ambos, instrucciones paso a paso, "Marcar como presentada" (modal con fecha) → upsert en `declaraciones_agp`. Ingresos brutos = `salario × 12 + totalVentas` del año.
- `src/pages/FacturasPage.jsx` — Invoice list with category filter chips, search, inline category edit
- `src/pages/HistorialPage.jsx` — Placeholder "Próximamente"
- `src/pages/AjustesPage.jsx` — **TODO 3 ✅** Simplificado: solo tipo contribuyente card + datos personales + cargas + Gmail sync. Eliminada la sección "Declaración anual" (botones GP/GSP) y el resumen estimado.

#### Components
- `src/components/Onboarding.jsx` — 4-step: RUC check → situación → facturación → noveno dígito. Calls `onComplete({ tipoContribuyente, regimen, novenoDigitoRuc, onboardingCompletado: true })`
- `src/components/ObligacionCard.jsx` — Card with 5 states (vencida/urgente/pendiente/futura/presentada). **TODO 3:** soporta `obligacion.ctaLabel` opcional: si presente, muestra un badge de texto junto al chevron (útil para el AGP card con mensaje dinámico).
- `src/components/TarjetaPerfilTributario.jsx` — Dark card showing contributor type, regime, detalle, and IVA obligation chip: "IVA Semestral" para `rimpe_emprendedor`, "IVA Mensual" para los demás con IVA, nada para los que no declaran IVA
- `src/components/Icon.jsx` — Material Symbols icon wrapper
- `src/components/ui.jsx` — Shared primitives: GreenBtn, Input, SectionLabel

#### Legacy (no longer imported, kept for reference)
- `src/LemonTaxDesktop.jsx` — Old monolithic desktop UI (dead code)
- `src/LemonTaxMobile.jsx` — Old monolithic mobile UI (dead code)

## Database Tables (Supabase Postgres with RLS)

- **facturas** — `user_id, emisor, ruc, fecha, monto, categoria, es_deducible_sri, clave_acceso, fuente(gmail|manual), es_venta(bool default false), tarifa_iva(numeric nullable)`. Upsert conflict key: `user_id,clave_acceso`. `monto` = importeTotal (total con IVA para compras de Gmail; base sin IVA para ventas manuales). `tarifa_iva`: null o >0 = gravada 15%, 0 = tarifa 0%.
- **gmail_tokens** — `user_id, refresh_token, last_sync`
- **perfil** — `user_id, cedula, nombre, salario_mensual, otros_ingresos, cargas_familiares, enfermedad_catastrofica, tipo_contribuyente, regimen, noveno_digito_ruc, onboarding_completado`
- **declaraciones_iva** *(TODO 1 + 2)* — `id uuid pk, user_id, periodo, tipo(mensual|semestral), total_ventas, iva_ventas, total_compras, credito_tributario, valor_pagar(negativo=crédito a favor), fecha_vencimiento date, fecha_presentacion date, estado(pendiente|presentada|vencida), created_at`. UNIQUE(user_id, periodo). `periodo` = `'YYYY-MM'` para mensual, `'YYYY-S1'` / `'YYYY-S2'` para semestral. RLS: usuarios solo ven sus propias declaraciones.
- **declaraciones_agp** *(TODO 3)* — `id uuid pk, user_id, anio_fiscal integer, total_salud, total_educacion, total_alimentacion, total_vivienda, total_vestimenta, total_deducible, ahorro_estimado, estado('borrador'|'presentada'), fecha_presentacion date, created_at`. UNIQUE(user_id, anio_fiscal). RLS.

> **Required SQL migrations** (run in Supabase Dashboard → SQL Editor):
> ```sql
> -- Perfil: campos de onboarding (ya aplicado si el onboarding funciona)
> ALTER TABLE perfil
>   ADD COLUMN IF NOT EXISTS tipo_contribuyente text,
>   ADD COLUMN IF NOT EXISTS regimen text,
>   ADD COLUMN IF NOT EXISTS noveno_digito_ruc char(1),
>   ADD COLUMN IF NOT EXISTS onboarding_completado boolean DEFAULT false;
>
> -- Facturas: campos para IVA (TODO 1) y ventas manuales (TODO 6)
> ALTER TABLE facturas
>   ADD COLUMN IF NOT EXISTS es_venta boolean DEFAULT false,
>   ADD COLUMN IF NOT EXISTS tarifa_iva numeric;
>
> -- Tabla declaraciones_iva (TODO 1)
> CREATE TABLE IF NOT EXISTS declaraciones_iva (
>   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
>   user_id uuid REFERENCES auth.users,
>   periodo text NOT NULL,           -- 'YYYY-MM'
>   tipo text NOT NULL,              -- 'mensual' | 'semestral'
>   total_ventas numeric(12,2),
>   iva_ventas numeric(12,2),
>   total_compras numeric(12,2),
>   credito_tributario numeric(12,2),
>   valor_pagar numeric(12,2),       -- negativo = crédito a favor
>   fecha_vencimiento date,
>   fecha_presentacion date,
>   estado text DEFAULT 'pendiente', -- 'pendiente' | 'presentada' | 'vencida'
>   created_at timestamptz DEFAULT now()
> );
> ALTER TABLE declaraciones_iva ENABLE ROW LEVEL SECURITY;
> CREATE POLICY "own rows" ON declaraciones_iva
>   USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
>
> -- Tabla declaraciones_agp (TODO 3)
> CREATE TABLE IF NOT EXISTS declaraciones_agp (
>   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
>   user_id uuid REFERENCES auth.users,
>   anio_fiscal integer NOT NULL,
>   total_salud numeric(12,2),
>   total_educacion numeric(12,2),
>   total_alimentacion numeric(12,2),
>   total_vivienda numeric(12,2),
>   total_vestimenta numeric(12,2),
>   total_deducible numeric(12,2),
>   ahorro_estimado numeric(12,2),
>   estado text DEFAULT 'borrador',  -- 'borrador' | 'presentada'
>   fecha_presentacion date,
>   created_at timestamptz DEFAULT now(),
>   UNIQUE(user_id, anio_fiscal)
> );
> ALTER TABLE declaraciones_agp ENABLE ROW LEVEL SECURITY;
> CREATE POLICY "own rows" ON declaraciones_agp
>   USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
> ```

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

- **No CSS framework** — inline styles with design tokens object from `src/theme.js` (`C.text`, `C.surface`, etc.)
- **State management** — plain React useState + useContext (AuthContext in auth.jsx), no external state library
- **Routing** — React Router v7 (BrowserRouter, Routes, Route, Outlet, useParams, useNavigate). `vercel.json` has SPA rewrite rule.
- **Onboarding gate** — `usePerfil()` checked in AppContent before rendering BrowserRouter; if `!onboardingCompletado`, render `<Onboarding>` full-screen (outside the router)
- **Derived state over setState in effect** — compute values directly during render from hook data; avoid setting state inside `useEffect` to satisfy `react-hooks` ESLint rules
- **Route protection in ObligacionDetallePage** — uses `OBLIGACIONES_POR_TIPO[tipoContribuyente]` from theme.js + `TIPO_URL_A_OBLIGACION` map to validate access; `useEffect` only for redirect, access error computed as derived state
- **Supabase pattern** — parallel fetches on mount via `Promise.allSettled` (resiliente: si una tabla no existe aún, el resto sigue funcionando), upserts con `onConflict`
- **IVA calculation convention** — compras de Gmail: `monto` = total con IVA → crédito = `monto * 15/115`. Ventas manuales: `monto` = base sin IVA → IVA cobrado = `monto * 0.15`. `tarifa_iva = 0` excluye del cálculo de IVA.
- **Rutas específicas antes del patrón genérico** — `/obligaciones/iva/:year/:mes`, `/obligaciones/iva-semestral/:anio/:semestre` y `/obligaciones/gastos-personales/:anio` declaradas ANTES de `/:tipo/:year/:periodo` en App.jsx para que React Router las resuelva por el segmento estático
- **AGP limit calculation (TODO 3)** — `limite = min(ingresosAnuales * 0.5, 15817)` donde `ingresosAnuales = perfil.salario * 12 + totalVentas` del año. Regla SRI 2025. Ahorro estimado = `min(totalDeducible, limite) * 0.15` (tasa marginal conservadora 15%).
- **AGP clasificación con animación** — al clasificar, `clasificandoId` activa opacity 0 en la factura (CSS transition 320ms), luego `setFacturas` actualiza la categoría y la factura sale de `sinClasificar`. No usar `removiendoIds` separado.
- **AGP presentada en ObligacionesPage** — carga `declaraciones_agp` en paralelo con `Promise.allSettled` para no romper si la tabla no existe. Sobreescribe `obligacion.estado` a `"presentada"` y añade `ctaLabel` antes de pasarlo a ObligacionCard.
- **recharts** — instalado (v3) para gráficos de barras en IvaSemestralPage. Usar `ResponsiveContainer + BarChart + Bar` con `radius={[4,4,0,0]}` para estilo consistente. Tooltip y Legend con `fontFamily: "DM Sans, sans-serif"`
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
