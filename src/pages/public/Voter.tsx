import React, { useState, useEffect } from 'react';
import { useStudentAuth } from '../../context/StudentAuthContext';
import { supabase } from '../../lib/supabase';
import * as firestoreService from '../../lib/firestoreService';
import { useNavigate } from 'react-router-dom';
import { 
  Lock, 
  Vote as VoteIcon, 
  CheckCircle2, 
  AlertCircle, 
  User, 
  Info, 
  Clock, 
  Award,
  Sparkles,
  Check,
  ChevronRight
} from 'lucide-react';

interface Candidate {
  id: string;
  poste_id: string;
  nom: string;
  prenom: string;
  photo_url: string | null;
  slogan: string | null;
  programme: string | null;
}

interface Position {
  id: string;
  election_id: string;
  nom: string;
  description: string | null;
  ordre: number;
  candidats: Candidate[];
}

interface Election {
  id: string;
  titre: string;
  description: string | null;
  date_ouverture: string | null;
  date_fermeture: string | null;
  statut: 'brouillon' | 'ouverte' | 'fermee' | 'publiee';
}

export default function Voter() {
  const { student, openAuthModal } = useStudentAuth();
  const navigate = useNavigate();

  const [election, setElection] = useState<Election | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [votedPosteIds, setVotedPosteIds] = useState<string[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Candidat choisi pour le poste actuel
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>('');
  
  // Modals
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [simulating, setSimulating] = useState(false);

  // Charger les données du scrutin
  const loadVotingState = async () => {
    try {
      setLoading(true);
      setErrorMsg('');

      if (!student) {
        setElection(null);
        setPositions([]);
        setLoading(false);
        return;
      }

      // 1. Charger l'élection active pour l'amicale de l'étudiant
      const { data: elecData, error: elecErr } = await supabase
        .from('elections')
        .select('*')
        .eq('statut', 'ouverte')
        .eq('amicale_id', student.amicale_id)
        .limit(1)
        .maybeSingle();

      if (elecErr || !elecData) {
        setElection(null);
        setPositions([]);
        setLoading(false);
        return;
      }

      const electionData = elecData as Election;
      setElection(electionData);

      // 2. Charger tous les postes de l'élection avec leurs candidats
      const { data: postesData, error: postesErr } = await supabase
        .from('postes')
        .select('*')
        .eq('election_id', electionData.id)
        .order('ordre', { ascending: true });

      if (postesErr || !postesData) {
        setPositions([]);
        setLoading(false);
        return;
      }

      const allPositions = await Promise.all(
        postesData.map(async (pos) => {
          const { data: candsData, error: candsErr } = await supabase
            .from('candidats')
            .select('*')
            .eq('poste_id', pos.id);
          return { ...pos, candidats: candsData || [] };
        })
      );
      setPositions(allPositions as any);

      // 3. Charger la liste des postes déjà votés par l'étudiant connecté (Émargements)
      const { data: votedData, error: votedErr } = await supabase
        .from('emargements')
        .select('poste_id')
        .eq('student_id', student.id)
        .eq('election_id', electionData.id);

      if (!votedErr && votedData) {
        setVotedPosteIds(votedData.map(d => d.poste_id));
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Erreur lors du chargement des informations de vote.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVotingState();
  }, [student]);

  // Récupérer les postes non votés
  const remainingPositions = positions.filter(pos => !votedPosteIds.includes(pos.id));
  const activePosition = remainingPositions.length > 0 ? remainingPositions[0] : null;

  // Soumission du vote pour le poste actif
  const handleConfirmVote = async () => {
    if (!student || !election || !activePosition || !selectedCandidateId) return;
    setSubmitLoading(true);
    setErrorMsg('');

    try {
      const success = await firestoreService.submitVoteSecure(
        election.id,
        activePosition.id,
        selectedCandidateId,
        student.id
      );

      if (success) {
        // Vote enregistré avec succès, on nettoie la sélection et on recharge la liste d'émargement
        setSelectedCandidateId('');
        setShowConfirmModal(false);
        
        // Recharger le statut pour passer au poste suivant (Émargements)
        const { data: votedData, error: votedErr } = await supabase
          .from('emargements')
          .select('poste_id')
          .eq('student_id', student.id)
          .eq('election_id', election.id);
          
        if (!votedErr && votedData) {
          setVotedPosteIds(votedData.map(d => d.poste_id));
        }
      } else {
        setErrorMsg("Le serveur a refusé l'enregistrement du bulletin.");
        setShowConfirmModal(false);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Une erreur est survenue lors de l'envoi de votre vote.");
      setShowConfirmModal(false);
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleAutoVoteSimulation = async () => {
    if (simulating || !student || !election) return;
    setSimulating(true);
    setErrorMsg('');
    
    let currentVotedIds = [...votedPosteIds];
    let remaining = positions.filter(pos => !currentVotedIds.includes(pos.id));

    for (const activePos of remaining) {
      if (!activePos.candidats || activePos.candidats.length === 0) {
        currentVotedIds.push(activePos.id);
        setVotedPosteIds([...currentVotedIds]);
        continue;
      }

      // 1. Sélection visuelle du candidat
      const randomIndex = Math.floor(Math.random() * activePos.candidats.length);
      const cand = activePos.candidats[randomIndex];
      setSelectedCandidateId(cand.id);
      
      // Attendre 1,2 seconde pour laisser le temps de voir la sélection
      await new Promise(resolve => setTimeout(resolve, 1200));

      // 2. Affichage du modal de confirmation
      setShowConfirmModal(true);
      
      // Attendre 1,2 seconde sur l'écran de confirmation
      await new Promise(resolve => setTimeout(resolve, 1200));

      // 3. Validation et envoi du vote
      try {
        const success = await firestoreService.submitVoteSecure(
          election.id,
          activePos.id,
          cand.id,
          student.id
        );

        if (success) {
          setShowConfirmModal(false);
          setSelectedCandidateId('');
          
          currentVotedIds.push(activePos.id);
          setVotedPosteIds([...currentVotedIds]);
          
          // Pause d'une seconde avant de passer au poste suivant
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          setErrorMsg("La simulation a échoué lors de la soumission du vote.");
          setShowConfirmModal(false);
          setSelectedCandidateId('');
          break;
        }
      } catch (err: any) {
        console.error(err);
        setErrorMsg(err.message || "Erreur lors de la simulation.");
        setShowConfirmModal(false);
        setSelectedCandidateId('');
        break;
      }
    }
    setSimulating(false);
  };

  // Progression globale
  const totalPostes = positions.length;
  const votedCount = votedPosteIds.length;
  const progressPercent = totalPostes > 0 ? (votedCount / totalPostes) * 100 : 0;

  // 1. ÉTAT DE CHARGEMENT
  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-full border-4 border-uni-rose border-t-transparent animate-spin" />
        <p className="text-gray-400 font-display font-medium text-sm">Vérification de vos accès et récupération du bulletin...</p>
      </div>
    );
  }

  // 2. ÉTAT NON CONNECTÉ (Verrouillage d'accès)
  if (!student) {
    return (
      <div className="w-full max-w-2xl mx-auto py-12 px-4">
        <div className="glassmorphism p-10 rounded-3xl text-center space-y-6 relative overflow-hidden border border-white/5 shadow-2xl">
          <div className="absolute -right-16 -top-16 w-36 h-36 bg-uni-rose/5 rounded-full blur-2xl" />
          
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/5 text-uni-rose border border-white/10 shadow-inner">
            <Lock className="w-6 h-6 animate-pulse" />
          </div>
          
          <div className="space-y-2 max-w-md mx-auto">
            <h2 className="text-3xl font-display font-black text-white tracking-tight">Accès Sécurisé</h2>
            <p className="text-sm text-gray-400 leading-relaxed">
              Le bulletin de vote électronique est réservé aux étudiants identifiés sur la liste électorale. Veuillez vous connecter pour accéder à l'urne numérique.
            </p>
          </div>

          <div className="pt-4 flex justify-center">
            <button 
              onClick={openAuthModal}
              className="btn-gold px-8 py-3.5 flex items-center gap-2 cursor-pointer"
            >
              <User className="w-4 h-4" />
              <span>M'authentifier & Voter ⚡</span>
            </button>
          </div>

          <div className="border-t border-white/5 pt-6 text-[11px] text-gray-500 max-w-sm mx-auto">
            🔒 Vos choix électoraux restent anonymes. La feuille des émargements est dissociée des choix de bulletins.
          </div>
        </div>
      </div>
    );
  }

  // 3. ÉTAT AUCUNE ÉLECTION OUVERTE
  if (!election) {
    return (
      <div className="w-full max-w-2xl mx-auto py-12 px-4">
        <div className="glassmorphism p-10 rounded-3xl text-center space-y-6 border border-white/5 shadow-2xl">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/5 text-gray-400 border border-white/10">
            <Clock className="w-6 h-6" />
          </div>
          
          <div className="space-y-2">
            <h2 className="text-2xl font-display font-extrabold text-white">Aucun vote n'est ouvert actuellement</h2>
            <p className="text-sm text-gray-400 max-w-md mx-auto leading-relaxed">
              Il n'y a pas de scrutin actif ouvert pour le vote actuellement. Les périodes d'ouverture et fermeture sont planifiées par la commission électorale.
            </p>
          </div>

          <div className="pt-4">
            <button 
              onClick={() => navigate('/')}
              className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white font-semibold rounded-xl border border-white/10 transition-all text-sm cursor-pointer"
            >
              Retourner à l'accueil
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3.5. ÉTAT SCRUTIN PLANIFIÉ (Pas encore ouvert au vote)
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

  const isNotStarted = election.date_ouverture && new Date() < new Date(election.date_ouverture);
  if (isNotStarted) {
    return (
      <div className="w-full max-w-2xl mx-auto py-12 px-4">
        <div className="glassmorphism p-10 rounded-3xl text-center space-y-6 border border-white/5 shadow-2xl">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-uni-rose/10 text-uni-rose border border-uni-rose/20">
            <Clock className="w-6 h-6 animate-pulse" />
          </div>
          
          <div className="space-y-2">
            <h2 className="text-2xl font-display font-extrabold text-white">Le scrutin n'est pas encore ouvert</h2>
            <p className="text-sm text-gray-400 max-w-md mx-auto leading-relaxed">
              L'élection <strong>{election.titre}</strong> est actuellement visible pour consulter les candidats et les programmes, mais la période de vote commencera le :
            </p>
            <div className="p-3 bg-white/5 rounded-xl border border-white/5 text-uni-rose font-mono font-bold text-sm w-fit mx-auto mt-2">
              {formatDate(election.date_ouverture)}
            </div>
          </div>

          <div className="pt-4 flex gap-4 justify-center">
            <button 
              onClick={() => navigate('/candidats')}
              className="btn-gold px-6 py-3 text-sm cursor-pointer"
            >
              Découvrir les Candidats
            </button>
            <button 
              onClick={() => navigate('/')}
              className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white font-semibold rounded-xl border border-white/10 transition-all text-sm cursor-pointer"
            >
              Retourner à l'accueil
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 4. ÉTAT DÉJÀ VOTÉ TOUS LES POSTES (Confirmation finale de fin)
  if (remainingPositions.length === 0) {
    return (
      <div className="w-full max-w-2xl mx-auto py-12 px-4">
        <div className="glassmorphism p-10 rounded-3xl text-center space-y-6 border border-white/5 shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-green-500/5 to-transparent pointer-events-none" />
          
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 shadow-lg relative">
            <CheckCircle2 className="w-10 h-10" />
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-green-500"></span>
            </span>
          </div>
          
          <div className="space-y-3 max-w-md mx-auto">
            <span className="px-3 py-1 rounded-full bg-green-500/15 text-green-400 border border-green-500/20 text-[10px] font-bold uppercase tracking-wider">
              Scrutin Complété
            </span>
            <h2 className="text-3xl font-display font-black text-white tracking-tight">Merci, votre vote a bien été enregistré</h2>
            <p className="text-sm text-gray-400 leading-relaxed">
              Votre participation pour l'élection <strong>{election.titre}</strong> a été enregistrée de manière sécurisée et anonyme.
            </p>
          </div>

          <div className="bg-white/5 p-5 rounded-2xl max-w-md mx-auto text-xs text-gray-400 text-left border border-white/5 space-y-3">
            <div className="flex justify-between items-center border-b border-white/5 pb-2">
              <span className="text-gray-500 font-bold uppercase tracking-wider text-[10px]">Récapitulatif d'émargement :</span>
              <span className="text-green-400 font-bold text-xs">VOTÉ</span>
            </div>
            <div className="space-y-1.5 text-gray-300">
              <p>✔ Vous avez validé vos bulletins de vote pour les <strong>{totalPostes}</strong> postes de ce scrutin.</p>
              <p className="text-[11px] text-gray-400 italic">Pour des raisons de confidentialité, vos choix individuels ne sont pas réaffichés et ne peuvent pas être audités par un tiers pour éviter toute influence externe.</p>
            </div>
          </div>

          <div className="flex gap-4 justify-center pt-4">
            <button 
              onClick={() => navigate('/candidats')}
              className="px-5 py-3 bg-white/5 hover:bg-white/10 text-white font-semibold rounded-xl text-sm border border-white/10 transition-all cursor-pointer"
            >
              Découvrir les programmes
            </button>
            <button 
              onClick={() => navigate('/')}
              className="btn-gold px-5 py-3 text-sm cursor-pointer"
            >
              Aller à l'accueil
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 5. SCRUTIN EN COURS - VOTE POSTE PAR POSTE
  return (
    <div className="w-full max-w-4xl mx-auto py-4 px-4 space-y-6">
      
      {/* Barre de progression supérieure */}
      <div className="glassmorphism p-5 rounded-2xl border border-white/5 space-y-3 shadow-md">
        <div className="flex justify-between items-center text-xs font-semibold">
          <span className="text-gray-400">Progression du bulletin :</span>
          <span className="text-uni-rose">
            Poste {votedCount + 1} sur {totalPostes}
          </span>
        </div>
        <div className="h-2 bg-white/5 rounded-full overflow-hidden w-full relative border border-white/5">
          <div 
            className="h-full bg-gradient-to-r from-uni-rose to-uni-rose-light rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pt-2 border-t border-white/5">
          <p className="text-[10px] text-gray-400">
            {simulating ? "🤖 Simulation de vote en cours... Veuillez patienter." : "💡 Mode démo disponible : simulez automatiquement le vote pour tous les postes restants."}
          </p>
          <button
            type="button"
            onClick={handleAutoVoteSimulation}
            disabled={simulating || remainingPositions.length === 0}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold font-display transition-all cursor-pointer ${
              simulating
                ? 'bg-uni-rose/25 text-uni-rose cursor-wait animate-pulse border border-uni-rose/25'
                : 'bg-white/5 hover:bg-uni-rose/15 text-uni-rose border border-uni-rose/30 hover:border-uni-rose'
            }`}
          >
            {simulating ? "Simulation..." : "Simuler le vote (Auto) 🤖"}
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-uni-rose/10 border border-uni-rose/20 text-xs font-semibold text-uni-rose-light leading-relaxed flex gap-2.5 items-start">
          <AlertCircle className="w-4 h-4 shrink-0 text-uni-rose-light mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Poste Actuel */}
      {activePosition && (
        <div className="space-y-6">
          <div className="glassmorphism p-6 rounded-2xl border border-white/5 space-y-2">
            <span className="px-2.5 py-0.5 rounded-full bg-white/5 text-gray-400 border border-white/10 text-[9px] font-bold uppercase tracking-wider">
              Choix Électoral
            </span>
            <h2 className="text-2xl font-display font-black text-white">
              {activePosition.nom}
            </h2>
            {activePosition.description && (
              <p className="text-xs text-gray-400 leading-relaxed">
                {activePosition.description}
              </p>
            )}
          </div>

          {/* Grille des candidats pour ce poste */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activePosition.candidats.map(cand => {
              const isSelected = selectedCandidateId === cand.id;
              return (
                <div 
                  key={cand.id}
                  onClick={() => setSelectedCandidateId(cand.id)}
                  className={`glassmorphism rounded-2xl overflow-hidden cursor-pointer border transition-all flex flex-col group relative ${
                    isSelected 
                      ? 'border-uni-rose bg-uni-rose/5 shadow-lg shadow-uni-rose/5' 
                      : 'border-white/5 hover:border-white/20 hover:bg-white/5'
                  }`}
                >
                  {/* Photo */}
                  <div className="relative h-44 bg-white/5 flex items-center justify-center overflow-hidden border-b border-white/5">
                    {cand.photo_url ? (
                      <img 
                        src={cand.photo_url} 
                        alt={`${cand.prenom} ${cand.nom}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center border border-white/10 text-xl font-display font-bold text-gray-500">
                        {cand.prenom[0]}{cand.nom[0]}
                      </div>
                    )}

                    {isSelected && (
                      <div className="absolute top-3 right-3 bg-uni-rose text-white p-1.5 rounded-full shadow-lg border border-uni-rose-light">
                        <Check className="w-4 h-4 stroke-[3]" />
                      </div>
                    )}
                  </div>

                  {/* Détails */}
                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                    <div className="space-y-1">
                      <h4 className="font-bold text-white text-base truncate">
                        {cand.prenom} {cand.nom}
                      </h4>
                      {cand.slogan ? (
                        <p className="text-xs text-uni-rose-light font-medium italic line-clamp-2">
                          « {cand.slogan} »
                        </p>
                      ) : (
                        <p className="text-xs text-gray-500 italic">Aucun slogan renseigné</p>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCandidate(cand);
                        }}
                        className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-white font-semibold rounded-lg text-xs border border-white/5 transition-all cursor-pointer inline-flex items-center justify-center gap-1"
                      >
                        <Info className="w-3.5 h-3.5 text-gray-400" />
                        <span>Programme</span>
                      </button>

                      <button 
                        type="button"
                        onClick={() => setSelectedCandidateId(cand.id)}
                        className={`px-4 py-2 font-bold rounded-lg text-xs transition-all cursor-pointer ${
                          isSelected 
                            ? 'bg-uni-rose text-white' 
                            : 'bg-white/5 text-gray-300 hover:bg-white/10'
                        }`}
                      >
                        {isSelected ? 'Choisi' : 'Choisir'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Action de confirmation */}
          <div className="glassmorphism p-5 rounded-2xl border border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4 shadow-lg">
            <span className="text-xs text-gray-400">
              {selectedCandidateId 
                ? "Un candidat est sélectionné pour ce poste." 
                : "Veuillez sélectionner un candidat ci-dessus pour exprimer votre voix."}
            </span>
            
            <button
              onClick={() => {
                const cand = activePosition.candidats.find(c => c.id === selectedCandidateId);
                if (cand) {
                  setSelectedCandidate(null); // fermer programme si ouvert
                  setShowConfirmModal(true);
                }
              }}
              disabled={!selectedCandidateId}
              className={`px-6 py-3 rounded-xl font-display font-bold text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer ${
                selectedCandidateId 
                  ? 'btn-gold shadow-uni-rose/10' 
                  : 'bg-white/5 border border-white/10 text-gray-500 cursor-not-allowed'
              }`}
            >
              <VoteIcon className="w-4 h-4" />
              <span>Confirmer mon vote pour ce poste 🗳️</span>
            </button>
          </div>
        </div>
      )}

      {/* A. MODAL PROGRAMME CANDIDAT */}
      {selectedCandidate && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="glassmorphism w-full max-w-xl p-8 rounded-3xl space-y-6 relative border border-white/10 animate-in fade-in zoom-in-95 duration-200">
            <button 
              onClick={() => setSelectedCandidate(null)}
              className="absolute right-6 top-6 p-2 rounded-lg text-gray-400 hover:bg-white/5 hover:text-white transition-all cursor-pointer font-bold text-lg"
            >
              &times;
            </button>

            <div className="flex gap-4 items-center">
              {selectedCandidate.photo_url ? (
                <img 
                  src={selectedCandidate.photo_url} 
                  alt={`${selectedCandidate.prenom} ${selectedCandidate.nom}`}
                  className="w-16 h-16 rounded-full object-cover border border-uni-gold/20"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center border border-white/10 text-xl font-bold text-gray-500 font-display">
                  {selectedCandidate.prenom[0]}{selectedCandidate.nom[0]}
                </div>
              )}
              <div>
                <h3 className="text-xl font-bold text-white font-display">
                  {selectedCandidate.prenom} {selectedCandidate.nom}
                </h3>
                {selectedCandidate.slogan && (
                  <p className="text-xs text-uni-rose-light font-medium italic mt-0.5">
                    « {selectedCandidate.slogan} »
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2 border-t border-white/5 pt-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Programme Électoral</h4>
              <div className="text-sm text-gray-300 leading-relaxed bg-white/5 p-4 rounded-xl max-h-60 overflow-y-auto whitespace-pre-wrap">
                {selectedCandidate.programme || "Le candidat n'a pas rédigé de programme écrit."}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button 
                onClick={() => setSelectedCandidate(null)}
                className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white border border-white/15 text-xs font-semibold rounded-xl transition-all cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* B. MODAL DE CONFIRMATION INDIVIDUELLE */}
      {showConfirmModal && activePosition && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="glassmorphism w-full max-w-md p-8 rounded-3xl space-y-6 relative border border-uni-rose/25 shadow-2xl animate-fade-up">
            <div className="text-center space-y-3">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-uni-rose/15 text-uni-rose border border-uni-rose/25 mb-2">
                <VoteIcon className="w-5 h-5 text-uni-rose" />
              </div>
              <h3 className="text-xl font-display font-extrabold text-white">Confirmer votre choix</h3>
              <p className="text-xs text-gray-400 leading-relaxed max-w-xs mx-auto">
                Vous êtes sur le point de valider votre vote pour le poste de <strong>{activePosition.nom}</strong>.
              </p>
            </div>

            {/* Détails du candidat choisi */}
            {(() => {
              const cand = activePosition.candidats.find(c => c.id === selectedCandidateId);
              return cand ? (
                <div className="bg-white/5 p-4 rounded-xl border border-white/5 flex items-center gap-3">
                  {cand.photo_url ? (
                    <img 
                      src={cand.photo_url} 
                      alt={`${cand.prenom} ${cand.nom}`}
                      className="w-10 h-10 rounded-full object-cover border border-white/10"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10 font-bold text-xs text-gray-400">
                      {cand.prenom[0]}{cand.nom[0]}
                    </div>
                  )}
                  <div>
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Candidat choisi :</span>
                    <span className="text-sm font-bold text-white">{cand.prenom} {cand.nom}</span>
                  </div>
                </div>
              ) : null;
            })()}

            <div className="bg-uni-rose/5 border border-uni-rose/20 p-3 rounded-lg text-[10px] text-uni-rose-light leading-relaxed">
              ⚠ <strong>Vote Définitif</strong> : Une fois confirmé, votre bulletin pour ce poste est déposé et il est impossible de revenir en arrière ou d'annuler votre vote.
            </div>

            <div className="flex gap-3">
              <button 
                type="button" 
                onClick={() => setShowConfirmModal(false)}
                disabled={submitLoading}
                className="w-1/3 bg-white/5 hover:bg-white/10 text-white border border-white/15 font-semibold py-3 px-4 rounded-xl text-xs transition-all text-center cursor-pointer"
              >
                Annuler
              </button>
              <button 
                type="button"
                onClick={handleConfirmVote}
                disabled={submitLoading}
                className="w-2/3 btn-gold py-3 px-6 rounded-xl flex justify-center items-center cursor-pointer gap-1.5"
              >
                {submitLoading ? (
                  <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirmer mon vote</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
