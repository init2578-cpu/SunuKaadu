// Edge Function : auto-schedule-elections
// Appelée par pg_cron toutes les minutes.
// Vérifie les scrutins "brouillon" dont la date_ouverture est passée,
// les ouvre automatiquement et envoie les e-mails OTP / notification candidats.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "http://kong:8000";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const APP_URL = Deno.env.get("APP_URL") || "https://sunukaadu.creinit.com";

// Client privilégié (bypass RLS) pour opérations serveur
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function callSendVoteEmail(payload: Record<string, unknown>): Promise<void> {
  // En local, le runtime Edge accède aux autres functions via l'URL interne du container Kong
  const fnUrl = `${SUPABASE_URL}/functions/v1/send-vote-email`;
  try {
    const res = await fetch(fnUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // On utilise le service_role pour ne pas bloquer sur les restrictions de rôle
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        apikey: SERVICE_ROLE_KEY,
      },
      body: JSON.stringify(payload),
    });
    const result = await res.json();
    if (result?.sandbox_restriction) {
      console.info("[auto-schedule] Sandbox Resend restriction – e-mail non envoyé (environnement local).");
    } else if (!res.ok) {
      console.error("[auto-schedule] Erreur send-vote-email:", result);
    }
  } catch (err) {
    console.error("[auto-schedule] fetch send-vote-email error:", err);
  }
}

// ─── Traitement d'une élection à ouvrir ──────────────────────────────────────

// ─── Phase 1 : Envoi des emails (H-5 min) ───────────────────────────────────

async function processElectionEmails(election: Record<string, unknown>): Promise<{ success: boolean; message: string }> {
  const electionId = election.id as string;
  const amicaleId = election.amicale_id as string;

  // 1. Vérifier qu'il y a au moins 1 poste avec ≥ 2 candidats
  const { data: postesData } = await supabaseAdmin
    .from("postes")
    .select("id, nom")
    .eq("election_id", electionId);

  if (!postesData || postesData.length === 0) {
    return {
      success: false,
      message: `Élection ${electionId}: aucun poste défini. Skip.`,
    };
  }

  const posteIds = postesData.map((p: any) => p.id);
  const { data: candidatsSnap, error: candErr } = await supabaseAdmin
    .from("candidats")
    .select("id, poste_id, prenom, nom")
    .in("poste_id", posteIds);
    
  if (candErr) {
    console.error("Erreur query candidats:", candErr);
  }

  const candidatsByPoste: Record<string, number> = {};
  (candidatsSnap || []).forEach((c: any) => {
    candidatsByPoste[c.poste_id] = (candidatsByPoste[c.poste_id] || 0) + 1;
  });

  const hasValidPoste = Object.values(candidatsByPoste).some((count) => count >= 2);
  if (!hasValidPoste) {
    return {
      success: false,
      message: `Élection ${electionId}: aucun poste avec ≥ 2 candidats. Skip.`,
    };
  }

  // 2. Récupérer les étudiants activés de l'amicale
  const { data: studentsSnap } = await supabaseAdmin
    .from("students")
    .select("id, prenom, nom, email")
    .eq("amicale_id", amicaleId)
    .eq("is_activated", true);

  const expiresAt = election.date_fermeture
    ? new Date(election.date_fermeture as string).getTime()
    : Date.now() + 24 * 60 * 60 * 1000;

  // 3. Générer et stocker les OTP, puis envoyer les e-mails aux étudiants
  let studentEmails = 0;
  for (const student of studentsSnap || []) {
    const otp = generateOtp();

    await supabaseAdmin
      .from("students")
      .update({ otp_code: otp, otp_expires_at: expiresAt })
      .eq("id", (student as any).id);

    if ((student as any).email) {
      await callSendVoteEmail({
        type: "student",
        to: (student as any).email,
        prenom: (student as any).prenom,
        nom: (student as any).nom,
        election_titre: election.titre as string,
        otp_code: otp,
        date_fermeture: election.date_fermeture as string | null,
      });
      studentEmails++;
    }
  }

  // 4. (Anciennement notifications candidats, retiré car la colonne email a été supprimée)
  let candidatEmails = 0;

  // 5. Marquer les e-mails comme envoyés
  const { error: updateErr } = await supabaseAdmin
    .from("elections")
    .update({ emails_envoyes: true })
    .eq("id", electionId);

  if (updateErr) {
    return {
      success: false,
      message: `Élection ${electionId}: erreur de mise à jour (emails_envoyes) – ${updateErr.message}`,
    };
  }

  return {
    success: true,
    message: `[H-5] Élection "${election.titre}": ${studentEmails} OTP étudiant(s) et ${candidatEmails} notification(s) candidat(s) envoyé(s).`,
  };
}

