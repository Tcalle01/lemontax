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
  │           ├── /obligaciones/renta/:anio → DeclaracionIRPage                 ← ídem
  │           ├── /obligaciones/:tipo/:year/:periodo → ObligacionDetallePage
  │           ├── /proyeccion-ir → ProyeccionIRPage  ← sin menú, accesible desde widget dashboard
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
- `src/utils/parsearXMLVenta.js` — Browser-side XML parser for SRI sales invoices (facturas emitidas). `parsearXMLVenta(xmlText)` → `{ emisor, ruc, fecha, numeroFactura, claveAcceso, clienteNombre, clienteRuc, subtotal, tarifaIva, total, descripcion }`. Handles CDATA, HTML-encoded, and direct XML. Only accepts codDoc=01 (facturas). Returns null if invalid.
- `src/sriExport.js` — Excel generation (Formulario GP + Anexo GSP) using SheetJS
- `src/utils/generarArchivoIR.js` — XML generation for DIMM Formularios (Form 102). `generarArchivoIR(declaracion, perfil, tipoContribuyente)` + `descargarArchivoIR(...)` trigger descarga `IR_[RUC]_[anio].xml`
- `src/supabase.js` — Supabase client init
- `src/theme.js` — Design tokens (C), catColors, catIcons, CANASTA, TIPOS_CONTRIBUYENTE, OBLIGACIONES_POR_TIPO, DIAS_VENCIMIENTO
- `src/data/tablaIR.js` — Tablas IR 2025 hardcodeadas (progresiva general, RIMPE Emprendedor, RIMPE Negocio Popular) + `calcularIR(ingresos, deducibles, tipo)` + `tasaMarginalIR(base)`. ⚠️ Verificar valores RIMPE en sri.gob.ec antes de producción.
- `supabase/functions/gmail-sync/index.ts` — Edge function (Gmail sync + XML parsing + AI categorization)

#### Hooks
- `src/hooks/usePerfil.js` — Reads/writes `perfil` table. Returns `{ perfil, tipoContribuyente, regimen, novenoDigitoRuc, onboardingCompletado, loading, savePerfil, updatePerfil, refetch }`. `perfil` incluye `ingresoMensualDependencia` (sueldo neto mensual para tipos dependencia).
- `src/hooks/useObligaciones.js` — Generates obligations list with due dates from 9th RUC digit. Returns `{ obligaciones, loading }`
- `src/hooks/useIsMobile.js` — Returns boolean, breakpoint at 768px

#### Layouts (use react-router-dom `<Outlet />`)
- `src/layouts/DesktopLayout.jsx` — Dark green sidebar, 5 nav tabs, user avatar, logout
- `src/layouts/MobileLayout.jsx` — Phone frame, status bar, bottom tab bar

