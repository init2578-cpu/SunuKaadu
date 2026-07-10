-- Migration: Optimisation de la performance des politiques RLS et indexation
-- Date: 2026-07-10

-- 1. Index sur amicale_id et statut pour accélérer la recherche des scrutins
CREATE INDEX IF NOT EXISTS elections_amicale_id_statut_idx ON public.elections (amicale_id, statut);

-- 2. Optimisation des fonctions Security Definer pour retourner immédiatement si l'utilisateur n'est pas connecté (anonyme)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;
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
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;
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
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT amicale_id INTO v_amicale_id FROM public.admins
  WHERE auth_user_id = auth.uid()
    AND is_revoked = false;
  RETURN v_amicale_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Optimisation de la politique de lecture publique sur la table elections
DROP POLICY IF EXISTS "Allow read for public if published or open" ON public.elections;

CREATE POLICY "Allow read for public if published or open" ON public.elections FOR SELECT
  USING (
    statut IN ('ouverte', 'fermee', 'publiee') OR
    (statut = 'brouillon' AND date_ouverture IS NOT NULL) OR
    (auth.uid() IS NOT NULL AND (
      public.is_super_admin() OR
      amicale_id = public.get_admin_amicale_id()
    ))
  );
