import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { 
  Award, 
  Users, 
  Percent, 
  AlertCircle, 
  TrendingUp, 
  Calendar,
  Lock,
  Eye,
  EyeOff,
  CheckCircle,
  FileText,
  List,
  PieChart,
  BarChart3
} from 'lucide-react';
import ResultsChart from '../../components/ResultsChart';
import VoteEvolutionChart from '../../components/VoteEvolutionChart';
import GlobalTurnoutChart from '../../components/GlobalTurnoutChart';

interface Election {
  id: string;
  titre: string;
  description: string | null;
  date_ouverture: string | null;
  date_fermeture: string | null;
  statut: 'brouillon' | 'ouverte' | 'fermee' | 'publiee';
  amicale_id: string;
  created_at?: string;
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
}

interface PositionResult {
  id: string;
  nom: string;
  description: string | null;
  total_votes: number;
  candidates: CandidateResult[];
}

export default function ResultatsAdmin() {
  const { admin } = useAdminAuth();
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
  const [votes, setVotes] = useState<any[]>([]);
  const [emargementTimestamps, setEmargementTimestamps] = useState<number[]>([]);

  // Charger toutes les élections existantes pour l'admin
  const loadAllElections = async () => {
    if (!admin) return;
    try {
      setLoading(true);
      setErrorMsg('');

      let queryBuilder = supabase
        .from('elections')
        .select('*');
      
      if (admin.role !== 'super_admin' && admin.amicale_id) {
        queryBuilder = queryBuilder.eq('amicale_id', admin.amicale_id);
      }
      
      const { data: snapDocs, error: err } = await queryBuilder;
      if (err) throw err;

      const list = (snapDocs || []) as Election[];
      list.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
      setElections(list);

      if (list.length > 0) {
        setSelectedElectionId(list[0].id);
        setSelectedElection(list[0]);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Impossible de charger la liste des scrutins.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllElections();
  }, [admin]);

  // Charger les résultats pour l'élection sélectionnée
  const loadElectionResults = async (electionId: string) => {
    if (!electionId) return;
    try {
      setResultsLoading(true);
      setErrorMsg('');

      // 1. Charger les postes (tri local pour éviter l'erreur d'index composite)
      const { data: postesDocs, error: postErr } = await supabase
        .from('postes')
        .select('*')
        .eq('election_id', electionId);
      if (postErr) throw postErr;

      let postesData = (postesDocs || []) as any[];
      // Tri local
      postesData.sort((a, b) => (a.ordre || 0) - (b.ordre || 0));

      // 2. Charger les candidats pour ces postes
      const posteIds = postesData.map(p => p.id);
      let candidatsData: any[] = [];
      if (posteIds.length > 0) {
        const { data: candDocs, error: candErr } = await supabase
          .from('candidats')
          .select('*')
          .in('poste_id', posteIds);
        if (candErr) throw candErr;
        candidatsData = candDocs || [];
      }

      // 3. Charger tous les votes de cette élection
      const { data: votesDocs, error: votesErr } = await supabase
        .from('votes')
        .select('candidat_id, created_at')
        .eq('election_id', electionId);
      if (votesErr) throw votesErr;

      setVotes(votesDocs || []);

      // 4. Compter les votes par candidat
      const voteCounts: Record<string, number> = {};
      (votesDocs || []).forEach(v => {
        if (v.candidat_id) {
          voteCounts[v.candidat_id] = (voteCounts[v.candidat_id] || 0) + 1;
        }
      });

      // 5. Charger le nombre total d'étudiants inscrits et calculer la participation unique
      const election = elections.find(e => e.id === electionId);
      const electionAmicaleId = election?.amicale_id || admin?.amicale_id;
      
      let studentQuery = supabase
        .from('students')
        .select('id', { count: 'exact', head: true });
      if (electionAmicaleId) {
        studentQuery = studentQuery.eq('amicale_id', electionAmicaleId);
      }
      const { count: studentCount, error: studErr } = await studentQuery;
      if (studErr) throw studErr;
      const totalStudents = studentCount || 0;

      const { data: emargementsDocs, error: emErr } = await supabase
        .from('emargements')
        .select('student_id, created_at')
        .eq('election_id', electionId);
      if (emErr) throw emErr;

      const studentFirstVoteTime: Record<string, number> = {};
      (emargementsDocs || []).forEach(d => {
        const time = new Date(d.created_at).getTime();
        if (!studentFirstVoteTime[d.student_id] || time < studentFirstVoteTime[d.student_id]) {
          studentFirstVoteTime[d.student_id] = time;
        }
      });
      const sortedTimestamps = Object.values(studentFirstVoteTime).sort((a, b) => a - b);
      setEmargementTimestamps(sortedTimestamps);

      const voterIds = new Set((emargementsDocs || []).map(d => d.student_id));
      const votersCount = voterIds.size;
      const participationRate = totalStudents > 0 ? (votersCount / totalStudents) * 100 : 0;

      setStats({
        voters_count: votersCount,
        total_students: totalStudents,
        participation_rate: participationRate
      });

      // Mappage
      const results: PositionResult[] = postesData.map((pos: any) => {
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
            isWinner: false
          };
        });

        const totalVotes = candidatesWithVotes.reduce((sum: number, c: any) => sum + c.votes_count, 0);

        candidatesWithVotes.forEach((c: any) => {
          c.percentage = totalVotes > 0 ? parseFloat(((c.votes_count / totalVotes) * 100).toFixed(1)) : 0;
        });

        let maxVotes = 0;
        candidatesWithVotes.forEach((c: any) => {
          if (c.votes_count > maxVotes) {
            maxVotes = c.votes_count;
          }
        });

        if (maxVotes > 0) {
          const winners = candidatesWithVotes.filter((c: any) => c.votes_count === maxVotes);
          if (winners.length === 1) {
            candidatesWithVotes.forEach((c: any) => {
              if (c.votes_count === maxVotes) c.isWinner = true;
            });
          }
        }

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
      setErrorMsg("Impossible de calculer les scores pour cette élection.");
    } finally {
      setResultsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedElectionId) {
      loadElectionResults(selectedElectionId);
      const sel = elections.find(e => e.id === selectedElectionId);
      if (sel) setSelectedElection(sel);
    }
  }, [selectedElectionId, elections]);

  const handlePublishResults = async (electionId: string) => {
    try {
      setErrorMsg('');
      const { error } = await supabase
        .from('elections')
        .update({ statut: 'publiee' })
        .eq('id', electionId);

      if (error) throw error;

      // Mettre à jour l'état local pour refléter le changement
      setElections(prev => prev.map(e => e.id === electionId ? { ...e, statut: 'publiee' } : e));
      setSelectedElection(prev => prev && prev.id === electionId ? { ...prev, statut: 'publiee' } : prev);
      
      alert("🎉 Les résultats de l'élection ont été publiés avec succès ! Ils sont maintenant visibles sur le portail public.");
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Erreur lors de la publication des résultats.");
    }
  };

  const formatDate = (isoString: string | null) => {
    if (!isoString) return 'Non définie';
    const date = new Date(isoString);
    return date.toLocaleString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'brouillon':
        return <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-gray-400 text-[10px] font-semibold uppercase">Brouillon</span>;
      case 'ouverte':
        return <span className="px-2 py-0.5 rounded-full bg-uni-gold/20 border border-uni-gold/30 text-uni-gold text-[10px] font-semibold uppercase animate-pulse">Ouvert</span>;
      case 'fermee':
        return <span className="px-2 py-0.5 rounded-full bg-uni-red/20 border border-uni-red/35 text-uni-red-light text-[10px] font-semibold uppercase">Clos</span>;
      case 'publiee':
        return <span className="px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/25 text-green-400 text-[10px] font-semibold uppercase">Publié</span>;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-[40vh] flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 rounded-full border-2 border-uni-gold border-t-transparent animate-spin" />
        <p className="text-gray-400 text-xs">Chargement des scrutins...</p>
      </div>
    );
  }

  if (elections.length === 0) {
    return (
      <div className="glassmorphism p-8 rounded-2xl text-center space-y-4">
        <AlertCircle className="w-8 h-8 text-gray-500 mx-auto" />
        <h3 className="text-lg font-bold text-white">Aucune élection enregistrée</h3>
        <p className="text-sm text-gray-400 max-w-sm mx-auto">
          Vous devez d'abord créer une élection dans la section "Élections" avant de pouvoir en consulter les résultats.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête d'impression officiel (uniquement visible à l'impression en PDF) */}
      <div className="hidden print:block border-b-2 border-black pb-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="text-left space-y-1">
            <h1 className="text-2xl font-bold uppercase tracking-tight text-black">Procès-Verbal des Résultats Électoraux</h1>
            <p className="text-sm font-semibold text-black">CREINIT - Commission Électorale</p>
            {selectedElection && (
              <p className="text-base font-bold text-black">{selectedElection.titre}</p>
            )}
            <p className="text-[10px] text-gray-500">
              Rapport officiel généré le {new Date().toLocaleDateString('fr-FR')} à {new Date().toLocaleTimeString('fr-FR')}
            </p>
          </div>
          <img src="/logo.png" className="h-16 w-auto object-contain rounded" alt="CREINIT Logo" />
        </div>
      </div>
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print">
        <div>
          <h1 className="text-3xl font-display font-extrabold text-white">Résultats Électoraux</h1>
          <p className="text-sm text-gray-400">Consultez et auditez les scores de chaque scrutin en temps réel.</p>
        </div>

        <div className="w-full sm:w-auto flex flex-wrap items-center gap-3">
          <button
            onClick={() => window.print()}
            className="w-full sm:w-auto bg-white/5 hover:bg-white/10 text-white font-semibold text-sm py-2.5 px-4 rounded-xl border border-white/10 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98]"
          >
            <FileText className="w-4 h-4 text-uni-gold" />
            <span>Télécharger le PV (PDF) 📄</span>
          </button>

          <select 
            value={selectedElectionId} 
            onChange={(e) => setSelectedElectionId(e.target.value)}
            className="w-full sm:w-64 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-uni-gold transition-all cursor-pointer"
          >
            {elections.map(e => (
              <option key={e.id} value={e.id} className="bg-gray-900 text-white">
                {e.titre} ({e.statut})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Warning/Info Box */}
      {selectedElection && (
        <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-xs text-gray-400 flex items-start gap-3 leading-relaxed no-print">
          <Lock className="w-4 h-4 text-uni-gold shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-white">Espace de contrôle réservé à la commission électorale</p>
            <div>
              Les résultats ci-dessous sont actualisés en direct. 
              {selectedElection.statut === 'publiee' ? (
                <span className="text-green-400 font-semibold flex items-center gap-1 mt-1">
                  <Eye className="w-3.5 h-3.5" /> Ces résultats sont actuellement PUBLICS et consultables par tous les étudiants.
                </span>
              ) : (
                <div className="space-y-2 mt-1">
                  <span className="text-uni-gold-light font-semibold flex items-center gap-1">
                    <EyeOff className="w-3.5 h-3.5" /> Ces résultats sont masqués pour les étudiants (visibilité admin uniquement).
                  </span>
                  {selectedElection.statut === 'fermee' && (
                    <button 
                      onClick={() => handlePublishResults(selectedElection.id)}
                      className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-500 text-white font-display font-bold text-[11px] py-1.5 px-3 rounded-lg transition-all active:scale-[0.98] cursor-pointer mt-1"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Publier les résultats 📢</span>
                    </button>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-uni-red/10 border border-uni-red/20 text-xs font-semibold text-uni-red-light flex gap-2.5 items-center no-print">
          <AlertCircle className="w-4 h-4 text-uni-red-light" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* RÉSULTATS DÉTAILLÉS */}
      {resultsLoading ? (
        <div className="min-h-[25vh] flex flex-col items-center justify-center space-y-4">
          <div className="w-10 h-10 rounded-full border-2 border-uni-gold border-t-transparent animate-spin" />
          <p className="text-gray-400 text-xs font-medium">Calcul des bulletins...</p>
        </div>
      ) : (
        <>
          {/* Stats Box */}
          {stats && selectedElection && (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
              <div className="glassmorphism p-5 rounded-2xl border border-white/5 space-y-1.5">
                <span className="text-gray-500 text-[10px] font-bold uppercase tracking-wider block">Statut Actuel</span>
                <div className="flex items-center gap-1.5">{getStatusBadge(selectedElection.statut)}</div>
              </div>

              <div className="glassmorphism p-5 rounded-2xl border border-white/5 space-y-1">
                <span className="text-gray-500 text-[10px] font-bold uppercase tracking-wider block">Participation</span>
                <span className="text-xl font-black text-white flex items-center gap-1">
                  <Percent className="w-4 h-4 text-uni-gold" /> {stats.participation_rate.toFixed(1)}%
                </span>
              </div>

              <div className="glassmorphism p-5 rounded-2xl border border-white/5 space-y-1">
                <span className="text-gray-500 text-[10px] font-bold uppercase tracking-wider block">Suffrages Exprimés</span>
                <span className="text-xl font-black text-white flex items-center gap-1">
                  <TrendingUp className="w-4 h-4 text-green-400" /> {stats.voters_count}
                </span>
              </div>

              <div className="glassmorphism p-5 rounded-2xl border border-white/5 space-y-1">
                <span className="text-gray-500 text-[10px] font-bold uppercase tracking-wider block">Liste Électorale</span>
                <span className="text-xl font-black text-white flex items-center gap-1">
                  <Users className="w-4 h-4 text-gray-400" /> {stats.total_students}
                </span>
              </div>
            </div>
          )}

          {/* Procès-Verbal / Préambule Officiel */}
          {selectedElection && stats && (
            <div className="p-6 rounded-2xl border border-white/10 bg-white/2 space-y-3 text-sm text-gray-300 print:text-black print:bg-white print:border-black print:p-4 font-mono leading-relaxed print:break-inside-avoid">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 print:text-black">
                <FileText className="w-4 h-4 text-uni-gold print:text-black" />
                <span>Procès-Verbal de Scrutin</span>
              </h3>
              <p>
                Conformément aux dispositions réglementaires régissant les élections de l'amicale des étudiants de l'établissement, le bureau électoral certifie par le présent procès-verbal les résultats issus du scrutin électronique sécurisé. 
              </p>
              <p>
                Le vote s'est déroulé de manière transparente avec un protocole de chiffrement garantissant à la fois l'anonymat absolu du suffrage de chaque électeur et la traçabilité de l'émargement. 
                Les votes ont été enregistrés du <strong className="text-white print:text-black">{formatDate(selectedElection.date_ouverture)}</strong> au <strong className="text-white print:text-black">{formatDate(selectedElection.date_fermeture)}</strong>. Les audits de sécurité n'ont révélé aucune anomalie ou altération de données.
              </p>
            </div>
          )}

          {/* Évolution globale de la participation */}
          {selectedElection && stats && emargementTimestamps.length > 0 && (
            <div className="glassmorphism p-6 rounded-2xl border border-white/5 space-y-4 print:break-inside-avoid">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 print:text-black font-display">
                <span>📈 Évolution Temporelle Globale de la Participation (Turnout)</span>
              </h3>
              <div className="p-4 bg-white/2 rounded-xl border border-white/10 print:bg-white print:border-black print:p-2">
                <GlobalTurnoutChart
                  voteTimestamps={emargementTimestamps}
                  totalEligible={stats.total_students}
                  dateOuverture={selectedElection.date_ouverture}
                  dateFermeture={selectedElection.date_fermeture}
                />
              </div>
            </div>
          )}

          {/* Postes */}
          <div className="space-y-6">
            {positionResults.map(pos => (
              <div key={pos.id} className="glassmorphism rounded-2xl border border-white/5 overflow-hidden">
                <div className="p-5 border-b border-white/5 bg-white/2 flex justify-between items-center gap-4 flex-wrap">
                  <div>
                    <h3 className="text-lg font-bold text-white font-display">{pos.nom}</h3>
                    {pos.description && <p className="text-xs text-gray-500 mt-0.5">{pos.description}</p>}
                  </div>
                  
                  <div className="flex items-center gap-4 no-print">
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

                    <span className="text-xs font-semibold text-gray-400 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5">
                      {pos.total_votes} votes
                    </span>
                  </div>
                </div>

                <div className="p-5">
                  {/* --- VUE ÉCRAN (Interactif avec onglets) --- */}
                  <div className="no-print">
                    {(viewModes[pos.id] || 'list') === 'list' ? (
                      <div className="space-y-4">
                        {pos.candidates.map(cand => (
                          <div 
                            key={cand.id}
                            className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                              cand.isWinner 
                                ? 'border-uni-gold/25 bg-uni-gold/5' 
                                : 'border-white/5 bg-white/1'
                            }`}
                          >
                            <div className="flex gap-3 items-center min-w-[200px]">
                              {cand.photo_url ? (
                                <img 
                                  src={cand.photo_url} 
                                  alt={`${cand.prenom} ${cand.nom}`}
                                  className="w-10 h-10 rounded-full object-cover border border-white/10 shrink-0"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10 font-bold text-xs text-gray-400 shrink-0">
                                  {cand.prenom[0]}{cand.nom[0]}
                                </div>
                              )}
                              <div>
                                <h4 className="font-bold text-white text-sm flex items-center gap-1.5">
                                  {cand.prenom} {cand.nom}
                                  {cand.isWinner && (
                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-uni-gold/20 text-uni-gold border border-uni-gold/30 text-[8px] font-bold">
                                      <Award className="w-2.5 h-2.5 fill-uni-gold" /> Gagnant
                                    </span>
                                  )}
                                </h4>
                                {cand.slogan && <p className="text-[10px] text-gray-400 italic">« {cand.slogan} »</p>}
                              </div>
                            </div>

                            <div className="flex-1 max-w-md space-y-1 sm:px-2">
                              <div className="h-2 bg-white/5 rounded-full overflow-hidden w-full relative">
                                <div 
                                  className={`h-full rounded-full transition-all duration-700 ease-out ${
                                    cand.isWinner ? 'bg-uni-gold' : 'bg-white/20'
                                  }`}
                                  style={{ width: `${cand.percentage}%` }}
                                />
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <span className={`text-sm font-black ${cand.isWinner ? 'text-uni-gold' : 'text-white'}`}>
                                {cand.votes_count} voix
                              </span>
                              <span className="text-[10px] text-gray-500 font-semibold block">({cand.percentage}%)</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <ResultsChart
                        candidates={pos.candidates}
                        totalVotes={pos.total_votes}
                        type={viewModes[pos.id] as 'bar' | 'doughnut'}
                      />
                    )}
                  </div>

                  {/* --- VUE IMPRESSION PDF (Procès-verbal figé avec Tableau + Diagramme circulaire) --- */}
                  <div className="hidden print:block space-y-6">
                    {/* Tableau print */}
                    <div className="border border-black rounded-none overflow-hidden print:break-inside-avoid">
                      <table className="min-w-full divide-y divide-black text-black">
                        <thead className="bg-gray-100">
                          <tr>
                            <th scope="col" className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-black border-r border-black">Candidat</th>
                            <th scope="col" className="px-4 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-black border-r border-black">Suffrages</th>
                            <th scope="col" className="px-4 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-black">Pourcentage</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-black">
                          {pos.candidates.map(cand => (
                            <tr key={cand.id} className={cand.isWinner ? 'bg-yellow-50 font-bold' : ''}>
                              <td className="px-4 py-2 whitespace-nowrap text-xs text-black border-r border-black">
                                {cand.prenom} {cand.nom} {cand.isWinner ? '🏆 (Gagnant)' : ''}
                              </td>
                              <td className="px-4 py-2 whitespace-nowrap text-xs text-center text-black border-r border-black">
                                {cand.votes_count} voix
                              </td>
                              <td className="px-4 py-2 whitespace-nowrap text-xs text-center text-black">
                                {cand.percentage}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Diagramme circulaire print */}
                    <div className="flex justify-center items-center py-4 border border-black p-4 bg-white print:break-inside-avoid">
                      <div className="w-full max-w-lg text-black">
                        <ResultsChart
                          candidates={pos.candidates}
                          totalVotes={pos.total_votes}
                          type="doughnut"
                        />
                      </div>
                    </div>
                  </div>

                  {/* --- COURBE D'ÉVOLUTION TEMPORELLE (Affichée sur écran et à l'impression) --- */}
                  <div className="mt-8 pt-6 border-t border-white/5 print:border-black/20 print:break-inside-avoid">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-4 print:text-black font-mono flex items-center gap-1.5">
                      <span>📈 Évolution temporelle des suffrages ({pos.nom.toUpperCase()})</span>
                    </h4>
                    <div className="p-4 bg-white/2 rounded-xl border border-white/10 print:bg-white print:border-black print:p-2">
                      <VoteEvolutionChart
                        candidates={pos.candidates}
                        votes={votes.filter(v => pos.candidates.some(c => c.id === v.candidat_id))}
                        dateOuverture={selectedElection?.date_ouverture || null}
                        dateFermeture={selectedElection?.date_fermeture || null}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Section signature officielle pour procès-verbal d'impression */}
          <div className="hidden print:block mt-12 pt-8 border-t border-dashed border-gray-400 print:break-inside-avoid">
            <h4 className="text-xs font-bold uppercase tracking-wider text-black mb-6 text-center">Fait à Dakar, le {new Date().toLocaleDateString('fr-FR')}</h4>
            <div className="flex justify-between text-[10px] font-semibold text-black px-4">
              <div>
                <p className="font-bold text-center">Président de la Commission Électorale</p>
                <div className="h-16"></div>
                <p className="border-t border-black w-44 pt-1 text-center font-normal">Signature & Cachet</p>
              </div>
              <div>
                <p className="font-bold text-center">Secrétaire Général Assesseur</p>
                <div className="h-16"></div>
                <p className="border-t border-black w-44 pt-1 text-center font-normal">Signature & Cachet</p>
              </div>
              <div>
                <p className="font-bold text-center">Représentant des Scrutateurs</p>
                <div className="h-16"></div>
                <p className="border-t border-black w-44 pt-1 text-center font-normal">Signature & Cachet</p>
              </div>
            </div>
          </div>

          {/* Style d'impression pour éviter l'overlap avec le footer fixe */}
          <style dangerouslySetInnerHTML={{ __html: `
            @media print {
              body {
                margin-bottom: 50px !important;
              }
            }
          `}} />

          {/* Pied de page imprimé répété en bas de chaque page PDF */}
          <div className="hidden print:block fixed bottom-0 left-0 right-0 text-center text-[10px] text-black font-bold font-mono bg-white py-2 border-t border-black">
            Copyright : CRE - Centre de Recherche et d'Essais de Kolda
          </div>

          {/* Pied de page écran (affiché en bas du contenu sur écran seulement) */}
          <div className="no-print mt-16 pt-6 border-t border-white/5 text-center text-xs text-gray-500 font-semibold font-mono">
            Copyright : CRE - Centre de Recherche et d'Essais de Kolda
          </div>
        </>
      )}
    </div>
  );
}
