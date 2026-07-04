// Edge Function : send-rep-email
// Envoie un email de bienvenue/invitation au représentant d'un candidat

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

  try {
    // 1. Parser le JWT localement pour extraire l'ID utilisateur
    const payloadB64 = token.split(".")[1];
    const payloadStr = atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/"));
    const jwt = JSON.parse(payloadStr);
    const userId = jwt.sub;
    
    if (!userId) return false;

    // 2. Toujours utiliser http://kong:8000 en interne (le DNS Docker)
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "http://kong:8000";

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: adminData, error } = await supabaseAdmin
      .from("admins")
      .select("role, is_revoked")
      .eq("auth_user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("Erreur DB:", error);
      return false;
    }

    if (adminData && !adminData.is_revoked && (adminData.role === "super_admin" || adminData.role === "delegue")) {
      return true;
    }
  } catch (err) {
    console.error("Erreur vérification token:", err);
  }

  return false;
}
interface RepEmailPayload {
  to: string;
  prenom: string;
  nom: string;
  candidat_prenom?: string;
  candidat_nom?: string;
  poste_nom?: string;
  election_titre?: string;
  mot_de_passe: string;
  login_url: string;
  role?: 'representant' | 'delegue' | 'super_admin';
}

const emailTemplate = (data: RepEmailPayload): string => {
  const isSuperAdmin = data.role === 'super_admin';
  const isDelegue = data.role === 'delegue';
  const isAdminOrDelegue = isSuperAdmin || isDelegue;

  const welcomeText = isSuperAdmin
    ? `Vous avez été désigné(e) comme <strong style="color:#fbbf24;">super administrateur</strong> de la plateforme.`
    : isDelegue
      ? `Vous avez été désigné(e) comme <strong style="color:#fbbf24;">délégué(e) électoral(e)</strong> de la commission électorale.`
      : `Vous avez été désigné(e) comme <strong style="color:#fbbf24;">représentant(e) officiel(le)</strong> du candidat suivant :`;

  const detailsSection = isAdminOrDelegue
    ? `En tant qu'administrateur, vous disposez d'un accès privilégié à la console d'administration sécurisée pour superviser le déroulement des scrutins, configurer les listes et gérer la plateforme.`
    : `En tant que représentant, vous pouvez accéder à un tableau de bord dédié pour <strong style="color:#fff;">suivre en temps réel les votes</strong> enregistrés pour votre candidat.`;

  const buttonText = isAdminOrDelegue
    ? "Accéder à la console d'administration →"
    : "Accéder à mon espace représentant →";

  const candidatCard = !isAdminOrDelegue ? `
    <!-- Card candidat -->
    <div style="background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.25);border-radius:14px;padding:20px 24px;margin-bottom:28px;">
      <p style="margin:0 0 6px;color:rgba(255,255,255,0.5);font-size:11px;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Candidat</p>
      <p style="margin:0 0 12px;color:#fff;font-size:18px;font-weight:700;">${data.candidat_prenom || ''} ${data.candidat_nom || ''}</p>
      <p style="margin:0 0 4px;color:rgba(255,255,255,0.5);font-size:11px;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Poste</p>
      <p style="margin:0 0 12px;color:#a78bfa;font-size:14px;font-weight:600;">${data.poste_nom || ''}</p>
      <p style="margin:0 0 4px;color:rgba(255,255,255,0.5);font-size:11px;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Élection</p>
      <p style="margin:0;color:rgba(255,255,255,0.8);font-size:13px;">${data.election_titre || ''}</p>
    </div>
  ` : '';

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Espace ${isAdminOrDelegue ? 'Administration' : 'Représentant'} - SunuKaadu</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0f1e;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0f1e;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#111827,#1a2235);border-radius:20px;overflow:hidden;border:1px solid rgba(255,193,7,0.2);max-width:600px;">
          
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1d4ed8,#7c3aed);padding:40px 40px 30px;text-align:center;">
              <div style="display:inline-block;background:rgba(255,193,7,0.15);border:1px solid rgba(255,193,7,0.3);border-radius:50%;width:70px;height:70px;line-height:70px;font-size:32px;margin-bottom:16px;">🗳️</div>
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
                ${welcomeText}
              </p>

              ${candidatCard}

              <p style="color:rgba(255,255,255,0.6);font-size:14px;line-height:1.6;margin:0 0 24px;">
                ${detailsSection}
              </p>

              <!-- Identifiants -->
              <div style="background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.25);border-radius:14px;padding:20px 24px;margin-bottom:28px;">
                <p style="margin:0 0 16px;color:#a5b4fc;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">🔑 Vos identifiants de connexion</p>
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding-bottom:10px;">
                      <p style="margin:0 0 4px;color:rgba(255,255,255,0.4);font-size:11px;text-transform:uppercase;">Identifiant (email)</p>
                      <p style="margin:0;color:#fff;font-size:15px;font-weight:600;background:rgba(255,255,255,0.05);padding:8px 12px;border-radius:8px;font-family:monospace;">${data.to}</p>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <p style="margin:0 0 4px;color:rgba(255,255,255,0.4);font-size:11px;text-transform:uppercase;">Mot de passe temporaire</p>
                      <p style="margin:0;color:#fbbf24;font-size:20px;font-weight:800;background:rgba(251,191,36,0.08);padding:10px 14px;border-radius:8px;font-family:monospace;letter-spacing:2px;">${data.mot_de_passe}</p>
                    </td>
                  </tr>
                </table>
              </div>

              <p style="color:rgba(255,255,255,0.5);font-size:13px;margin:0 0 24px;">
                ⚠️ Lors de votre première connexion, vous pourrez définir votre propre mot de passe permanent.
              </p>

              <!-- Bouton -->
              <div style="text-align:center;margin-bottom:32px;">
                <a href="${data.login_url}" style="display:inline-block;background:linear-gradient(135deg,#fbbf24,#f59e0b);color:#111827;font-size:15px;font-weight:800;text-decoration:none;padding:16px 40px;border-radius:12px;letter-spacing:0.5px;">
                  ${buttonText}
                </a>
              </div>

              <p style="color:rgba(255,255,255,0.3);font-size:12px;text-align:center;line-height:1.6;margin:0;">
                Si vous n'êtes pas à l'origine de cette inscription, ignorez cet email.<br>
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
};

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
    console.info(`[send-rep-email] SMTP: Email successfully sent to ${to} via ${host || "local Mailpit"}`);
    return { success: true };
  } catch (err) {
    console.error(`[send-rep-email] SMTP: Failed to send email to ${to} via ${host || "local Mailpit"}:`, err);
    return { success: false, error: String(err) };
  }
}

