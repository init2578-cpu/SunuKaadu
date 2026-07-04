import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Link } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext';
import {
  Users, Vote, Award, Inbox, ArrowRight, TrendingUp, AlertCircle, Activity, BarChart3, PieChart as PieChartIcon
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface Election {
  id: string;
  titre: string;
  statut: 'brouillon' | 'ouverte' | 'fermee' | 'publiee';
  created_at: string;
  amicale_id: string;
}

export default function Dashboard() {
  const { admin } = useAdminAuth();
  const [elections, setElections] = useState<Election[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [activeElection, setActiveElection] = useState<Election | null>(null);
  const [activeStats, setActiveStats] = useState<{ postes_count: number; voters_count: number } | null>(null);
  const [voteTimeline, setVoteTimeline] = useState<{ date: string; votes: number }[]>([]);
  const [electionsStatus, setElectionsStatus] = useState<{ name: string; value: number; fill: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const loadDashboardData = async () => {
    if (!admin) return;
    try {
      setLoading(true); setErrorMsg('');
      
      let queryBuilder = supabase
        .from('elections')
        .select('*');
      
      if (admin.role !== 'super_admin' && admin.amicale_id) {
        queryBuilder = queryBuilder.eq('amicale_id', admin.amicale_id);
      }
      
      const { data: elecDocs, error: elecErr } = await queryBuilder;
      if (elecErr) throw elecErr;

      const list = (elecDocs || []) as Election[];
      list.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
      setElections(list);

      // Compute electionsStatus
      const statusCounts = list.reduce((acc, el) => {
        acc[el.statut] = (acc[el.statut] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const statusColors: Record<string, string> = {
        brouillon: '#9ca3af', // gray-400
        ouverte: '#f0b429', // uni-gold
        fermee: '#f87171', // red-400
        publiee: '#c084fc', // purple-400
      };
      
      const statusLabels: Record<string, string> = {
        brouillon: 'Brouillon',
        ouverte: 'Ouvert',
        fermee: 'Clos',
        publiee: 'Publié',
      };

      setElectionsStatus(
        Object.entries(statusCounts).map(([statut, count]) => ({
          name: statusLabels[statut] || statut,
          value: count,
          fill: statusColors[statut] || '#ffffff',
        }))
      );

      const openElec = list.find(e => e.statut === 'ouverte');
      let targetAmicaleId = admin.amicale_id;
      if (admin.role === 'super_admin' && openElec) targetAmicaleId = openElec.amicale_id;

      let studentQuery = supabase
        .from('students')
        .select('id', { count: 'exact', head: true });
      
      if (targetAmicaleId) {
        studentQuery = studentQuery.eq('amicale_id', targetAmicaleId);
      }
      
      const { count: studentCount, error: studErr } = await studentQuery;
      if (studErr) throw studErr;
      setTotalStudents(studentCount || 0);

      if (openElec) {
        setActiveElection(openElec);
        
        const { count: postesCount, error: postErr } = await supabase
          .from('postes')
          .select('id', { count: 'exact', head: true })
          .eq('election_id', openElec.id);
        if (postErr) throw postErr;

        const { data: emargementDocs, error: emErr } = await supabase
          .from('emargements')
          .select('student_id, created_at')
          .eq('election_id', openElec.id);
        if (emErr) throw emErr;

        const voterIds = new Set((emargementDocs || []).map(d => d.student_id));
        setActiveStats({ postes_count: postesCount || 0, voters_count: voterIds.size });

        // Compute vote timeline
        const timelineCounts = (emargementDocs || []).reduce((acc, em) => {
          if (!em.created_at) return acc;
          const date = new Date(em.created_at).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' });
          acc[date] = (acc[date] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        const timelineArray = Object.entries(timelineCounts).map(([date, votes]) => ({ date, votes }));
        setVoteTimeline(timelineArray);
      } else {
        setActiveElection(null); setActiveStats(null); setVoteTimeline([]);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Erreur lors de la récupération des données.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (admin) loadDashboardData(); }, [admin]);

  const activeParticipationRate = activeStats && totalStudents > 0
    ? (activeStats.voters_count / totalStudents) * 100 : 0;

  const statusConfig: Record<string, { label: string; className: string }> = {
    brouillon: { label: 'Brouillon', className: 'badge-gray' },
    ouverte: { label: 'Ouvert', className: 'badge-live' },
    fermee: { label: 'Clos', className: 'text-red-400 bg-red-500/10 border border-red-500/20 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider' },
    publiee: { label: 'Publié', className: 'badge-purple' },
  };

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric'
  });

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4">
        <div className="relative w-12 h-12">
          <div className="w-12 h-12 rounded-full border border-uni-gold/20 absolute" />
          <div className="w-12 h-12 rounded-full border-2 border-transparent border-t-uni-gold animate-spin absolute" />
        </div>
        <p className="text-xs font-mono text-gray-500 uppercase tracking-widest">Chargement...</p>
      </div>
    );
  }

  const statCards = [
    {
      icon: '🗳️',
      label: 'Scrutin en cours',
      value: activeElection ? 1 : 0,
      badge: activeElection
        ? <span className="badge-live">Actif</span>
        : <span className="badge-gray">Aucun</span>,
      color: 'from-uni-gold/15 to-uni-gold/5',
      border: 'border-uni-gold/15',
    },
    {
      icon: '👥',
      label: 'Étudiants inscrits',
      value: totalStudents,
      badge: null,
      color: 'from-uni-green/15 to-uni-green/5',
      border: 'border-uni-green/15',
    },
    {
      icon: '📊',
      label: activeElection ? 'Suffrages exprimés' : 'Aucun vote en cours',
      value: activeStats?.voters_count ?? 0,
      badge: activeElection
        ? <span className="text-xs font-bold text-uni-gold">
            {activeParticipationRate.toFixed(1)}%
          </span>
        : null,
      color: 'from-purple-500/10 to-purple-500/5',
      border: 'border-purple-500/15',
    },
    {
      icon: '🏆',
      label: 'Postes à pourvoir',
      value: activeStats?.postes_count ?? 0,
      badge: null,
      color: 'from-blue-500/10 to-blue-500/5',
      border: 'border-blue-500/15',
    },
  ];

  return (
    <div className="space-y-8 animate-fade-up">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-mono text-uni-gold uppercase tracking-widest mb-1">Vue d'ensemble</p>
          <h1 className="text-3xl font-display font-black text-white">Tableau de Bord</h1>
          <p className="text-sm text-gray-500 mt-1">Statistiques de participation en temps réel</p>
        </div>
        <button
          onClick={loadDashboardData}
          className="flex items-center gap-2 text-xs font-semibold text-gray-500 hover:text-gray-300 bg-white/4 hover:bg-white/7 border border-white/6 px-3 py-2 rounded-xl transition-all cursor-pointer"
        >
          <Activity className="w-3.5 h-3.5" />
          Actualiser
        </button>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-uni-red/8 border border-uni-red/15 text-xs font-medium text-red-300 flex gap-2.5 items-center">
          <AlertCircle className="w-4 h-4 text-uni-red-light shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, i) => (
          <div
            key={i}
            className={`stat-card bg-gradient-to-br ${card.color} border ${card.border} animate-fade-up-delay-${Math.min(i + 1, 3)}`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-black/20 border border-white/5 flex items-center justify-center text-xl">
                {card.icon}
              </div>
              {card.badge}
            </div>
            <div>
              <p className="text-3xl font-display font-black text-white">{card.value}</p>
              <p className="text-xs text-gray-500 mt-1">{card.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Participation Bar */}
      {activeElection && totalStudents > 0 && (
        <div className="glassmorphism p-6 rounded-2xl border border-uni-gold/10 space-y-4 animate-fade-up-delay-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-5 rounded-full bg-uni-gold" />
              <span className="text-sm font-display font-bold text-white">Taux de Participation</span>
            </div>
            <span className="text-2xl font-display font-black text-gradient-gold">
              {activeParticipationRate.toFixed(1)}%
            </span>
          </div>
          <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{
                width: `${Math.min(activeParticipationRate, 100)}%`,
                background: 'linear-gradient(90deg, #f0b429, #f7cc56)'
              }}
            />
          </div>
          <p className="text-[11px] text-gray-500">
            {activeStats?.voters_count} voter(s) sur {totalStudents} étudiants inscrits
          </p>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        {/* Vote Timeline Chart */}
        <div className="glassmorphism p-6 rounded-2xl border border-white/5 space-y-4 animate-fade-up-delay-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-uni-gold" />
            <h3 className="text-sm font-display font-bold text-white">Évolution des Votes (Actif)</h3>
          </div>
          <div className="h-48 w-full">
            {activeElection && voteTimeline.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={voteTimeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorVotes" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f0b429" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#f0b429" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#111', borderColor: 'rgba(240,180,41,0.2)', borderRadius: '12px', fontSize: '12px' }}
                    itemStyle={{ color: '#f0b429', fontWeight: 'bold' }}
                  />
                  <Area type="monotone" dataKey="votes" stroke="#f0b429" strokeWidth={2} fillOpacity={1} fill="url(#colorVotes)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-xs text-gray-600 font-medium bg-white/2 rounded-xl border border-white/5">
                {activeElection ? "Pas encore de votes" : "Aucun scrutin actif"}
              </div>
            )}
          </div>
        </div>

        {/* Elections Status Pie Chart */}
        <div className="glassmorphism p-6 rounded-2xl border border-white/5 space-y-4 animate-fade-up-delay-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PieChartIcon className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-display font-bold text-white">Répartition des Scrutins</h3>
            </div>
          </div>
          <div className="h-48 w-full flex items-center justify-center relative">
            {electionsStatus.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={electionsStatus}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {electionsStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#111', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '12px' }}
                    itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full w-full text-xs text-gray-600 font-medium bg-white/2 rounded-xl border border-white/5">
                Aucune donnée
              </div>
            )}
            
            {/* Legend for Pie Chart inside chart area or aside */}
            {electionsStatus.length > 0 && (
              <div className="absolute right-0 top-0 bottom-0 flex flex-col justify-center gap-3 w-1/3">
                {electionsStatus.map((entry, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.fill }} />
                    <span className="text-[10px] text-gray-400 font-medium">{entry.name} ({entry.value})</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 animate-fade-up-delay-4">

        {/* Recent Elections */}
        <div className="lg:col-span-2 glassmorphism p-6 rounded-2xl border border-white/5 space-y-5">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-uni-gold" />
              <h3 className="text-sm font-display font-bold text-white">Activité des Scrutins</h3>
            </div>
            <Link to="/admin/elections" className="text-[11px] font-bold text-uni-gold hover:text-uni-gold-light flex items-center gap-1 transition-colors">
              Gérer <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {elections.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <Inbox className="w-10 h-10 mx-auto text-gray-700" />
              <p className="text-sm font-semibold text-gray-600">Aucun scrutin créé</p>
              <p className="text-xs text-gray-700">Commencez par créer votre première élection.</p>
              <Link to="/admin/elections" className="btn-gold inline-flex items-center gap-1.5 px-4 py-2 text-xs mt-2">
                <Vote className="w-3.5 h-3.5" /> Créer un scrutin
              </Link>
            </div>
          ) : (
            <div className="space-y-1">
              {elections.slice(0, 6).map((e) => {
                const cfg = statusConfig[e.statut];
                return (
                  <div
                    key={e.id}
                    className="flex items-center justify-between gap-4 py-3 px-3 rounded-xl hover:bg-white/3 transition-colors cursor-default"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-white/4 border border-white/6 flex items-center justify-center shrink-0">
                        <Vote className="w-3.5 h-3.5 text-gray-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white truncate">{e.titre}</p>
                        <p className="text-[10px] text-gray-600 mt-0.5">Créé le {formatDate(e.created_at)}</p>
                      </div>
                    </div>
                    <span className={cfg?.className}>{cfg?.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Active Election Focus */}
        <div className="glassmorphism p-6 rounded-2xl border border-white/5 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-4 h-4 text-uni-gold" />
              <h3 className="text-sm font-display font-bold text-white">Scrutin Actif</h3>
            </div>

            {activeElection ? (
              <div className="space-y-4">
                <div
                  className="p-4 rounded-xl border border-uni-gold/15 relative overflow-hidden"
                  style={{ background: 'linear-gradient(135deg, rgba(240,180,41,0.08), rgba(240,180,41,0.03))' }}
                >
                  <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-uni-gold animate-ping-slow" />
                  <span className="text-[9px] font-mono font-bold text-uni-gold uppercase tracking-widest block mb-2">En cours</span>
                  <p className="font-display font-extrabold text-white text-sm leading-snug">{activeElection.titre}</p>
                </div>

                <div className="space-y-3">
                  {[
                    { label: 'Postes configurés', value: activeStats?.postes_count ?? 0 },
                    { label: 'Suffrages exprimés', value: activeStats?.voters_count ?? 0 },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">{label}</span>
                      <span className="text-sm font-black text-white">{value}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">Participation</span>
                    <span className="text-sm font-black text-gradient-gold">{activeParticipationRate.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 space-y-3">
                <div className="w-12 h-12 mx-auto rounded-full bg-white/4 border border-white/6 flex items-center justify-center">
                  <Users className="w-5 h-5 text-gray-700" />
                </div>
                <p className="text-xs font-semibold text-gray-600">Aucun vote en cours</p>
                <p className="text-[10px] text-gray-700 leading-relaxed">
                  Ouvrez un scrutin depuis l'onglet Élections.
                </p>
              </div>
            )}
          </div>

          {activeElection && (
            <div className="pt-3 border-t border-white/5 grid grid-cols-2 gap-2">
              <Link
                to="/admin/participation"
                className="btn-ghost py-2.5 text-[11px] font-bold text-center flex items-center justify-center gap-1.5"
              >
                <Award className="w-3.5 h-3.5" />
                Émargement
              </Link>
              <Link
                to="/admin/results"
                className="btn-gold py-2.5 text-[11px] text-center flex items-center justify-center gap-1.5"
              >
                <TrendingUp className="w-3.5 h-3.5" />
                Résultats
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
