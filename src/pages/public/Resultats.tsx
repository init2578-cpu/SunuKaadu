import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Award, 
  Users, 
  Percent, 
  Inbox, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  TrendingUp,
  BarChart3,
  Calendar,
  List,
  PieChart
} from 'lucide-react';
import ResultsChart from '../../components/ResultsChart';

interface Election {
  id: string;
  titre: string;
  description: string | null;
  date_ouverture: string | null;
  date_fermeture: string | null;
  statut: 'brouillon' | 'ouverte' | 'fermee' | 'publiee';
  amicale_id: string;
}

interface CandidateResult {
  id: string;
  nom: string;
  prenom: string;
  photo_url: string | null;
  slogan: string | null;
  votes_count: number;
  percentage: number;
  isWinner: boolean;
  isTie: boolean;
}

interface PositionResult {
  id: string;
  nom: string;
  description: string | null;
  total_votes: number;
  candidates: CandidateResult[];
}

export default function Resultats() {
  const [elections, setElections] = useState<Election[]>([]);
  const [selectedElectionId, setSelectedElectionId] = useState<string>('');
  const [selectedElection, setSelectedElection] = useState<Election | null>(null);
  
  const [positionResults, setPositionResults] = useState<PositionResult[]>([]);
  const [stats, setStats] = useState<{
    voters_count: number;
    total_students: number;
    participation_rate: number;
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [viewModes, setViewModes] = useState<Record<string, 'list' | 'bar' | 'doughnut'>>({});

  // Charger toutes les élections (sauf brouillon) pour le sélecteur public
  const loadElections = async () => {
    const selectedAmId = localStorage.getItem('selected_amicale_id');
    if (!selectedAmId) {
      setElections([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setErrorMsg('');

      const { data, error } = await supabase
        .from('elections')
        .select('*')
        .eq('amicale_id', selectedAmId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const list = (data || []) as Election[];

      const filteredList = list.filter(e => e.statut !== 'brouillon');
      setElections(filteredList);

      if (filteredList.length > 0) {
        setSelectedElectionId(filteredList[0].id);
        setSelectedElection(filteredList[0]);
      } else {
        setSelectedElectionId('');
        setSelectedElection(null);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Impossible de charger la liste des scrutins.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadElections();

    const handleAmicaleChanged = () => {
      loadElections();
    };
    window.addEventListener('amicale_changed', handleAmicaleChanged);

    return () => {
      window.removeEventListener('amicale_changed', handleAmicaleChanged);
    };
  }, []);

  // Charger les résultats et participation pour l'élection sélectionnée
  const loadElectionData = async (electionId: string) => {
    if (!electionId || !selectedElection) return;
    
    // Si l'élection est ouverte, on n'affiche pas de scores (pour ne pas influencer)
    if (selectedElection.statut === 'ouverte') {
      setPositionResults([]);
      setStats(null);
      return;
    }

    try {
      setResultsLoading(true);
      setErrorMsg('');

      // 1. Charger les postes de l'élection
      const { data: postesData, error: postesErr } = await supabase
        .from('postes')
        .select('*')
        .eq('election_id', electionId)
        .order('ordre', { ascending: true });

      if (postesErr) throw postesErr;

      // 2. Charger les candidats pour ces postes
      const posteIds = (postesData || []).map(p => p.id);
      let candidatsData: any[] = [];
      if (posteIds.length > 0) {
        const { data: candsData, error: candsErr } = await supabase
          .from('candidats')
          .select('*')
          .in('poste_id', posteIds);
        if (candsErr) throw candsErr;
        candidatsData = candsData || [];
      }

      // 3. Charger tous les votes de cette élection
      const { data: votesDocs, error: votesErr } = await supabase
        .from('votes')
        .select('*')
        .eq('election_id', electionId);

      if (votesErr) throw votesErr;

      // 4. Compter les votes par candidat
      const voteCounts: Record<string, number> = {};
      (votesDocs || []).forEach(v => {
        if (v.candidat_id) {
          voteCounts[v.candidat_id] = (voteCounts[v.candidat_id] || 0) + 1;
        }
      });

      // 5. Charger le nombre d'étudiants admissibles et calculer la participation unique
      const electionAmicaleId = selectedElection.amicale_id;
      const { count: totalStudents, error: studentsErr } = await supabase
        .from('students')
        .select('id', { count: 'exact', head: true })
        .eq('amicale_id', electionAmicaleId);

      if (studentsErr) throw studentsErr;

      const { data: emargementsDocs, error: emargementsErr } = await supabase
        .from('emargements')
        .select('student_id')
        .eq('election_id', electionId);

      if (emargementsErr) throw emargementsErr;

      const voterIds = new Set((emargementsDocs || []).map(d => d.student_id));
      const votersCount = voterIds.size;
      const totalStudentsCount = totalStudents || 0;
      const participationRate = totalStudentsCount > 0 ? (votersCount / totalStudentsCount) * 100 : 0;

      setStats({
        voters_count: votersCount,
        total_students: totalStudentsCount,
        participation_rate: parseFloat(participationRate.toFixed(1))
      });

      // Mappage des résultats par poste
      const results: PositionResult[] = (postesData || []).map((pos: any) => {
        const candidatesOfPoste = candidatsData.filter(c => c.poste_id === pos.id);
        const candidatesWithVotes = candidatesOfPoste.map((cand: any) => {
          const count = voteCounts[cand.id] || 0;
          return {
            id: cand.id,
            nom: cand.nom,
            prenom: cand.prenom,
            photo_url: cand.photo_url,
            slogan: cand.slogan,
            votes_count: count,
            percentage: 0,
            isWinner: false,
            isTie: false
          };
        });

        // Somme des voix
        const totalVotes = candidatesWithVotes.reduce((sum: number, c: any) => sum + c.votes_count, 0);

        // Calculer les pourcentages
        candidatesWithVotes.forEach((c: any) => {
          c.percentage = totalVotes > 0 ? parseFloat(((c.votes_count / totalVotes) * 100).toFixed(1)) : 0;
        });

        // Déterminer le/les gagnant(s)
        let maxVotes = 0;
        candidatesWithVotes.forEach((c: any) => {
          if (c.votes_count > maxVotes) {
            maxVotes = c.votes_count;
          }
        });

        if (maxVotes > 0) {
          const topCandidates = candidatesWithVotes.filter((c: any) => c.votes_count === maxVotes);
          if (topCandidates.length === 1) {
            // Un seul gagnant
            candidatesWithVotes.forEach((c: any) => {
              if (c.votes_count === maxVotes) c.isWinner = true;
            });
          } else if (topCandidates.length > 1) {
            // Égalité
            candidatesWithVotes.forEach((c: any) => {
              if (c.votes_count === maxVotes) c.isTie = true;
            });
          }
        }

        // Classer par voix décroissantes
        candidatesWithVotes.sort((a: any, b: any) => b.votes_count - a.votes_count);

        return {
          id: pos.id,
          nom: pos.nom,
          description: pos.description,
          total_votes: totalVotes,
          candidates: candidatesWithVotes
        };
      });

      setPositionResults(results);
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Une erreur est survenue lors de la récupération des scores.");
    } finally {
      setResultsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedElectionId) {
      const sel = elections.find(e => e.id === selectedElectionId);
      if (sel) {
        setSelectedElection(sel);
      }
    }
  }, [selectedElectionId, elections]);

  useEffect(() => {
    if (selectedElectionId && selectedElection) {
      loadElectionData(selectedElectionId);
    }
  }, [selectedElectionId, selectedElection]);

  const formatDate = (isoString: string | null) => {
    if (!isoString) return 'Non définie';
    const date = new Date(isoString);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-full border-4 border-uni-gold border-t-transparent animate-spin" />
        <p className="text-gray-400 font-display font-medium text-sm">Chargement des scrutins...</p>
      </div>
    );
  }

  if (elections.length === 0) {
    return (
      <div className="w-full max-w-2xl mx-auto py-12 px-4">
        <div className="glassmorphism p-10 rounded-3xl text-center space-y-6 border border-white/5 shadow-2xl">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/5 text-uni-gold border border-white/10">
            <Inbox className="w-6 h-6 animate-pulse" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-display font-extrabold text-white">Aucun résultat à afficher</h2>
            <p className="text-sm text-gray-400 max-w-md mx-auto leading-relaxed">
              Il n'y a pas d'élection en cours ni de scrutins clos disponibles pour le moment.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const isElectionOpen = selectedElection?.statut === 'ouverte';

  return (
    <div className="w-full max-w-4xl mx-auto py-6 px-4 space-y-8">
      {/* Sélecteur de scrutin */}
      <div className="glassmorphism p-8 rounded-3xl border border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-48 h-48 bg-uni-gold/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="space-y-2">
          <span className="text-xs text-uni-gold-light uppercase tracking-wider font-bold">Consulter les scores</span>
          <h1 className="text-3xl font-display font-black text-white tracking-tight">Résultats Électoraux</h1>
          {selectedElection && selectedElection.date_fermeture && (
            <p className="text-xs text-gray-400 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-gray-500" /> Clos le {formatDate(selectedElection.date_fermeture)}
            </p>
          )}
        </div>

        <div className="w-full md:w-auto">
          <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1.5">Choix du scrutin</label>
          <select 
            value={selectedElectionId} 
            onChange={(e) => setSelectedElectionId(e.target.value)}
            className="w-full md:w-64 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-uni-gold transition-all cursor-pointer font-semibold"
          >
            {elections.map(e => (
              <option key={e.id} value={e.id} className="bg-gray-900 text-white">
                {e.titre} {e.statut === 'ouverte' ? '(En cours ⚡)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-uni-red/10 border border-uni-red/20 text-xs font-semibold text-uni-red-light leading-relaxed flex gap-2.5 items-start">
          <AlertCircle className="w-4 h-4 shrink-0 text-uni-red-light mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* CAS 1 : ÉLECTION ACTUELLEMENT OUVERTE */}
      {isElectionOpen ? (
        <div className="glassmorphism p-10 rounded-3xl text-center space-y-6 border border-white/5 shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-uni-gold/5 to-transparent pointer-events-none" />
          
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/5 text-uni-gold border border-white/10 shadow-inner">
            <Clock className="w-6 h-6 animate-pulse" />
          </div>
          
          <div className="space-y-2 max-w-md mx-auto">
            <span className="px-2.5 py-0.5 rounded-full bg-uni-gold/20 text-uni-gold border border-uni-gold/30 text-[9px] font-bold uppercase tracking-wider">
              Scrutin Ouvert
            </span>
            <h2 className="text-2xl font-display font-extrabold text-white tracking-tight">Vote en cours</h2>
            <p className="text-sm text-gray-400 leading-relaxed">
              Les résultats seront disponibles à la clôture du vote. Les décomptes sont gelés afin de préserver la neutralité du scrutin et de ne pas influencer les électeurs.
            </p>
          </div>

          <div className="pt-2 text-xs text-gray-500">
            ⏰ Fin du scrutin prévue dans les horaires définis par l'administration.
          </div>
        </div>
      ) : resultsLoading ? (
        /* CAS 2 : CHARGEMENT DES RÉSULTATS */
        <div className="min-h-[30vh] flex flex-col items-center justify-center space-y-4">
          <div className="w-10 h-10 rounded-full border-2 border-uni-gold border-t-transparent animate-spin" />
          <p className="text-gray-400 text-xs font-medium">Récupération des données électorales...</p>
        </div>
      ) : (
        /* CAS 3 : SCRUTIN FERMÉ OU PUBLIÉ (AFFICHAGE) */
        <>
          {/* Taux de participation globale */}
          {stats && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="glassmorphism p-6 rounded-2xl border border-white/5 flex gap-4 items-center">
                <div className="w-12 h-12 rounded-xl bg-uni-gold/15 border border-uni-gold/25 flex items-center justify-center text-uni-gold">
                  <Percent className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-2xl font-black text-white">{stats.participation_rate.toFixed(2)}%</span>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">Participation globale</p>
                </div>
              </div>

              <div className="glassmorphism p-6 rounded-2xl border border-white/5 flex gap-4 items-center">
                <div className="w-12 h-12 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-400">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-2xl font-black text-white">{stats.voters_count}</span>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">Votants uniques</p>
                </div>
              </div>

              <div className="glassmorphism p-6 rounded-2xl border border-white/5 flex gap-4 items-center">
                <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-2xl font-black text-white">{stats.total_students}</span>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">Électeurs inscrits</p>
                </div>
              </div>
            </div>
          )}

          {/* Rendu des scores par Poste */}
          <div className="space-y-8">
            {positionResults.map((pos) => (
              <div key={pos.id} className="glassmorphism rounded-3xl border border-white/5 overflow-hidden shadow-lg">
                
                {/* En-tête du Poste */}
                <div className="p-6 border-b border-white/5 bg-white/2 flex justify-between items-center gap-4 flex-wrap no-print">
                  <div>
                    <h3 className="text-xl font-bold text-white font-display">{pos.nom}</h3>
                    {pos.description && (
                      <p className="text-xs text-gray-500 mt-0.5">{pos.description}</p>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-4">
                    {/* Selecteur de diagramme */}
                    <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 shrink-0 gap-1">
                      <button
                        onClick={() => setViewModes(prev => ({ ...prev, [pos.id]: 'list' }))}
                        className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                          (viewModes[pos.id] || 'list') === 'list'
                            ? 'bg-uni-gold text-gray-900 font-bold'
                            : 'text-gray-400 hover:text-white'
                        }`}
                        title="Vue en liste"
                      >
                        <List className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setViewModes(prev => ({ ...prev, [pos.id]: 'bar' }))}
                        className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                          viewModes[pos.id] === 'bar'
                            ? 'bg-uni-gold text-gray-900 font-bold'
                            : 'text-gray-400 hover:text-white'
                        }`}
                        title="Diagramme en barres"
                      >
                        <BarChart3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setViewModes(prev => ({ ...prev, [pos.id]: 'doughnut' }))}
                        className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                          viewModes[pos.id] === 'doughnut'
                            ? 'bg-uni-gold text-gray-900 font-bold'
                            : 'text-gray-400 hover:text-white'
                        }`}
                        title="Diagramme circulaire"
                      >
                        <PieChart className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="bg-white/5 px-3 py-1.5 rounded-xl border border-white/10 text-xs text-gray-300 font-semibold flex items-center gap-1.5 shrink-0">
                      <TrendingUp className="w-4 h-4 text-uni-gold" />
                      <span>{pos.total_votes} voix</span>
                    </div>
                  </div>
                </div>

                {/* Classement / Diagramme */}
                <div className="p-6">
                  {(viewModes[pos.id] || 'list') === 'list' ? (
                    <div className="space-y-5">
                      {pos.candidates.map((cand) => {
                        const isTop = cand.isWinner || cand.isTie;
                        return (
                          <div 
                            key={cand.id}
                            className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                              cand.isWinner 
                                ? 'border-uni-gold/30 bg-uni-gold/5 shadow-md' 
                                : cand.isTie
                                ? 'border-orange-500/20 bg-orange-500/5'
                                : 'border-white/5 bg-white/1'
                            }`}
                          >
                            {/* Infos Candidat */}
                            <div className="flex gap-4 items-center min-w-[240px]">
                              {cand.photo_url ? (
                                <img 
                                  src={cand.photo_url} 
                                  alt={`${cand.prenom} ${cand.nom}`}
                                  className="w-12 h-12 rounded-full object-cover border border-white/10 shrink-0"
                                />
                              ) : (
                                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center border border-white/10 font-bold text-gray-400 shrink-0">
                                  {cand.prenom[0]}{cand.nom[0]}
                                </div>
                              )}
                              <div className="space-y-0.5">
                                <h4 className="font-bold text-white text-sm flex items-center gap-2">
                                  {cand.prenom} {cand.nom}
                                  {cand.isWinner && (
                                    <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-uni-gold/25 text-uni-gold border border-uni-gold/30 text-[9px] font-bold">
                                      <Award className="w-2.5 h-2.5 fill-uni-gold" /> Gagnant
                                    </span>
                                  )}
                                  {cand.isTie && (
                                    <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/25 text-[9px] font-bold">
                                      Égalité
                                    </span>
                                  )}
                                </h4>
                                {cand.slogan && (
                                  <p className="text-[11px] text-gray-400 italic line-clamp-1">« {cand.slogan} »</p>
                                )}
                              </div>
                            </div>

                            {/* Histogramme (Progress Bar) */}
                            <div className="flex-1 max-w-lg space-y-1 md:px-4">
                              <div className="flex justify-between text-xs font-semibold">
                                <span className="text-gray-500">Avancement</span>
                                <span className={isTop ? cand.isWinner ? 'text-uni-gold' : 'text-orange-400' : 'text-gray-300'}>
                                  {cand.percentage}%
                                </span>
                              </div>
                              <div className="h-2.5 bg-white/5 rounded-full overflow-hidden w-full relative border border-white/5">
                                <div 
                                  className={`h-full rounded-full transition-all duration-700 ease-out ${
                                    cand.isWinner 
                                      ? 'bg-gradient-to-r from-uni-gold to-uni-gold-light' 
                                      : cand.isTie
                                      ? 'bg-gradient-to-r from-orange-500 to-orange-400'
                                      : 'bg-white/20'
                                  }`}
                                  style={{ width: `${cand.percentage}%` }}
                                />
                              </div>
                            </div>

                            {/* Décompte de voix */}
                            <div className="text-right shrink-0 md:min-w-[80px]">
                              <span className={`text-base font-black ${cand.isWinner ? 'text-uni-gold' : cand.isTie ? 'text-orange-400' : 'text-white'}`}>
                                {cand.votes_count}
                              </span>
                              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">voix</p>
                            </div>

                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <ResultsChart
                      candidates={pos.candidates}
                      totalVotes={pos.total_votes}
                      type={viewModes[pos.id] as 'bar' | 'doughnut'}
                    />
                  )}
                </div>

              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