async function sendEmailToInbucket(to: string, subject: string, html: string): Promise<{ success: boolean; sandbox_restriction: boolean; error?: string }> {
  const res = await sendEmailViaSMTP(to, subject, html);
  return { success: res.success, sandbox_restriction: true, error: res.error };
}

async function sendEmail(to: string, subject: string, html: string): Promise<{ success: boolean; sandbox_restriction?: boolean; error?: string; id?: string }> {
  const smtpHost = Deno.env.get("SMTP_HOST");
  if (smtpHost) {
    console.info("[send-rep-email] SMTP_HOST detected, routing via SMTP.");
    const res = await sendEmailViaSMTP(to, subject, html);
    return { success: res.success, error: res.error };
  }

  const isMockKey = !RESEND_API_KEY || RESEND_API_KEY.startsWith("re_UnEQCR9F");

  if (isMockKey) {
    console.info("[send-rep-email] Mock key detected, sending directly to Inbucket.");
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
      console.error("Resend error:", result);
      const isSandbox = result?.message?.includes("only send testing emails") ||
                        result?.message?.includes("sandbox") ||
                        result?.statusCode === 403;
      if (isSandbox) {
        console.info(`[send-rep-email] Sandbox restriction detected for ${to}, falling back to Inbucket.`);
        return await sendEmailToInbucket(to, subject, html);
      }
      return { success: false, error: result?.message || "Resend error" };
    }

    return { success: true, id: result.id };
  } catch (err) {
    console.error("[send-rep-email] Network error trying Resend, falling back to Inbucket:", err);
    return await sendEmailToInbucket(to, subject, html);
  }
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
    const payload: RepEmailPayload = await req.json();

    if (!payload.to || !payload.mot_de_passe || !payload.prenom) {
      return new Response(
        JSON.stringify({ error: "Paramètres manquants" }),
        { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
      );
    }

    const isAdminOrDelegue = payload.role === 'super_admin' || payload.role === 'delegue';
    const loginUrl = payload.login_url || (isAdminOrDelegue ? `${APP_URL}/admin/login` : `${APP_URL}/representant/login`);
    const emailSubject = payload.role === 'super_admin'
      ? `🗳️ Votre accès Super Administrateur - SunuKaadu`
      : payload.role === 'delegue'
        ? `🗳️ Votre espace délégué - SunuKaadu`
        : `🗳️ Votre espace représentant - ${payload.candidat_prenom || ''} ${payload.candidat_nom || ''}`;

    const result = await sendEmail(payload.to, emailSubject, emailTemplate({ ...payload, login_url: loginUrl }));

    if (!result.success) {
      return new Response(
        JSON.stringify({ error: "Erreur lors de l'envoi de l'email", details: result.error }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    return new Response(
      JSON.stringify(result),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (err: unknown) {
    console.error("Edge function error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
});

