import React, { useState, useEffect } from 'react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { supabase } from '../../lib/supabase';
import { LogOut, Award, AlertTriangle, Info, Shield, Users, CheckCircle, Clock } from 'lucide-react';

interface ResultatCandidat {
  candidat_id: string;
  nom: string;
  prenom: string;
  poste_nom: string;
  statut_election: 'brouillon' | 'ouverte' | 'fermee' | 'publiee';
  nb_voix: number;
  gagnant: boolean;
}

export default function RepresentantDashboard() {
  const { admin, logout } = useAdminAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [resultats, setResultats] = useState<ResultatCandidat | null>(null);

  useEffect(() => {
    const fetchCandidateResults = async () => {
      if (!admin || !admin.candidat_id) {
        setError("Aucun candidat n'est lié à votre compte représentant.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError('');

        // 1. Fetch Candidate
        const { data: candData, error: candErr } = await supabase
          .from('candidats')
          .select('*')
          .eq('id', admin.candidat_id)
          .maybeSingle();

        if (candErr || !candData) {
          setError("Candidat introuvable.");
          setLoading(false);
          return;
        }

        // 2. Fetch Poste
        const { data: posteData, error: posteErr } = await supabase
          .from('postes')
          .select('*')
          .eq('id', candData.poste_id)
          .maybeSingle();

        if (posteErr || !posteData) {
          setError("Poste introuvable.");
          setLoading(false);
          return;
        }

        // 3. Fetch Election
        const { data: elecData, error: elecErr } = await supabase
          .from('elections')
          .select('*')
          .eq('id', posteData.election_id)
          .maybeSingle();

        if (elecErr || !elecData) {
          setError("Élection introuvable.");
          setLoading(false);
          return;
        }

        // 4. Count Votes for this candidate
        const { count: nbVoix, error: votesErr } = await supabase
          .from('votes')
          .select('id', { count: 'exact', head: true })
          .eq('candidat_id', admin.candidat_id);

        if (votesErr) throw votesErr;

        // 5. Determine if winner (only if election is closed/published)
        let isWinner = false;
        if (elecData.statut === 'fermee' || elecData.statut === 'publiee') {
          // Fetch all candidates for this poste
          const { data: candsList, error: candsErr } = await supabase
            .from('candidats')
            .select('id')
            .eq('poste_id', candData.poste_id);

          if (candsErr) throw candsErr;
          const candIds = (candsList || []).map(d => d.id);

          // Fetch all votes for this poste
          const { data: posteVotesList, error: posteVotesErr } = await supabase
            .from('votes')
            .select('candidat_id')
            .eq('poste_id', candData.poste_id);

          if (posteVotesErr) throw posteVotesErr;
          
          const votesMap: Record<string, number> = {};
          (posteVotesList || []).forEach(v => {
            if (v.candidat_id) {
              votesMap[v.candidat_id] = (votesMap[v.candidat_id] || 0) + 1;
            }
          });

          const maxVotes = Math.max(...candIds.map(cid => votesMap[cid] || 0));
          const winners = candIds.filter(cid => (votesMap[cid] || 0) === maxVotes);
          if (winners.length === 1 && winners[0] === admin.candidat_id) {
            isWinner = true;
          }
        }

        setResultats({
          candidat_id: admin.candidat_id,
          nom: candData.nom || '',
          prenom: candData.prenom || '',
          poste_nom: posteData.nom || '',
          statut_election: elecData.statut,
          nb_voix: nbVoix || 0,
          gagnant: isWinner
        });
      } catch (err: any) {
        console.error(err);
        setError(err.message || "Erreur de chargement des résultats.");
      } finally {
        setLoading(false);
      }
    };

    fetchCandidateResults();
  }, [admin]);

  const handleLogout = async () => {
    if (confirm("Voulez-vous vous déconnecter de l'espace représentant ?")) {
      await logout();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-uni-bg flex flex-col items-center justify-center p-6">
        <div className="w-12 h-12 rounded-full border-4 border-uni-gold border-t-transparent animate-spin mb-4" />
        <p className="text-gray-400 font-display font-medium text-sm">Chargement des données...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-uni-bg text-gray-100 p-6 md:p-12 relative flex flex-col items-center">
      {/* Arrière-plans décoratifs */}
      <div className="absolute top-0 left-0 w-full h-[300px] bg-gradient-to-b from-uni-green/10 to-transparent pointer-events-none z-0" />
      
      <div className="relative z-10 w-full max-w-3xl space-y-8">
        
        {/* Barre d'en-tête */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/5 pb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-uni-gold/10 border border-uni-gold/20 flex items-center justify-center text-uni-gold">
              <Shield className="w-5.5 h-5.5" />
            </div>
            <div>
              <h1 className="text-xl font-display font-extrabold text-white">Espace d'Observation</h1>
              <p className="text-xs text-gray-400 font-medium font-mono">
                Portail Représentant : {admin?.prenom} {admin?.nom}
              </p>
            </div>
          </div>
          
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-2 bg-white/5 hover:bg-uni-red/15 hover:text-uni-red-light border border-white/5 font-display font-bold py-2.5 px-4 rounded-xl text-xs transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Déconnexion</span>
          </button>
        </header>

        {error ? (
          <div className="p-6 rounded-2xl bg-uni-red/10 border border-uni-red/20 text-sm text-uni-red-light flex gap-3 items-start">
            <AlertTriangle className="w-5 h-5 shrink-0 text-uni-red mt-0.5" />
            <p>{error}</p>
          </div>
        ) : (
          resultats && (
            <main className="space-y-6">
              
              {/* Carte du Candidat Représenté */}
              <div className="glassmorphism p-8 rounded-3xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-[150px] h-[150px] rounded-full bg-uni-gold/5 blur-[50px] pointer-events-none" />
                
                <div className="space-y-6">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-uni-gold/10 border border-uni-gold/25 text-uni-gold text-[10px] font-bold uppercase tracking-wider">
                    <Users className="w-3.5 h-3.5" />
                    Candidat représenté
                  </span>
                  
                  <div className="space-y-2">
                    <h2 className="text-3xl font-display font-black text-white">
                      {resultats.prenom} {resultats.nom}
                    </h2>
                    <p className="text-sm text-gray-300 font-medium">
                      Postulé pour le poste : <strong className="text-uni-gold">{resultats.poste_nom}</strong>
                    </p>
                  </div>
                  
                  {/* Badge de statut de l'élection */}
                  <div className="flex items-center gap-2.5 bg-white/5 p-3 rounded-xl border border-white/5 w-fit">
                    <span className="w-2.5 h-2.5 rounded-full bg-uni-gold animate-pulse" />
                    <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">
                      État du scrutin :{' '}
                      <span className="text-white">
                        {resultats.statut_election === 'brouillon' && 'Brouillon'}
                        {resultats.statut_election === 'ouverte' && 'Vote en cours 🗳️'}
                        {resultats.statut_election === 'fermee' && 'Scrutin Clos 🔒'}
                        {resultats.statut_election === 'publiee' && 'Résultats Officiels 📢'}
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Panneau de résultats ou d'informations */}
              {resultats.statut_election === 'ouverte' || resultats.statut_election === 'brouillon' ? (
                /* CAS : ÉLECTION EN COURS */
                <div className="glassmorphism p-8 rounded-3xl border border-uni-gold/20 bg-uni-gold/5 space-y-4">
                  <div className="flex gap-4 items-start">
                    <div className="w-10 h-10 rounded-xl bg-uni-gold/15 flex items-center justify-center text-uni-gold shrink-0 mt-0.5">
                      <Clock className="w-5.5 h-5.5" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-lg font-display font-bold text-white">Scrutin actuellement en cours</h3>
                      <p className="text-sm text-gray-300 leading-relaxed">
                        Les résultats seront visibles à la clôture du vote. Conformément au secret et à l'intégrité du scrutin, aucun décompte de voix n'est accessible avant la fermeture des urnes.
                      </p>
                    </div>
                  </div>
                  
                  <div className="pt-2 border-t border-white/5 mt-4">
                    <div className="flex gap-3 items-start text-xs text-gray-400 bg-black/10 p-4 rounded-xl">
                      <Info className="w-4.5 h-4.5 shrink-0 text-uni-gold mt-0.5" />
                      <div>
                        <strong>Rappel Droit de vote double rôle :</strong> Votre désignation comme représentant n'affecte en rien votre droit de vote étudiant. 
                        Vos identifiants de vote habituels s'utilisent sur <a href="/voter" className="text-uni-gold hover:underline">/voter</a>. 
                        Cet espace quant à lui vous servira uniquement d'observation des scores à la fin du scrutin.
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* CAS : ÉLECTION CLOSE OU PUBLIÉE */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Nombre de voix */}
                  <div className="glassmorphism p-8 rounded-3xl flex flex-col justify-center items-center text-center space-y-2 relative overflow-hidden">
                    <span className="text-xs uppercase tracking-wider text-gray-400 font-bold">Suffrages obtenus</span>
                    <span className="text-6xl font-black font-mono text-white pt-2">{resultats.nb_voix}</span>
                    <span className="text-xs text-uni-gold font-medium font-display pt-1">voix enregistrées</span>
                  </div>

                  {/* Badge Élu / Non élu */}
                  <div className="glassmorphism p-8 rounded-3xl flex flex-col justify-center items-center text-center space-y-4">
                    <span className="text-xs uppercase tracking-wider text-gray-400 font-bold">Résultat de la candidature</span>
                    
                    {resultats.gagnant ? (
                      <div className="space-y-2 flex flex-col items-center">
                        <div className="w-16 h-16 rounded-full bg-green-500/10 text-green-400 border border-green-500/25 flex items-center justify-center mb-1">
                          <Award className="w-8 h-8" />
                        </div>
                        <span className="px-4 py-1.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/20 font-display font-black text-sm uppercase tracking-wider">
                          🏆 Élu / Gagnant
                        </span>
                        <p className="text-[11px] text-gray-400 max-w-[200px]">
                          Félicitations, ce candidat a obtenu le plus grand nombre de voix pour son poste.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2 flex flex-col items-center">
                        <div className="w-16 h-16 rounded-full bg-white/5 text-gray-400 border border-white/5 flex items-center justify-center mb-1">
                          <Users className="w-8 h-8" />
                        </div>
                        <span className="px-4 py-1.5 rounded-full bg-white/5 text-gray-400 border border-white/10 font-display font-bold text-sm uppercase tracking-wider">
                          Non élu
                        </span>
                        <p className="text-[11px] text-gray-400 max-w-[200px]">
                          Le candidat n'a pas réuni le nombre de voix majoritaire pour ce poste.
                        </p>
                      </div>
                    )}
                  </div>

                </div>
              )}
              
            </main>
          )
        )}
        
        {/* Footer informatif rappelant la confidentialité absolue */}
        <footer className="text-center pt-6 border-t border-white/5 text-[10px] text-gray-500 space-y-1">
          <p>© 2026 Bureau de l'Amicale des Étudiants — Tous droits réservés.</p>
          <p className="max-w-md mx-auto leading-relaxed">
            <strong>Règle de sécurité et confidentialité :</strong> Conformément à la réglementation électorale, ce tableau de bord n'a accès qu'aux statistiques strictes et isolées de votre propre candidat. Les données brutes et intermédiaires des autres candidats ou scrutins ne sont pas récupérées par l'API.
          </p>
        </footer>

      </div>
    </div>
  );
}
