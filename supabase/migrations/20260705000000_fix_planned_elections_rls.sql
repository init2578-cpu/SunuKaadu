-- Migration: Autoriser la lecture publique des scrutins planifiés
-- Date: 2026-07-05

-- On remplace la politique de lecture pour inclure les élections planifiées 
-- (statut 'brouillon' avec une date_ouverture définie)

DROP POLICY IF EXISTS "Allow read for public if published or open" ON public.elections;

CREATE POLICY "Allow read for public if published or open" ON public.elections FOR SELECT
  USING (
    statut IN ('ouverte', 'fermee', 'publiee') OR
    (statut = 'brouillon' AND date_ouverture IS NOT NULL) OR
    public.is_super_admin() OR
    (auth.uid() IS NOT NULL AND amicale_id = public.get_admin_amicale_id())
  );
