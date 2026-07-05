import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { User, X, AlertTriangle, FileText, Award } from 'lucide-react';

interface Election {
  id: string;
  titre: string;
  statut: string;
  date_ouverture?: string | null;
}

interface Candidat {
  id: string;
  poste_id: string;
  nom: string;
  prenom: string;
  photo_url: string | null;
  slogan: string | null;
  programme: string | null;
  representant?: {
    id: string;
    prenom: string;
    nom: string;
    email: string;
  } | null;
}

interface Poste {
  id: string;
  nom: string;
  description: string | null;
  ordre?: number;
  candidats: Candidat[];
}

export default function Candidats() {
  const [election, setElection] = useState<Election | null>(null);
  const [postes, setPostes] = useState<Poste[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Candidat sélectionné pour la modal
  const [selectedCandidat, setSelectedCandidat] = useState<Candidat | null>(null);

  const loadElectionAndCandidats = async () => {
    const selectedAmId = localStorage.getItem('selected_amicale_id');
    if (!selectedAmId) {
      setElection(null);
      setPostes([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setErrorMsg('');

      // 1. Rechercher une élection ouverte, publiée ou planifiée
      const { data: electionsData, error: electionsErr } = await supabase
        .from('elections')
        .select('*')
        .eq('amicale_id', selectedAmId)
        .order('created_at', { ascending: false });

      if (electionsErr) throw electionsErr;

      const now = new Date();
      const filteredElections = (electionsData || []).filter(e => {
        if (e.statut === 'ouverte' || e.statut === 'publiee') return true;
        if (e.statut === 'brouillon' && e.date_ouverture) {
          return new Date(e.date_ouverture) > now;
        }
        return false;
      });

      // Prendre l'élection ouverte ou planifiée prioritairement, sinon la dernière publiée
      let activeElection = filteredElections.find(e => e.statut === 'ouverte');
      if (!activeElection) {
        activeElection = filteredElections.find(e => e.statut === 'brouillon');
      }
      if (!activeElection && filteredElections.length > 0) {
        activeElection = filteredElections[0];
      }

      if (!activeElection) {
        setElection(null);
        setPostes([]);
        return;
      }

      setElection(activeElection as any);

      // 2. Charger les postes et les candidats associés
      const { data: postesData, error: postesErr } = await supabase
        .from('postes')
        .select('*')
        .eq('election_id', activeElection.id)
        .order('nom', { ascending: true });

      if (postesErr) throw postesErr;

      if (postesData && postesData.length > 0) {
        const posteIds = postesData.map(p => p.id);
        const { data: candidatsData, error: candidatsErr } = await supabase
          .from('candidats')
          .select('*')
          .in('poste_id', posteIds);

        if (candidatsErr) throw candidatsErr;

        // Charger les représentants associés
        const candIds = (candidatsData || []).map(c => c.id);
        let repsData: any[] = [];
        if (candIds.length > 0) {
          const { data: reps, error: repsErr } = await supabase
            .from('admins')
            .select('id, nom, prenom, email, candidat_id')
            .eq('role', 'representant')
            .eq('is_revoked', false)
            .in('candidat_id', candIds);
          if (!repsErr && reps) {
            repsData = reps;
          }
        }

        // Associer les candidats à leurs postes
        const mappedPostes = postesData.map(poste => ({
          ...poste,
          candidats: (candidatsData || [])
            .filter(c => c.poste_id === poste.id)
            .map(c => ({
              ...c,
              representant: repsData.find(r => r.candidat_id === c.id) || null
            }))
        }));
        setPostes(mappedPostes as any);
      } else {
        setPostes([]);
      }
    } catch (e: any) {
      console.error(e);
      setErrorMsg("Impossible de charger les candidats.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadElectionAndCandidats();

    const handleAmicaleChanged = () => {
      loadElectionAndCandidats();
    };
    window.addEventListener('amicale_changed', handleAmicaleChanged);

    return () => {
      window.removeEventListener('amicale_changed', handleAmicaleChanged);
    };
  }, []);

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 relative">
      <div className="grid-bg" />
      <div className="grid-bg-glow" />

      {/* Title */}
      <div className="relative z-10">
        <h1 className="text-3xl md:text-4xl font-display font-extrabold text-white uppercase tracking-wider glitch-hover">
          Candidats Officiels
        </h1>
        <p className="text-sm text-neon-cyan/70 mt-1 font-mono">
          &gt; SCANNING_DATABASE: Profils, slogans et professions de foi des candidats authentifiés.
        </p>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-uni-red/10 border border-uni-red/20 text-sm font-semibold text-uni-red-light flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {loading ? (
        <div className="glassmorphism p-12 flex flex-col items-center justify-center rounded-3xl">
          <div className="w-8 h-8 rounded-full border-4 border-uni-gold border-t-transparent animate-spin mb-3" />
          <p className="text-sm text-gray-400">Chargement des fiches candidats...</p>
        </div>
      ) : !election ? (
        <div className="glassmorphism p-10 rounded-3xl border border-white/5 flex flex-col items-center justify-center text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-uni-gold border border-white/10">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Aucun scrutin actif</h3>
            <p className="text-sm text-gray-400 max-w-md">
              Il n'y a pas d'élection en cours ni de candidats déclarés en ce moment.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-12">
          {/* Subtitle with election details */}
          <div className="p-4 bg-black/40 border border-neon-cyan/20 flex justify-between items-center z-10 relative font-mono">
            <span className="text-xs text-neon-cyan/80">
              SCRUTIN_TARGET : <span className="text-white font-bold">{election.titre.toUpperCase()}</span>
            </span>
            <span className={`px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
              election.statut === 'ouverte'
                ? (election.date_ouverture && new Date() < new Date(election.date_ouverture) ? 'text-neon-pink border border-neon-pink/30 bg-neon-pink/10' : 'text-neon-cyan border border-neon-cyan/30 bg-neon-cyan/10')
                : election.statut === 'brouillon'
                  ? 'text-neon-pink border border-neon-pink/30 bg-neon-pink/10'
                  : 'text-gray-400 border border-gray-600 bg-gray-800/30'
            }`}>
              {election.statut === 'ouverte' 
                ? (election.date_ouverture && new Date() < new Date(election.date_ouverture) ? 'PLANIFIÉ' : 'EN COURS')
                : election.statut === 'brouillon'
                  ? 'PLANIFIÉ'
                  : 'ARCHIVE'}
            </span>
          </div>

          {/* List of positions and candidates */}
          {postes.length === 0 ? (
            <p className="text-center text-gray-500 py-8">Aucun poste configuré pour ce scrutin.</p>
          ) : (
            <div className="space-y-10">
              {postes.map((poste) => {
                const candidates = poste.candidats || [];
                return (
                  <div key={poste.id} className="space-y-4 z-10 relative">
                    <div className="border-l-2 border-neon-cyan pl-3">
                      <h2 className="text-xl font-display font-extrabold text-white uppercase tracking-wide">{poste.nom}</h2>
                      {poste.description && (
                        <p className="text-xs text-neon-cyan/60 font-mono mt-0.5">&gt; DESCRIPTION: {poste.description}</p>
                      )}
                    </div>

                    {candidates.length === 0 ? (
                      <div className="bg-white/3 border border-dashed border-white/10 p-6 rounded-2xl text-center text-xs text-gray-500">
                        Aucun candidat n'est inscrit pour ce poste.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {candidates.map((cand) => (
                          <div 
                            key={cand.id}
                            onClick={() => setSelectedCandidat(cand)}
                            className="cyber-card p-5 cursor-pointer flex flex-col justify-between items-start space-y-4 hover:-translate-y-1 duration-300"
                          >
                            <div className="scanline" />
                            <div className="flex gap-4 items-center w-full">
                              {/* Photo */}
                              <div className="w-16 h-16 bg-black/40 border border-neon-cyan/45 overflow-hidden flex items-center justify-center shrink-0 shadow-[0_0_10px_rgba(0,240,255,0.1)]">
                                {cand.photo_url ? (
                                  <img 
                                    src={cand.photo_url} 
                                    alt={`${cand.prenom} ${cand.nom}`}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <User className="w-6 h-6 text-neon-cyan/50" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <h3 className="text-base font-display font-bold text-white truncate uppercase">
                                  {cand.prenom} {cand.nom}
                                </h3>
                                {cand.slogan && (
                                  <p className="text-xs text-neon-pink font-mono mt-0.5 truncate">
                                    // {cand.slogan}
                                  </p>
                                )}
                                {cand.representant && (
                                  <p className="text-[10px] text-neon-cyan/85 font-mono mt-1 border border-neon-cyan/25 bg-neon-cyan/5 px-1.5 py-0.5 rounded truncate max-w-full inline-block">
                                    Rep : {cand.representant.prenom} {cand.representant.nom}
                                  </p>
                                )}
                              </div>
                            </div>

                            {cand.programme && (
                              <p className="text-xs font-mono text-neon-cyan/80 line-clamp-3 leading-relaxed w-full">
                                &gt; {cand.programme}
                              </p>
                            )}

                            <span className="text-xs font-bold text-neon-cyan hover:text-white mt-2 flex items-center gap-1 font-mono">
                              <FileText className="w-3.5 h-3.5" />
                              <span>[ ANALYSER_DOSSIER ]</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* DETAIL MODAL */}
      {selectedCandidat && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="cyber-card w-full max-w-xl p-8 space-y-6 relative shadow-2xl max-h-[85vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            <div className="scanline" />
            <button 
              onClick={() => setSelectedCandidat(null)}
              className="absolute right-6 top-6 p-2 text-neon-cyan hover:bg-neon-cyan/15 transition-all cursor-pointer border border-transparent hover:border-neon-cyan/30"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Profile banner */}
            <div className="flex gap-4 items-center">
              <div className="w-20 h-20 bg-black/50 border border-neon-cyan/50 overflow-hidden flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(0,240,255,0.2)]">
                {selectedCandidat.photo_url ? (
                  <img 
                    src={selectedCandidat.photo_url} 
                    alt={`${selectedCandidat.prenom} ${selectedCandidat.nom}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-8 h-8 text-neon-cyan/60" />
                )}
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-display font-extrabold text-white uppercase tracking-wider text-neon-cyan">
                  {selectedCandidat.prenom} {selectedCandidat.nom}
                </h2>
                {selectedCandidat.slogan && (
                  <p className="text-sm font-mono text-neon-pink mt-0.5">
                    // {selectedCandidat.slogan}
                  </p>
                )}
              </div>
            </div>

            {/* Représentant info */}
            {selectedCandidat.representant && (
              <div className="p-4 bg-neon-cyan/5 border border-neon-cyan/20 rounded-lg space-y-1">
                <h4 className="text-[10px] font-mono font-bold uppercase tracking-wider text-neon-cyan/80">Représentant officiel du candidat</h4>
                <p className="text-sm font-semibold text-white font-mono">{selectedCandidat.representant.prenom} {selectedCandidat.representant.nom}</p>
                <p className="text-xs text-neon-cyan/60 font-mono">{selectedCandidat.representant.email}</p>
              </div>
            )}

            {/* Programme body */}
            <div className="space-y-3.5 pt-4 border-t border-neon-cyan/20">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neon-cyan/80 flex items-center gap-1.5 font-mono">
                <FileText className="w-4 h-4" />
                <span>[ DOSSIER_PROFESSION_DE_FOI ]</span>
              </h3>
              
              <div className="text-sm text-gray-300 leading-relaxed space-y-4 whitespace-pre-line font-mono bg-black/40 p-4 border border-neon-cyan/10">
                {selectedCandidat.programme || "Le candidat n'a pas encore rédigé de profession de foi détaillée."}
              </div>
            </div>

            <div className="pt-4 border-t border-neon-cyan/20 flex justify-end">
              <button 
                onClick={() => setSelectedCandidat(null)}
                className="cyber-btn py-2.5 px-6 cursor-pointer"
              >
                DISMISS
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
