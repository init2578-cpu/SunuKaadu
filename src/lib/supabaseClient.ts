import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Detect if placeholder or empty keys are used
const isPlaceholder = 
  !supabaseUrl || 
  !supabaseAnonKey || 
  supabaseUrl.includes('placeholder') || 
  supabaseAnonKey.includes('placeholder');

// Helper to generate IDs
const generateId = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

// Mock data initialization
const initMockDB = () => {
  if (!localStorage.getItem('mock_amicales')) {
    localStorage.setItem('mock_amicales', JSON.stringify([
      { id: 'amicale-kolda', nom: 'Amicale de Kolda', description: 'Regroupement des étudiants de Kolda', created_at: new Date().toISOString() },
      { id: 'amicale-kaolack', nom: 'Amicale de Kaolack', description: 'Regroupement des étudiants de Kaolack', created_at: new Date().toISOString() }
    ]));
  }

  const existingAdmins = localStorage.getItem('mock_admins');
  if (!existingAdmins || !existingAdmins.includes('delegue@univ.sn') || !existingAdmins.includes('amicale_id') || !existingAdmins.includes('ibnrassul05@gmail.com') || !existingAdmins.includes('mot_de_passe')) {
    localStorage.setItem('mock_admins', JSON.stringify([
      { id: 'mock-admin-id', auth_user_id: 'mock-admin-id', nom: 'Administrateur', prenom: 'Général', email: 'admin@amicale.sn', role: 'super_admin', is_activated: true, is_revoked: false, amicale_id: null, mot_de_passe: null },
      { id: 'super-admin-id-real', auth_user_id: 'super-admin-id-real', nom: 'Hadim', prenom: 'Super Admin', email: 'ibnrassul05@gmail.com', role: 'super_admin', is_activated: true, is_revoked: false, amicale_id: null, mot_de_passe: null },
      { id: 'delegue-id', auth_user_id: null, nom: 'Diallo', prenom: 'Moussa', email: 'delegue@univ.sn', role: 'delegue', is_activated: false, is_revoked: false, amicale_id: 'amicale-kolda', mot_de_passe: 'Del-Demo99' },
      { id: 'representant-id', auth_user_id: 'representant-auth-id', nom: 'Diop', prenom: 'Abdou', email: 'representant@univ.sn', role: 'representant', is_activated: true, is_revoked: false, amicale_id: 'amicale-kolda', candidat_id: 'cand-1', mot_de_passe: null }
    ]));
  }
  if (!localStorage.getItem('mock_students') || !localStorage.getItem('mock_students')?.includes('amicale_id')) {
    localStorage.setItem('mock_students', JSON.stringify([
      { id: 'stud-1', nom: 'Ndiaye', prenom: 'Mamadou', email: 'mamadou.ndiaye@univ.sn', numero_carte: 'N202611', filiere: 'Informatique', promotion: '2026', auth_user_id: null, is_activated: false, amicale_id: 'amicale-kolda' },
      { id: 'stud-2', nom: 'Diop', prenom: 'Aminata', email: 'aminata.diop@univ.sn', numero_carte: 'D202522', filiere: 'Médecine', promotion: '2025', auth_user_id: 'auth-student-2', is_activated: true, amicale_id: 'amicale-kolda' },
      { id: 'stud-3', nom: 'Sow', prenom: 'Ousmane', email: 'ousmane.sow@univ.sn', numero_carte: 'S202633', filiere: 'Droit', promotion: '2026', auth_user_id: null, is_activated: false, amicale_id: 'amicale-kolda' }
    ]));
  }
  if (!localStorage.getItem('mock_elections') || !localStorage.getItem('mock_elections')?.includes('amicale_id')) {
    localStorage.setItem('mock_elections', JSON.stringify([
      { id: 'elec-1', titre: "Élection du Bureau de l'Amicale 2026", description: "Scrutin pour élire le bureau de l'amicale des étudiants.", statut: 'brouillon', date_ouverture: null, date_fermeture: null, created_by: 'mock-admin-id', created_at: new Date().toISOString(), amicale_id: 'amicale-kolda' }
    ]));
  }
  if (!localStorage.getItem('mock_postes')) {
    localStorage.setItem('mock_postes', JSON.stringify([
      { id: 'poste-1', election_id: 'elec-1', nom: 'Président', description: 'Président du bureau', ordre: 1 },
      { id: 'poste-2', election_id: 'elec-1', nom: 'Secrétaire Général', description: 'Secrétaire général', ordre: 2 }
    ]));
  }
  if (!localStorage.getItem('mock_candidats')) {
    localStorage.setItem('mock_candidats', JSON.stringify([
      { id: 'cand-1', poste_id: 'poste-1', nom: 'Diallo', prenom: 'Ibrahima', photo_url: null, slogan: "Le changement c'est maintenant !", programme: 'Améliorer les conditions de vie sociale et universitaire.' },
      { id: 'cand-2', poste_id: 'poste-1', nom: 'Fall', prenom: 'Fatou', photo_url: null, slogan: 'Unir pour réussir !', programme: 'Digitaliser les services et renforcer les partenariats.' },
      { id: 'cand-3', poste_id: 'poste-2', nom: 'Gueye', prenom: 'Abdoulaye', photo_url: null, slogan: 'La voix des sans voix', programme: 'Assurer une communication transparente.' }
    ]));
  }
  if (!localStorage.getItem('mock_votes')) {
    localStorage.setItem('mock_votes', JSON.stringify([]));
  }
};

