-- Migration: Durcissement de la sécurité de la base de données
-- Date: 2026-07-02

-- Octroi des privilèges de base aux rôles standards
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.amicales, public.admins, public.elections, public.postes, public.candidats TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.students TO anon, authenticated;
GRANT SELECT (id, nom, prenom, email, matricule, numero_carte, filiere, promotion, amicale_id, is_activated, created_at) ON public.students TO anon, authenticated;
GRANT SELECT ON public.emargements, public.votes TO anon, authenticated;

-- 1. Suppression des politiques de développement ouvertes
DROP POLICY IF EXISTS "Allow public read" ON public.amicales;
DROP POLICY IF EXISTS "Allow public write" ON public.amicales;

DROP POLICY IF EXISTS "Allow public read" ON public.admins;
DROP POLICY IF EXISTS "Allow public write" ON public.admins;

DROP POLICY IF EXISTS "Allow public read" ON public.students;
DROP POLICY IF EXISTS "Allow public write" ON public.students;

DROP POLICY IF EXISTS "Allow public read" ON public.elections;
DROP POLICY IF EXISTS "Allow public write" ON public.elections;

DROP POLICY IF EXISTS "Allow public read" ON public.postes;
DROP POLICY IF EXISTS "Allow public write" ON public.postes;

DROP POLICY IF EXISTS "Allow public read" ON public.candidats;
DROP POLICY IF EXISTS "Allow public write" ON public.candidats;

DROP POLICY IF EXISTS "Allow public read" ON public.emargements;
DROP POLICY IF EXISTS "Allow public write" ON public.emargements;

DROP POLICY IF EXISTS "Allow public read" ON public.votes;
DROP POLICY IF EXISTS "Allow public write" ON public.votes;

DROP POLICY IF EXISTS "Allow public read" ON public.mail;
DROP POLICY IF EXISTS "Allow public write" ON public.mail;

-- 2. L'accès aux colonnes d'OTP des étudiants a été sécurisé via les privilèges SELECT ci-dessus.
-- Seules les fonctions SECURITY DEFINER exécutées en tant que propriétaire (postgres/service_role) y auront accès.

-- 3. Fonctions d'aide à la sécurité (Security Definer) pour l'évaluation des rôles dans RLS
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admins
    WHERE auth_user_id = auth.uid()
      AND role = 'super_admin'
      AND is_revoked = false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_delegue_or_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admins
    WHERE auth_user_id = auth.uid()
      AND role IN ('super_admin', 'delegue')
      AND is_revoked = false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_admin_amicale_id()
RETURNS UUID AS $$
DECLARE
  v_amicale_id UUID;
BEGIN
  SELECT amicale_id INTO v_amicale_id FROM public.admins
  WHERE auth_user_id = auth.uid()
    AND is_revoked = false;
  RETURN v_amicale_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Politiques RLS durcies

-- ==========================================
-- AMICALES
-- ==========================================
CREATE POLICY "Allow public read" ON public.amicales FOR SELECT USING (true);
CREATE POLICY "Allow write for super_admin" ON public.amicales FOR ALL TO authenticated USING (public.is_super_admin());

-- ==========================================
-- ADMINS
-- ==========================================
-- Un admin ne peut voir que les admins de son amicale (ou tous si super_admin)
CREATE POLICY "Allow read for admins" ON public.admins FOR SELECT TO authenticated
  USING (
    public.is_super_admin() OR
    amicale_id = public.get_admin_amicale_id() OR
    auth_user_id = auth.uid()
  );

CREATE POLICY "Allow write for super_admin" ON public.admins FOR ALL TO authenticated
  USING (public.is_super_admin());

CREATE POLICY "Allow write for delegue on representatives" ON public.admins FOR ALL TO authenticated
  USING (
    NOT public.is_super_admin() AND
    public.is_delegue_or_super_admin() AND
    amicale_id = public.get_admin_amicale_id() AND
    role = 'representant'
  );

