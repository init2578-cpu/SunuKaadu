import { supabase } from './supabase';

// Helper types
export interface Election {
  id: string;
  titre: string;
  description: string | null;
  statut: 'brouillon' | 'ouverte' | 'fermee' | 'publiee';
  amicale_id: string;
  created_by: string | null;
  created_at: string;
}

export interface Poste {
  id: string;
  election_id: string;
  nom: string;
  description: string | null;
  ordre: number;
  created_at: string;
}

export interface Candidat {
  id: string;
  poste_id: string;
  nom: string;
  prenom: string;
  photo_url: string | null;
  slogan: string | null;
  programme: string | null;
  created_at: string;
}

export interface Admin {
  id: string;
  auth_user_id: string | null;
  nom: string;
  prenom: string;
  email: string;
  role: 'super_admin' | 'delegue' | 'representant';
  candidat_id: string | null;
  amicale_id: string | null;
  is_activated: boolean;
  is_revoked: boolean;
  mot_de_passe: string | null;
  created_by: string | null;
  created_at: string;
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
  amicale_id: string;
  is_activated: boolean;
  created_at: string;
}

// =========================================================================
// ELECTIONS
// =========================================================================
export const getElections = async (amicaleId?: string): Promise<Election[]> => {
  let query = supabase.from('elections').select('*');
  if (amicaleId) {
    query = query.eq('amicale_id', amicaleId);
  }
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as Election[];
};

export const getElection = async (id: string): Promise<Election | null> => {
  const { data, error } = await supabase
    .from('elections')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as Election | null;
};

export const createElection = async (payload: Omit<Election, 'id' | 'created_at'>): Promise<string> => {
  const { data, error } = await supabase
    .from('elections')
    .insert([payload])
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
};

export const updateElection = async (id: string, payload: Partial<Election>): Promise<void> => {
  const { error } = await supabase
    .from('elections')
    .update(payload)
    .eq('id', id);
  if (error) throw error;
};

export const deleteElection = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('elections')
    .delete()
    .eq('id', id);
  if (error) throw error;
};

// =========================================================================
// POSTES
// =========================================================================
export const getPostes = async (electionId: string): Promise<Poste[]> => {
  const { data, error } = await supabase
    .from('postes')
    .select('*')
    .eq('election_id', electionId)
    .order('ordre', { ascending: true });
  if (error) throw error;
  return (data || []) as Poste[];
};

export const createPoste = async (payload: Omit<Poste, 'id' | 'created_at'>): Promise<string> => {
  const { data, error } = await supabase
    .from('postes')
    .insert([payload])
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
};

export const updatePoste = async (id: string, payload: Partial<Poste>): Promise<void> => {
  const { error } = await supabase
    .from('postes')
    .update(payload)
    .eq('id', id);
  if (error) throw error;
};

export const deletePoste = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('postes')
    .delete()
    .eq('id', id);
  if (error) throw error;
};

// =========================================================================
// CANDIDATS
// =========================================================================
export const getCandidats = async (posteIds: string[]): Promise<Candidat[]> => {
  if (posteIds.length === 0) return [];
  const { data, error } = await supabase
    .from('candidats')
    .select('*')
    .in('poste_id', posteIds);
  if (error) throw error;
  return (data || []) as Candidat[];
};

export const createCandidat = async (payload: Omit<Candidat, 'id' | 'created_at'>): Promise<string> => {
  const { data, error } = await supabase
    .from('candidats')
    .insert([payload])
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
};

export const updateCandidat = async (id: string, payload: Partial<Candidat>): Promise<void> => {
  const { error } = await supabase
    .from('candidats')
    .update(payload)
    .eq('id', id);
  if (error) throw error;
};

export const deleteCandidat = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('candidats')
    .delete()
    .eq('id', id);
  if (error) throw error;
};

// =========================================================================
// REPRESENTANTS / ADMINS
// =========================================================================
export const getRepresentatives = async (candidateIds: string[]): Promise<Admin[]> => {
  if (candidateIds.length === 0) return [];
  const { data, error } = await supabase
    .from('admins')
    .select('*')
    .eq('role', 'representant')
    .in('candidat_id', candidateIds);
  if (error) throw error;
  return (data || []) as Admin[];
};

// =========================================================================
// STUDENTS / WHITE LIST
// =========================================================================
export const getStudents = async (amicaleId: string): Promise<Student[]> => {
  const { data, error } = await supabase
    .from('students')
    .select('id, nom, prenom, email, matricule, numero_carte, filiere, promotion, amicale_id, is_activated, created_at')
    .eq('amicale_id', amicaleId);
  if (error) throw error;
  return (data || []) as unknown as Student[];
};

// =========================================================================
// VOTES & SCRUTIN SECURE TRANSACTION
// =========================================================================
export const submitVoteSecure = async (
  electionId: string, 
  posteId: string, 
  candidatId: string, 
  studentId: string
): Promise<boolean> => {
  try {
    const { data, error } = await supabase.rpc('submit_vote', {
      p_election_id: electionId,
      p_poste_id: posteId,
      p_candidat_id: candidatId || null,
      p_student_id: studentId
    });

    if (error) throw error;
    if (!data.success) {
      throw new Error(data.error);
    }

    return true;
  } catch (e: any) {
    console.error("Erreur lors de la soumission du vote :", e);
    throw e;
  }
};

export const hasVotesRecorded = async (electionId: string): Promise<boolean> => {
  const { data, error } = await supabase
    .from('votes')
    .select('id')
    .eq('election_id', electionId)
    .limit(1);
  if (error) throw error;
  return data && data.length > 0;
};