class MockQueryBuilder {
  private table: string;
  private filters: Array<(item: any) => boolean> = [];
  private orderByField: string | null = null;
  private orderByAscending = true;
  private isHead = false;
  private pendingInsertData: any[] | null = null;
  private pendingInsertError: any = null;

  constructor(table: string) {
    this.table = table;
  }

  select(columns = '*', options?: any) {
    if (options?.head) {
      this.isHead = true;
    }
    return this;
  }

  eq(field: string, value: any) {
    this.filters.push((item: any) => item[field] === value);
    return this;
  }
  
  in(field: string, values: any[]) {
    this.filters.push((item: any) => values.includes(item[field]));
    return this;
  }

  order(field: string, options?: { ascending: boolean }) {
    this.orderByField = field;
    this.orderByAscending = options?.ascending ?? true;
    return this;
  }

  private getData(): any[] {
    const key = `mock_${this.table}`;
    return JSON.parse(localStorage.getItem(key) || '[]');
  }

  private saveData(data: any[]) {
    const key = `mock_${this.table}`;
    localStorage.setItem(key, JSON.stringify(data));
  }

  async execute() {
    let data = this.getData();
    
    // Apply filters
    for (const filter of this.filters) {
      data = data.filter(filter);
    }

    // Apply sorting
    if (this.orderByField) {
      data.sort((a: any, b: any) => {
        const valA = a[this.orderByField!];
        const valB = b[this.orderByField!];
        if (valA === null || valA === undefined) return 1;
        if (valB === null || valB === undefined) return -1;
        if (valA < valB) return this.orderByAscending ? -1 : 1;
        if (valA > valB) return this.orderByAscending ? 1 : -1;
        return 0;
      });
    }

    // Handle relations
    if (this.table === 'elections') {
      const postes = JSON.parse(localStorage.getItem('mock_postes') || '[]');
      data = data.map((election: any) => ({
        ...election,
        postes: postes.filter((p: any) => p.election_id === election.id)
      }));
    } else if (this.table === 'postes') {
      const candidats = JSON.parse(localStorage.getItem('mock_candidats') || '[]');
      data = data.map((poste: any) => ({
        ...poste,
        candidats: candidats.filter((c: any) => c.poste_id === poste.id)
      }));
    }

    if (this.isHead) {
      return { data: null, count: data.length, error: null };
    }

    return { data, count: data.length, error: null };
  }

  // Chaining support
  then(onfulfilled?: (value: any) => any, onrejected?: (reason: any) => any) {
    // If we have pending insert data, resolve with that instead of executing a select
    if (this.pendingInsertData !== null || this.pendingInsertError !== null) {
      const result = this.pendingInsertError
        ? { data: null, error: this.pendingInsertError }
        : { data: this.pendingInsertData, error: null };
      return Promise.resolve(result).then(onfulfilled, onrejected);
    }
    return this.execute().then(onfulfilled, onrejected);
  }