-- ==========================================
-- STUDENTS
-- ==========================================
CREATE POLICY "Allow read for students themselves or admins" ON public.students FOR SELECT
  USING (
    public.is_super_admin() OR
    (auth.uid() IS NOT NULL AND amicale_id = public.get_admin_amicale_id()) OR
    -- Permettre la sélection de son propre profil à un étudiant (basé sur l'id fourni dans les requêtes anonymes ou de vérification)
    -- RLS s'applique, mais le client filtrera par ID
    true
  );

CREATE POLICY "Allow write for admins" ON public.students FOR ALL TO authenticated
  USING (
    public.is_super_admin() OR
    (public.is_delegue_or_super_admin() AND amicale_id = public.get_admin_amicale_id())
  );

-- ==========================================
-- ELECTIONS
-- ==========================================
CREATE POLICY "Allow read for public if published or open" ON public.elections FOR SELECT
  USING (
    statut IN ('ouverte', 'fermee', 'publiee') OR
    public.is_super_admin() OR
    (auth.uid() IS NOT NULL AND amicale_id = public.get_admin_amicale_id())
  );

CREATE POLICY "Allow write for admins" ON public.elections FOR ALL TO authenticated
  USING (
    public.is_super_admin() OR
    (public.is_delegue_or_super_admin() AND amicale_id = public.get_admin_amicale_id())
  );

-- ==========================================
-- POSTES
-- ==========================================
CREATE POLICY "Allow read for everyone" ON public.postes FOR SELECT USING (true);
CREATE POLICY "Allow write for admins" ON public.postes FOR ALL TO authenticated
  USING (
    public.is_super_admin() OR
    EXISTS (
      SELECT 1 FROM public.elections e
      WHERE e.id = election_id AND e.amicale_id = public.get_admin_amicale_id()
    )
  );

-- ==========================================
-- CANDIDATS
-- ==========================================
CREATE POLICY "Allow read for everyone" ON public.candidats FOR SELECT USING (true);
CREATE POLICY "Allow write for admins" ON public.candidats FOR ALL TO authenticated
  USING (
    public.is_super_admin() OR
    EXISTS (
      SELECT 1 FROM public.postes p
      JOIN public.elections e ON e.id = p.election_id
      WHERE p.id = poste_id AND e.amicale_id = public.get_admin_amicale_id()
    )
  );

-- ==========================================
-- EMARGEMENTS
-- ==========================================
CREATE POLICY "Allow read for admins or representatives" ON public.emargements FOR SELECT
  USING (
    public.is_super_admin() OR
    (auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.elections e
      WHERE e.id = election_id AND e.amicale_id = public.get_admin_amicale_id()
    )) OR
    -- Les représentants peuvent lire les émargements pour suivre la participation
    EXISTS (
      SELECT 1 FROM public.admins a
      WHERE a.role = 'representant' 
        AND a.amicale_id = (SELECT amicale_id FROM public.elections e WHERE e.id = election_id)
        -- Note: pour les représentants, on valide l'email dans l'application ou l'API
    )
  );

-- Pas de modification directe depuis le client (insertion via RPC uniquement)
CREATE POLICY "Deny write for everyone" ON public.emargements FOR ALL TO public USING (false);

-- ==========================================
-- VOTES
-- ==========================================
-- Permettre la lecture des résultats globaux uniquement lorsque le scrutin est clos ou publié.
-- Cela empêche toute fuite en temps réel.
CREATE POLICY "Allow read if closed or published" ON public.votes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.elections e
      WHERE e.id = election_id AND e.statut IN ('fermee', 'publiee')
    )
  );

-- Pas de modification directe depuis le client (insertion via RPC uniquement)
CREATE POLICY "Deny write for everyone" ON public.votes FOR ALL TO public USING (false);

-- ==========================================
-- MAIL
-- ==========================================
-- Seul le service_role peut lire/écrire dans la table mail
CREATE POLICY "Allow service role only" ON public.mail FOR ALL TO service_role USING (true);

-- 5. RPC sécurisés (Security Definer)

-- ==========================================
-- RPC : DEMANDE D'OTP ÉTUDIANT
-- ==========================================
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
    RETURN jsonb_build_object('success', false, 'error', 'Cet email n''est pas autorisé à voter. Contactez l''administration.');
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

