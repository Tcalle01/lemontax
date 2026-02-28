// supabase/functions/enviar-recordatorios/index.ts
// Cron diario a las 8am Ecuador (UTC-5 = 13:00 UTC)
// Envía recordatorios por email via Resend para obligaciones próximas

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const APP_URL = Deno.env.get("APP_URL") || "https://lemontax.vercel.app";

// ── Tablas de vencimiento (mismo que DIAS_VENCIMIENTO en theme.js) ──
const DIAS_VENCIMIENTO: Record<string, number> = {
  "1": 10, "2": 12, "3": 14, "4": 16, "5": 18,
  "6": 20, "7": 22, "8": 24, "9": 26, "0": 28,
};

const OBLIGACIONES_POR_TIPO: Record<string, string[]> = {
  dependencia_pura:      ["ir_anual", "agp"],
  dependencia_con_extras:["iva_mensual", "ir_anual", "agp"],
  freelancer_general:    ["iva_mensual", "ir_anual", "agp"],
  rimpe_emprendedor:     ["iva_semestral", "ir_anual_rimpe", "agp"],
  rimpe_negocio_popular: ["ir_anual_rimpe", "agp"],
  arrendador_general:    ["iva_mensual", "ir_anual", "agp"],
};

function buildDate(year: number, month: number, day: number): Date {
  const lastDay = new Date(year, month, 0).getDate();
  return new Date(year, month - 1, Math.min(day, lastDay));
}

function diasHasta(fecha: Date, hoy: Date): number {
  const diff = fecha.getTime() - hoy.getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

interface Obligacion {
  id: string;
  nombre: string;
  descripcion: string;
  fechaVencimiento: Date;
  ruta: string;
}

function calcularObligaciones(
  tipoContribuyente: string,
  digito: string | null,
  hoy: Date
): Obligacion[] {
  const tipos = OBLIGACIONES_POR_TIPO[tipoContribuyente] || [];
  const anio = hoy.getFullYear();
  // If no digit, use day 10 (earliest possible SRI date)
  const dia = digito ? (DIAS_VENCIMIENTO[digito] ?? 10) : 10;
  const result: Obligacion[] = [];

  for (const tipo of tipos) {
    if (tipo === "iva_mensual") {
      for (let mes = 1; mes <= 12; mes++) {
        const mesDec = mes + 1 > 12 ? 1 : mes + 1;
        const anioDec = mes + 1 > 12 ? anio + 1 : anio;
        const fv = buildDate(anioDec, mesDec, dia);
        const mesNombre = new Date(anio, mes - 1).toLocaleString("es-EC", { month: "long" });
        result.push({
          id: `iva_mensual_${anio}_${String(mes).padStart(2, "0")}`,
          nombre: "Declaración de IVA",
          descripcion: `${mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1)} ${anio}`,
          fechaVencimiento: fv,
          ruta: `/obligaciones/iva/${anio}/${String(mes).padStart(2, "0")}`,
        });
      }
    } else if (tipo === "iva_semestral") {
      for (const sem of [1, 2]) {
        const mesVenc = sem === 1 ? 7 : 1;
        const anioVenc = sem === 1 ? anio : anio + 1;
        result.push({
          id: `iva_semestral_${anio}_S${sem}`,
          nombre: "IVA Semestral",
          descripcion: sem === 1 ? `Enero – Junio ${anio}` : `Julio – Diciembre ${anio}`,
          fechaVencimiento: buildDate(anioVenc, mesVenc, dia),
          ruta: `/obligaciones/iva-semestral/${anio}/${sem}`,
        });
      }
    } else if (tipo === "ir_anual" || tipo === "ir_anual_rimpe") {
      const esRimpe = tipo === "ir_anual_rimpe";
      const mesVenc = esRimpe ? 5 : 3;
      result.push({
        id: `ir_anual_${anio - 1}`,
        nombre: esRimpe ? "Impuesto a la Renta (RIMPE)" : "Impuesto a la Renta",
        descripcion: `Año fiscal ${anio - 1}`,
        fechaVencimiento: buildDate(anio, mesVenc, dia),
        ruta: `/obligaciones/renta/${anio - 1}`,
      });
    } else if (tipo === "agp") {
      result.push({
        id: `agp_${anio - 1}`,
        nombre: "Gastos Personales (AGP)",
        descripcion: `Año fiscal ${anio - 1}`,
        // If no digit, use day 10 of February (earliest), as specified for no-digit users
        fechaVencimiento: digito ? buildDate(anio, 2, dia) : buildDate(anio, 2, 10),
        ruta: `/obligaciones/gastos-personales/${anio - 1}`,
      });
    }
  }

  return result;
}

function emailHtml(
  nombre: string,
  obligacionNombre: string,
  obligacionDescripcion: string,
  fechaVenc: string,
  diasRestantes: number,
  ruta: string,
  userId: string
): string {
  const ctaUrl = `${APP_URL}${ruta}`;
  const unsubUrl = `${APP_URL}/ajustes`;
  const diasTexto = diasRestantes === 0
    ? "¡hoy!"
    : diasRestantes === 1
    ? "mañana"
    : `en ${diasRestantes} días`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Recordatorio facilito</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:'DM Sans',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

        <!-- Header verde -->
        <tr>
          <td style="background:#1A3A2A;padding:28px 32px;text-align:center;">
            <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
              <tr>
                <td style="background:#F5E642;border-radius:12px;width:44px;height:44px;text-align:center;vertical-align:middle;">
                  <span style="font-size:22px;line-height:44px;">✓</span>
                </td>
                <td style="padding-left:12px;">
                  <span style="color:#ffffff;font-size:22px;font-weight:800;letter-spacing:-0.5px;">facilito</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Cuerpo -->
        <tr>
          <td style="padding:32px;">
            <p style="color:#5A7A64;font-size:13px;margin:0 0 8px;">Hola, <strong style="color:#1A2E20;">${nombre || "contribuyente"}</strong></p>
            <h1 style="color:#1A2E20;font-size:20px;font-weight:800;margin:0 0 20px;line-height:1.3;">
              Tu <strong>${obligacionNombre}</strong> vence ${diasTexto}
            </h1>

            <!-- Card de la obligación -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7FAF8;border:1.5px solid #E0E8E2;border-radius:12px;margin-bottom:24px;">
              <tr>
                <td style="padding:16px 20px;">
                  <table cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="background:#F5E64230;border-radius:8px;padding:8px;vertical-align:middle;">
                        <span style="font-size:20px;">📅</span>
                      </td>
                      <td style="padding-left:14px;vertical-align:middle;">
                        <p style="color:#1A2E20;font-size:15px;font-weight:700;margin:0 0 3px;">${obligacionNombre}</p>
                        <p style="color:#5A7A64;font-size:12px;margin:0 0 3px;">${obligacionDescripcion}</p>
                        <p style="color:#8FA894;font-size:11px;margin:0;">Vence el <strong style="color:#1A2E20;">${fechaVenc}</strong></p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            ${!nombre ? `<p style="color:#5A7A64;font-size:12px;background:#FFF8E1;border:1px solid #F5E64260;border-radius:8px;padding:12px;margin-bottom:24px;">
              💡 <strong>Tip:</strong> Configura tu dígito de RUC en facilito para recibir recordatorios con tu fecha exacta de vencimiento.
            </p>` : ""}

            <!-- CTA -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center">
                  <a href="${ctaUrl}" style="display:inline-block;background:#1A3A2A;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:14px;font-weight:800;letter-spacing:0.2px;">
                    Revisar en facilito →
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#F7FAF8;border-top:1px solid #E0E8E2;padding:20px 32px;text-align:center;">
            <p style="color:#8FA894;font-size:11px;margin:0 0 6px;">
              Este recordatorio fue enviado por facilito — declarar, facilito.
            </p>
            <p style="margin:0;">
              <a href="${unsubUrl}" style="color:#8FA894;font-size:11px;text-decoration:underline;">
                Desactivar notificaciones
              </a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function enviarEmail(
  to: string,
  asunto: string,
  html: string
): Promise<boolean> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "facilito <recordatorios@lemontax.vercel.app>",
      to: [to],
      subject: asunto,
      html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`Error enviando email a ${to}:`, err);
    return false;
  }
  return true;
}