  async maybeSingle() {
    const { data } = await this.execute();
    if (data && data.length > 0) {
      return { data: data[0], error: null };
    }
    return { data: null, error: null };
  }

  // single() is now defined after insert() to handle both select and insert chains

  insert(payload: any): this {
    const current = this.getData();
    const items = Array.isArray(payload) ? payload : [payload];
    
    const newItems = items.map((item: any) => ({
      id: item.id || generateId(),
      created_at: new Date().toISOString(),
      ...item
    }));

    if (this.table === 'students') {
      for (const item of newItems) {
        if (current.some((s: any) => s.email === item.email)) {
          this.pendingInsertData = null;
          this.pendingInsertError = { message: "Cet email est déjà enregistré sur la liste blanche." };
          return this;
        }
      }
    }

    this.saveData([...current, ...newItems]);
    this.pendingInsertData = Array.isArray(payload) ? newItems : newItems;
    return this;
  }

  // Allow .insert(payload).select('id').single() chaining
  // select() is already defined above and returns `this`, so chaining works.
  // We override single() to handle pending insert data.
  async single() {
    // If we have pending insert data (from insert chain), return first item
    if (this.pendingInsertData !== null) {
      if (this.pendingInsertError) {
        return { data: null, error: this.pendingInsertError };
      }
      const item = this.pendingInsertData[0] || null;
      return { data: item, error: item ? null : { message: 'Aucun enregistrement trouvé.' } };
    }
    // Normal select single
    const { data } = await this.execute();
    if (data && data.length > 0) {
      return { data: data[0], error: null };
    }
    return { data: null, error: { message: 'Aucun enregistrement trouvé.' } };
  }

  async update(payload: any) {
    const current = this.getData();
    let updatedCount = 0;
    
    const next = current.map((item: any) => {
      let match = true;
      for (const filter of this.filters) {
        if (!filter(item)) {
          match = false;
          break;
        }
      }
      if (match) {
        updatedCount++;
        return { ...item, ...payload };
      }
      return item;
    });

    this.saveData(next);
    
    const updated = next.filter((item: any) => {
      let match = true;
      for (const filter of this.filters) {
        if (!filter(item)) {
          match = false;
          break;
        }
      }
      return match;
    });

    return { data: updated, error: null };
  }

  async delete() {
    const current = this.getData();
    const next = current.filter((item: any) => {
      let match = true;
      for (const filter of this.filters) {
        if (!filter(item)) {
          match = false;
          break;
        }
      }
      return !match;
    });

    this.saveData(next);
    return { error: null };
  }
}