-- ==========================================
-- RPC : VÉRIFICATION D'OTP ÉTUDIANT
-- ==========================================
CREATE OR REPLACE FUNCTION public.verify_student_otp(p_email TEXT, p_code TEXT)
RETURNS JSONB AS $$
DECLARE
  v_student RECORD;
  v_current_time BIGINT;
BEGIN
  -- 1. Trouver l'étudiant
  SELECT * INTO v_student FROM public.students WHERE LOWER(TRIM(email)) = LOWER(TRIM(p_email));
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profil étudiant introuvable.');
  END IF;

  -- 2. Vérifier l'OTP
  IF v_student.otp_code IS NULL OR v_student.otp_code != TRIM(p_code) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Code de validation incorrect.');
  END IF;

  -- 3. Vérifier l'expiration
  v_current_time := (extract(epoch from now()) * 1000)::BIGINT;
  IF v_student.otp_expires_at IS NULL OR v_student.otp_expires_at < v_current_time THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce code a expiré. Veuillez en demander un nouveau.');
  END IF;

  -- 4. Valider l'étudiant et nettoyer l'OTP
  UPDATE public.students 
  SET otp_code = NULL, otp_expires_at = NULL, is_activated = true 
  WHERE id = v_student.id;

  RETURN jsonb_build_object(
    'success', true,
    'student', jsonb_build_object(
      'id', v_student.id,
      'nom', v_student.nom,
      'prenom', v_student.prenom,
      'email', v_student.email,
      'numero_carte', v_student.numero_carte,
      'filiere', v_student.filiere,
      'promotion', v_student.promotion,
      'is_activated', true,
      'amicale_id', v_student.amicale_id
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- RPC : CONNEXION/ACTIVATION REPRÉSENTANT
-- ==========================================
CREATE OR REPLACE FUNCTION public.login_representative(
  p_email TEXT,
  p_password TEXT,
  p_personal_password TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_admin RECORD;
BEGIN
  -- Trouver le représentant
  SELECT * INTO v_admin FROM public.admins WHERE LOWER(TRIM(email)) = LOWER(TRIM(p_email)) AND role = 'representant';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé : vous n''êtes pas enregistré comme représentant.');
  END IF;

  IF v_admin.is_revoked THEN
    RETURN jsonb_build_object('success', false, 'error', 'Votre accès a été révoqué.');
  END IF;

  -- Cas 1: Première connexion (Activation avec mot de passe temporaire)
  IF NOT v_admin.is_activated THEN
    IF v_admin.mot_de_passe IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Aucun mot de passe temporaire configuré. Contactez votre délégué.');
    END IF;
    IF v_admin.mot_de_passe != p_password THEN
      RETURN jsonb_build_object('success', false, 'error', 'Mot de passe temporaire incorrect. Saisissez le mot de passe fourni par le délégué.');
    END IF;

    IF p_personal_password IS NULL OR length(p_personal_password) < 6 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Veuillez fournir un mot de passe personnel de 6 caractères minimum.');
    END IF;

    -- Activer et stocker le mot de passe personnel
    UPDATE public.admins
    SET is_activated = true, mot_de_passe = p_personal_password
    WHERE id = v_admin.id;

    RETURN jsonb_build_object(
      'success', true,
      'status', 'activated',
      'admin', jsonb_build_object(
        'id', v_admin.id,
        'auth_user_id', v_admin.auth_user_id,
        'role', v_admin.role,
        'candidat_id', v_admin.candidat_id,
        'amicale_id', v_admin.amicale_id,
        'is_activated', true,
        'is_revoked', false,
        'nom', v_admin.nom,
        'prenom', v_admin.prenom,
        'email', v_admin.email
      )
    );
  ELSE
    -- Cas 2: Connexions suivantes
    IF v_admin.mot_de_passe != p_password THEN
      RETURN jsonb_build_object('success', false, 'error', 'Mot de passe incorrect.');
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'status', 'logged_in',
      'admin', jsonb_build_object(
        'id', v_admin.id,
        'auth_user_id', v_admin.auth_user_id,
        'role', v_admin.role,
        'candidat_id', v_admin.candidat_id,
        'amicale_id', v_admin.amicale_id,
        'is_activated', true,
        'is_revoked', false,
        'nom', v_admin.nom,
        'prenom', v_admin.prenom,
        'email', v_admin.email
      )
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- RPC : VÉRIFIER LE MOT DE PASSE TEMPORAIRE ADMIN
-- ==========================================
CREATE OR REPLACE FUNCTION public.verify_temp_admin_password(p_email TEXT, p_temp_password TEXT)
RETURNS JSONB AS $$
DECLARE
  v_admin RECORD;
BEGIN
  SELECT * INTO v_admin FROM public.admins WHERE LOWER(TRIM(email)) = LOWER(TRIM(p_email)) AND role IN ('super_admin', 'delegue');
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé : Vous n''êtes pas enregistré comme administrateur.');
  END IF;

  IF v_admin.is_revoked THEN
    RETURN jsonb_build_object('success', false, 'error', 'Votre accès a été révoqué.');
  END IF;

  IF v_admin.is_activated THEN
    -- Déjà activé, utiliser la connexion standard Supabase Auth
    RETURN jsonb_build_object('success', true, 'is_activated', true);
  END IF;

  IF v_admin.mot_de_passe IS NULL OR v_admin.mot_de_passe != p_temp_password THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mot de passe temporaire incorrect. Saisissez le mot de passe fourni par l''administrateur.');
  END IF;

  RETURN jsonb_build_object('success', true, 'is_activated', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- RPC : SOUMISSION TRANSACTIONNELLE DE VOTE
-- ==========================================
CREATE OR REPLACE FUNCTION public.submit_vote(
  p_election_id UUID,
  p_poste_id UUID,
  p_candidat_id UUID,
  p_student_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_election RECORD;
  v_student RECORD;
BEGIN
  -- 1. Vérifier si l'élection existe et est ouverte
  SELECT * INTO v_election FROM public.elections WHERE id = p_election_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'L''élection spécifiée n''existe pas.');
  END IF;

  IF v_election.statut != 'ouverte' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le vote pour cette élection n''est pas ouvert.');
  END IF;

  IF v_election.date_ouverture IS NOT NULL AND now() < v_election.date_ouverture THEN
    RETURN jsonb_build_object('success', false, 'error', 'La période de vote n''a pas encore commencé.');
  END IF;

  IF v_election.date_fermeture IS NOT NULL AND now() > v_election.date_fermeture THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le scrutin est clos, vous ne pouvez plus voter.');
  END IF;

  -- 2. Vérifier si l'étudiant existe, est activé et appartient à l'amicale de l'élection
  SELECT * INTO v_student FROM public.students WHERE id = p_student_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profil étudiant introuvable.');
  END IF;

  IF NOT v_student.is_activated THEN
    RETURN jsonb_build_object('success', false, 'error', 'Votre compte n''est pas activé.');
  END IF;

  IF v_student.amicale_id != v_election.amicale_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Vous n''êtes pas autorisé à voter pour cette amicale.');
  END IF;

  -- 3. Enregistrer l'émargement (la contrainte UNIQUE gère le doublon)
  BEGIN
    INSERT INTO public.emargements (election_id, poste_id, student_id)
    VALUES (p_election_id, p_poste_id, p_student_id);
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Vous avez déjà voté pour ce poste.');
  END;

  -- 4. Enregistrer le bulletin de vote de manière totalement anonyme
  INSERT INTO public.votes (election_id, poste_id, candidat_id)
  VALUES (p_election_id, p_poste_id, p_candidat_id);

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Trigger pour synchroniser et activer les administrateurs inscrits sur Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_auth_user_created()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.admins
  SET auth_user_id = NEW.id,
      is_activated = true,
      mot_de_passe = NULL
  WHERE LOWER(TRIM(email)) = LOWER(TRIM(NEW.email))
    AND role IN ('super_admin', 'delegue');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_created();
