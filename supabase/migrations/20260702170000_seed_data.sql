-- Migration: Seed de données de test pour local dev
-- Date: 2026-07-02

-- 1. Élection ouverte pour AMICALE KOLDA
INSERT INTO public.elections (id, titre, description, statut, date_ouverture, date_fermeture, amicale_id, created_by)
VALUES (
  'e1111111-1111-1111-1111-111111111111',
  'Élection Bureau Kolda 2026',
  'Scrutin général de l''Amicale de Kolda',
  'ouverte',
  now() - interval '1 hour',
  now() + interval '1 day',
  'a1111111-1111-1111-1111-111111111111',
  'b1111111-1111-1111-1111-111111111111'
) ON CONFLICT DO NOTHING;

-- 2. Poste de vote (sans description ni ordre qui ne sont pas dans le schema local)
INSERT INTO public.postes (id, election_id, nom, nombre_voix_max)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'e1111111-1111-1111-1111-111111111111',
  'Président',
  1
) ON CONFLICT DO NOTHING;

-- 3. Candidat
INSERT INTO public.candidats (id, poste_id, nom, prenom, parti, email)
VALUES (
  'c1111111-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  'Diop',
  'Awa',
  'L''avenir ensemble',
  'candidat@amicale.sn'
) ON CONFLICT DO NOTHING;

-- 4. Étudiant de test (électeur)
INSERT INTO public.students (id, nom, prenom, email, matricule, numero_carte, filiere, promotion, amicale_id, is_activated)
VALUES (
  '33333333-3333-3333-3333-333333333333',
  'Student',
  'Test',
  'student@amicale.sn',
  'M111222',
  'T202600',
  'Informatique',
  '2026',
  'a1111111-1111-1111-1111-111111111111',
  false
) ON CONFLICT DO NOTHING;

-- 5. Représentant de candidat
INSERT INTO public.admins (id, nom, prenom, email, role, is_activated, is_revoked, amicale_id, candidat_id, mot_de_passe)
VALUES (
  'b3333333-3333-3333-3333-333333333333',
  'Rep',
  'Test',
  'rep@amicale.sn',
  'representant',
  false,
  false,
  'a1111111-1111-1111-1111-111111111111',
  'c1111111-1111-1111-1111-111111111111',
  'rep123'
) ON CONFLICT DO NOTHING;
