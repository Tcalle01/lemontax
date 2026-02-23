# facilito — Contexto del proyecto

## Qué es
App web de declaración de impuestos personales para Ecuador (SRI). Antes llamada "Lemon Tax", ahora rebranded a **facilito**. Permite importar facturas electrónicas desde Gmail, organizarlas por categoría, y generar los formularios oficiales del SRI (Formulario GP y Anexo GSP) en Excel.

## Stack
- **Frontend**: React + Vite, desplegado en Vercel (lemontax.vercel.app)
- **Backend**: Supabase (auth, base de datos, Edge Functions)
- **Auth**: Google OAuth via Supabase (con acceso a Gmail)
- **Folder local**: `C:\Users\Admin\Desktop\lemon-tax`

## Archivos principales en src/
- `App.jsx` — router principal, detecta si es mobile o desktop
- `LemonTaxDesktop.jsx` — UI desktop completa (dashboard, facturas, declaración, conectar)
- `LemonTaxMobile.jsx` — UI mobile
- `LoginScreen.jsx` — pantalla de login con onboarding de 3 pasos
- `auth.jsx` — contexto de autenticación, incluye `triggerSync()` para llamar Edge Function
- `supabase.js` — cliente Supabase
- `gmailImport.js` — import manual de Gmail (legacy, ya no es el principal)
- `sriExport.js` — generación de Excel con Formulario GP y Anexo GSP

## Supabase
- **Project ref**: `ciuuhgqbgvcndxjfuejc`
- **URL**: `https://ciuuhgqbgvcndxjfuejc.supabase.co`
- **Anon key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpdXVoZ3FiZ3ZjbmR4amZ1ZWpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3ODI4ODEsImV4cCI6MjA4NzM1ODg4MX0.1vlTv7qNf_7dM4VuPS0lDOVc7CrKvBzAWZr28F5tZ0M`

## Tablas en Supabase
### facturas
- `id`, `user_id`, `emisor`, `ruc`, `fecha`, `monto`, `categoria`, `sri` (boolean), `comprobantes`, `fuente` (gmail/manual), `clave_acceso` (unique por user)
- RLS: cada usuario solo ve sus facturas

### gmail_tokens
- `user_id`, `refresh_token`, `last_sync`
- Guarda el refresh token de Google para el sync automático en background

### perfiles
- `user_id`, `salario`, `cargas` (cargas familiares)

## Edge Function: gmail-sync
- Ubicación: `supabase/functions/gmail-sync/index.ts`
- Deploy: `npx supabase functions deploy gmail-sync`
- **Función**: busca emails en Gmail con facturas XML del SRI, las parsea y guarda en Supabase
- **Triggers**: 
  1. Cron automático cada 12h
  2. Manual desde botón en UI — llama `POST /functions/v1/gmail-sync` con `{ user_id }` en el body
- **Secrets necesarios en Supabase**: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- JWT verification está **desactivada** en esta función (configurado en Supabase Dashboard)

## Parsing de XMLs del SRI
El parser maneja 3 formatos:
1. **CDATA estándar**: `<comprobante><![CDATA[...]]></comprobante>`
2. **HTML-encoded** (Tipti y otros): `<comprobante>&lt;factura...&gt;</comprobante>`
3. **XML directo**

## Categorías SRI
- Alimentación, Salud, Educación, Vivienda, Vestimenta, Turismo, Otros
- Cada categoría mapea a un campo del Formulario GP (campos 106-111)

## Branding — facilito
- Nombre: **facilito** (siempre minúscula)
- Tagline: "La forma más fácil de declarar impuestos en Ecuador"
- Logo: SVG con checkmark redondeado sobre fondo amarillo
- Colores: dark green `#0D1F14` + yellow `#F5E642`
- Fonts: Syne (títulos), DM Sans (cuerpo)
- Tono: amigable, humano, sin términos intimidantes
- Copy clave: "Declarar, facilito." / "Todo listo" / "Estás al día"

## TODOs pendientes
- [ ] Verificar que el sync automático (cron cada 12h) esté funcionando correctamente
- [ ] Cargar facturas desde Supabase al abrir la app (actualmente puede cargar desde localStorage)
- [ ] Mostrar "último sync" con fecha real en pantalla Conectar
- [ ] Mobile: revisar que LemonTaxMobile.jsx también tenga el rebrand de facilito
- [ ] Exportar Excel: verificar que Formulario GP y Anexo GSP generan correctamente con las facturas de Supabase
- [ ] Considerar agregar notificaciones/recordatorio cuando se acerque la fecha de declaración SRI

## Cómo hacer deploy
```bash
# Frontend (Vercel auto-deploya al hacer push)
git add .
git commit -m "descripción"
git push

# Edge Function
npx supabase functions deploy gmail-sync
```

## Usuario de prueba
- Email: tomas@industryft.com / tomascallesaenz@gmail.com
