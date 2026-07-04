// Edge Function : send-vote-email
// Envoie les e-mails lors de l'ouverture d'un scrutin :
//  - aux électeurs : leur code OTP à 6 chiffres
//  - aux candidats : notification d'ouverture du vote

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { SMTPClient } from "https://deno.land/x/denomailer/mod.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const FROM_EMAIL = "onboarding@resend.dev";
const APP_URL = Deno.env.get("APP_URL") || "http://localhost:5173";

async function verifyAuthorization(authHeader: string | null): Promise<boolean> {
  if (!authHeader) return false;
  const token = authHeader.replace("Bearer ", "");
  
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (serviceRoleKey && token === serviceRoleKey) {
    return true;
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!supabaseUrl || !supabaseAnonKey) return false;

  try {
    const tempClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    
    const { data: { user }, error } = await tempClient.auth.getUser();
    if (error || !user) return false;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: adminData } = await supabaseAdmin
      .from("admins")
      .select("role, is_revoked")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (adminData && !adminData.is_revoked && (adminData.role === "super_admin" || adminData.role === "delegue")) {
      return true;
    }
  } catch (err) {
    console.error("Token verification error:", err);
  }

  return false;
}

// ─── Templates HTML ──────────────────────────────────────────────────────────

const studentEmailTemplate = (data: {
  prenom: string;
  nom: string;
  election_titre: string;
  otp_code: string;
  vote_url: string;
  date_fermeture?: string;
}): string => `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Votre code de vote - SunuKaadu</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0f1e;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0f1e;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#111827,#1a2235);border-radius:20px;overflow:hidden;border:1px solid rgba(34,197,94,0.2);max-width:600px;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#064e3b,#065f46);padding:40px 40px 30px;text-align:center;">
              <div style="display:inline-block;background:rgba(34,197,94,0.15);border:1px solid rgba(34,197,94,0.3);border-radius:50%;width:70px;height:70px;line-height:70px;font-size:32px;margin-bottom:16px;">🗳️</div>
              <h1 style="color:#4ade80;font-size:26px;font-weight:800;margin:0 0 8px;">SunuKaadu</h1>
              <p style="color:rgba(255,255,255,0.7);font-size:14px;margin:0;">Plateforme officielle de gestion des scrutins</p>
            </td>
          </tr>

          <!-- Corps -->
          <tr>
            <td style="padding:40px;">
              <h2 style="color:#fff;font-size:20px;font-weight:700;margin:0 0 8px;">
                Bonjour ${data.prenom} ${data.nom},
              </h2>
              <p style="color:rgba(255,255,255,0.6);font-size:15px;line-height:1.6;margin:0 0 28px;">
                Le scrutin <strong style="color:#4ade80;">"${data.election_titre}"</strong> sera officiellement <strong style="color:#4ade80;">OUVERT dans 5 minutes</strong>. Vous êtes invité(e) à vous préparer pour exprimer votre vote.
              </p>

              <!-- Code OTP -->
              <div style="background:rgba(34,197,94,0.08);border:2px solid rgba(34,197,94,0.3);border-radius:16px;padding:28px 24px;margin-bottom:28px;text-align:center;">
                <p style="margin:0 0 12px;color:#4ade80;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:2px;">🔑 Votre Code Electoral Secret</p>
                <p style="margin:0 0 16px;color:rgba(255,255,255,0.5);font-size:12px;">Ce code à 6 chiffres est <strong>strictement personnel</strong> et ne doit être partagé avec personne.</p>
                <div style="background:rgba(0,0,0,0.3);border:1px solid rgba(34,197,94,0.4);border-radius:12px;padding:20px;display:inline-block;min-width:200px;">
                  <span style="color:#4ade80;font-size:40px;font-weight:900;letter-spacing:10px;font-family:monospace;">${data.otp_code}</span>
                </div>
                ${data.date_fermeture ? `<p style="margin:16px 0 0;color:rgba(255,255,255,0.4);font-size:12px;">⏰ Valide jusqu'au : <strong style="color:rgba(255,165,0,0.9);">${data.date_fermeture}</strong></p>` : ''}
              </div>

              <p style="color:rgba(255,255,255,0.6);font-size:14px;line-height:1.6;margin:0 0 24px;">
                Pour voter, rendez-vous sur la plateforme, saisissez votre e-mail puis ce code secret. Votre vote sera enregistré de manière <strong style="color:#fff;">totalement anonyme</strong>.
              </p>

              <!-- Bouton -->
              <div style="text-align:center;margin-bottom:32px;">
                <a href="${data.vote_url}" style="display:inline-block;background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;font-size:15px;font-weight:800;text-decoration:none;padding:16px 40px;border-radius:12px;letter-spacing:0.5px;">
                  Voter maintenant →
                </a>
              </div>

              <p style="color:rgba(255,255,255,0.3);font-size:12px;text-align:center;line-height:1.6;margin:0;">
                Si vous n'êtes pas inscrit(e) sur cette plateforme, ignorez cet e-mail.<br>
                Ce message est envoyé automatiquement par la plateforme SunuKaadu.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:rgba(0,0,0,0.2);padding:20px 40px;border-top:1px solid rgba(255,255,255,0.05);">
              <p style="margin:0;color:rgba(255,255,255,0.2);font-size:11px;text-align:center;">
                SunuKaadu — Système de vote universitaire sécurisé
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const candidatEmailTemplate = (data: {
  prenom: string;
  nom: string;
  election_titre: string;
  poste_nom: string;
  vote_url: string;
  date_fermeture?: string;
}): string => `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Scrutin ouvert - SunuKaadu</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0f1e;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0f1e;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#111827,#1a2235);border-radius:20px;overflow:hidden;border:1px solid rgba(251,191,36,0.2);max-width:600px;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1d4ed8,#7c3aed);padding:40px 40px 30px;text-align:center;">
              <div style="display:inline-block;background:rgba(251,191,36,0.15);border:1px solid rgba(251,191,36,0.3);border-radius:50%;width:70px;height:70px;line-height:70px;font-size:32px;margin-bottom:16px;">🏆</div>
              <h1 style="color:#fbbf24;font-size:26px;font-weight:800;margin:0 0 8px;">SunuKaadu</h1>
              <p style="color:rgba(255,255,255,0.7);font-size:14px;margin:0;">Plateforme officielle de gestion des scrutins</p>
            </td>
          </tr>

          <!-- Corps -->
          <tr>
            <td style="padding:40px;">
              <h2 style="color:#fff;font-size:20px;font-weight:700;margin:0 0 8px;">
                Bonjour ${data.prenom} ${data.nom},
              </h2>
              <p style="color:rgba(255,255,255,0.6);font-size:15px;line-height:1.6;margin:0 0 28px;">
                Le scrutin pour lequel vous êtes candidat(e) vient d'ouvrir. Les électeurs peuvent dès à présent enregistrer leurs votes.
              </p>

              <!-- Card élection -->
              <div style="background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.25);border-radius:14px;padding:20px 24px;margin-bottom:28px;">
                <p style="margin:0 0 4px;color:rgba(255,255,255,0.4);font-size:11px;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Scrutin</p>
                <p style="margin:0 0 16px;color:#fff;font-size:17px;font-weight:700;">${data.election_titre}</p>
                <p style="margin:0 0 4px;color:rgba(255,255,255,0.4);font-size:11px;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Poste</p>
                <p style="margin:0 0 16px;color:#a78bfa;font-size:15px;font-weight:600;">${data.poste_nom}</p>
                <p style="margin:0 0 4px;color:rgba(255,255,255,0.4);font-size:11px;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Votre candidature</p>
                <p style="margin:0;color:#fbbf24;font-size:15px;font-weight:700;">${data.prenom} ${data.nom}</p>
                ${data.date_fermeture ? `
                <div style="margin-top:16px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.08);">
                  <p style="margin:0;color:rgba(255,255,255,0.4);font-size:11px;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Clôture prévue</p>
                  <p style="margin:4px 0 0;color:rgba(255,165,0,0.9);font-size:14px;font-weight:600;">⏰ ${data.date_fermeture}</p>
                </div>` : ''}
              </div>

              <p style="color:rgba(255,255,255,0.6);font-size:14px;line-height:1.6;margin:0 0 24px;">
                Vous pouvez suivre l'avancement du vote en temps réel depuis votre espace représentant sur la plateforme. <strong style="color:#fff;">Bonne chance !</strong>
              </p>

              <!-- Bouton -->
              <div style="text-align:center;margin-bottom:32px;">
                <a href="${data.vote_url}/representant/login" style="display:inline-block;background:linear-gradient(135deg,#fbbf24,#f59e0b);color:#111827;font-size:15px;font-weight:800;text-decoration:none;padding:16px 40px;border-radius:12px;letter-spacing:0.5px;">
                  Suivre le scrutin →
                </a>
              </div>

              <p style="color:rgba(255,255,255,0.3);font-size:12px;text-align:center;line-height:1.6;margin:0;">
                Ce message est envoyé automatiquement par la plateforme SunuKaadu.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:rgba(0,0,0,0.2);padding:20px 40px;border-top:1px solid rgba(255,255,255,0.05);">
              <p style="margin:0;color:rgba(255,255,255,0.2);font-size:11px;text-align:center;">
                SunuKaadu — Système de vote universitaire sécurisé
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDateFr(isoString: string): string {
  try {
    return new Date(isoString).toLocaleString("fr-FR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
      timeZone: "Africa/Dakar"
    });
  } catch {
    return isoString;
  }
}

async function sendEmailViaSMTP(
  to: string,
  subject: string,
  html: string
): Promise<{ success: boolean; error?: string }> {
  const host = Deno.env.get("SMTP_HOST");
  const portStr = Deno.env.get("SMTP_PORT");
  const user = Deno.env.get("SMTP_USER");
  const pass = Deno.env.get("SMTP_PASS");
  const sender = Deno.env.get("SMTP_SENDER") || "SunuKaadu <noreply@sunukaadu.univ.sn>";

  try {
    const config: any = {
      connection: {
        hostname: host || "supabase_inbucket_SunuKaadu",
        port: portStr ? parseInt(portStr, 10) : 1025,
        tls: host ? (portStr === "465") : false,
      },
    };

    if (host && user && pass) {
      config.connection.auth = {
        username: user,
        password: pass,
      };
      if (portStr === "587") {
        config.debug = {
          allowUnsecure: true,
        };
      }
    } else {
      config.debug = {
        allowUnsecure: true,
        noStartTLS: true,
      };
      config.connection.tls = false;
    }

    const client = new SMTPClient(config);

    await client.send({
      from: sender,
      to: [to],
      subject,
      content: "Veuillez activer le support HTML dans votre client de messagerie pour lire cet e-mail.",
      html,
    });

    await client.close();
    console.info(`[send-vote-email] SMTP: Email successfully sent to ${to} via ${host || "local Mailpit"}`);
    return { success: true };
  } catch (err) {
    console.error(`[send-vote-email] SMTP: Failed to send email to ${to} via ${host || "local Mailpit"}:`, err);
    return { success: false, error: String(err) };
  }
}

async function sendEmailToInbucket(to: string, subject: string, html: string): Promise<{ success: boolean; sandbox_restriction: boolean; error?: string }> {
  const res = await sendEmailViaSMTP(to, subject, html);
  return { success: res.success, sandbox_restriction: true, error: res.error };
}

async function sendEmail(to: string, subject: string, html: string): Promise<{ success: boolean; sandbox_restriction?: boolean; error?: string }> {
  const smtpHost = Deno.env.get("SMTP_HOST");
  if (smtpHost) {
    console.info("[send-vote-email] SMTP_HOST detected, routing via SMTP.");
    return await sendEmailViaSMTP(to, subject, html);
  }

  const isMockKey = !RESEND_API_KEY || RESEND_API_KEY.startsWith("re_UnEQCR9F");

  if (isMockKey) {
    console.info("[send-vote-email] Mock key detected, sending directly to Inbucket.");
    return await sendEmailToInbucket(to, subject, html);
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `SunuKaadu <${FROM_EMAIL}>`,
        to: [to],
        subject,
        html,
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      const isSandbox = result?.message?.includes("only send testing emails") ||
                        result?.message?.includes("sandbox") ||
                        result?.statusCode === 403;
      if (isSandbox) {
        console.info(`[send-vote-email] Sandbox restriction detected for ${to}, falling back to Inbucket.`);
        return await sendEmailToInbucket(to, subject, html);
      }
      return { success: false, error: result?.message || "Resend error" };
    }

    return { success: true };
  } catch (err) {
    console.error("[send-vote-email] Network error trying Resend, falling back to Inbucket:", err);
    return await sendEmailToInbucket(to, subject, html);
  }
}

// ─── Handler principal ────────────────────────────────────────────────────────

interface VoteEmailPayload {
  type: "student" | "candidat";
  to: string;
  prenom: string;
  nom: string;
  election_titre: string;
  otp_code?: string;           // uniquement pour type=student
  poste_nom?: string;          // uniquement pour type=candidat
  date_fermeture?: string;     // ISO string optionnel
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  const authHeader = req.headers.get("Authorization");
  const isAuthorized = await verifyAuthorization(authHeader);
  if (!isAuthorized) {
    return new Response(
      JSON.stringify({ error: "Non autorisé : privilèges insuffisants" }),
      { status: 403, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  }

  try {
    const payload: VoteEmailPayload = await req.json();

    if (!payload.to || !payload.prenom || !payload.nom || !payload.election_titre || !payload.type) {
      return new Response(
        JSON.stringify({ error: "Paramètres manquants" }),
        { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
      );
    }

    const vote_url = APP_URL;
    const dateFr = payload.date_fermeture ? formatDateFr(payload.date_fermeture) : undefined;

    let subject: string;
    let html: string;

    if (payload.type === "student") {
      if (!payload.otp_code) {
        return new Response(
          JSON.stringify({ error: "otp_code requis pour le type student" }),
          { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
        );
      }
      subject = `🗳️ Votre code de vote — ${payload.election_titre}`;
      html = studentEmailTemplate({
        prenom: payload.prenom,
        nom: payload.nom,
        election_titre: payload.election_titre,
        otp_code: payload.otp_code,
        vote_url,
        date_fermeture: dateFr,
      });
    } else {
      subject = `🏆 Scrutin ouvert — ${payload.election_titre}`;
      html = candidatEmailTemplate({
        prenom: payload.prenom,
        nom: payload.nom,
        election_titre: payload.election_titre,
        poste_nom: payload.poste_nom || "Poste en compétition",
        vote_url,
        date_fermeture: dateFr,
      });
    }

    const result = await sendEmail(payload.to, subject, html);

    return new Response(
      JSON.stringify(result),
      {
        status: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      }
    );
  } catch (err: unknown) {
    console.error("Edge function error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      }
    );
  }
});
