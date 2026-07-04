global.WebSocket = class {}; // Mock WebSocket for Node.js < 22 to satisfy @supabase/realtime-js

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'http://127.0.0.1:54321';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const supabase = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { persistSession: false }
});

async function runTests() {
  console.log("=== STARTING END-TO-END SECURITY VERIFICATION ===");

  try {
    // ----------------------------------------------------
    // TEST 1: check_representative_active
    // ----------------------------------------------------
    console.log("\n[Test 1] check_representative_active...");
    // Avant activation
    const { data: repActive1, error: errActive1 } = await supabase.rpc('check_representative_active', {
      p_email: 'rep@amicale.sn'
    });
    if (errActive1) throw errActive1;
    console.log("-> Active avant activation:", repActive1); // Devrait être false

    // ----------------------------------------------------
    // TEST 2: login_representative (Première connexion / Activation)
    // ----------------------------------------------------
    console.log("\n[Test 2] login_representative (Activation)...");
    const { data: repLogin1, error: errLogin1 } = await supabase.rpc('login_representative', {
      p_email: 'rep@amicale.sn',
      p_password: 'rep123',
      p_personal_password: 'rep_personal_pwd_999'
    });
    if (errLogin1) throw errLogin1;
    console.log("-> Resultat activation:", repLogin1);
    if (!repLogin1.success || repLogin1.status !== 'activated') {
      throw new Error("L'activation du représentant a échoué");
    }

    // Après activation
    const { data: repActive2, error: errActive2 } = await supabase.rpc('check_representative_active', {
      p_email: 'rep@amicale.sn'
    });
    if (errActive2) throw errActive2;
    console.log("-> Active après activation:", repActive2); // Devrait être true

    // Connexion ultérieure avec le nouveau mot de passe
    console.log("\n[Test 3] login_representative (Connexion régulière)...");
    const { data: repLogin2, error: errLogin2 } = await supabase.rpc('login_representative', {
      p_email: 'rep@amicale.sn',
      p_password: 'rep_personal_pwd_999'
    });
    if (errLogin2) throw errLogin2;
    console.log("-> Resultat connexion ultérieure:", repLogin2);
    if (!repLogin2.success || repLogin2.status !== 'logged_in') {
      throw new Error("La connexion régulière du représentant a échoué");
    }

    // ----------------------------------------------------
    // TEST 4: verify_temp_admin_password
    // ----------------------------------------------------
    console.log("\n[Test 4] verify_temp_admin_password...");
    const { data: adminCheck, error: errAdminCheck } = await supabase.rpc('verify_temp_admin_password', {
      p_email: 'admin@amicale.sn',
      p_temp_password: 'admin123'
    });
    if (errAdminCheck) throw errAdminCheck;
    console.log("-> Resultat check admin temp password:", adminCheck);
    if (!adminCheck.success || adminCheck.is_activated) {
      throw new Error("La validation du mot de passe temporaire admin a échoué");
    }

    // ----------------------------------------------------
    // TEST 5: request_student_otp & verify_student_otp
    // ----------------------------------------------------
    console.log("\n[Test 5] request_student_otp...");
    const { data: otpReq, error: errOtpReq } = await supabase.rpc('request_student_otp', {
      p_email: 'student@amicale.sn'
    });
    if (errOtpReq) throw errOtpReq;
    console.log("-> Resultat request OTP:", otpReq);
    if (!otpReq.success) {
      throw new Error("La requête d'OTP a échoué: " + otpReq.error);
    }

    // Puisqu'on ne peut pas lire l'OTP par RLS (les colonnes sont masquées pour anon),
    // récupérons-la de la table via service_role.
    const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false }
    });

    const { data: studentDb, error: errStudentDb } = await supabaseAdmin
      .from('students')
      .select('otp_code')
      .eq('email', 'student@amicale.sn')
      .single();
    if (errStudentDb) throw errStudentDb;
    const otpCode = studentDb.otp_code;
    console.log("-> OTP récupéré via service_role:", otpCode);

    // Essayer de le lire via le client anonyme standard (devrait retourner nul/vide ou erreur de droits)
    console.log("\n[Test 6] Vérification restriction d'accès aux colonnes OTP (RLS)...");
    const { data: studentAnon, error: errStudentAnon } = await supabase
      .from('students')
      .select('id, email, otp_code')
      .eq('email', 'student@amicale.sn')
      .single();
    console.log("-> Lecture anonyme de otp_code (devrait être nul ou rejeté):", studentAnon?.otp_code);
    if (studentAnon && studentAnon.otp_code) {
      throw new Error("FAILLE DE SECURITE : Un utilisateur anonyme a pu lire l'OTP d'un étudiant !");
    }
    console.log("-> RLS restriction validée avec succès !");

    // Valider l'OTP
    console.log("\n[Test 7] verify_student_otp...");
    const { data: otpVerify, error: errOtpVerify } = await supabase.rpc('verify_student_otp', {
      p_email: 'student@amicale.sn',
      p_code: otpCode
    });
    if (errOtpVerify) throw errOtpVerify;
    console.log("-> Resultat verify OTP:", otpVerify);
    if (!otpVerify.success) {
      throw new Error("La validation d'OTP a échoué: " + otpVerify.error);
    }

    // ----------------------------------------------------
    // TEST 8: submit_vote
    // ----------------------------------------------------
    console.log("\n[Test 8] submit_vote...");
    const electionId = 'e1111111-1111-1111-1111-111111111111';
    const posteId = '11111111-1111-1111-1111-111111111111';
    const candidatId = 'c1111111-1111-1111-1111-111111111111';
    const studentId = otpVerify.student.id;

    const { data: voteRes, error: errVoteRes } = await supabase.rpc('submit_vote', {
      p_election_id: electionId,
      p_poste_id: posteId,
      p_candidat_id: candidatId,
      p_student_id: studentId
    });
    if (errVoteRes) throw errVoteRes;
    console.log("-> Resultat submit_vote:", voteRes);
    if (!voteRes.success) {
      throw new Error("La soumission du vote a échoué: " + voteRes.error);
    }

    // Tenter de voter deux fois
    console.log("\n[Test 9] submit_vote (Tentative double vote)...");
    const { data: voteRes2, error: errVoteRes2 } = await supabase.rpc('submit_vote', {
      p_election_id: electionId,
      p_poste_id: posteId,
      p_candidat_id: candidatId,
      p_student_id: studentId
    });
    if (errVoteRes2) throw errVoteRes2;
    console.log("-> Resultat tentative double vote:", voteRes2);
    if (voteRes2.success) {
      throw new Error("FAILLE DE SECURITE : Un étudiant a pu voter deux fois !");
    }
    console.log("-> Double vote bloqué avec succès !");

    // Vérifier l'anonymat dans la table des votes
    console.log("\n[Test 10] Vérification de l'anonymat des votes...");
    const { data: votes, error: errVotes } = await supabaseAdmin
      .from('votes')
      .select('*')
      .eq('election_id', electionId);
    if (errVotes) throw errVotes;
    console.log("-> Bulletins de vote enregistrés (ne doivent contenir aucune référence à l'étudiant):", votes);
    for (const v of votes) {
      if (v.student_id) {
        throw new Error("FAILLE DE SECURITE : Le bulletin de vote contient l'identifiant de l'étudiant !");
      }
    }
    console.log("-> Anonymat des votes validé avec succès !");

    console.log("\n==============================================");
    console.log("🎉 TOUS LES TESTS DE SÉCURITÉ ONT RÉUSSI AVEC SUCCÈS !");
    console.log("==============================================");

  } catch (error) {
    console.error("\n❌ UN TEST A ÉCHOUÉ :", error);
    process.exit(1);
  }
}

runTests();
