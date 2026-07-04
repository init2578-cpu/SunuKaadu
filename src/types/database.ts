// Types TypeScript pour la base de données PostgreSQL de la plateforme d'élection

export interface Profile {
  id: string; // ID utilisateur Supabase Auth
  email: string;
  role: 'admin' | 'student';
  created_at?: string;
}

export interface Student {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  numero_carte: string;
  filiere: string | null;
  promotion: string | null;
  auth_user_id: string | null;
  is_activated: boolean;
  amicale_id: string;
  created_at?: string;
}

export interface Election {
  id: string;
  titre: string;
  description: string | null;
  statut: 'brouillon' | 'ouverte' | 'fermee' | 'publiee';
  date_debut: string | null;
  date_fin: string | null;
  created_by: string | null;
  amicale_id: string;
  created_at?: string;
}

export interface Poste {
  id: string;
  election_id: string;
  nom: string;
  description: string | null;
  ordre: number;
  created_at?: string;
}

export interface Candidat {
  id: string;
  poste_id: string;
  nom: string;
  prenom: string;
  photo_url: string | null;
  slogan: string | null;
  programme: string | null;
  created_at?: string;
}

export interface Emargement {
  id: string;
  election_id: string;
  poste_id: string;
  user_id: string;
  created_at?: string;
}

export interface Vote {
  id: string;
  election_id: string;
  poste_id: string;
  candidat_id: string;
  student_id: string;
  created_at?: string;
}