// ─── Phase 2 : Ouverture de l'élection (Heure H) ────────────────────────────

async function openElection(election: Record<string, unknown>): Promise<{ success: boolean; message: string }> {
  const electionId = election.id as string;
  const amicaleId = election.amicale_id as string;

  // 1. Vérifier qu'aucune autre élection n'est déjà ouverte dans cette amicale
  const { data: openSnap } = await supabaseAdmin
    .from("elections")
    .select("id, titre")
    .eq("amicale_id", amicaleId)
    .eq("statut", "ouverte");

  if (openSnap && openSnap.length > 0) {
    return {
      success: false,
      message: `Amicale ${amicaleId}: une élection est déjà ouverte ("${(openSnap[0] as any).titre}"). Skip.`,
    };
  }

  // 2. Ouvrir l'élection
  const { error: updateErr } = await supabaseAdmin
    .from("elections")
    .update({
      statut: "ouverte",
      date_ouverture: new Date().toISOString(),
    })
    .eq("id", electionId);

  if (updateErr) {
    return {
      success: false,
      message: `Élection ${electionId}: erreur lors de l'ouverture – ${updateErr.message}`,
    };
  }

  return {
    success: true,
    message: `[Heure H] Élection "${election.titre}" officiellement ouverte aux votes.`,
  };
}

// ─── Handler principal ────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // CORS preflight
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
  if (!authHeader || authHeader !== `Bearer ${SERVICE_ROLE_KEY}`) {
    return new Response(
      JSON.stringify({ error: "Non autorisé" }),
      { status: 401, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  }

  try {
    const now = new Date();
    const nowStr = now.toISOString();
    // 5 minutes avant l'heure d'ouverture
    const nowPlus5Mins = new Date(now.getTime() + 5 * 60 * 1000).toISOString();

    const results: string[] = [];
    let processedCount = 0;

    // --- PHASE 1 : Préparation et Envoi d'emails (H-5 min) ---
    const { data: dueForEmails, error: fetchEmailsErr } = await supabaseAdmin
      .from("elections")
      .select("*")
      .eq("statut", "brouillon")
      .eq("emails_envoyes", false)
      .not("date_ouverture", "is", null)
      .lte("date_ouverture", nowPlus5Mins);

    if (fetchEmailsErr) throw fetchEmailsErr;

    if (dueForEmails && dueForEmails.length > 0) {
      for (const election of dueForEmails) {
        const result = await processElectionEmails(election);
        results.push(result.message);
        if (result.success) processedCount++;
        console.info(result.message);
      }
    }

    // --- PHASE 2 : Ouverture du Scrutin (Heure H) ---
    const { data: dueForOpening, error: fetchOpenErr } = await supabaseAdmin
      .from("elections")
      .select("*")
      .eq("statut", "brouillon")
      .eq("emails_envoyes", true)
      .not("date_ouverture", "is", null)
      .lte("date_ouverture", nowStr);

    if (fetchOpenErr) throw fetchOpenErr;

    if (dueForOpening && dueForOpening.length > 0) {
      for (const election of dueForOpening) {
        const result = await openElection(election);
        results.push(result.message);
        if (result.success) processedCount++;
        console.info(result.message);
      }
    }

    if (results.length === 0) {
      return new Response(
        JSON.stringify({ message: "Aucune action requise (envoi d'e-mails ou ouverture)." }),
        { status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
      );
    }

    return new Response(
      JSON.stringify({
        message: `Traitement terminé. Actions réalisées : ${processedCount}.`,
        results,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      }
    );
  } catch (err: unknown) {
    console.error("[auto-schedule] Erreur globale:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      }
    );
  }
});
