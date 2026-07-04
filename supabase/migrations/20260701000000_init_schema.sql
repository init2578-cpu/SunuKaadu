-- 1. Table Amicales
CREATE TABLE IF NOT EXISTS public.amicales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Table Admins
CREATE TABLE IF NOT EXISTS public.admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom TEXT NOT NULL,
    prenom TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL CHECK (role IN ('super_admin', 'delegue', 'representant')),
    amicale_id UUID REFERENCES public.amicales(id) ON DELETE SET NULL,
    is_activated BOOLEAN DEFAULT false NOT NULL,
    is_revoked BOOLEAN DEFAULT false NOT NULL,
    auth_user_id UUID UNIQUE,
    mot_de_passe TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Table Students (Électeurs)
CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom TEXT NOT NULL,
    prenom TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    matricule TEXT NOT NULL UNIQUE,
    numero_carte TEXT,
    filiere TEXT,
    promotion TEXT,
    is_activated BOOLEAN DEFAULT false NOT NULL,
    amicale_id UUID REFERENCES public.amicales(id) ON DELETE CASCADE NOT NULL,
    otp_code TEXT,
    otp_expires_at BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Table Elections
CREATE TABLE IF NOT EXISTS public.elections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titre TEXT NOT NULL,
    description TEXT,
    date_ouverture TIMESTAMP WITH TIME ZONE,
    date_fermeture TIMESTAMP WITH TIME ZONE,
    statut TEXT NOT NULL CHECK (statut IN ('brouillon', 'ouverte', 'fermee', 'publiee')) DEFAULT 'brouillon',
    emails_envoyes BOOLEAN DEFAULT false NOT NULL,
    created_by UUID REFERENCES public.admins(id) ON DELETE SET NULL,
    amicale_id UUID REFERENCES public.amicales(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Table Postes
CREATE TABLE IF NOT EXISTS public.postes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    election_id UUID REFERENCES public.elections(id) ON DELETE CASCADE NOT NULL,
    nom TEXT NOT NULL,
    description TEXT,
    ordre INTEGER DEFAULT 0 NOT NULL,
    nombre_voix_max INTEGER DEFAULT 1 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Table Candidats
CREATE TABLE IF NOT EXISTS public.candidats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poste_id UUID REFERENCES public.postes(id) ON DELETE CASCADE NOT NULL,
    nom TEXT NOT NULL,
    prenom TEXT NOT NULL,
    photo_url TEXT,
    slogan TEXT,
    programme TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.admins ADD COLUMN candidat_id UUID REFERENCES public.candidats(id) ON DELETE SET NULL;

-- 7. Table Emargements
CREATE TABLE IF NOT EXISTS public.emargements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    election_id UUID REFERENCES public.elections(id) ON DELETE CASCADE NOT NULL,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
    poste_id UUID REFERENCES public.postes(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (student_id, poste_id)
);

-- 8. Table Votes
CREATE TABLE IF NOT EXISTS public.votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poste_id UUID REFERENCES public.postes(id) ON DELETE CASCADE NOT NULL,
    candidat_id UUID REFERENCES public.candidats(id) ON DELETE SET NULL,
    election_id UUID REFERENCES public.elections(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. Table Mail
CREATE TABLE IF NOT EXISTS public.mail (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "to" TEXT NOT NULL,
    message JSONB NOT NULL,
    status TEXT DEFAULT 'pending' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insertion des amicales par défaut
INSERT INTO public.amicales (id, nom, description) VALUES
('a1111111-1111-1111-1111-111111111111', 'AMICALE KOLDA', 'Amicale des étudiants originaires de Kolda'),
('a2222222-2222-2222-2222-222222222222', 'AMICALE ZIGUINCHOR', 'Amicale des étudiants de Ziguinchor')
ON CONFLICT (nom) DO NOTHING;

-- Insertion du super admin par défaut
INSERT INTO public.admins (id, nom, prenom, email, role, is_activated, is_revoked, mot_de_passe) VALUES
('b1111111-1111-1111-1111-111111111111', 'SANE', 'Youssouph Badji', 'youssouphbadji2013@gmail.com', 'super_admin', false, false, 'admin123'),
('b2222222-2222-2222-2222-222222222222', 'Admin', 'Super', 'admin@amicale.sn', 'super_admin', false, false, 'admin123')
ON CONFLICT (email) DO NOTHING;

-- Configuration de l'accès public (Optionnel selon RLS)
ALTER TABLE public.amicales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.elections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.postes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emargements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mail ENABLE ROW LEVEL SECURITY;

-- Création des politiques d'accès public simples pour le mode dev local (Select/Insert/Update/Delete ouverts)
CREATE POLICY "Allow public read" ON public.amicales FOR SELECT USING (true);
CREATE POLICY "Allow public write" ON public.amicales FOR ALL USING (true);

CREATE POLICY "Allow public read" ON public.admins FOR SELECT USING (true);
CREATE POLICY "Allow public write" ON public.admins FOR ALL USING (true);

CREATE POLICY "Allow public read" ON public.students FOR SELECT USING (true);
CREATE POLICY "Allow public write" ON public.students FOR ALL USING (true);

CREATE POLICY "Allow public read" ON public.elections FOR SELECT USING (true);
CREATE POLICY "Allow public write" ON public.elections FOR ALL USING (true);

CREATE POLICY "Allow public read" ON public.postes FOR SELECT USING (true);
CREATE POLICY "Allow public write" ON public.postes FOR ALL USING (true);

CREATE POLICY "Allow public read" ON public.candidats FOR SELECT USING (true);
CREATE POLICY "Allow public write" ON public.candidats FOR ALL USING (true);

CREATE POLICY "Allow public read" ON public.emargements FOR SELECT USING (true);
CREATE POLICY "Allow public write" ON public.emargements FOR ALL USING (true);

CREATE POLICY "Allow public read" ON public.votes FOR SELECT USING (true);
CREATE POLICY "Allow public write" ON public.votes FOR ALL USING (true);

CREATE POLICY "Allow public read" ON public.mail FOR SELECT USING (true);
CREATE POLICY "Allow public write" ON public.mail FOR ALL USING (true);
