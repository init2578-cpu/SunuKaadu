-- Active l'extension pour les UUID si non présente
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================================================
-- 1. TABLES
-- =========================================================================

-- Table amicales (Groupes d'étudiants régionaux / thématiques)
CREATE TABLE public.amicales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Table admins
CREATE TABLE public.admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    role TEXT NOT NULL DEFAULT 'delegue' CHECK (role IN ('super_admin', 'delegue', 'representant')),
    candidat_id UUID, -- clé étrangère de référence vers candidats(id), ajoutée en fin de création des tables
    amicale_id UUID REFERENCES public.amicales(id) ON DELETE SET NULL,
    is_activated BOOLEAN NOT NULL DEFAULT false,
    is_revoked BOOLEAN NOT NULL DEFAULT false,
    nom TEXT,
    prenom TEXT,
    email TEXT NOT NULL UNIQUE,
    created_by UUID REFERENCES public.admins(id) ON DELETE SET NULL,
    mot_de_passe TEXT, -- mot de passe temporaire pour activation
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Table students (liste blanche des étudiants)
CREATE TABLE public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom TEXT NOT NULL,
    prenom TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    numero_carte TEXT UNIQUE,
    filiere TEXT,
    promotion TEXT,
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    amicale_id UUID REFERENCES public.amicales(id) ON DELETE SET NULL,
    is_activated BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Table elections
CREATE TABLE public.elections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titre TEXT NOT NULL,
    description TEXT,
    date_ouverture TIMESTAMPTZ,
    date_fermeture TIMESTAMPTZ,
    statut TEXT NOT NULL CHECK (statut IN ('brouillon', 'ouverte', 'fermee', 'publiee')) DEFAULT 'brouillon',
    emails_envoyes BOOLEAN DEFAULT false NOT NULL,
    amicale_id UUID REFERENCES public.amicales(id) ON DELETE SET NULL,
    created_by UUID REFERENCES public.admins(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Table postes
CREATE TABLE public.postes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    election_id UUID NOT NULL REFERENCES public.elections(id) ON DELETE CASCADE,
    nom TEXT NOT NULL, -- ex: Président, Secrétaire Général, Trésorier
    description TEXT,
    ordre INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Table candidats
CREATE TABLE public.candidats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poste_id UUID NOT NULL REFERENCES public.postes(id) ON DELETE CASCADE,
    nom TEXT NOT NULL,
    prenom TEXT NOT NULL,
    photo_url TEXT,
    slogan TEXT,
    programme TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Contrainte de clé étrangère vers candidats pour admins (définie après candidats)
ALTER TABLE public.admins ADD CONSTRAINT fk_admins_candidat FOREIGN KEY (candidat_id) REFERENCES public.candidats(id) ON DELETE SET NULL;


-- Table votes (Urne électronique)
CREATE TABLE public.votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    election_id UUID NOT NULL REFERENCES public.elections(id) ON DELETE CASCADE,
    poste_id UUID NOT NULL REFERENCES public.postes(id) ON DELETE CASCADE,
    candidat_id UUID NOT NULL REFERENCES public.candidats(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    -- Contrainte d'unicité : un étudiant ne peut voter qu'une fois pour un poste donné
    CONSTRAINT unique_student_vote_per_poste UNIQUE (student_id, poste_id)
);

-- =========================================================================
-- 2. FONCTIONS D'HELPER SÉCURISÉES
-- =========================================================================

-- -- Fonctions helper de rôles (définies avec SECURITY DEFINER pour contourner le RLS)
CREATE OR REPLACE FUNCTION public.get_admin_role(p_auth_uid UUID)
RETURNS TEXT AS $$
DECLARE
    v_role TEXT;
BEGIN
    SELECT role INTO v_role 
    FROM public.admins 
    WHERE auth_user_id = p_auth_uid AND is_revoked = false;
    
    RETURN v_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_admin_amicale(p_auth_uid UUID)
RETURNS UUID AS $$
DECLARE
    v_amicale_id UUID;
BEGIN
    SELECT amicale_id INTO v_amicale_id 
    FROM public.admins 
    WHERE auth_user_id = p_auth_uid AND is_revoked = false;
    
    RETURN v_amicale_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_super_admin(p_auth_uid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN public.get_admin_role(p_auth_uid) = 'super_admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_admin_staff(p_auth_uid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_role TEXT;
BEGIN
    v_role := public.get_admin_role(p_auth_uid);
    RETURN v_role = 'super_admin' OR v_role = 'delegue';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_representant_of(p_auth_uid UUID, p_candidat_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.admins 
        WHERE auth_user_id = p_auth_uid 
          AND role = 'representant' 
          AND candidat_id = p_candidat_id
          AND is_revoked = false
      );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Redéfinition de is_admin pour compatibilité avec l'existant
CREATE OR REPLACE FUNCTION public.is_admin(p_uid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN public.is_admin_staff(p_uid);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================================
-- 3. POLITIQUES DE SÉCURITÉ RLS (ROW LEVEL SECURITY)
-- =========================================================================

-- Activation du RLS sur toutes les tables
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.elections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.postes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------------------------
-- A. Table amicales
-- -------------------------------------------------------------------------
ALTER TABLE public.amicales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view amicales"
    ON public.amicales FOR SELECT USING (true);

CREATE POLICY "Super admins can manage amicales"
    ON public.amicales TO authenticated
    USING (public.is_super_admin(auth.uid()))
    WITH CHECK (public.is_super_admin(auth.uid()));

-- -------------------------------------------------------------------------
-- B. Table admins
-- -------------------------------------------------------------------------
CREATE POLICY "Admins view policy"
    ON public.admins FOR SELECT TO authenticated
    USING (public.is_admin_staff(auth.uid()) OR auth_user_id = auth.uid());
    
CREATE POLICY "Admins can insert delegate or representant"
    ON public.admins FOR INSERT TO authenticated
    WITH CHECK (
        public.is_super_admin(auth.uid())
        OR
        (
            public.is_admin_staff(auth.uid())
            AND role = 'representant'
            AND EXISTS (
                SELECT 1 FROM public.candidats c
                JOIN public.postes p ON c.poste_id = p.id
                JOIN public.elections e ON p.election_id = e.id
                WHERE c.id = candidat_id AND e.amicale_id = public.get_admin_amicale(auth.uid())
            )
        )
    );
    
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
                -- Allow if linked to candidate in our amicale
                EXISTS (
                    SELECT 1 FROM public.candidats c
                    JOIN public.postes p ON c.poste_id = p.id
                    JOIN public.elections e ON p.election_id = e.id
                    WHERE c.id = candidat_id AND e.amicale_id = public.get_admin_amicale(auth.uid())
                )
                OR
                -- Allow if created by someone in our amicale
                (SELECT amicale_id FROM public.admins WHERE id = created_by) = public.get_admin_amicale(auth.uid())
                OR
                -- Allow if not linked to any candidate (detached)
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
                -- New row must be linked to candidate in our amicale or NULL
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

-- -------------------------------------------------------------------------
-- C. Table students (Aucun accès direct client)
-- -------------------------------------------------------------------------
CREATE POLICY "Admins can manage students"
    ON public.students TO authenticated
    USING (
        public.is_super_admin(auth.uid()) 
        OR 
        (public.is_admin_staff(auth.uid()) AND amicale_id = public.get_admin_amicale(auth.uid()))
    )
    WITH CHECK (
        public.is_super_admin(auth.uid()) 
        OR 
        (public.is_admin_staff(auth.uid()) AND amicale_id = public.get_admin_amicale(auth.uid()))
    );

-- -------------------------------------------------------------------------
-- D. Tables elections, postes, candidats (Lecture publique)
-- -------------------------------------------------------------------------
-- Lecture autorisée à tous (utilisateurs anonymes et connectés)
CREATE POLICY "Anyone can view elections"
    ON public.elections FOR SELECT USING (true);
CREATE POLICY "Anyone can view postes"
    ON public.postes FOR SELECT USING (true);
CREATE POLICY "Anyone can view candidats"
    ON public.candidats FOR SELECT USING (true);

-- Modification réservée aux administrateurs adéquats
CREATE POLICY "Admins can manage elections"
    ON public.elections TO authenticated
    USING (
        public.is_super_admin(auth.uid()) 
        OR 
        (public.is_admin_staff(auth.uid()) AND amicale_id = public.get_admin_amicale(auth.uid()))
    )
    WITH CHECK (
        public.is_super_admin(auth.uid()) 
        OR 
        (public.is_admin_staff(auth.uid()) AND amicale_id = public.get_admin_amicale(auth.uid()))
    );

CREATE POLICY "Admins can manage postes"
    ON public.postes TO authenticated
    USING (
        public.is_super_admin(auth.uid()) 
        OR 
        (public.is_admin_staff(auth.uid()) AND EXISTS (
            SELECT 1 FROM public.elections e 
            WHERE e.id = election_id AND e.amicale_id = public.get_admin_amicale(auth.uid())
        ))
    )
    WITH CHECK (
        public.is_super_admin(auth.uid()) 
        OR 
        (public.is_admin_staff(auth.uid()) AND EXISTS (
            SELECT 1 FROM public.elections e 
            WHERE e.id = election_id AND e.amicale_id = public.get_admin_amicale(auth.uid())
        ))
    );

CREATE POLICY "Admins can manage candidats"
    ON public.candidats TO authenticated
    USING (
        public.is_super_admin(auth.uid()) 
        OR 
        (public.is_admin_staff(auth.uid()) AND EXISTS (
            SELECT 1 FROM public.postes p
            JOIN public.elections e ON p.election_id = e.id
            WHERE p.id = poste_id AND e.amicale_id = public.get_admin_amicale(auth.uid())
        ))
    )
    WITH CHECK (
        public.is_super_admin(auth.uid()) 
        OR 
        (public.is_admin_staff(auth.uid()) AND EXISTS (
            SELECT 1 FROM public.postes p
            JOIN public.elections e ON p.election_id = e.id
            WHERE p.id = poste_id AND e.amicale_id = public.get_admin_amicale(auth.uid())
        ))
    );

-- -------------------------------------------------------------------------
-- D. Table votes
-- -------------------------------------------------------------------------
-- Pas de politique de SELECT direct (Lecture interdite côté client pour préserver l'anonymat)

-- Politique d'insertion contrôlée
CREATE POLICY "Students can insert their own votes if election is open"
    ON public.votes FOR INSERT TO authenticated
    WITH CHECK (
        -- 1. L'utilisateur qui insère le vote doit correspondre au student_id passé
        auth.uid() = (
            SELECT auth_user_id FROM public.students WHERE id = student_id
        )
        AND
        -- 2. Le poste concerné doit appartenir à une élection dont le statut est 'ouverte'
        EXISTS (
            SELECT 1 FROM public.elections e
            JOIN public.postes p ON p.election_id = e.id
            WHERE p.id = poste_id AND e.statut = 'ouverte'
        )
    );

-- Admins peuvent supprimer/réinitialiser les votes s'ils font partie du staff admin
CREATE POLICY "Admins can delete votes if needed for reset"
    ON public.votes FOR DELETE TO authenticated
    USING (public.is_admin_staff(auth.uid()));

-- =========================================================================
-- 5. STATISTIQUES SÉCURISÉES DE PARTICIPATION & CONTRÔLE VOTE (RPC)
-- =========================================================================

-- Fonction pour obtenir les statistiques de participation de manière anonyme
CREATE OR REPLACE FUNCTION public.get_election_stats(p_election_id UUID)
RETURNS TABLE(
    postes_count INT,
    candidats_count INT,
    voters_count INT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        (SELECT COUNT(*)::INT FROM public.postes WHERE election_id = p_election_id) as postes_count,
        (SELECT COUNT(*)::INT FROM public.candidats c JOIN public.postes p ON c.poste_id = p.id WHERE p.election_id = p_election_id) as candidats_count,
        (SELECT COUNT(DISTINCT student_id)::INT FROM public.votes WHERE election_id = p_election_id) as voters_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour vérifier si des votes existent déjà pour une élection (bloque la suppression)
CREATE OR REPLACE FUNCTION public.has_votes_recorded(p_election_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.votes WHERE election_id = p_election_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour vérifier si un email étudiant est dans la liste blanche et s'il est activé
CREATE OR REPLACE FUNCTION public.check_student_email(p_email TEXT)
RETURNS TABLE(email_exists BOOLEAN, is_activated BOOLEAN, amicale_id UUID) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        EXISTS(SELECT 1 FROM public.students WHERE email = LOWER(p_email)) as email_exists,
        COALESCE((SELECT s.is_activated FROM public.students s WHERE s.email = LOWER(p_email)), false) as is_activated,
        (SELECT s.amicale_id FROM public.students s WHERE s.email = LOWER(p_email)) as amicale_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour activer le compte étudiant après la création de l'Auth User
CREATE OR REPLACE FUNCTION public.activate_student(p_email TEXT, p_auth_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_user_email TEXT;
BEGIN
    -- 1. Récupérer l'email de l'utilisateur authentifié depuis auth.users
    SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();
    
    -- 2. Sécurité : Vérifier que l'utilisateur qui appelle la fonction correspond à p_auth_user_id
    -- et que son email correspond exactement à p_email (sensible à la casse)
    IF auth.uid() <> p_auth_user_id OR LOWER(v_user_email) <> LOWER(p_email) THEN
        RAISE EXCEPTION 'Accès non autorisé : usurpation d''identité ou email incorrect.';
    END IF;

    -- 3. Vérifier que l'étudiant existe et n'est pas encore activé
    IF EXISTS (
        SELECT 1 FROM public.students 
        WHERE email = LOWER(p_email) AND is_activated = false
    ) THEN
        -- 4. Activer le compte de l'étudiant
        UPDATE public.students
        SET auth_user_id = p_auth_user_id,
            is_activated = true
        WHERE email = LOWER(p_email);
        
        RETURN TRUE;
    ELSE
        RETURN FALSE;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -------------------------------------------------------------------------
-- 6. DYNAMIC VOTING & RESULTS CONTROL (RPC)
-- -------------------------------------------------------------------------

-- Fonction pour vérifier si un étudiant a déjà voté pour une élection donnée
CREATE OR REPLACE FUNCTION public.has_student_voted(p_student_id UUID, p_election_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.votes 
        WHERE student_id = p_student_id AND election_id = p_election_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour obtenir le décompte anonymisé des voix par candidat pour une élection
CREATE OR REPLACE FUNCTION public.get_election_results(p_election_id UUID)
RETURNS TABLE(
    candidat_id UUID,
    poste_id UUID,
    votes_count INT
) AS $$
BEGIN
    -- Sécurité : Seules les élections 'publiee' (ou pour les admins) ont leurs résultats publics
    IF NOT EXISTS (
        SELECT 1 FROM public.elections 
        WHERE id = p_election_id AND statut = 'publiee'
    ) AND NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Les résultats de cette élection ne sont pas publics.';
    END IF;

    RETURN QUERY
    SELECT 
        v.candidat_id,
        v.poste_id,
        COUNT(*)::INT as votes_count
    FROM public.votes v
    WHERE v.election_id = p_election_id
    GROUP BY v.candidat_id, v.poste_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour obtenir le registre d'émargement nominatif (pour les admins uniquement)
CREATE OR REPLACE FUNCTION public.get_voters_registry(p_election_id UUID)
RETURNS TABLE(
    student_nom TEXT,
    student_prenom TEXT,
    student_email TEXT,
    poste_nom TEXT,
    voted_at TIMESTAMPTZ
) AS $$
BEGIN
    IF NOT public.is_super_admin(auth.uid()) AND NOT (
        public.is_admin_staff(auth.uid()) AND EXISTS (
            SELECT 1 FROM public.elections e
            WHERE e.id = p_election_id AND e.amicale_id = public.get_admin_amicale(auth.uid())
        )
    ) THEN
        RAISE EXCEPTION 'Accès non autorisé : réservé aux administrateurs de cette amicale.';
    END IF;

    RETURN QUERY
    SELECT 
        s.nom as student_nom,
        s.prenom as student_prenom,
        s.email as student_email,
        p.nom as poste_nom,
        v.created_at as voted_at
    FROM public.votes v
    JOIN public.students s ON v.student_id = s.id
    JOIN public.postes p ON v.poste_id = p.id
    WHERE v.election_id = p_election_id
    ORDER BY v.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour soumettre un vote de manière sécurisée après validation des contraintes côté serveur
CREATE OR REPLACE FUNCTION public.submit_vote(
    p_election_id UUID,
    p_poste_id UUID,
    p_candidat_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_student_id UUID;
BEGIN
    -- 1. Récupérer l'ID de l'étudiant correspondant à l'utilisateur authentifié
    SELECT id INTO v_student_id FROM public.students WHERE auth_user_id = auth.uid();
    
    -- Si l'étudiant n'est pas identifié ou n'est pas activé, bloquer
    IF v_student_id IS NULL THEN
        RAISE EXCEPTION 'Accès non autorisé : étudiant non identifié ou non activé.';
    END IF;

    -- 2. Vérifier que l'élection est bien 'ouverte'
    IF NOT EXISTS (
        SELECT 1 FROM public.elections 
        WHERE id = p_election_id AND statut = 'ouverte'
    ) THEN
        RAISE EXCEPTION 'Le vote pour cette élection n''est pas ouvert.';
    END IF;

    -- 3. Vérifier que le poste appartient bien à cette élection
    IF NOT EXISTS (
        SELECT 1 FROM public.postes 
        WHERE id = p_poste_id AND election_id = p_election_id
    ) THEN
        RAISE EXCEPTION 'Le poste n''appartient pas à cette élection.';
    END IF;

    -- 4. Vérifier que le candidat appartient bien à ce poste
    IF NOT EXISTS (
        SELECT 1 FROM public.candidats 
        WHERE id = p_candidat_id AND poste_id = p_poste_id
    ) THEN
        RAISE EXCEPTION 'Le candidat n''est pas inscrit pour ce poste.';
    END IF;

    -- 5. Vérifier que l'étudiant n'a pas déjà voté pour ce poste
    IF EXISTS (
        SELECT 1 FROM public.votes 
        WHERE student_id = v_student_id AND poste_id = p_poste_id
    ) THEN
        RAISE EXCEPTION 'Vous avez déjà voté pour ce poste.';
    END IF;

    -- 6. Insérer le vote
    INSERT INTO public.votes (election_id, poste_id, candidat_id, student_id)
    VALUES (p_election_id, p_poste_id, p_candidat_id, v_student_id);

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour obtenir la liste des poste_id pour lesquels l'étudiant a déjà émis un vote
CREATE OR REPLACE FUNCTION public.get_voted_postes(p_election_id UUID)
RETURNS TABLE(poste_id UUID) AS $$
DECLARE
    v_student_id UUID;
BEGIN
    SELECT id INTO v_student_id FROM public.students WHERE auth_user_id = auth.uid();
    
    RETURN QUERY
    SELECT v.poste_id FROM public.votes v
    WHERE v.student_id = v_student_id AND v.election_id = p_election_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour obtenir le décompte de voix par candidat (accessible uniquement pour les scrutins fermés ou publiés)
CREATE OR REPLACE FUNCTION public.get_resultats(p_election_id UUID)
RETURNS TABLE(
    candidat_id UUID,
    poste_id UUID,
    votes_count INT
) AS $$
BEGIN
    -- Sécurité : Seules les élections 'fermee' ou 'publiee' peuvent avoir leurs résultats consultés par le public
    -- Les administrateurs de l'amicale concernée ou les super admins peuvent toujours voir les résultats pour contrôle
    IF NOT EXISTS (
        SELECT 1 FROM public.elections 
        WHERE id = p_election_id AND statut IN ('fermee', 'publiee')
    ) AND NOT (
        public.is_super_admin(auth.uid()) OR (
            public.is_admin_staff(auth.uid()) AND EXISTS (
                SELECT 1 FROM public.elections e
                WHERE e.id = p_election_id AND e.amicale_id = public.get_admin_amicale(auth.uid())
            )
        )
    ) THEN
        RAISE EXCEPTION 'Les résultats de cette élection ne sont pas encore disponibles.';
    END IF;

    RETURN QUERY
    SELECT 
        v.candidat_id,
        v.poste_id,
        COUNT(*)::INT as votes_count
    FROM public.votes v
    WHERE v.election_id = p_election_id
    GROUP BY v.candidat_id, v.poste_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour obtenir les agrégats de participation d'une élection
CREATE OR REPLACE FUNCTION public.get_participation_globale(p_election_id UUID)
RETURNS TABLE(
    voters_count INT,
    total_eligible INT,
    participation_rate NUMERIC
) AS $$
DECLARE
    v_voters_count INT;
    v_total_eligible INT;
    v_rate NUMERIC;
BEGIN
    -- Compter les votants uniques pour cette élection
    SELECT COUNT(DISTINCT student_id)::INT INTO v_voters_count
    FROM public.votes
    WHERE election_id = p_election_id;

    -- Compter le nombre total d'étudiants éligibles dans la table students
    SELECT COUNT(*)::INT INTO v_total_eligible
    FROM public.students;

    -- Calculer le taux en %
    IF v_total_eligible > 0 THEN
        v_rate := ROUND((v_voters_count::NUMERIC / v_total_eligible::NUMERIC) * 100, 2);
    ELSE
        v_rate := 0;
    END IF;

    RETURN QUERY SELECT v_voters_count, v_total_eligible, v_rate;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Fonction pour vérifier si un email admin est dans la liste et s'il est activé
CREATE OR REPLACE FUNCTION public.check_admin_email(p_email TEXT)
RETURNS TABLE(email_exists BOOLEAN, role TEXT, is_activated BOOLEAN, amicale_id UUID) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        EXISTS(SELECT 1 FROM public.admins WHERE email = LOWER(p_email) AND is_revoked = false) as email_exists,
        COALESCE((SELECT a.role FROM public.admins a WHERE a.email = LOWER(p_email) AND a.is_revoked = false), NULL) as role,
        COALESCE((SELECT a.is_activated FROM public.admins a WHERE a.email = LOWER(p_email) AND a.is_revoked = false), false) as is_activated,
        (SELECT a.amicale_id FROM public.admins a WHERE a.email = LOWER(p_email) AND a.is_revoked = false) as amicale_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour activer le compte admin après la création de l'Auth User
CREATE OR REPLACE FUNCTION public.activate_admin(p_email TEXT, p_auth_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_user_email TEXT;
BEGIN
    -- 1. Récupérer l'email de l'utilisateur authentifié depuis auth.users
    SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();
    
    -- 2. Sécurité : Vérifier que l'utilisateur qui appelle la fonction correspond à p_auth_user_id
    -- et que son email correspond exactement à p_email (sensible à la casse)
    IF auth.uid() <> p_auth_user_id OR LOWER(v_user_email) <> LOWER(p_email) THEN
        RAISE EXCEPTION 'Accès non autorisé : usurpation d''identité ou email incorrect.';
    END IF;

    -- 3. Vérifier que l'admin existe et n'est pas encore activé
    IF EXISTS (
        SELECT 1 FROM public.admins 
        WHERE email = LOWER(p_email) AND is_activated = false AND is_revoked = false
    ) THEN
        -- 4. Activer le compte de l'admin
        UPDATE public.admins 
        SET 
            is_activated = true,
            auth_user_id = p_auth_user_id
        WHERE email = LOWER(p_email);
        
        RETURN true;
    END IF;
    
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Fonction pour obtenir les résultats d'un candidat spécifique par son représentant
CREATE OR REPLACE FUNCTION public.get_resultats_candidat(p_candidat_id UUID)
RETURNS TABLE (
    candidat_id UUID,
    nom TEXT,
    prenom TEXT,
    poste_nom TEXT,
    statut_election TEXT,
    nb_voix BIGINT,
    gagnant BOOLEAN
) AS $$
DECLARE
    v_election_id UUID;
    v_poste_id UUID;
    v_statut TEXT;
    v_is_rep BOOLEAN;
    v_candidat_nom TEXT;
    v_candidat_prenom TEXT;
    v_poste_nom TEXT;
    v_votes_count BIGINT := 0;
    v_gagnant BOOLEAN := false;
    v_max_votes BIGINT := 0;
BEGIN
    -- 1. Sécurité : Vérifier que l'utilisateur est le représentant de ce candidat
    v_is_rep := public.is_representant_of(auth.uid(), p_candidat_id);
    IF NOT v_is_rep THEN
        RAISE EXCEPTION 'Non autorisé. Cet espace est réservé au représentant de ce candidat.';
    END IF;

    -- 2. Récupérer le candidat et les infos associées
    SELECT c.nom, c.prenom, p.nom, p.id, p.election_id 
    INTO v_candidat_nom, v_candidat_prenom, v_poste_nom, v_poste_id, v_election_id
    FROM public.candidats c
    JOIN public.postes p ON c.poste_id = p.id
    WHERE c.id = p_candidat_id;

    IF v_poste_id IS NULL THEN
        RAISE EXCEPTION 'Candidat ou poste inexistant.';
    END IF;

    -- 3. Récupérer le statut de l'élection
    SELECT statut INTO v_statut
    FROM public.elections
    WHERE id = v_election_id;

    IF v_statut IS NULL THEN
        RAISE EXCEPTION 'Élection inexistante.';
    END IF;

    -- 4. Compter les voix si l'élection n'est PAS ouverte ou brouillon
    IF v_statut IN ('fermee', 'publiee') THEN
        -- Voix pour ce candidat
        SELECT COUNT(*) INTO v_votes_count
        FROM public.votes
        WHERE candidat_id = p_candidat_id;

        -- Déterminer si gagnant (score le plus élevé pour ce poste)
        -- Cherchons le maximum de voix obtenu par un candidat sur ce poste
        SELECT COALESCE(MAX(votes_par_cand), 0) INTO v_max_votes
        FROM (
            SELECT cand.id as c_id, COUNT(v.id) as votes_par_cand
            FROM public.candidats cand
            LEFT JOIN public.votes v ON v.candidat_id = cand.id
            WHERE cand.poste_id = v_poste_id
            GROUP BY cand.id
        ) sub;

        IF v_votes_count = v_max_votes AND v_max_votes > 0 THEN
            v_gagnant := true;
        END IF;
    ELSE
        -- Si l'élection est ouverte ou brouillon, on ne renvoie ni voix ni vainqueur
        v_votes_count := 0;
        v_gagnant := false;
    END IF;

    RETURN QUERY SELECT 
        p_candidat_id, 
        v_candidat_nom, 
        v_candidat_prenom, 
        v_poste_nom, 
        v_statut, 
        v_votes_count, 
        v_gagnant;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Fonction pour vérifier l'unicité globale d'un e-mail et numéro de carte
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


-- Fonction pour importer des étudiants en lot (gère les ré-affiliations d'étudiants orphelins)
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
    -- Boucler sur chaque étudiant du tableau JSON
    FOR v_student IN SELECT * FROM jsonb_to_recordset(p_students) AS x(
        nom TEXT, 
        prenom TEXT, 
        email TEXT, 
        numero_carte TEXT, 
        filiere TEXT, 
        promotion TEXT
    ) LOOP
        -- Vérifier l'existence de l'email
        SELECT id, amicale_id INTO v_existing_id, v_existing_amicale_id
        FROM public.students
        WHERE email = LOWER(v_student.email);

        IF v_existing_id IS NOT NULL THEN
            -- L'email existe déjà
            IF v_existing_amicale_id IS NULL THEN
                -- Étudiant orphelin, on le ré-affilie à cette amicale
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
                -- Déjà dans notre amicale, mise à jour simple
                UPDATE public.students
                SET nom = v_student.nom,
                    prenom = v_student.prenom,
                    numero_carte = v_student.numero_carte,
                    filiere = COALESCE(v_student.filiere, filiere),
                    promotion = COALESCE(v_student.promotion, promotion)
                WHERE id = v_existing_id;
                v_updated := v_updated + 1;
            ELSE
                -- Appartient à une autre amicale active
                v_ignored := v_ignored + 1;
                v_details := array_append(v_details, 'Ignoré (e-mail doublon autre amicale) : ' || v_student.email);
            END IF;
        ELSE
            -- Vérifier l'existence du numéro de carte
            SELECT email INTO v_existing_card_email
            FROM public.students
            WHERE LOWER(numero_carte) = LOWER(v_student.numero_carte);

            IF v_existing_card_email IS NOT NULL THEN
                v_ignored := v_ignored + 1;
                v_details := array_append(v_details, 'Ignoré (n° carte doublon base) : ' || v_student.numero_carte);
            ELSE
                -- Prêt pour une insertion classique
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


-- Helper functions for temporary password verification
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