Deno.serve(async (req) => {
  // Allow cron invocation (no auth) and manual POST
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const hoy = new Date();
  // Normalize to midnight UTC for comparison
  hoy.setUTCHours(0, 0, 0, 0);

  // ── Fetch all users with notifications enabled ──
  const { data: perfiles, error } = await supabase
    .from("perfil")
    .select("user_id, nombre, noveno_digito_ruc, tipo_contribuyente, dias_anticipacion, email_notificaciones, notificaciones_email")
    .eq("notificaciones_email", true)
    .not("tipo_contribuyente", "is", null);

  if (error) {
    console.error("Error fetching perfiles:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  // ── Fetch user emails from auth ──
  // We need auth.users emails — use service role to query
  const { data: authUsers } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const emailPorUserId: Record<string, string> = {};
  for (const u of authUsers?.users || []) {
    emailPorUserId[u.id] = u.email || "";
  }

  let enviados = 0;
  let errores = 0;

  for (const p of perfiles || []) {
    const tipoContribuyente = p.tipo_contribuyente;
    const digito = p.noveno_digito_ruc || null;
    const diasAnticipacion = p.dias_anticipacion ?? 7;
    const emailDestino = p.email_notificaciones || emailPorUserId[p.user_id] || "";
    const nombre = p.nombre || "";

    if (!emailDestino) continue;

    const obligaciones = calcularObligaciones(tipoContribuyente, digito, hoy);

    for (const ob of obligaciones) {
      const dias = diasHasta(ob.fechaVencimiento, hoy);

      // For users without digit: send reminder on day 10 of relevant month
      // with a note to configure their digit. We check if obligation date
      // falls exactly diasAnticipacion days from today.
      const debeNotificar = dias === diasAnticipacion;

      // Special case: no digit configured → remind when dias === diasAnticipacion
      // for a "earliest possible" date (dia 10), with a note
      if (!debeNotificar) continue;

      const fechaStr = ob.fechaVencimiento.toLocaleDateString("es-EC", {
        weekday: "long", day: "numeric", month: "long", year: "numeric",
      });

      const sinDigito = !digito;
      const asunto = `Recordatorio: Tu ${ob.nombre} vence el ${ob.fechaVencimiento.toLocaleDateString("es-EC", { day: "numeric", month: "long" })}`;

      const html = emailHtml(
        nombre,
        ob.nombre,
        ob.descripcion,
        fechaStr,
        dias,
        ob.ruta,
        p.user_id,
      );

      // Replace the nombre placeholder for no-digit hint
      const htmlFinal = sinDigito
        ? html.replace(nombre || "contribuyente", `${nombre || "contribuyente"}`) // html already has the hint when nombre is empty-ish
        : html;

      const ok = await enviarEmail(emailDestino, asunto, sinDigito
        ? `[facilito] ${asunto} · Configura tu RUC para fechas exactas`
        : asunto);

      if (ok) { enviados++; console.log(`Email enviado a ${emailDestino} — ${ob.nombre}`); }
      else errores++;
    }
  }

  console.log(`Recordatorios enviados: ${enviados}, errores: ${errores}`);
  return new Response(JSON.stringify({ enviados, errores }), {
    headers: { "Content-Type": "application/json" },
  });
});