#### Pages
- `src/pages/DashboardPage.jsx` — Stats, upcoming obligations widget, recent invoices, top categories. **TODO 3:** widget amarillo debajo de obligaciones urgentes si hay facturas sin clasificar del año AGP (`sinClasificarAgp`), navega a GastosPersonalesPage. El map de facturas incluye `esVenta: f.es_venta` para filtrar correctamente. **TODO 4:** incluye `<ProyeccionIRWidget>` en la columna izquierda (debajo del AGP banner, arriba de facturas recientes).
- `src/pages/ObligacionesPage.jsx` — TarjetaPerfilTributario + obligations grouped by urgency. **TODO 3:** carga recuento de facturas sin clasificar del año AGP y estado de `declaraciones_agp`; enriquece la obligación AGP con `ctaLabel` dinámico ("Clasificar mis facturas (N pendientes)" / "Ver resumen y generar formularios" / "Ver detalle") y sobreescribe `estado` a `"presentada"` si corresponde.
- `src/pages/ObligacionDetallePage.jsx` — Detail view with route protection (redirects if tipo doesn't match tipoContribuyente)
- `src/pages/IvaDeclaracionPage.jsx` — **TODO 1** Declaración mensual IVA (Form 104). Aplica a: `dependencia_con_extras`, `freelancer_general`, `arrendador_general`. Carga compras (es_venta=null/false) y ventas (es_venta=true) del período, calcula IVA, modal Form 104 pre-llenado. Guarda en `declaraciones_iva` con `tipo='mensual'`, `periodo='YYYY-MM'`.
- `src/pages/IvaSemestralPage.jsx` — **TODO 2** Declaración semestral IVA (Form 104-A). Solo para `rimpe_emprendedor`. Período: S1 = enero–junio (vence julio), S2 = julio–diciembre (vence enero año siguiente). Incluye: tabla desglosada mes a mes (ventas base, IVA cobrado, compras total, IVA pagado, saldo mensual), gráfico de barras recharts (Ventas vs Compras por mes), totales consolidados, modal Form 104-A pre-llenado, marcar como presentada. Guarda en `declaraciones_iva` con `tipo='semestral'`, `periodo='YYYY-S1'` o `'YYYY-S2'`.
- `src/pages/GastosPersonalesPage.jsx` — **TODO 3** ✅ AGP completo en `/obligaciones/gastos-personales/:anio`. 4 secciones: (1) facturas sin clasificar del año — 5 botones de categoría + "No es gasto personal", clasifican en Supabase con animación fade-out; (2) resumen por categoría (Salud/Educación/Alimentación/Vivienda/Vestimenta) con totales y barra de progreso hacia el límite `min(50% ingresos brutos, $15,817)`; (3) ahorro estimado = efectivo × 15% + motivacional si hay pendientes; (4) botones Formulario GP / Anexo GSP / Generar ambos, instrucciones paso a paso, "Marcar como presentada" (modal con fecha) → upsert en `declaraciones_agp`. Ingresos brutos = `salario × 12 + totalVentas` del año.
- `src/pages/FacturasPage.jsx` — **TODO 6 ✅** Dos tabs: "Compras" (`es_venta=false/null`, funcionalidad existente + filtro corregido) y "Ventas" (`es_venta=true`). `dependencia_pura` ve solo Compras. Tab Ventas: (1) banner resumen mensual con total+conteo → clickeable al módulo IVA del mes, (2) selectores mes/año + botón "Agregar ingreso", (3) lista con columnas cliente/descripción/fecha/base/IVA%/total/estado. Estado de cobro togglable inline. Modal 3 opciones: XML (parsearXMLVenta.js → preview → guardar), manual (fecha, n°, cliente, RUC, desc, subtotal, IVA selector 0%/15%, total auto, estado), rápido (fecha, desc, monto). Usa `crypto.randomUUID()` como clave_acceso para entradas manuales.
- `src/pages/HistorialPage.jsx` — Placeholder "Próximamente"
- `src/pages/AjustesPage.jsx` — **TODO 3 ✅** Simplificado: solo tipo contribuyente card + datos personales + cargas + Gmail sync. Eliminada la sección "Declaración anual" (botones GP/GSP) y el resumen estimado. **TODO 4:** campo "Sueldo neto mensual (después de IESS)" visible solo para `dependencia_pura` y `dependencia_con_extras`.
- `src/pages/ProyeccionIRPage.jsx` — **TODO 4 ✅** Página completa en `/proyeccion-ir` (sin menú, accesible desde widget). Secciones: desglose de ingresos (dependencia+ventas+otros), deducciones (AGP+gastos negocio), base imponible + IR estimado (dark card), simulador slider hasta $50k, comparación con/sin deducciones, nota especial para `dependencia_pura`. Usa `calcularIR()` de tablaIR.js. Fetchea facturas del año actual + `declaraciones_agp` del año anterior.
- `src/pages/DeclaracionIRPage.jsx` — **TODO 5 ✅** Asistente guiado en `/obligaciones/renta/:anio`. Pasos variables por tipo: RIMPE=3 (ingresos→retenciones→resumen), `dependencia_pura`=4 (+gastos personales), demás=5 (+gastos negocio). Barra de progreso visual, auto-guarda borrador en `declaraciones_ir` al avanzar. Pre-llena desde facturas + AGP + perfil. Paso resumen: desglose en lenguaje simple, card resultado (IR a pagar o devolución), modales "Ver casillas Form. 102", "Instrucciones DIMM", "Marcar presentada". Genera y descarga `IR_[RUC]_[anio].xml` via `descargarArchivoIR()`. Para RIMPE: título "Declaración Renta RIMPE", cálculo sobre ingresos brutos, sin deducciones GP/negocio.

#### Components
- `src/components/Onboarding.jsx` — **TODO 4:** 5-step para dependencia: RUC → situación → **ingreso neto mensual** → noveno dígito. Para freelancer/negocio: RUC → situación → facturación → noveno dígito. Constantes `STEP_RUC=0, STEP_SITUACION=1, STEP_FACTURACION=2, STEP_NOVENO=3, STEP_INGRESO=4`. `progressIndex()` mapea step a progreso visual (0–3). `onComplete` incluye `ingresoMensualDependencia`.
- `src/components/ProyeccionIRWidget.jsx` — **TODO 4 ✅** Widget compacto para dashboard. Props: `{ facturas, perfil, tipoContribuyente }`. Muestra: barra progreso del año (mes/12), ingresos acumulados, IR estimado anualizado. Link "Ver completo →" navega a `/proyeccion-ir`. Usa `calcularIR()` de tablaIR.js.
- `src/components/ObligacionCard.jsx` — Card with 5 states (vencida/urgente/pendiente/futura/presentada). **TODO 3:** soporta `obligacion.ctaLabel` opcional: si presente, muestra un badge de texto junto al chevron (útil para el AGP card con mensaje dinámico).
- `src/components/TarjetaPerfilTributario.jsx` — Dark card showing contributor type, regime, detalle, and IVA obligation chip: "IVA Semestral" para `rimpe_emprendedor`, "IVA Mensual" para los demás con IVA, nada para los que no declaran IVA
- `src/components/Icon.jsx` — Material Symbols icon wrapper
- `src/components/ui.jsx` — Shared primitives: GreenBtn, Input, SectionLabel

#### Legacy (no longer imported, kept for reference)
- `src/LemonTaxDesktop.jsx` — Old monolithic desktop UI (dead code)
- `src/LemonTaxMobile.jsx` — Old monolithic mobile UI (dead code)

## Database Tables (Supabase Postgres with RLS)

- **facturas** — `user_id, emisor, ruc, fecha, monto, categoria, es_deducible_sri, clave_acceso, fuente(gmail|manual|xml|rapido), es_venta(bool default false), tarifa_iva(numeric nullable), estado_cobro(text), cliente_nombre(text), cliente_ruc(text), numero_factura(text), descripcion(text)`. Upsert conflict key: `user_id,clave_acceso`. `monto` = importeTotal (total con IVA para compras de Gmail; base sin IVA para ventas manuales). `tarifa_iva`: null o >0 = gravada 15%, 0 = tarifa 0%. Para ventas: `emisor`=nombre del usuario, `cliente_nombre`=nombre del comprador.
- **gmail_tokens** — `user_id, refresh_token, last_sync`
- **perfil** — `user_id, cedula, nombre, salario_mensual, otros_ingresos, cargas_familiares, enfermedad_catastrofica, tipo_contribuyente, regimen, noveno_digito_ruc, onboarding_completado, ingreso_mensual_dependencia numeric(12,2)` *(campo TODO 4: sueldo neto mensual después de IESS, solo para dependencia_pura/dependencia_con_extras)*
- **declaraciones_iva** *(TODO 1 + 2)* — `id uuid pk, user_id, periodo, tipo(mensual|semestral), total_ventas, iva_ventas, total_compras, credito_tributario, valor_pagar(negativo=crédito a favor), fecha_vencimiento date, fecha_presentacion date, estado(pendiente|presentada|vencida), created_at`. UNIQUE(user_id, periodo). `periodo` = `'YYYY-MM'` para mensual, `'YYYY-S1'` / `'YYYY-S2'` para semestral. RLS: usuarios solo ven sus propias declaraciones.
- **declaraciones_agp** *(TODO 3)* — `id uuid pk, user_id, anio_fiscal integer, total_salud, total_educacion, total_alimentacion, total_vivienda, total_vestimenta, total_deducible, ahorro_estimado, estado('borrador'|'presentada'), fecha_presentacion date, created_at`. UNIQUE(user_id, anio_fiscal). RLS.
- **declaraciones_ir** *(TODO 5)* — `id uuid pk, user_id, anio_fiscal integer, ingresos_dependencia, ingresos_facturacion, ingresos_otros, gastos_deducibles_negocio, gastos_personales_salud, gastos_personales_educacion, gastos_personales_alimentacion, gastos_personales_vivienda, gastos_personales_vestimenta, base_imponible, ir_causado, retenciones_recibidas, anticipos_pagados, ir_a_pagar, estado('borrador'|'presentada'), fecha_presentacion date, created_at`. UNIQUE(user_id, anio_fiscal). RLS.

> **Required SQL migrations** (run in Supabase Dashboard → SQL Editor):
> ```sql
> -- Facturas: campos para ventas (TODO 6)
> ALTER TABLE facturas
>   ADD COLUMN IF NOT EXISTS estado_cobro text,        -- 'cobrado' | 'pendiente'
>   ADD COLUMN IF NOT EXISTS cliente_nombre text,
>   ADD COLUMN IF NOT EXISTS cliente_ruc text,
>   ADD COLUMN IF NOT EXISTS numero_factura text,
>   ADD COLUMN IF NOT EXISTS descripcion text;
>
> -- Perfil: campo ingreso dependencia (TODO 4)
> ALTER TABLE perfil
>   ADD COLUMN IF NOT EXISTS ingreso_mensual_dependencia numeric(12,2);
>
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
>
> -- Tabla declaraciones_ir (TODO 5)
> CREATE TABLE IF NOT EXISTS declaraciones_ir (
>   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
>   user_id uuid REFERENCES auth.users,
>   anio_fiscal integer NOT NULL,
>   ingresos_dependencia numeric(12,2),
>   ingresos_facturacion numeric(12,2),
>   ingresos_otros numeric(12,2),
>   gastos_deducibles_negocio numeric(12,2),
>   gastos_personales_salud numeric(12,2),
>   gastos_personales_educacion numeric(12,2),
>   gastos_personales_alimentacion numeric(12,2),
>   gastos_personales_vivienda numeric(12,2),
>   gastos_personales_vestimenta numeric(12,2),
>   base_imponible numeric(12,2),
>   ir_causado numeric(12,2),
>   retenciones_recibidas numeric(12,2),
>   anticipos_pagados numeric(12,2),
>   ir_a_pagar numeric(12,2),
>   estado text DEFAULT 'borrador',  -- 'borrador' | 'presentada'
>   fecha_presentacion date,
>   created_at timestamptz DEFAULT now(),
>   UNIQUE(user_id, anio_fiscal)
> );
> ALTER TABLE declaraciones_ir ENABLE ROW LEVEL SECURITY;
> CREATE POLICY "own rows" ON declaraciones_ir
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
- **IVA calculation convention** — compras de Gmail: `monto` = total con IVA → crédito = `monto * 15/115`. Ventas (manual/XML/rápido): `monto` = base sin IVA → IVA cobrado = `monto * tarifa_iva/100`. `tarifa_iva = 0` excluye del cálculo de IVA; `tarifa_iva = null` (ingreso rápido) = sin IVA implícito.
- **Rutas específicas antes del patrón genérico** — `/obligaciones/iva/:year/:mes`, `/obligaciones/iva-semestral/:anio/:semestre` y `/obligaciones/gastos-personales/:anio` declaradas ANTES de `/:tipo/:year/:periodo` en App.jsx para que React Router las resuelva por el segmento estático
- **AGP limit calculation (TODO 3)** — `limite = min(ingresosAnuales * 0.5, 15817)` donde `ingresosAnuales = perfil.salario * 12 + totalVentas` del año. Regla SRI 2025. Ahorro estimado = `min(totalDeducible, limite) * 0.15` (tasa marginal conservadora 15%).
- **AGP clasificación con animación** — al clasificar, `clasificandoId` activa opacity 0 en la factura (CSS transition 320ms), luego `setFacturas` actualiza la categoría y la factura sale de `sinClasificar`. No usar `removiendoIds` separado.
- **AGP presentada en ObligacionesPage** — carga `declaraciones_agp` en paralelo con `Promise.allSettled` para no romper si la tabla no existe. Sobreescribe `obligacion.estado` a `"presentada"` y añade `ctaLabel` antes de pasarlo a ObligacionCard.
- **recharts** — instalado (v3) para gráficos de barras en IvaSemestralPage. Usar `ResponsiveContainer + BarChart + Bar` con `radius={[4,4,0,0]}` para estilo consistente. Tooltip y Legend con `fontFamily: "DM Sans, sans-serif"`
- **IR calculation (TODO 4)** — `calcularIR(ingresos, gastosDeducibles, tipoContribuyente)` en `src/data/tablaIR.js`. Para dependencia: `ingresos = ingresoNetoMensual * 12` (neto ya sin IESS → base = ingresos - GP). Para freelancer/arriendo: `ingresos = ventas + otros`. Para RIMPE: tabla simplificada (emprendedor) o cuota fija (negocio popular). IR anualizado en widget = `(ingresosAcumulados / mesesTranscurridos) * 12`. Simulador: slider 0–$50k de ingresos extra, recalcula en tiempo real con derived state.
- **ProyeccionIR income convention** — `dependencia_pura`: sin deducción IESS separada (ya incluida en neto). `dependencia_con_extras`: suma neto + ventas_año. RIMPE: no deduce GP del income, aplica tabla RIMPE directamente sobre ingresos brutos.
- **DeclaracionIR wizard pattern (TODO 5)** — pasos variables según tipo (`getPasos(tipo)` → array). `ingresos_facturacion` y `comprasNegocio` son **derived state** (filter sobre `facturas[]`), NO campos editables — solo se editan `sueldoAnual`, `bonosExtras`, `ingresosOtros`, `otrosGastosNegocio`, GP por categoría, `retenciones`, `anticipos`. `guardarBorrador()` upsert en `declaraciones_ir` con conflict key `user_id,anio_fiscal`. Pre-fill: `esDependencia ? ingresoMensualDependencia * 12` para sueldoAnual; categorías GP desde `declaraciones_agp`. "gastos negocio auto" = facturas donde `!es_venta && !CATS_AGP.includes(categoria)`.
- **XML DIMM (TODO 5)** — `generarArchivoIR()` en `src/utils/generarArchivoIR.js`. Casillas: 301=dep, 302=fact, 303=otros, 399=total; 401=negocio, 451-455=GP cats, 499=deducciones; 839=base, 849=ir_causado, 879=retenciones, 882=anticipos, 899=ir_a_pagar. Campo `<regimen>` = `GENERAL` | `RIMPE_EMPRENDEDOR` | `RIMPE_NEGOCIO_POPULAR`.
- **Ventas (TODO 6) — convenciones clave**:
  - Separación en tabla `facturas`: Compras = `.neq("es_venta", true)` (captura null y false). Ventas = `.eq("es_venta", true)`.
  - `categoria` siempre es `"Ventas"` para facturas emitidas. Al filtrar AGP o deducciones, excluir `es_venta=true` o `categoria="Ventas"`.
  - `emisor` = nombre del usuario (el vendedor); `cliente_nombre`/`cliente_ruc` = el comprador.
  - `fuente`: `"xml"` (subido por usuario), `"manual"` (formulario), `"rapido"` (ingreso sin comprobante). `"gmail"` solo para compras importadas.
  - Ventas con XML → upsert `onConflict: user_id,clave_acceso`. Ventas manual/rápido → insert con `crypto.randomUUID()` como clave_acceso.
  - `estado_cobro` (`'cobrado'|'pendiente'`) se togglea inline con click en badge → update Supabase inmediato.
  - Banner resumen mensual navega a IVA: rimpe_emprendedor → `/obligaciones/iva-semestral/{year}/{S1|S2}`; otros con IVA → `/obligaciones/iva/{year}/{MM}`. Sin IVA (rimpe_negocio_popular): banner no es clickeable.
  - **Integración con otros módulos**: las ventas de TODO 6 alimentan automáticamente IvaDeclaracionPage e IvaSemestralPage (ya usan `es_venta=true`), ProyeccionIRPage (`ingresos_facturacion`), y el límite AGP (`ingresosAnuales = salario*12 + totalVentas`). No se requiere cambio en esos módulos.
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
