import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStudentAuth } from '../../context/StudentAuthContext';
import { supabase } from '../../lib/supabase';
import { Calendar, Vote, BarChart3, Users, Clock, Info, Lock } from 'lucide-react';

interface Election {
  id: string;
  titre: string;
  description: string | null;
  statut: 'brouillon' | 'ouverte' | 'fermee' | 'publiee';
  date_ouverture: string | null;
  date_fermeture: string | null;
  created_at?: string;
}

export default function Home() {
  const { student, openAuthModal } = useStudentAuth();
  const navigate = useNavigate();

  const handleVoteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (student) {
      navigate('/voter');
    } else {
      openAuthModal();
    }
  };

  const [openElection, setOpenElection] = useState<Election | null>(null);
  const [publishedElection, setPublishedElection] = useState<Election | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchElectionState = async () => {
    const selectedAmId = localStorage.getItem('selected_amicale_id');
    if (!selectedAmId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // 1. Rechercher une élection ouverte
      const { data: openDocs, error: openErr } = await supabase
        .from('elections')
        .select('*')
        .eq('statut', 'ouverte')
        .eq('amicale_id', selectedAmId)
        .order('created_at', { ascending: false });

      if (openErr) throw openErr;

      if (openDocs && openDocs.length > 0) {
        setOpenElection(openDocs[0] as Election);
        setPublishedElection(null);
      } else {
        setOpenElection(null);
        
        // 2. Sinon, rechercher la dernière élection publiée
        const { data: pubDocs, error: pubErr } = await supabase
          .from('elections')
          .select('*')
          .eq('statut', 'publiee')
          .eq('amicale_id', selectedAmId)
          .order('date_fermeture', { ascending: false });

        if (pubErr) throw pubErr;

        if (pubDocs && pubDocs.length > 0) {
          setPublishedElection(pubDocs[0] as Election);
        } else {
          setPublishedElection(null);
        }
      }
    } catch (e) {
      console.error("Erreur de récupération de l'état électoral", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchElectionState();

    const handleAmicaleChanged = () => {
      fetchElectionState();
    };
    window.addEventListener('amicale_changed', handleAmicaleChanged);

    return () => {
      window.removeEventListener('amicale_changed', handleAmicaleChanged);
    };
  }, []);

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

  return (
    <div className="w-full max-w-4xl mx-auto space-y-12 relative">
      <div className="grid-bg" />
      <div className="grid-bg-glow" />
      
      {/* Hero Section */}
      <section className="text-center space-y-6 py-8 relative z-10">
        <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-none bg-black/40 text-neon-cyan border border-neon-cyan/50 text-[10px] sm:text-xs font-mono font-bold tracking-widest uppercase shadow-[0_0_15px_rgba(0,240,255,0.2)] backdrop-blur-md">
          <span className="w-2 h-2 bg-neon-cyan animate-pulse rounded-full" /> Sène kàddu moy sunu yité
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-6xl font-display font-extrabold tracking-tight text-white max-w-3xl mx-auto leading-tight uppercase glitch-hover">
          Dalal ak jamm ci Buntub Wote bu Yaatu bi
        </h1>
        <p className="text-base md:text-lg text-neon-cyan/70 max-w-2xl mx-auto leading-relaxed font-mono">
          Exercez votre devoir civique universitaire. Élisez les représentants qui porteront votre voix et défendront vos intérêts au quotidien.
        </p>
      </section>

      {/* Dynamic Election Dashboard Panel */}
      <section className="relative">
        {loading ? (
          <div className="glassmorphism p-12 flex flex-col items-center justify-center rounded-3xl">
            <div className="w-8 h-8 rounded-full border-4 border-uni-rose border-t-transparent animate-spin mb-3" />
            <p className="text-sm text-gray-400">Vérification des scrutins en cours...</p>
          </div>
        ) : openElection ? (
          (() => {
            const hasNotStartedYet = openElection.date_ouverture && new Date() < new Date(openElection.date_ouverture);
            return (
              /* CAS 1 : ÉLECTION PLANIFIÉE OU ACTUELLEMENT OUVERTE */
              <div className="cyber-card p-8 md:p-10 z-10">
                <div className="scanline" />
                
                <div className="flex flex-wrap items-center justify-between gap-4">
                  {hasNotStartedYet ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 sm:px-3 font-mono text-[10px] sm:text-xs font-bold uppercase tracking-wider text-neon-pink border border-neon-pink/50 bg-neon-pink/10">
                      <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-neon-pink animate-pulse" />
                      Scrutin planifié
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 sm:px-3 font-mono text-[10px] sm:text-xs font-bold uppercase tracking-wider text-neon-cyan border border-neon-cyan/50 bg-neon-cyan/10">
                      <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-neon-cyan animate-ping" />
                      Scrutin en cours
                    </span>
                  )}
                  
                  {openElection.date_ouverture && hasNotStartedYet ? (
                    <span className="text-xs text-neon-pink/80 flex items-center gap-1.5 font-mono">
                      <Clock className="w-3.5 h-3.5" />
                      SYS.OPEN : {formatDate(openElection.date_ouverture)}
                    </span>
                  ) : openElection.date_fermeture ? (
                    <span className="text-xs text-neon-cyan/80 flex items-center gap-1.5 font-mono">
                      <Clock className="w-3.5 h-3.5" />
                      SYS.CLOSE : {formatDate(openElection.date_fermeture)}
                    </span>
                  ) : null}
                </div>

                <div className="space-y-3 mt-6">
                  <h2 className="text-2xl md:text-3xl font-display font-extrabold text-white uppercase tracking-wide">
                    {openElection.titre}
                  </h2>
                  <p className="text-sm md:text-base text-gray-300 font-mono leading-relaxed max-w-3xl">
                    &gt; {openElection.description || "Aucune description fournie pour ce scrutin. Veuillez vous rapprocher de la commission électorale."}
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-4 mt-8 pt-6 border-t border-neon-cyan/20">
                  {!hasNotStartedYet ? (
                    <button 
                      onClick={handleVoteClick}
                      className="cyber-btn cyber-btn-primary py-3 px-8 flex items-center justify-center gap-2 cursor-pointer w-full sm:w-auto"
                    >
                      <Vote className="w-4 h-4" />
                      <span>INITIALISER VOTE</span>
                    </button>
                  ) : (
                    <button 
                      disabled
                      className="bg-black/50 text-gray-500 font-display font-semibold py-3 px-8 border border-gray-700 flex items-center justify-center gap-2 cursor-not-allowed uppercase w-full sm:w-auto"
                    >
                      <Lock className="w-4 h-4 text-gray-500" />
                      <span>VERROUILLÉ</span>
                    </button>
                  )}
                  <Link 
                    to="/candidats" 
                    className="cyber-btn py-3 px-8 flex items-center justify-center gap-2 w-full sm:w-auto"
                  >
                    <Users className="w-4 h-4" />
                    <span>SCAN CANDIDATS</span>
                  </Link>
                </div>
              </div>
            );
          })()
        ) : publishedElection ? (
          /* CAS 2 : DERNIÈRE ÉLECTION PUBLIÉE */
          <div className="cyber-card p-8 md:p-10 z-10">
            <div className="scanline" />

            <div className="flex flex-wrap items-center justify-between gap-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 font-mono text-xs font-bold uppercase tracking-wider text-neon-purple border border-neon-purple/50 bg-neon-purple/10">
                DATA UPLOADED
              </span>
              <span className="text-xs text-neon-purple/80 flex items-center gap-1.5 font-mono">
                SYS.ARCHIVED : {formatDate(publishedElection.date_fermeture)}
              </span>
            </div>

            <div className="space-y-3 mt-6">
              <h2 className="text-2xl md:text-3xl font-display font-extrabold text-white uppercase tracking-wide">
                {publishedElection.titre}
              </h2>
              <p className="text-sm font-mono text-gray-400 leading-relaxed max-w-3xl">
                &gt; Le vote est désormais clos. Les données consolidées ont été auditées et sont accessibles dans les archives.
              </p>
            </div>

            <div className="mt-8 pt-6 border-t border-neon-purple/20 flex flex-col sm:flex-row">
              <Link 
                to="/resultats" 
                className="cyber-btn py-3 px-8 flex items-center justify-center gap-2 w-full sm:w-max"
                style={{ borderColor: 'var(--color-neon-purple)', color: 'var(--color-neon-purple)' }}
              >
                <BarChart3 className="w-4 h-4" />
                <span>ANALYSER RÉSULTATS</span>
              </Link>
            </div>
          </div>
        ) : (
          /* CAS 3 : AUCUN SCRUTIN DISPONIBLE */
          <div className="cyber-card p-10 z-10 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-12 h-12 border border-neon-cyan/50 flex items-center justify-center text-neon-cyan bg-neon-cyan/5 relative">
              <div className="absolute inset-0 border border-neon-cyan animate-pulse opacity-50" />
              <Info className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-display font-bold text-white uppercase tracking-widest">Aucun signal détecté</h3>
              <p className="text-sm font-mono text-neon-cyan/70 max-w-md">
                &gt; Système en veille. Aucune élection active ou archive récente trouvée dans la base de données centrale.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Info Cards Grid */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 z-10 relative">
        <div className="cyber-card p-6 space-y-4 hover:-translate-y-2 transition-transform duration-300">
          <div className="w-10 h-10 border border-neon-cyan/50 flex items-center justify-center text-neon-cyan bg-neon-cyan/10">
            <Lock className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-display font-bold text-white uppercase">Cryptage Quantique</h3>
          <p className="text-sm font-mono text-neon-cyan/70 leading-relaxed">
            &gt; Le secret du vote est garanti. Émargement traçable, mais bulletins de vote strictement isolés par protocole de sécurité avancé.
          </p>
        </div>

        <div className="cyber-card p-6 space-y-4 hover:-translate-y-2 transition-transform duration-300">
          <div className="w-10 h-10 border border-neon-cyan/50 flex items-center justify-center text-neon-cyan bg-neon-cyan/10">
            <Users className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-display font-bold text-white uppercase">Auth. Biométrique</h3>
          <p className="text-sm font-mono text-neon-cyan/70 leading-relaxed">
            &gt; Seuls les matricules validés et authentifiés dans la matrice universitaire ont l'autorisation d'accéder au terminal de vote.
          </p>
        </div>

        <div className="cyber-card p-6 space-y-4 hover:-translate-y-2 transition-transform duration-300">
          <div className="w-10 h-10 border border-neon-cyan/50 flex items-center justify-center text-neon-cyan bg-neon-cyan/10">
            <BarChart3 className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-display font-bold text-white uppercase">Transparence Absolue</h3>
          <p className="text-sm font-mono text-neon-cyan/70 leading-relaxed">
            &gt; Décompte synchronisé en temps réel après clôture. Algorithmes d'agrégation immuables assurant des résultats infalsifiables.
          </p>
        </div>
      </section>
    </div>
  );
}