class MockSupabaseClient {
  auth = {
    getSession: async () => {
      const sessionStr = localStorage.getItem('mock_session');
      const session = sessionStr ? JSON.parse(sessionStr) : null;
      return { data: { session }, error: null };
    },
    signInWithPassword: async ({ email, password }: any) => {
      const emailLower = email.trim().toLowerCase();
      
      // Chercher d'abord dans les admins
      const admins = JSON.parse(localStorage.getItem('mock_admins') || '[]');
      const admin = admins.find((a: any) => a.email.toLowerCase() === emailLower);
      if (admin && admin.is_activated && !admin.is_revoked) {
        // Utiliser l'auth_user_id existant, ou en générer un séquentiel stable
        const stableAuthId = admin.auth_user_id || ('mock-admin-auth-id-' + admin.id);
        if (!admin.auth_user_id) {
          admin.auth_user_id = stableAuthId;
          const idx = admins.findIndex((a: any) => a.id === admin.id);
          if (idx !== -1) admins[idx] = admin;
          localStorage.setItem('mock_admins', JSON.stringify(admins));
        }
        const session = {
          user: { id: stableAuthId, email: admin.email }
        };
        localStorage.setItem('mock_session', JSON.stringify(session));
        this._triggerAuthStateChange('SIGNED_IN', session);
        return { data: { user: session.user }, error: null };
      }
      
      const students = JSON.parse(localStorage.getItem('mock_students') || '[]');
      const student = students.find((s: any) => s.email.toLowerCase() === emailLower);
      if (student && student.is_activated) {
        if (!student.auth_user_id) {
          student.auth_user_id = 'mock-student-auth-id-' + student.id;
          localStorage.setItem('mock_students', JSON.stringify(students));
        }
        const session = {
          user: { id: student.auth_user_id, email: student.email }
        };
        localStorage.setItem('mock_session', JSON.stringify(session));
        this._triggerAuthStateChange('SIGNED_IN', session);
        return { data: { user: session.user }, error: null };
      }
      return { data: { user: null }, error: { message: "Identifiants incorrects ou accès non autorisé." } };
    },
    signUp: async ({ email, password }: any) => {
      const emailLower = email.trim().toLowerCase();
      
      // Vérifier si c'est un étudiant éligible
      const students = JSON.parse(localStorage.getItem('mock_students') || '[]');
      const student = students.find((s: any) => s.email.toLowerCase() === emailLower);
      if (student) {
        const session = {
          user: { id: 'mock-student-auth-id-' + student.id, email: student.email }
        };
        localStorage.setItem('mock_session', JSON.stringify(session));
        this._triggerAuthStateChange('SIGNED_IN', session);
        return { data: { user: session.user }, error: null };
      }

      // Vérifier si c'est un admin autorisé
      const admins = JSON.parse(localStorage.getItem('mock_admins') || '[]');
      const admin = admins.find((a: any) => a.email.toLowerCase() === emailLower);
      if (admin && !admin.is_revoked) {
        const session = {
          user: { id: 'mock-admin-auth-id-' + admin.id, email: admin.email }
        };
        localStorage.setItem('mock_session', JSON.stringify(session));
        this._triggerAuthStateChange('SIGNED_IN', session);
        return { data: { user: session.user }, error: null };
      }

      return { data: { user: null }, error: { message: "Cet email n'est pas autorisé à s'inscrire." } };
    },
    signOut: async () => {
      localStorage.removeItem('mock_session');
      this._triggerAuthStateChange('SIGNED_OUT', null);
      return { error: null };
    },
    onAuthStateChange: (callback: any) => {
      this.authStateListeners.push(callback);
      const sessionStr = localStorage.getItem('mock_session');
      const session = sessionStr ? JSON.parse(sessionStr) : null;
      setTimeout(() => callback('SIGNED_IN', session), 0);
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              this.authStateListeners = this.authStateListeners.filter(l => l !== callback);
            }
          }
        }
      };
    },
    resetPasswordForEmail: async (email: string) => {
      await new Promise(resolve => setTimeout(resolve, 200));
      return { error: null };
    }
  };
  
  storage = {
    from: (bucket: string) => ({
      upload: async (path: string, file: File) => {
        await new Promise(resolve => setTimeout(resolve, 300));
        let objectUrl = "";
        try {
          objectUrl = URL.createObjectURL(file);
        } catch (e) {
          objectUrl = "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150";
        }
        const mockStorage = JSON.parse(localStorage.getItem('mock_storage_urls') || '{}');
        mockStorage[path] = objectUrl;
        localStorage.setItem('mock_storage_urls', JSON.stringify(mockStorage));
        return { data: { path }, error: null };
      },
      getPublicUrl: (path: string) => {
        const mockStorage = JSON.parse(localStorage.getItem('mock_storage_urls') || '{}');
        const publicUrl = mockStorage[path] || `https://api.dicebear.com/7.x/initials/svg?seed=${path}`;
        return { data: { publicUrl } };
      }
    })
  };

  private authStateListeners: any[] = [];
  private _triggerAuthStateChange(event: string, session: any) {
    this.authStateListeners.forEach(l => l(event, session));
  }

  from(table: string) {
    return new MockQueryBuilder(table);
  }

  async rpc(fn: string, args: any) {
    if (fn === 'get_election_stats') {
      const electionId = args.p_election_id;
      const postes = JSON.parse(localStorage.getItem('mock_postes') || '[]');
      const candidats = JSON.parse(localStorage.getItem('mock_candidats') || '[]');
      const votes = JSON.parse(localStorage.getItem('mock_votes') || '[]');

      const electionPostes = postes.filter((p: any) => p.election_id === electionId);
      const posteIds = electionPostes.map((p: any) => p.id);
      const electionCandidats = candidats.filter((c: any) => posteIds.includes(c.poste_id));
      const electionVotes = votes.filter((v: any) => v.election_id === electionId);
      const voterIds = new Set(electionVotes.map((v: any) => v.student_id));

      return {
        data: [{
          postes_count: electionPostes.length,
          candidats_count: electionCandidats.length,
          voters_count: voterIds.size
        }],
        error: null
      };
    }

    if (fn === 'has_votes_recorded') {
      const electionId = args.p_election_id;
      const votes = JSON.parse(localStorage.getItem('mock_votes') || '[]');
      const hasVotes = votes.some((v: any) => v.election_id === electionId);
      return { data: hasVotes, error: null };
    }

    if (fn === 'has_admin_temp_password') {
      // Dans le mock, aucun mot de passe temporaire n'est requis : retourner false
      return { data: false, error: null };
    }

    if (fn === 'verify_admin_temp_password') {
      // Dans le mock, pas de mot de passe temporaire — toujours valide
      return { data: true, error: null };
    }

    if (fn === 'check_admin_email') {
      const emailLower = args.p_email.trim().toLowerCase();
      const admins = JSON.parse(localStorage.getItem('mock_admins') || '[]');
      const admin = admins.find((a: any) => a.email.toLowerCase() === emailLower);
      if (admin && !admin.is_revoked) {
        return {
          data: [{
            email_exists: true,
            role: admin.role || 'delegue',
            is_activated: admin.is_activated ?? false,
            amicale_id: admin.amicale_id || null
          }],
          error: null
        };
      }
      return {
        data: [{
          email_exists: false,
          role: null,
          is_activated: false,
          amicale_id: null
        }],
        error: null
      };
    }

    if (fn === 'check_and_save_representative') {
      const candidateId = args.p_candidate_id;
      const nom = args.p_nom;
      const prenom = args.p_prenom;
      const emailLower = args.p_email.trim().toLowerCase();
      const authUserId = args.p_auth_user_id;
      const password = args.p_password;
      const createdBy = args.p_created_by;

      const admins = JSON.parse(localStorage.getItem('mock_admins') || '[]');
      const existingAdmin = admins.find((a: any) => a.email.toLowerCase() === emailLower);

      let repMsg = "";

      if (existingAdmin) {
        if (existingAdmin.role === 'super_admin' || existingAdmin.role === 'delegue') {
          return {
            data: {
              success: false,
              message: "Cet e-mail est déjà associé à un compte administrateur ou délégué."
            },
            error: null
          };
        }

        if (existingAdmin.role === 'representant') {
          if (existingAdmin.candidat_id && existingAdmin.candidat_id !== candidateId && !existingAdmin.is_revoked) {
            return {
              data: {
                success: false,
                message: "Cet étudiant est déjà assigné comme représentant pour un autre candidat."
              },
              error: null
            };
          }

          existingAdmin.nom = nom;
          existingAdmin.prenom = prenom;
          existingAdmin.candidat_id = candidateId;
          existingAdmin.is_revoked = false;
          existingAdmin.created_by = createdBy;
          
          if (authUserId) {
            existingAdmin.auth_user_id = authUserId;
            existingAdmin.is_activated = true;
          } else {
            existingAdmin.mot_de_passe = password;
          }

          localStorage.setItem('mock_admins', JSON.stringify(admins));

          if (authUserId) {
            repMsg = `\nCet étudiant possède déjà un compte actif. Il peut se connecter avec ses identifiants étudiants habituels.`;
          } else if (!existingAdmin.is_activated) {
            repMsg = `\nIdentifiant : ${emailLower}\nMot de passe : ${password}`;
          }

          return {
            data: {
              success: true,
              message: "Représentant mis à jour.",
              rep_msg: repMsg
            },
            error: null
          };
        }
      } else {
        const newRep = {
          id: generateId(),
          nom: nom,
          prenom: prenom,
          email: emailLower,
          role: 'representant',
          candidat_id: candidateId,
          is_revoked: false,
          created_by: createdBy,
          auth_user_id: authUserId || null,
          is_activated: !!authUserId,
          mot_de_passe: authUserId ? null : password
        };

        admins.push(newRep);
        localStorage.setItem('mock_admins', JSON.stringify(admins));

        if (authUserId) {
          repMsg = `\nCet étudiant possède déjà un compte actif. Il peut se connecter avec ses identifiants étudiants habituels.`;
        } else {
          repMsg = `\nIdentifiant : ${emailLower}\nMot de passe : ${password}`;
        }

        return {
          data: {
            success: true,
            message: "Représentant enregistré.",
            rep_msg: repMsg
          },
          error: null
        };
      }
    }

    if (fn === 'activate_admin') {
      const emailLower = args.p_email.trim().toLowerCase();
      const authUserId = args.p_auth_user_id;
      const admins = JSON.parse(localStorage.getItem('mock_admins') || '[]');
      const adminIdx = admins.findIndex((a: any) => a.email.toLowerCase() === emailLower);
      if (adminIdx !== -1 && !admins[adminIdx].is_activated) {
        admins[adminIdx].is_activated = true;
        admins[adminIdx].auth_user_id = authUserId;
        localStorage.setItem('mock_admins', JSON.stringify(admins));
        return { data: true, error: null };
      }
      return { data: false, error: null };
    }

    if (fn === 'check_student_email') {
      const emailLower = args.p_email.trim().toLowerCase();
      const students = JSON.parse(localStorage.getItem('mock_students') || '[]');
      const student = students.find((s: any) => s.email.toLowerCase() === emailLower);
      if (student) {
        return {
          data: [{
            email_exists: true,
            is_activated: student.is_activated,
            amicale_id: student.amicale_id || null
          }],
          error: null
        };
      }
      return {
        data: [{
          email_exists: false,
          is_activated: false,
          amicale_id: null
        }],
        error: null
      };
    }

    if (fn === 'activate_student') {
      const emailLower = args.p_email.trim().toLowerCase();
      const authUserId = args.p_auth_user_id;
      const students = JSON.parse(localStorage.getItem('mock_students') || '[]');
      const studentIdx = students.findIndex((s: any) => s.email.toLowerCase() === emailLower);
      if (studentIdx !== -1 && !students[studentIdx].is_activated) {
        students[studentIdx].is_activated = true;
        students[studentIdx].auth_user_id = authUserId;
        localStorage.setItem('mock_students', JSON.stringify(students));
        return { data: true, error: null };
      }
      return { data: false, error: null };
    }

    if (fn === 'has_student_voted') {
      const studentId = args.p_student_id;
      const electionId = args.p_election_id;
      const votes = JSON.parse(localStorage.getItem('mock_votes') || '[]');
      const hasVoted = votes.some((v: any) => v.student_id === studentId && v.election_id === electionId);
      return { data: hasVoted, error: null };
    }

    if (fn === 'get_election_results') {
      const electionId = args.p_election_id;
      const votes = JSON.parse(localStorage.getItem('mock_votes') || '[]');
      const electionVotes = votes.filter((v: any) => v.election_id === electionId);
      
      const counts: Record<string, { candidat_id: string; poste_id: string; votes_count: number }> = {};
      for (const v of electionVotes) {
        const key = `${v.candidat_id}-${v.poste_id}`;
        if (!counts[key]) {
          counts[key] = {
            candidat_id: v.candidat_id,
            poste_id: v.poste_id,
            votes_count: 0
          };
        }
        counts[key].votes_count++;
      }
      return { data: Object.values(counts), error: null };
    }

    if (fn === 'get_voters_registry') {
      const electionId = args.p_election_id;
      const votes = JSON.parse(localStorage.getItem('mock_votes') || '[]');
      const students = JSON.parse(localStorage.getItem('mock_students') || '[]');
      const postes = JSON.parse(localStorage.getItem('mock_postes') || '[]');
      
      const electionVotes = votes.filter((v: any) => v.election_id === electionId);
      
      const registry = electionVotes.map((v: any) => {
        const student = students.find((s: any) => s.id === v.student_id) || {};
        const poste = postes.find((p: any) => p.id === v.poste_id) || {};
        return {
          student_nom: student.nom || 'Anonyme',
          student_prenom: student.prenom || 'Électeur',
          student_email: student.email || '',
          poste_nom: poste.nom || 'Poste',
          voted_at: v.created_at
        };
      });
      
      registry.sort((a: any, b: any) => new Date(b.voted_at).getTime() - new Date(a.voted_at).getTime());
      return { data: registry, error: null };
    }
    if (fn === 'submit_vote') {
      const electionId = args.p_election_id;
      const posteId = args.p_poste_id;
      const candidatId = args.p_candidat_id;

      const sessionStr = localStorage.getItem('mock_session');
      const session = sessionStr ? JSON.parse(sessionStr) : null;
      if (!session || !session.user || !session.user.email) {
        return { data: null, error: { message: "Accès non autorisé : vous devez être connecté." } };
      }

      const students = JSON.parse(localStorage.getItem('mock_students') || '[]');
      const student = students.find((s: any) => s.email.toLowerCase() === session.user.email.toLowerCase());
      if (!student) {
        return { data: null, error: { message: "Accès non autorisé : étudiant non identifié ou non activé." } };
      }

      const elections = JSON.parse(localStorage.getItem('mock_elections') || '[]');
      const election = elections.find((e: any) => e.id === electionId && e.statut === 'ouverte');
      if (!election) {
        return { data: null, error: { message: "Le vote pour cette élection n'est pas ouvert." } };
      }

      const postes = JSON.parse(localStorage.getItem('mock_postes') || '[]');
      const poste = postes.find((p: any) => p.id === posteId && p.election_id === electionId);
      if (!poste) {
        return { data: null, error: { message: "Le poste n'appartient pas à cette élection." } };
      }

      const candidats = JSON.parse(localStorage.getItem('mock_candidats') || '[]');
      const candidat = candidats.find((c: any) => c.id === candidatId && c.poste_id === posteId);
      if (!candidat) {
        return { data: null, error: { message: "Le candidat n'est pas inscrit pour ce poste." } };
      }

      const votes = JSON.parse(localStorage.getItem('mock_votes') || '[]');
      const alreadyVoted = votes.some((v: any) => v.student_id === student.id && v.poste_id === posteId);
      if (alreadyVoted) {
        return { data: null, error: { message: "Vous avez déjà voté pour ce poste." } };
      }

      const newVote = {
        id: 'vote-' + generateId(),
        election_id: electionId,
        poste_id: posteId,
        candidat_id: candidatId,
        student_id: student.id,
        created_at: new Date().toISOString()
      };
      votes.push(newVote);
      localStorage.setItem('mock_votes', JSON.stringify(votes));

      return { data: true, error: null };
    }

    if (fn === 'get_voted_postes') {
      const electionId = args.p_election_id;
      const sessionStr = localStorage.getItem('mock_session');
      const session = sessionStr ? JSON.parse(sessionStr) : null;
      if (!session || !session.user || !session.user.email) {
        return { data: [], error: null };
      }

      const students = JSON.parse(localStorage.getItem('mock_students') || '[]');
      const student = students.find((s: any) => s.email.toLowerCase() === session.user.email.toLowerCase());
      if (!student) {
        return { data: [], error: null };
      }

      const votes = JSON.parse(localStorage.getItem('mock_votes') || '[]');
      const studentVotes = votes.filter((v: any) => v.student_id === student.id && v.election_id === electionId);
      
      const votedPostes = studentVotes.map((v: any) => ({ poste_id: v.poste_id }));
      return { data: votedPostes, error: null };
    }

    if (fn === 'get_resultats') {
      const electionId = args.p_election_id;
      const elections = JSON.parse(localStorage.getItem('mock_elections') || '[]');
      const election = elections.find((e: any) => e.id === electionId);
      if (!election) {
        return { data: null, error: { message: "Élection introuvable." } };
      }

      const sessionStr = localStorage.getItem('mock_session');
      const session = sessionStr ? JSON.parse(sessionStr) : null;
      const isAdmin = session && session.user && session.user.email === 'admin@amicale.sn';

      if (election.statut !== 'fermee' && election.statut !== 'publiee' && !isAdmin) {
        return { data: null, error: { message: "Les résultats de cette élection ne sont pas encore disponibles." } };
      }

      const votes = JSON.parse(localStorage.getItem('mock_votes') || '[]');
      const electionVotes = votes.filter((v: any) => v.election_id === electionId);
      
      const counts: Record<string, { candidat_id: string; poste_id: string; votes_count: number }> = {};
      for (const v of electionVotes) {
        const key = `${v.candidat_id}-${v.poste_id}`;
        if (!counts[key]) {
          counts[key] = {
            candidat_id: v.candidat_id,
            poste_id: v.poste_id,
            votes_count: 0
          };
        }
        counts[key].votes_count++;
      }
      return { data: Object.values(counts), error: null };
    }

    if (fn === 'get_participation_globale') {
      const electionId = args.p_election_id;
      const votes = JSON.parse(localStorage.getItem('mock_votes') || '[]');
      const students = JSON.parse(localStorage.getItem('mock_students') || '[]');
      const elections = JSON.parse(localStorage.getItem('mock_elections') || '[]');
      const election = elections.find((e: any) => e.id === electionId);
      const electionAmicaleId = election?.amicale_id;
      
      const electionVotes = votes.filter((v: any) => v.election_id === electionId);
      const uniqueVoters = new Set(electionVotes.map((v: any) => v.student_id)).size;
      const amicaleStudents = electionAmicaleId 
        ? students.filter((s: any) => s.amicale_id === electionAmicaleId)
        : students;
      const totalStudents = amicaleStudents.length;
      const rate = totalStudents > 0 ? parseFloat(((uniqueVoters / totalStudents) * 100).toFixed(2)) : 0;

      return {
        data: [{
          voters_count: uniqueVoters,
          total_eligible: totalStudents,
          participation_rate: rate
        }],
        error: null
      };
    }

    if (fn === 'get_resultats_candidat') {
      const candidatId = args.p_candidat_id;
      const sessionStr = localStorage.getItem('mock_session');
      const authUser = sessionStr ? JSON.parse(sessionStr)?.user : null;
      if (!authUser) {
        return { data: null, error: { message: "Non authentifié" } };
      }

      const admins = JSON.parse(localStorage.getItem('mock_admins') || '[]');
      const isRep = admins.some((a: any) => 
        a.auth_user_id === authUser.id && 
        a.role === 'representant' && 
        a.candidat_id === candidatId && 
        !a.is_revoked
      );

      if (!isRep) {
        return { data: null, error: { message: "Non autorisé. Cet espace est réservé au représentant de ce candidat." } };
      }

      const candidats = JSON.parse(localStorage.getItem('mock_candidats') || '[]');
      const candidate = candidats.find((c: any) => c.id === candidatId);
      if (!candidate) {
        return { data: null, error: { message: "Candidat inexistant" } };
      }

      const postes = JSON.parse(localStorage.getItem('mock_postes') || '[]');
      const poste = postes.find((p: any) => p.id === candidate.poste_id);
      
      const elections = JSON.parse(localStorage.getItem('mock_elections') || '[]');
      const election = elections.find((e: any) => e.id === (poste?.election_id));

      if (!election) {
        return { data: null, error: { message: "Élection inexistante" } };
      }

      let votesCount = 0;
      let isGagnant = false;

      if (election.statut === 'fermee' || election.statut === 'publiee') {
        const votes = JSON.parse(localStorage.getItem('mock_votes') || '[]');
        votesCount = votes.filter((v: any) => v.candidat_id === candidatId).length;

        const postCandidates = candidats.filter((c: any) => c.poste_id === poste.id);
        let maxVotes = 0;
        postCandidates.forEach((c: any) => {
          const cvotes = votes.filter((v: any) => v.candidat_id === c.id).length;
          if (cvotes > maxVotes) {
            maxVotes = cvotes;
          }
        });

        if (votesCount === maxVotes && maxVotes > 0) {
          isGagnant = true;
        }
      }

      return {
        data: [{
          candidat_id: candidatId,
          nom: candidate.nom,
          prenom: candidate.prenom,
          poste_nom: poste?.nom || '',
          statut_election: election.statut,
          nb_voix: votesCount,
          gagnant: isGagnant
        }],
        error: null
      };
    }

    return { data: null, error: { message: `La fonction RPC ${fn} n'est pas implémentée dans le mock.` } };
  }
}

// Export mock or real client depending on environment
let supabaseClientInstance: any;

if (isPlaceholder) {
  console.warn("⚠️ Variables d'environnement Supabase absentes ou fictives. Utilisation du client local simulé (localStorage).");
  initMockDB();
  supabaseClientInstance = new MockSupabaseClient();
} else {
  console.log("⚡ Connexion à Supabase configurée avec succès.");
  supabaseClientInstance = createClient(supabaseUrl, supabaseAnonKey);
}

export const supabase = supabaseClientInstance;
