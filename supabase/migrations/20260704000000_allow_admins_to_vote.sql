-- Migration: Permettre aux délégués et représentants de voter
-- Date: 2026-07-04

CREATE OR REPLACE FUNCTION public.request_student_otp(p_email TEXT)
RETURNS JSONB AS $$
DECLARE
  v_student RECORD;
  v_election RECORD;
  v_otp TEXT;
  v_expires_at BIGINT;
  v_supabase_url TEXT;
  v_service_key TEXT;
BEGIN
  -- 1. Trouver l'étudiant
  SELECT * INTO v_student FROM public.students WHERE LOWER(TRIM(email)) = LOWER(TRIM(p_email));
  IF NOT FOUND THEN
    -- Vérifier si l'utilisateur est un représentant ou un délégué actif
    DECLARE
      v_admin RECORD;
    BEGIN
      SELECT * INTO v_admin FROM public.admins 
      WHERE LOWER(TRIM(email)) = LOWER(TRIM(p_email)) 
        AND role IN ('delegue', 'representant') 
        AND is_revoked = false;
      
      IF FOUND THEN
        -- Insérer dans la table students pour permettre le vote
        INSERT INTO public.students (nom, prenom, email, numero_carte, matricule, is_activated, amicale_id)
        VALUES (
          COALESCE(v_admin.nom, 'Admin'), 
          COALESCE(v_admin.prenom, 'Amicale'), 
          LOWER(TRIM(p_email)), 
          'ADM-' || UPPER(v_admin.role) || '-' || SUBSTRING(v_admin.id::text FROM 1 FOR 8),
          'ADM-' || UPPER(v_admin.role) || '-' || SUBSTRING(v_admin.id::text FROM 1 FOR 8),
          true, 
          v_admin.amicale_id
        )
        RETURNING * INTO v_student;
      ELSE
        RETURN jsonb_build_object('success', false, 'error', 'Cet email n''est pas autorisé à voter. Contactez l''administration.');
      END IF;
    END;
  END IF;

  -- 2. Trouver l'élection ouverte de son amicale
  SELECT * INTO v_election FROM public.elections WHERE amicale_id = v_student.amicale_id AND statut = 'ouverte' LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Aucun scrutin n''est actuellement ouvert pour votre amicale.');
  END IF;

  -- 3. Générer ou réutiliser le code OTP
  v_otp := (floor(random() * 900000) + 100000)::TEXT;
  -- Expire dans 24 heures (millisecondes)
  v_expires_at := (extract(epoch from (now() + interval '24 hours')) * 1000)::BIGINT;
  
  UPDATE public.students 
  SET otp_code = v_otp, otp_expires_at = v_expires_at 
  WHERE id = v_student.id;

  -- 4. Déclencher l'envoi du mail via net.http_post
  -- On récupère la clé service_role et l'URL depuis les secrets du vault
  SELECT decrypted_secret INTO v_supabase_url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
  SELECT decrypted_secret INTO v_service_key FROM vault.decrypted_secrets WHERE name = 'SERVICE_ROLE_KEY' LIMIT 1;

  IF v_supabase_url IS NOT NULL AND v_service_key IS NOT NULL THEN
    PERFORM net.http_post(
      url := v_supabase_url || '/functions/v1/send-vote-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_key
      ),
      body := jsonb_build_object(
        'type', 'student',
        'to', v_student.email,
        'prenom', v_student.prenom,
        'nom', v_student.nom,
        'election_titre', v_election.titre,
        'otp_code', v_otp,
        'date_fermeture', COALESCE(v_election.date_fermeture::text, NULL)
      )
    );
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
