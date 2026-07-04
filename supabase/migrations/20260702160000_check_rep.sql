-- Migration: Ajout d'une fonction de vérification pour le représentant
-- Date: 2026-07-02

CREATE OR REPLACE FUNCTION public.check_representative_active(p_email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admins
    WHERE LOWER(TRIM(email)) = LOWER(TRIM(p_email))
      AND role = 'representant'
      AND is_activated = true
      AND is_revoked = false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
