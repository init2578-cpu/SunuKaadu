import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAdminAuth } from '../../context/AdminAuthContext';

import { 
  Plus, 
  Edit2, 
  Trash2, 
  X, 
  Calendar, 
  CheckCircle, 
  Play, 
  Square, 
  Award, 
  Users, 
  PieChart, 
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  FolderOpen,
  Mail
} from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

interface Election {
  id: string;
  titre: string;
  description: string | null;
  date_ouverture: string | null;
  date_fermeture: string | null;
  statut: 'brouillon' | 'ouverte' | 'fermee' | 'publiee';
  created_by: string | null;
  created_at: string;
  amicale_id: string;
}

export default function Elections() {
  const { admin } = useAdminAuth();
  const [elections, setElections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Élection sélectionnée pour affichage des détails
  const [selectedElection, setSelectedElection] = useState<any | null>(null);
  const [stats, setStats] = useState<{
    postes_count: number;
    candidats_count: number;
    voters_count: number;
    total_students: number;
  } | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Formulaire modal
  const [showFormModal, setShowFormModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  
  // États des champs de l'élection
  const [titre, setTitre] = useState('');
  const [description, setDescription] = useState('');
  const [dateOuverture, setDateOuverture] = useState('');
  const [dateFermeture, setDateFermeture] = useState('');
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  // États additionnels pour super_admin
  const [amicales, setAmicales] = useState<any[]>([]);
  const [selectedAmicaleId, setSelectedAmicaleId] = useState('');
  const [amicaleFilter, setAmicaleFilter] = useState('');

  // Action error/success notifications
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  // Charger la liste des amicales (si super_admin)
  const fetchAmicales = async () => {
    try {
      const { data, error } = await supabase.from('amicales').select('*').order('nom', { ascending: true });
      if (error) throw error;
      setAmicales(data || []);
    } catch (e) {
      console.error("Erreur de chargement des amicales", e);
    }
  };

  // Charger la liste des élections
  const fetchElections = async () => {
    if (!admin) return;
    try {
      setLoading(true);
      let query = supabase.from('elections').select('*');
      if (admin.role !== 'super_admin' && admin.amicale_id) {
        query = query.eq('amicale_id', admin.amicale_id);
      }
      const { data: electionsData, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;

      // Pour chaque élection, charger la liste des postes associés
      const electionsWithPostes = await Promise.all(
        (electionsData || []).map(async (elec) => {
          const { data: postesList } = await supabase.from('postes').select('id').eq('election_id', elec.id);
          return { ...elec, postes: postesList || [] };
        })
      );
      setElections(electionsWithPostes || []);
    } catch (e: any) {
      console.error(e);
      setActionError(e.message || "Erreur de chargement des élections.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchElections();
    if (admin && admin.role === 'super_admin') {
      fetchAmicales();
    }
  }, [admin]);

  // La planification automatique des scrutins est gérée côté serveur
  // par pg_cron + Edge Function `auto-schedule-elections`.
  // Plus besoin d'intervalle côté navigateur.

  // Charger les stats de participation
  const loadElectionStats = async (electionId: string) => {
    try {
      setStatsLoading(true);
      setActionError('');
      setActionSuccess('');

      // 1. Récupérer les stats : postes, candidats, votes
      const { data: postes } = await supabase.from('postes').select('id').eq('election_id', electionId);
      const postesCount = postes?.length || 0;
      const posteIds = (postes || []).map(d => d.id);

      let candidatsCount = 0;
      if (posteIds.length > 0) {
        const { count: cCount } = await supabase.from('candidats').select('id', { count: 'exact', head: true }).in('poste_id', posteIds);
        candidatsCount = cCount || 0;
      }

      const { data: emargements } = await supabase.from('emargements').select('student_id').eq('election_id', electionId);
      const voterIds = new Set((emargements || []).map(d => d.student_id));
      const votersCount = voterIds.size;

      // 2. Compter le nombre total d'étudiants inscrits dans cette amicale
      const election = elections.find(e => e.id === electionId);
      const electionAmicaleId = election?.amicale_id || admin?.amicale_id;

      const { count: sCount } = await supabase.from('students').select('id', { count: 'exact', head: true }).eq('amicale_id', electionAmicaleId);
      const studentsCount = sCount || 0;

      setStats({
        postes_count: postesCount,
        candidats_count: candidatsCount,
        voters_count: votersCount,
        total_students: studentsCount
      });
    } catch (e: any) {
      console.error(e);
      setActionError("Impossible de charger les statistiques de l'élection.");
    } finally {
      setStatsLoading(false);
    }
  };

  // Sélectionner une élection
  const handleSelectElection = (election: any) => {
    setSelectedElection(election);
    loadElectionStats(election.id);
  };

  // Ouvrir modal de création
  const handleOpenCreate = () => {
    setModalMode('create');
    setTitre('');
    setDescription('');
    setDateOuverture('');
    setDateFermeture('');
    setSelectedAmicaleId(amicales[0]?.id || '');
    setFormError('');
    setShowFormModal(true);
  };

  // Ouvrir modal de modification
  const handleOpenEdit = (election: any) => {
    if (election.statut !== 'brouillon') {
      alert("Seules les élections au statut 'brouillon' peuvent être modifiées.");
      return;
    }
    setModalMode('edit');
    setTitre(election.titre || election.title || '');
    setDescription(election.description || '');
    setDateOuverture(election.date_ouverture ? election.date_ouverture.substring(0, 16) : '');
    setDateFermeture(election.date_fermeture ? election.date_fermeture.substring(0, 16) : '');
    setSelectedAmicaleId(election.amicale_id || '');
    setFormError('');
    setShowFormModal(true);
  };

  // Enregistrer (Créer ou Modifier)
  const handleSaveElection = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!titre.trim()) {
      setFormError('Le titre est obligatoire.');
      return;
    }

    const targetAmicaleId = admin?.role === 'super_admin' ? selectedAmicaleId : admin?.amicale_id;
    if (!targetAmicaleId) {
      setFormError("Veuillez sélectionner une amicale.");
      return;
    }

    setFormLoading(true);

    try {
      const payload: any = {
        titre: titre.trim(),
        description: description.trim() || null,
        date_ouverture: dateOuverture || null,
        date_fermeture: dateFermeture || null,
        amicale_id: targetAmicaleId
      };

      if (modalMode === 'edit' && selectedElection) {
        const { error } = await supabase.from('elections').update(payload).eq('id', selectedElection.id);
        if (error) throw error;
        setActionSuccess("L'élection a bien été modifiée.");
      } else {
        const { error } = await supabase.from('elections').insert([{
          ...payload,
          statut: 'brouillon',
          created_by: admin?.id || null
        }]);
        if (error) throw error;
        setActionSuccess("L'élection a bien été créée en tant que brouillon.");
      }

      setShowFormModal(false);
      setSelectedElection(null);
      setStats(null);
      fetchElections();
    } catch (err: any) {
      setFormError(err.message || "Erreur de sauvegarde.");
    } finally {
      setFormLoading(false);
    }
  };

  // Supprimer une élection
  const handleDeleteElection = async (electionId: string, title: string) => {
    if (!confirm(`Voulez-vous vraiment supprimer l'élection "${title}" ? Cette action est irréversible.`)) {
      return;
    }

    try {
      // Vérifier si des votes sont déjà enregistrés dans la table emargements
      const { count: voteCount } = await supabase
        .from('emargements')
        .select('id', { count: 'exact', head: true })
        .eq('election_id', electionId);

      if (voteCount && voteCount > 0) {
        setActionError("🚫 Impossible de supprimer cette élection : des votes ont déjà été enregistrés dans l'urne.");
        return;
      }

      const { error } = await supabase.from('elections').delete().eq('id', electionId);
      if (error) throw error;

      setActionSuccess("L'élection a été supprimée avec succès.");
      setSelectedElection(null);
      setStats(null);
      fetchElections();
    } catch (e: any) {
      console.error(e);
      setActionError(e.message || "Erreur lors de la suppression de l'élection.");
    }
  };

  // ─── Envoi des e-mails de vote (OTP électeurs + notification candidats) ────
  const sendVoteEmails = async (electionId: string, election?: any) => {
    try {
      const elec = election || selectedElection;
      if (!elec) return;

      const targetAmicaleId = elec.amicale_id || admin?.amicale_id;
      if (!targetAmicaleId) return;

      // Récupérer les étudiants + les candidats
      const [{ data: studentsSnap }, { data: postesData }] = await Promise.all([
        supabase.from('students').select('id, nom, prenom, email, matricule, numero_carte, filiere, promotion, amicale_id, is_activated, created_at').eq('amicale_id', targetAmicaleId).eq('is_activated', true),
        supabase.from('postes').select('id, nom').eq('election_id', electionId)
      ]);

      const expiresAt = elec.date_fermeture
        ? new Date(elec.date_fermeture).getTime()
        : Date.now() + 24 * 60 * 60 * 1000;

      let candidatesDocs: any[] = [];
      if (postesData && postesData.length > 0) {
        const posteIds = postesData.map((p: any) => p.id);
        const { data: candidatsSnap } = await supabase
          .from('candidats')
          .select('*, postes(nom)')
          .in('poste_id', posteIds);
        candidatesDocs = candidatsSnap || [];
      }

      let emailsSent = 0;
      let sandboxCount = 0;

      // ── E-mails étudiants (OTP) ─────────────────────────────────────────
      if (studentsSnap && studentsSnap.length > 0) {
        for (const student of studentsSnap) {
          const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

          // Stocker le code OTP dans la base
          await supabase.from('students').update({
            otp_code: otpCode,
            otp_expires_at: expiresAt
          }).eq('id', student.id);

          if (!student.email) continue;

          try {
            const { data: result, error: invokeErr } = await supabase.functions.invoke('send-vote-email', {
              body: {
                type: 'student',
                to: student.email,
                prenom: student.prenom,
                nom: student.nom,
                election_titre: elec.titre,
                otp_code: otpCode,
                date_fermeture: elec.date_fermeture || null,
              }
            });
            if (invokeErr) throw invokeErr;
            if (result?.sandbox_restriction) sandboxCount++;
            else emailsSent++;
          } catch (e) {
            console.error(`Erreur envoi e-mail étudiant ${student.email}:`, e);
          }
        }
      }

      // ── E-mails candidats (notification) ───────────────────────────────
      for (const candidat of candidatesDocs) {
        if (!candidat.email) continue;
        const posteNom = (candidat as any).postes?.nom ||
          postesData?.find((p: any) => p.id === candidat.poste_id)?.nom ||
          'Poste en compétition';

        try {
          const { data: result, error: invokeErr } = await supabase.functions.invoke('send-vote-email', {
            body: {
              type: 'candidat',
              to: candidat.email,
              prenom: candidat.prenom,
              nom: candidat.nom,
              election_titre: elec.titre,
              poste_nom: posteNom,
              date_fermeture: elec.date_fermeture || null,
            }
          });
          if (invokeErr) throw invokeErr;
          if (result?.sandbox_restriction) sandboxCount++;
          else emailsSent++;
        } catch (e) {
          console.error(`Erreur envoi e-mail candidat ${candidat.email}:`, e);
        }
      }

      return { emailsSent, sandboxCount, studentsCount: studentsSnap?.length || 0, candidatsCount: candidatesDocs.length };
    } catch (e: any) {
      console.error('sendVoteEmails error:', e);
      return null;
    }
  };

  // Statut Transition : Ouvrir le vote
  const handleOpenVote = async (electionId: string) => {
    setActionError('');
    setActionSuccess('');

    try {
      // 1. Vérification : y a-t-il au moins un poste avec au moins 2 candidats ?
      const { data: postesData } = await supabase.from('postes').select('id, nom').eq('election_id', electionId);

      let hasValidPoste = false;
      let candidatesDocs: any[] = [];
      if (postesData && postesData.length > 0) {
        const posteIds = postesData.map(p => p.id);
        const { data: candidatsSnap } = await supabase.from('candidats').select('*').in('poste_id', posteIds);

        candidatesDocs = candidatsSnap || [];
        const candidatsByPoste: Record<string, number> = {};
        candidatesDocs.forEach(c => {
          candidatsByPoste[c.poste_id] = (candidatsByPoste[c.poste_id] || 0) + 1;
        });
        hasValidPoste = Object.values(candidatsByPoste).some(count => count >= 2);
      }

      if (!hasValidPoste) {
        setActionError("🚫 Impossible d'ouvrir le vote : vous devez configurer au moins un poste contenant au moins 2 candidats déclarés.");
        return;
      }

      // 2. Vérification : y a-t-il déjà un scrutin au statut 'ouverte' dans cette amicale ?
      const { data: openSnap } = await supabase
        .from('elections')
        .select('titre, statut')
        .eq('amicale_id', selectedElection?.amicale_id)
        .eq('statut', 'ouverte');

      const alreadyOpen = openSnap && openSnap.length > 0 ? openSnap[0] : null;

      if (alreadyOpen) {
        setActionError(`🚫 Une élection est déjà ouverte en ce moment : "${alreadyOpen.titre}". Fermez-la avant d'ouvrir un nouveau scrutin.`);
        return;
      }

      // 3. Gestion de l'ouverture ou de la planification
      const hasFutureStartDate = selectedElection?.date_ouverture && new Date(selectedElection.date_ouverture) > new Date();

      if (hasFutureStartDate) {
        // L'élection est planifiée dans le futur, on ne l'ouvre pas maintenant.
        // Le script automatisé s'en chargera.
        setActionSuccess(`📅 Le scrutin est bien planifié. Le système automatisé enverra les codes secrets 5 minutes avant, et ouvrira le scrutin à l'heure prévue.`);
      } else {
        // Ouverture immédiate
        const updateData: any = { 
          statut: 'ouverte',
          date_ouverture: new Date().toISOString(),
          emails_envoyes: true // On marque les emails comme envoyés puisqu'on le fait manuellement
        };

        await supabase.from('elections').update(updateData).eq('id', electionId);

        // 4. Envoyer les e-mails manuellement
        const emailResult = await sendVoteEmails(electionId);

        const studentsCount = emailResult?.studentsCount || 0;
        const sandboxCount = emailResult?.sandboxCount || 0;
        const emailsSent = emailResult?.emailsSent || 0;

        setActionSuccess(`🗳️ Scrutin OUVERT ! ${emailsSent} e-mail(s) envoyé(s) avec le code OTP${sandboxCount > 0 ? ` (${sandboxCount} restreint(s) par Sandbox)` : ''}.`);
      }

      // Recharger l'élection sélectionnée
      const { data: reloadedSnap } = await supabase.from('elections').select('*').eq('id', electionId).single();
      if (reloadedSnap) {
        const { data: reloadedPostesSnap } = await supabase.from('postes').select('id').eq('election_id', electionId);
        setSelectedElection({ ...reloadedSnap, postes: reloadedPostesSnap || [] });
        loadElectionStats(electionId);
      }
      fetchElections();
    } catch (e: any) {
      console.error(e);
      setActionError(e.message || "Erreur lors de l'ouverture du scrutin.");
    }
  };

  // Statut Transition : Fermer le vote
  const handleCloseVote = async (electionId: string) => {
    setActionError('');
    setActionSuccess('');

    try {
      await supabase.from('elections').update({
        statut: 'fermee',
        date_fermeture: new Date().toISOString()
      }).eq('id', electionId);

      setActionSuccess("🔒 Le scrutin est désormais CLOS. Les votes ne sont plus acceptés.");
      
      const { data: reloadedSnap } = await supabase.from('elections').select('*').eq('id', electionId).single();
      if (reloadedSnap) {
        const { data: reloadedPostesSnap } = await supabase.from('postes').select('id').eq('election_id', electionId);
        setSelectedElection({ ...reloadedSnap, postes: reloadedPostesSnap || [] });
        loadElectionStats(electionId);
      }
      fetchElections();
    } catch (e: any) {
      console.error(e);
      setActionError(e.message || "Erreur lors de la clôture.");
    }
  };

  // Statut Transition : Rouvrir le vote
  const handleReopenVote = async (electionId: string) => {
    setActionError('');
    setActionSuccess('');

    try {
      // Vérification : y a-t-il déjà un scrutin au statut 'ouverte' dans cette amicale ?
      const { data: openSnap } = await supabase
        .from('elections')
        .select('titre, statut')
        .eq('amicale_id', selectedElection?.amicale_id)
        .eq('statut', 'ouverte');

      const alreadyOpen = openSnap && openSnap.length > 0 ? openSnap[0] : null;

      if (alreadyOpen) {
        setActionError(`🚫 Une élection est déjà ouverte en ce moment : "${alreadyOpen.titre}". Fermez-la avant d'ouvrir ou de rouvrir un scrutin.`);
        return;
      }

      await supabase.from('elections').update({
        statut: 'ouverte',
        date_fermeture: null
      }).eq('id', electionId);

      // Renvoyer les e-mails avec de nouveaux codes OTP lors d'une réouverture
      const emailResult = await sendVoteEmails(electionId);
      const emailsSent = emailResult?.emailsSent || 0;
      const sandboxCount = emailResult?.sandboxCount || 0;

      setActionSuccess(`🔓 Scrutin rouvert ! ${emailsSent} e-mail(s) renvoyé(s) avec un nouveau code OTP${sandboxCount > 0 ? ` (${sandboxCount} restreint(s) par Sandbox)` : ''}.`);

      const { data: reloadedSnap } = await supabase.from('elections').select('*').eq('id', electionId).single();
      if (reloadedSnap) {
        const { data: reloadedPostesSnap } = await supabase.from('postes').select('id').eq('election_id', electionId);
        setSelectedElection({ ...reloadedSnap, postes: reloadedPostesSnap || [] });
        loadElectionStats(electionId);
      }
      fetchElections();
    } catch (e: any) {
      console.error(e);
      setActionError(e.message || "Erreur lors de la réouverture du scrutin.");
    }
  };

  // Statut Transition : Publier les résultats
  const handlePublishResults = async (electionId: string) => {
    setActionError('');
    setActionSuccess('');

    try {
      await supabase.from('elections').update({ statut: 'publiee' }).eq('id', electionId);

      setActionSuccess("🎉 Les résultats sont désormais PUBLICS et accessibles à tous sur le portail étudiant.");
      
      const { data: reloadedSnap } = await supabase.from('elections').select('*').eq('id', electionId).single();
      if (reloadedSnap) {
        const { data: reloadedPostesSnap } = await supabase.from('postes').select('id').eq('election_id', electionId);
        setSelectedElection({ ...reloadedSnap, postes: reloadedPostesSnap || [] });
        loadElectionStats(electionId);
      }
      fetchElections();
    } catch (e: any) {
      console.error(e);
      setActionError(e.message || "Erreur de publication.");
    }
  };

  // Formatter la date
  const formatDate = (isoString: string | null) => {
    if (!isoString) return 'Non définie';
    const date = new Date(isoString);
    return date.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Badge du statut
  const renderStatusBadge = (election: any) => {
    switch (election.statut) {
      case 'ouverte':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Ouverte
          </span>
        );
      case 'fermee':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-uni-red/15 text-uni-red-light border border-uni-red/25">
            Fermée
          </span>
        );
      case 'publiee':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-500/15 text-purple-400 border border-purple-500/25">
            Publiée
          </span>
        );
      default:
        if (election.date_ouverture && new Date(election.date_ouverture) > new Date()) {
          return (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/15 text-blue-400 border border-blue-500/25 flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Planifiée
            </span>
          );
        }
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/5 text-gray-400 border border-white/10">
            Brouillon
          </span>
        );
    }
  };

  const filteredElections = elections.filter((election) => {
    if (admin?.role === 'super_admin' && amicaleFilter) {
      return election.amicale_id === amicaleFilter;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-extrabold text-white">Gestion des Élections</h1>
          <p className="text-sm text-gray-400">Définissez et pilotez les scrutins de l'amicale.</p>
        </div>
        <button 
          onClick={handleOpenCreate}
          className="flex items-center gap-2 bg-uni-gold hover:bg-uni-gold-light text-uni-green-dark font-display font-bold text-sm py-2.5 px-5 rounded-xl transition-all shadow-md cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Créer une Élection</span>
        </button>
      </div>

      {/* Filter Bar for Super Admin */}
      {admin?.role === 'super_admin' && amicales.length > 0 && (
        <div className="glassmorphism p-4 rounded-2xl flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 w-full md:w-auto">
            <span className="text-xs text-gray-400 font-semibold mr-1">Filtrer par Amicale :</span>
            <select
              value={amicaleFilter}
              onChange={(e) => setAmicaleFilter(e.target.value)}
              className="bg-transparent text-xs text-gray-300 font-medium focus:outline-none border-none pr-6 cursor-pointer"
            >
              <option value="" className="bg-gray-900 text-white">Toutes les Amicales</option>
              {amicales.map(a => (
                <option key={a.id} value={a.id} className="bg-gray-900 text-white">{a.nom}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Message Notifications */}
      {actionError && (
        <div className="p-4 rounded-xl bg-uni-red/10 border border-uni-red/20 text-sm font-semibold text-uni-red-light flex items-center gap-2.5">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}
      {actionSuccess && (
        <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-sm font-semibold text-green-400 flex items-center gap-2.5">
          <CheckCircle className="w-5 h-5 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Elections list */}
        <div className="lg:col-span-2 space-y-4">
          {loading ? (
            <div className="glassmorphism p-12 flex flex-col items-center justify-center rounded-2xl">
              <div className="w-8 h-8 rounded-full border-4 border-uni-gold border-t-transparent animate-spin mb-3" />
              <p className="text-sm text-gray-400">Chargement des élections...</p>
            </div>
          ) : filteredElections.length === 0 ? (
            <div className="glassmorphism p-12 text-center text-gray-500 rounded-2xl">
              Aucune élection trouvée pour les critères sélectionnés.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredElections.map((election) => {
                const isSelected = selectedElection?.id === election.id;
                const amicaleName = amicales.find(a => a.id === election.amicale_id)?.nom || 'Amicale';
                return (
                  <div 
                    key={election.id}
                    onClick={() => handleSelectElection(election)}
                    className={`glassmorphism p-5 rounded-2xl cursor-pointer transition-all hover:scale-[1.005] ${
                      isSelected ? 'border-uni-gold bg-uni-card-hover ring-1 ring-uni-gold/30' : 'hover:border-white/10'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <h3 className="text-lg font-display font-bold text-white leading-snug flex items-center gap-2 flex-wrap">
                          <span className="truncate">{election.title || election.titre}</span>
                          {admin?.role === 'super_admin' && (
                            <span className="px-2 py-0.5 rounded bg-uni-gold/10 text-uni-gold border border-uni-gold/20 text-[9px] font-bold uppercase tracking-wider shrink-0">
                              {amicaleName}
                            </span>
                          )}
                        </h3>
                        <p className="text-xs text-gray-400 mt-1 line-clamp-1">{election.description || 'Sans description'}</p>
                      </div>
                      {renderStatusBadge(election)}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-4 pt-4 border-t border-white/5 text-xs text-gray-400">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-uni-gold" />
                        <span>Ouverture: {formatDate(election.date_ouverture)}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Square className="w-3.5 h-3.5 text-uni-gold" />
                        <span>Postes: {election.postes?.length || 0}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Detail Panel */}
        <div className="space-y-6">
          {selectedElection ? (
            <div className="glassmorphism p-6 rounded-3xl space-y-6 sticky top-24">
              <div>
                <span className="text-xs font-bold text-uni-gold uppercase tracking-wider">Scrutin Sélectionné</span>
                <h2 className="text-xl font-display font-extrabold text-white mt-1 leading-snug">
                  {selectedElection.title || selectedElection.titre}
                </h2>
                <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                  {selectedElection.description || "Aucune description renseignée."}
                </p>
              </div>

              {/* LIVE STATS SUMMARY */}
              <div className="bg-white/3 border border-white/5 rounded-2xl p-4 space-y-3.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-uni-gold" />
                  <span>Statistiques en Direct</span>
                </h4>
                
                {statsLoading ? (
                  <div className="py-6 flex flex-col items-center justify-center">
                    <div className="w-5 h-5 rounded-full border-2 border-uni-gold border-t-transparent animate-spin mb-2" />
                    <span className="text-[10px] text-gray-500">Calcul...</span>
                  </div>
                ) : stats ? (
                  <div className="space-y-3 font-mono text-xs">
                    <div className="flex justify-between text-gray-400">
                      <span>Postes à pourvoir :</span>
                      <span className="text-white font-bold">{stats.postes_count}</span>
                    </div>
                    <div className="flex justify-between text-gray-400">
                      <span>Candidats en lice :</span>
                      <span className="text-white font-bold">{stats.candidats_count}</span>
                    </div>
                    <div className="flex justify-between text-gray-400 border-t border-white/5 pt-2">
                      <span>Émargements (Votes) :</span>
                      <span className="text-white font-bold">{stats.voters_count} / {stats.total_students}</span>
                    </div>
                    <div className="space-y-1 pt-1.5">
                      <div className="flex justify-between font-sans text-xs font-semibold text-uni-gold">
                        <span>Taux de participation :</span>
                        <span>
                          {stats.total_students > 0 
                            ? ((stats.voters_count / stats.total_students) * 100).toFixed(1)
                            : 0}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-uni-gold rounded-full transition-all duration-500" 
                          style={{ 
                            width: `${stats.total_students > 0 ? (stats.voters_count / stats.total_students) * 100 : 0}%` 
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-[10px] text-gray-500 text-center py-4">Erreur de chargement des stats.</p>
                )}
              </div>

              {/* ACTION BUTTONS DEPENDING ON STATUS */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">Actions administratives</h4>

                <Link 
                  to={`/admin/elections/${selectedElection.id}/postes`}
                  className="w-full bg-uni-gold hover:bg-uni-gold-light text-uni-green-dark font-display font-bold py-2.5 px-4 rounded-xl flex justify-center items-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99] text-center"
                >
                  <Award className="w-4 h-4" />
                  <span>Postes & Candidats 🏆</span>
                </Link>
                
                {selectedElection.statut === 'brouillon' && (
                  <>
                    <button 
                      onClick={() => handleOpenVote(selectedElection.id)}
                      className="w-full bg-uni-green hover:bg-uni-green-light text-white font-display font-bold py-2.5 px-4 rounded-xl flex justify-center items-center gap-2 cursor-pointer transition-all active:scale-[0.98]"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>
                        {selectedElection.date_ouverture && new Date(selectedElection.date_ouverture) > new Date()
                          ? "Activer & Planifier 📅"
                          : "Ouvrir le vote 🗳️"}
                      </span>
                    </button>
                    
                    <button 
                      onClick={() => handleOpenEdit(selectedElection)}
                      className="w-full bg-white/5 hover:bg-white/10 text-white font-semibold py-2.5 px-4 rounded-xl border border-uni-border flex justify-center items-center gap-2 cursor-pointer transition-all"
                    >
                      <Edit2 className="w-4 h-4" />
                      <span>Modifier les détails</span>
                    </button>

                    <button 
                      onClick={() => handleDeleteElection(selectedElection.id, selectedElection.title || selectedElection.titre)}
                      className="w-full bg-uni-red/10 hover:bg-uni-red/20 text-uni-red-light font-semibold py-2.5 px-4 rounded-xl border border-uni-red/20 flex justify-center items-center gap-2 cursor-pointer transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Supprimer l'élection</span>
                    </button>
                  </>
                )}

                {selectedElection.statut === 'ouverte' && (
                  <button 
                    onClick={() => handleCloseVote(selectedElection.id)}
                    className="w-full bg-uni-red hover:bg-uni-red-light text-white font-display font-bold py-2.5 px-4 rounded-xl flex justify-center items-center gap-2 cursor-pointer transition-all active:scale-[0.98]"
                  >
                    <Square className="w-4 h-4 fill-current" />
                    <span>Fermer le vote 🔒</span>
                  </button>
                )}

                {selectedElection.statut === 'fermee' && (
                  <div className="space-y-3">
                    <button 
                      onClick={() => handlePublishResults(selectedElection.id)}
                      className="w-full bg-purple-600 hover:bg-purple-500 text-white font-display font-bold py-2.5 px-4 rounded-xl flex justify-center items-center gap-2 cursor-pointer transition-all active:scale-[0.98]"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>Publier les résultats 📢</span>
                    </button>
                    <button 
                      onClick={() => handleReopenVote(selectedElection.id)}
                      className="w-full bg-uni-gold/10 hover:bg-uni-gold/20 text-uni-gold font-display font-bold py-2.5 px-4 rounded-xl border border-uni-gold/20 flex justify-center items-center gap-2 cursor-pointer transition-all active:scale-[0.98]"
                    >
                      <Play className="w-4 h-4" />
                      <span>Rouvrir le vote 🔓</span>
                    </button>
                  </div>
                )}

                {selectedElection.statut === 'publiee' && (
                  <div className="p-3.5 rounded-xl bg-white/3 border border-white/5 text-center text-xs text-gray-500">
                    🎉 Scrutin clôturé et publié. Les résultats sont en ligne.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="glassmorphism p-8 rounded-3xl text-center text-gray-500 space-y-2">
              <FolderOpen className="w-10 h-10 text-gray-600 mx-auto" />
              <h4 className="text-sm font-bold text-white">Aucune Sélection</h4>
              <p className="text-xs">Sélectionnez une élection pour voir ses statistiques en direct et gérer son statut.</p>
            </div>
          )}
        </div>
      </div>

      {/* FORM MODAL (Créer ou Modifier) */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="glassmorphism w-full max-w-md p-8 rounded-3xl space-y-6 relative shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <button 
              onClick={() => setShowFormModal(false)}
              className="absolute right-6 top-6 p-2 rounded-lg text-gray-400 hover:bg-white/5 hover:text-white transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <h3 className="text-xl font-display font-extrabold text-white">
                {modalMode === 'edit' ? "Modifier l'Élection" : "Créer une Élection"}
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                Les scrutins créés sont initialement au statut "Brouillon".
              </p>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-uni-red/10 border border-uni-red/20 text-xs font-semibold text-uni-red-light text-center leading-relaxed">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveElection} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 block">Titre du Scrutin</label>
                <input 
                  type="text" 
                  value={titre}
                  onChange={(e) => setTitre(e.target.value)}
                  disabled={formLoading}
                  placeholder="Ex: Élection du Bureau de l'Amicale 2026"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-uni-gold"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 block">Description / Renseignements</label>
                <textarea 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={formLoading}
                  placeholder="Ex: Votez pour élire les 3 postes clés..."
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-uni-gold resize-none"
                />
              </div>

              {/* Choix de l'amicale si super_admin */}
              {admin?.role === 'super_admin' && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 block">Amicale *</label>
                  <select
                    value={selectedAmicaleId}
                    onChange={(e) => setSelectedAmicaleId(e.target.value)}
                    disabled={formLoading}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-uni-gold cursor-pointer"
                  >
                    <option value="" className="bg-gray-900 text-white">Sélectionner une amicale</option>
                    {amicales.map(a => (
                      <option key={a.id} value={a.id} className="bg-gray-900 text-white">{a.nom}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 block">Date d'Ouverture théorique</label>
                  <input 
                    type="datetime-local" 
                    value={dateOuverture}
                    onChange={(e) => setDateOuverture(e.target.value)}
                    disabled={formLoading}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-uni-gold"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 block">Date de Clôture théorique</label>
                  <input 
                    type="datetime-local" 
                    value={dateFermeture}
                    onChange={(e) => setDateFermeture(e.target.value)}
                    disabled={formLoading}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-uni-gold"
                  />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={formLoading}
                className="w-full bg-uni-gold hover:bg-uni-gold-light text-uni-green-dark font-display font-bold py-3 px-6 rounded-xl transition-all flex justify-center items-center cursor-pointer mt-4"
              >
                {formLoading ? (
                  <div className="w-5 h-5 rounded-full border-2 border-uni-green-dark border-t-transparent animate-spin" />
                ) : (
                  <span>Enregistrer l'élection 🚀</span>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
