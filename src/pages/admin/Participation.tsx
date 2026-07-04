import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { 
  Users, 
  Search, 
  AlertCircle, 
  Calendar, 
  UserCheck, 
  FileSpreadsheet,
  Clock
} from 'lucide-react';

interface Election {
  id: string;
  titre: string;
  statut: 'brouillon' | 'ouverte' | 'fermee' | 'publiee';
}

interface VoterRecord {
  student_nom: string;
  student_prenom: string;
  student_email: string;
  poste_nom: string;
  voted_at: string;
}

export default function Participation() {
  const { admin } = useAdminAuth();
  const [elections, setElections] = useState<Election[]>([]);
  const [selectedElectionId, setSelectedElectionId] = useState<string>('');
  const [voters, setVoters] = useState<VoterRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [registryLoading, setRegistryLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Charger toutes les élections
  const loadElections = async () => {
    if (!admin) return;
    try {
      setLoading(true);
      setErrorMsg('');

      let queryBuilder = supabase
        .from('elections')
        .select('id, titre, statut, created_at, amicale_id');
      
      if (admin.role !== 'super_admin' && admin.amicale_id) {
        queryBuilder = queryBuilder.eq('amicale_id', admin.amicale_id);
      }
      
      const { data: snapDocs, error: err } = await queryBuilder;
      if (err) throw err;

      const list = (snapDocs || []) as any[];
      list.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
      setElections(list);

      if (list.length > 0) {
        setSelectedElectionId(list[0].id);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Impossible de récupérer la liste des scrutins.");
    } finally {
      setLoading(false);
    }
  };

  // Charger la feuille d'émargement de l'élection sélectionnée
  const loadVotersRegistry = async (electionId: string) => {
    if (!electionId) return;
    try {
      setRegistryLoading(true);
      setErrorMsg('');

      // 1. Charger les émargements
      const { data: votesList, error: votesErr } = await supabase
        .from('emargements')
        .select('id, student_id, poste_id, created_at')
        .eq('election_id', electionId);

      if (votesErr) throw votesErr;

      if (!votesList || votesList.length === 0) {
        setVoters([]);
        return;
      }

      // 2. Charger les infos des étudiants et des postes
      const studentIds = Array.from(new Set<string>(votesList.map(v => v.student_id)));
      const posteIds = Array.from(new Set<string>(votesList.map(v => v.poste_id)));

      // Fetch students
      const { data: studentsData, error: studsErr } = await supabase
        .from('students')
        .select('id, nom, prenom, email')
        .in('id', studentIds);
      if (studsErr) throw studsErr;

      // Fetch postes
      const { data: postesData, error: postErr } = await supabase
        .from('postes')
        .select('id, nom')
        .in('id', posteIds);
      if (postErr) throw postErr;

      const studentMap: Record<string, any> = {};
      (studentsData || []).forEach(s => {
        studentMap[s.id] = s;
      });

      const posteMap: Record<string, any> = {};
      (postesData || []).forEach(p => {
        posteMap[p.id] = p;
      });

      // 3. Maper les votes
      const records: VoterRecord[] = votesList.map(v => {
        const student = studentMap[v.student_id] || {};
        const poste = posteMap[v.poste_id] || {};
        return {
          student_nom: student.nom || 'Anonyme',
          student_prenom: student.prenom || 'Étudiant',
          student_email: student.email || 'inconnu@univ.sn',
          poste_nom: poste.nom || 'Poste inconnu',
          voted_at: v.created_at
        };
      });

      setVoters(records);
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Impossible de charger la liste d'émargement.");
    } finally {
      setRegistryLoading(false);
    }
  };

  useEffect(() => {
    loadElections();
  }, [admin]);

  useEffect(() => {
    if (selectedElectionId) {
      loadVotersRegistry(selectedElectionId);
    }
  }, [selectedElectionId]);

  // Formatter la date
  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // Filtrer les électeurs
  const filteredVoters = voters.filter(v => {
    const query = searchTerm.toLowerCase();
    const fullName = `${v.student_prenom} ${v.student_nom}`.toLowerCase();
    return (
      fullName.includes(query) ||
      v.student_email.toLowerCase().includes(query) ||
      v.poste_nom.toLowerCase().includes(query)
    );
  });

  // Dédupliquer par email pour obtenir le nombre unique d'étudiants ayant voté
  const uniqueVoterEmails = new Set(voters.map(v => v.student_email.toLowerCase()));
  const totalUniqueVoters = uniqueVoterEmails.size;

  if (loading) {
    return (
      <div className="min-h-[40vh] flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 rounded-full border-2 border-uni-gold border-t-transparent animate-spin" />
        <p className="text-gray-400 text-xs">Chargement du module émargement...</p>
      </div>
    );
  }

  if (elections.length === 0) {
    return (
      <div className="glassmorphism p-8 rounded-2xl text-center space-y-4">
        <AlertCircle className="w-8 h-8 text-gray-500 mx-auto" />
        <h3 className="text-lg font-bold text-white">Aucune élection existante</h3>
        <p className="text-sm text-gray-400 max-w-sm mx-auto">
          Créez d'abord un scrutin pour pouvoir suivre ses émargements.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-extrabold text-white">Registre d'Émargement</h1>
          <p className="text-sm text-gray-400">Contrôlez les participations en temps réel. L'anonymat des bulletins reste protégé.</p>
        </div>

        <div className="w-full sm:w-auto">
          <select 
            value={selectedElectionId} 
            onChange={(e) => setSelectedElectionId(e.target.value)}
            className="w-full sm:w-64 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-uni-gold transition-all cursor-pointer font-semibold"
          >
            {elections.map(e => (
              <option key={e.id} value={e.id} className="bg-gray-900 text-white">
                {e.titre} ({e.statut})
              </option>
            ))}
          </select>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-uni-red/10 border border-uni-red/20 text-xs font-semibold text-uni-red-light flex gap-2.5 items-center">
          <AlertCircle className="w-4 h-4 text-uni-red-light" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Barre de recherche et stats rapides */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
        {/* Recherche */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-gray-500" />
          <input 
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Rechercher par nom, prénom ou email..."
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-uni-gold focus:ring-1 focus:ring-uni-gold transition-all"
          />
        </div>

        {/* Stats */}
        <div className="flex gap-4 items-center flex-wrap">
          <div className="bg-white/5 border border-white/10 px-4 py-2 rounded-xl text-xs flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-uni-gold" />
            <span className="text-gray-400">Total votants uniques :</span>
            <span className="text-white font-bold">{totalUniqueVoters}</span>
          </div>

          <div className="bg-white/5 border border-white/10 px-4 py-2 rounded-xl text-xs flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-green-400" />
            <span className="text-gray-400">Bulletins déposés :</span>
            <span className="text-white font-bold">{voters.length}</span>
          </div>
        </div>
      </div>

      {/* Registre table */}
      <div className="glassmorphism rounded-2xl border border-white/5 overflow-hidden">
        {registryLoading ? (
          <div className="p-12 text-center space-y-4">
            <div className="w-8 h-8 rounded-full border-2 border-uni-gold border-t-transparent animate-spin mx-auto" />
            <p className="text-gray-400 text-xs font-medium">Chargement de la feuille d'émargement...</p>
          </div>
        ) : filteredVoters.length === 0 ? (
          <div className="p-12 text-center text-gray-500 space-y-2">
            <Users className="w-8 h-8 text-gray-600 mx-auto" />
            <p className="text-sm font-semibold">Aucun émargement trouvé</p>
            <p className="text-xs text-gray-600">
              {searchTerm ? "Aucun étudiant ne correspond à cette recherche." : "Aucun bulletin n'a encore été déposé pour ce scrutin."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-400">
              <thead className="text-xs uppercase bg-white/5 text-gray-300 border-b border-white/5">
                <tr>
                  <th className="px-6 py-3.5">Nom complet</th>
                  <th className="px-6 py-3.5">Email universitaire</th>
                  <th className="px-6 py-3.5">Collège / Poste audité</th>
                  <th className="px-6 py-3.5">Date et Heure d'émargement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredVoters.map((v, i) => (
                  <tr key={i} className="hover:bg-white/1 transition-all">
                    <td className="px-6 py-4 text-white font-semibold">
                      {v.student_prenom} {v.student_nom}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs">{v.student_email}</td>
                    <td className="px-6 py-4 text-xs font-semibold text-uni-gold-light">
                      {v.poste_nom}
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-300 flex items-center gap-1.5 mt-0.5">
                      <Clock className="w-3.5 h-3.5 text-gray-500" />
                      {formatDateTime(v.voted_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
