-- SQL Script to update database helper functions.
-- Run this script in the Supabase SQL Editor to enable global uniqueness checks and robust batch imports.

-- 1. Helper function to check global uniqueness
DROP FUNCTION IF EXISTS public.check_student_uniqueness(text, text);

CREATE OR REPLACE FUNCTION public.check_student_uniqueness(p_email TEXT, p_numero_carte TEXT)
RETURNS TABLE(
    email_exists BOOLEAN, 
    email_amicale_id UUID, 
    card_exists BOOLEAN, 
    card_amicale_id UUID
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        EXISTS(SELECT 1 FROM public.students WHERE email = LOWER(p_email)) as email_exists,
        (SELECT amicale_id FROM public.students WHERE email = LOWER(p_email) LIMIT 1) as email_amicale_id,
        EXISTS(SELECT 1 FROM public.students WHERE LOWER(numero_carte) = LOWER(p_numero_carte)) as card_exists,
        (SELECT amicale_id FROM public.students WHERE LOWER(numero_carte) = LOWER(p_numero_carte) LIMIT 1) as card_amicale_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Robust batch import function (handles updates for orphaned students)
CREATE OR REPLACE FUNCTION public.import_students_batch(p_students JSONB, p_amicale_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_student RECORD;
    v_added INT := 0;
    v_updated INT := 0;
    v_ignored INT := 0;
    v_details TEXT[] := ARRAY[]::TEXT[];
    v_existing_id UUID;
    v_existing_amicale_id UUID;
    v_existing_card_email TEXT;
BEGIN
    -- Loop through each student in the JSON array
    FOR v_student IN SELECT * FROM jsonb_to_recordset(p_students) AS x(
        nom TEXT, 
        prenom TEXT, 
        email TEXT, 
        numero_carte TEXT, 
        filiere TEXT, 
        promotion TEXT
    ) LOOP
        -- Check if email exists
        SELECT id, amicale_id INTO v_existing_id, v_existing_amicale_id
        FROM public.students
        WHERE email = LOWER(v_student.email);

        IF v_existing_id IS NOT NULL THEN
            -- Email exists
            IF v_existing_amicale_id IS NULL THEN
                -- Orphaned student, claim them
                UPDATE public.students
                SET amicale_id = p_amicale_id,
                    nom = v_student.nom,
                    prenom = v_student.prenom,
                    numero_carte = v_student.numero_carte,
                    filiere = COALESCE(v_student.filiere, filiere),
                    promotion = COALESCE(v_student.promotion, promotion)
                WHERE id = v_existing_id;
                v_updated := v_updated + 1;
            ELSIF v_existing_amicale_id = p_amicale_id THEN
                -- Already in our amicale, update info
                UPDATE public.students
                SET nom = v_student.nom,
                    prenom = v_student.prenom,
                    numero_carte = v_student.numero_carte,
                    filiere = COALESCE(v_student.filiere, filiere),
                    promotion = COALESCE(v_student.promotion, promotion)
                WHERE id = v_existing_id;
                v_updated := v_updated + 1;
            ELSE
                -- Belongs to another active amicale
                v_ignored := v_ignored + 1;
                v_details := array_append(v_details, 'Ignoré (e-mail doublon autre amicale) : ' || v_student.email);
            END IF;
        ELSE
            -- Check if card number exists
            SELECT email INTO v_existing_card_email
            FROM public.students
            WHERE LOWER(numero_carte) = LOWER(v_student.numero_carte);

            IF v_existing_card_email IS NOT NULL THEN
                v_ignored := v_ignored + 1;
                v_details := array_append(v_details, 'Ignoré (n° carte doublon base) : ' || v_student.numero_carte);
            ELSE
                -- Safe to insert new student
                INSERT INTO public.students (nom, prenom, email, numero_carte, filiere, promotion, is_activated, amicale_id)
                VALUES (v_student.nom, v_student.prenom, LOWER(v_student.email), v_student.numero_carte, v_student.filiere, v_student.promotion, false, p_amicale_id);
                v_added := v_added + 1;
            END IF;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'added', v_added,
        'updated', v_updated,
        'ignored', v_ignored,
        'details', to_jsonb(v_details)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Robust candidate representative policies update
DROP POLICY IF EXISTS "Admins update policy" ON public.admins;
CREATE POLICY "Admins update policy"
    ON public.admins FOR UPDATE TO authenticated
    USING (
        public.is_super_admin(auth.uid())
        OR
        auth_user_id = auth.uid()
        OR
        (
            public.is_admin_staff(auth.uid())
            AND role = 'representant'
            AND (
                EXISTS (
                    SELECT 1 FROM public.candidats c
                    JOIN public.postes p ON c.poste_id = p.id
                    JOIN public.elections e ON p.election_id = e.id
                    WHERE c.id = candidat_id AND e.amicale_id = public.get_admin_amicale(auth.uid())
                )
                OR
                (SELECT amicale_id FROM public.admins WHERE id = created_by) = public.get_admin_amicale(auth.uid())
                OR
                candidat_id IS NULL
            )
        )
    )
    WITH CHECK (
        public.is_super_admin(auth.uid())
        OR
        auth_user_id = auth.uid()
        OR
        (
            public.is_admin_staff(auth.uid())
            AND role = 'representant'
            AND (
                EXISTS (
                    SELECT 1 FROM public.candidats c
                    JOIN public.postes p ON c.poste_id = p.id
                    JOIN public.elections e ON p.election_id = e.id
                    WHERE c.id = candidat_id AND e.amicale_id = public.get_admin_amicale(auth.uid())
                )
                OR
                candidat_id IS NULL
            )
        )
    );

DROP POLICY IF EXISTS "Admins can delete representants" ON public.admins;
CREATE POLICY "Admins can delete representants"
    ON public.admins FOR DELETE TO authenticated
    USING (
        public.is_super_admin(auth.uid())
        OR
        (
            public.is_admin_staff(auth.uid())
            AND role = 'representant'
            AND (
                EXISTS (
                    SELECT 1 FROM public.candidats c
                    JOIN public.postes p ON c.poste_id = p.id
                    JOIN public.elections e ON p.election_id = e.id
                    WHERE c.id = candidat_id AND e.amicale_id = public.get_admin_amicale(auth.uid())
                )
                OR
                (SELECT amicale_id FROM public.admins WHERE id = created_by) = public.get_admin_amicale(auth.uid())
                OR
                candidat_id IS NULL
            )
        )
    );


-- 4. Temporary password verification function for candidate representatives
ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS mot_de_passe TEXT;

CREATE OR REPLACE FUNCTION public.verify_admin_temp_password(p_email TEXT, p_password TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.admins 
        WHERE email = LOWER(p_email) 
          AND mot_de_passe = p_password 
          AND is_activated = false 
          AND is_revoked = false
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.has_admin_temp_password(p_email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.admins 
        WHERE email = LOWER(p_email) 
          AND mot_de_passe IS NOT NULL 
          AND is_activated = false
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. Storage configuration & RLS policies for candidate photos
-- Create bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('candidats-photos', 'candidats-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Policy to allow authenticated admins to upload candidate photos
DROP POLICY IF EXISTS "Allow authenticated admins to upload candidate photos" ON storage.objects;
CREATE POLICY "Allow authenticated admins to upload candidate photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'candidats-photos'
    AND
    (
        public.is_super_admin(auth.uid())
        OR
        public.is_admin_staff(auth.uid())
    )
);

-- Policy to allow public read access to candidate photos
DROP POLICY IF EXISTS "Allow public read access to candidate photos" ON storage.objects;
CREATE POLICY "Allow public read access to candidate photos"
ON storage.objects
FOR SELECT
TO public
USING (
    bucket_id = 'candidats-photos'
);

-- Policy to allow authenticated admins to update/overwrite candidate photos
DROP POLICY IF EXISTS "Allow authenticated admins to update candidate photos" ON storage.objects;
CREATE POLICY "Allow authenticated admins to update candidate photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'candidats-photos'
    AND
    (
        public.is_super_admin(auth.uid())
        OR
        public.is_admin_staff(auth.uid())
    )
);

-- Policy to allow authenticated admins to delete candidate photos
DROP POLICY IF EXISTS "Allow authenticated admins to delete candidate photos" ON storage.objects;
CREATE POLICY "Allow authenticated admins to delete candidate photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'candidats-photos'
    AND
    (
        public.is_super_admin(auth.uid())
        OR
        public.is_admin_staff(auth.uid())
    )
);


-- =========================================================================
-- Migration: Ajouter la colonne mot_de_passe dans admins si elle n'existe pas
-- =========================================================================
ALTER TABLE public.admins
    ADD COLUMN IF NOT EXISTS mot_de_passe TEXT;

COMMENT ON COLUMN public.admins.mot_de_passe IS 'Mot de passe temporaire en clair pour activation du compte représentant';


-- =========================================================================
-- 6. RPC Function to check and save representative bypassing RLS (using JSONB)
-- =========================================================================
DROP FUNCTION IF EXISTS public.check_and_save_representative(uuid, text, text, text, uuid, text, uuid);
DROP FUNCTION IF EXISTS public.check_and_save_representative(text, text, text, text, text, text, text);
DROP FUNCTION IF EXISTS public.check_and_save_representative(jsonb);

CREATE OR REPLACE FUNCTION public.check_and_save_representative(JSONB)
RETURNS JSONB AS $$
DECLARE
    v_payload JSONB := $1;
    v_candidate_id TEXT;
    v_nom TEXT;
    v_prenom TEXT;
    v_email TEXT;
    v_auth_user_id TEXT;
    v_password TEXT;
    v_created_by TEXT;

    v_existing_admin RECORD;
    v_email_lower TEXT;
    v_rep_id UUID;
    v_msg TEXT := '';
    v_cand_uuid UUID;
    v_auth_uuid UUID;
    v_creator_uuid UUID;
BEGIN
    -- Extract values from JSONB payload
    v_candidate_id := v_payload->>'p_candidate_id';
    v_nom := v_payload->>'p_nom';
    v_prenom := v_payload->>'p_prenom';
    v_email := v_payload->>'p_email';
    v_auth_user_id := v_payload->>'p_auth_user_id';
    v_password := v_payload->>'p_password';
    v_created_by := v_payload->>'p_created_by';

    v_email_lower := LOWER(TRIM(v_email));
    v_cand_uuid := v_candidate_id::UUID;
    v_auth_uuid := NULLIF(v_auth_user_id, '')::UUID;
    v_creator_uuid := NULLIF(v_created_by, '')::UUID;

    -- Vérifier si l'email existe déjà dans les admins
    SELECT id, role, candidat_id, is_revoked, is_activated INTO v_existing_admin
    FROM public.admins
    WHERE email = v_email_lower;

    IF FOUND THEN
        -- Si administrateur ou délégué existant
        IF v_existing_admin.role IN ('super_admin', 'delegue') THEN
            RETURN jsonb_build_object('success', false, 'message', 'Cet e-mail est déjà associé à un compte administrateur ou délégué.');
        END IF;

        -- Si représentant existant
        IF v_existing_admin.role = 'representant' THEN
            -- Si déjà affecté à un autre candidat (et non révoqué)
            IF v_existing_admin.candidat_id IS NOT NULL AND v_existing_admin.candidat_id != v_cand_uuid AND NOT v_existing_admin.is_revoked THEN
                RETURN jsonb_build_object('success', false, 'message', 'Cet étudiant est déjà assigné comme représentant pour un autre candidat.');
            END IF;

            -- Mettre à jour le représentant existant
            UPDATE public.admins
            SET nom = v_nom,
                prenom = v_prenom,
                candidat_id = v_cand_uuid,
                is_revoked = false,
                created_by = v_creator_uuid,
                auth_user_id = COALESCE(v_auth_uuid, auth_user_id),
                is_activated = CASE WHEN v_auth_uuid IS NOT NULL THEN true ELSE is_activated END,
                mot_de_passe = CASE WHEN v_auth_uuid IS NULL THEN v_password ELSE mot_de_passe END
            WHERE id = v_existing_admin.id;

            IF v_auth_uuid IS NOT NULL THEN
                v_msg := 'Cet étudiant possède déjà un compte actif. Il peut se connecter avec ses identifiants étudiants habituels.';
            ELSIF NOT v_existing_admin.is_activated THEN
                v_msg := E'Identifiant : ' || v_email_lower || E'\nMot de passe : ' || v_password;
            END IF;

            RETURN jsonb_build_object('success', true, 'message', 'Représentant mis à jour.', 'rep_msg', v_msg);
        END IF;
    ELSE
        -- Insérer le nouveau représentant
        INSERT INTO public.admins (
            nom, prenom, email, role, candidat_id, is_revoked, created_by, auth_user_id, is_activated, mot_de_passe
        ) VALUES (
            v_nom, v_prenom, v_email_lower, 'representant', v_cand_uuid, false, v_creator_uuid, v_auth_uuid,
            (v_auth_uuid IS NOT NULL),
            CASE WHEN v_auth_uuid IS NULL THEN v_password ELSE NULL END
        ) RETURNING id INTO v_rep_id;

        IF v_auth_uuid IS NOT NULL THEN
            v_msg := 'Cet étudiant possède déjà un compte actif. Il peut se connecter avec ses identifiants étudiants habituels.';
        ELSE
            v_msg := E'Identifiant : ' || v_email_lower || E'\nMot de passe : ' || v_password;
        END IF;

        RETURN jsonb_build_object('success', true, 'message', 'Représentant enregistré.', 'rep_msg', v_msg);
    END IF;

    RETURN jsonb_build_object('success', false, 'message', 'Erreur inconnue.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.check_and_save_representative(jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.check_and_save_representative(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_and_save_representative(jsonb) TO service_role;

