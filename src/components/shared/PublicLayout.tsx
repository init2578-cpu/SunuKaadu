import React from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useStudentAuth } from '../../context/StudentAuthContext';
import StudentAuthModal from './StudentAuthModal';
import { supabase } from '../../lib/supabase';
import { Vote, ChevronDown, LogOut, User, Menu, X } from 'lucide-react';

export default function PublicLayout() {
  const { student, openAuthModal, logout } = useStudentAuth();
  const navigate = useNavigate();

  const [amicales, setAmicales] = React.useState<any[]>([]);
  const [selectedAmicaleId, setSelectedAmicaleId] = React.useState<string | null>(
    localStorage.getItem('selected_amicale_id')
  );
  const [scrolled, setScrolled] = React.useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const location = useLocation();

  React.useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  React.useEffect(() => {
    const fetchAmicales = async () => {
      try {
        const { data, error } = await supabase
          .from('amicales')
          .select('*')
          .order('nom', { ascending: true });
        
        if (error) throw error;
        const list = data || [];
        setAmicales(list);

        // Si l'amicale sélectionnée n'existe pas dans la base Supabase (ex: ancien ID Firebase ou UUID inexistant)
        const storedId = localStorage.getItem('selected_amicale_id');
        if (storedId) {
          const exists = list.some(a => a.id === storedId);
          if (!exists) {
            localStorage.removeItem('selected_amicale_id');
            setSelectedAmicaleId(null);
          }
        }
      } catch (e) { console.error(e); }
    };
    fetchAmicales();

    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleSelectAmicale = (id: string) => {
    localStorage.setItem('selected_amicale_id', id);
    setSelectedAmicaleId(id);
    window.dispatchEvent(new Event('amicale_changed'));
  };

  const handleVoteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (student) navigate('/voter');
    else openAuthModal();
  };

  const handleStudentLogout = async () => {
    if (confirm("Voulez-vous vous déconnecter de votre espace électeur ?")) {
      await logout();
      navigate('/');
    }
  };

  const currentAmicale = amicales.find(a => a.id === selectedAmicaleId);

  return (
    <div className="min-h-screen bg-uni-bg text-gray-100 flex flex-col justify-between relative overflow-x-hidden">

      {/* ── Ambient Background ── */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full bg-[#1E4DB7]/6 blur-[120px]" />
        <div className="absolute top-1/3 right-[-15%] w-[400px] h-[400px] rounded-full bg-[#E81B5A]/4 blur-[100px]" />
        <div className="absolute bottom-0 left-[-10%] w-[300px] h-[300px] rounded-full bg-[#1E4DB7]/5 blur-[80px]" />
        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '60px 60px'
          }}
        />
      </div>

      {/* ── Header ── */}
      <header
        className={`relative z-40 sticky top-0 transition-all duration-300 ${
          scrolled
            ? 'bg-uni-bg/90 backdrop-blur-xl border-b border-white/6 shadow-lg shadow-black/20'
            : 'bg-transparent border-b border-white/4 backdrop-blur-sm'
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-6">

          {/* Logo + Brand */}
          <Link to="/" className="flex items-center gap-3 shrink-0 group">
            <div className="relative">
              <div className="absolute inset-0 rounded-xl bg-uni-gold/20 blur-md group-hover:bg-uni-gold/30 transition-all" />
              <img
                src="/logo.png"
                className="relative h-9 w-auto object-contain rounded-xl"
                alt="Sunu Kàddu"
              />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-lg font-display font-black tracking-tight text-gradient-white-gold">
                Sunu Kàddu
              </span>
              <span className="text-[9px] font-mono text-gray-500 uppercase tracking-widest">Vote Électronique 🇸🇳</span>
            </div>
          </Link>

          {/* Amicale Switcher */}
          {selectedAmicaleId && amicales.length > 0 && (
            <div className="hidden md:flex items-center gap-2 bg-white/5 border border-white/8 rounded-xl px-3 py-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#E81B5A] animate-pulse" />
              <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider">Amicale</span>
              <select
                value={selectedAmicaleId}
                onChange={(e) => handleSelectAmicale(e.target.value)}
                className="bg-transparent text-[#E81B5A] font-bold text-xs focus:outline-none cursor-pointer pr-2"
              >
                {amicales.map(a => (
                  <option key={a.id} value={a.id} className="bg-gray-900 text-white">{a.nom}</option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 text-gray-500" />
            </div>
          )}

          {/* Navigation Desktop */}
          <nav className="hidden sm:flex items-center gap-3">
            <Link to="/" className="text-xs font-semibold text-gray-400 hover:text-white transition-colors px-3 py-2 rounded-xl hover:bg-white/5">
              Accueil
            </Link>
            <Link to="/candidats" className="text-xs font-semibold text-gray-400 hover:text-white transition-colors px-3 py-2 rounded-xl hover:bg-white/5">
              Candidats
            </Link>
            <Link to="/resultats" className="text-xs font-semibold text-gray-400 hover:text-white transition-colors px-3 py-2 rounded-xl hover:bg-white/5">
              Résultats
            </Link>
          </nav>

          {/* User Actions & Mobile Toggle */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Vote CTA */}
            {student ? (
              <div className="flex items-center gap-2 bg-white/5 border border-white/8 rounded-xl px-3 py-2">
                <div className="w-6 h-6 rounded-lg bg-[#1E4DB7]/30 flex items-center justify-center">
                  <User className="w-3.5 h-3.5 text-[#E81B5A]" />
                </div>
                <span className="text-xs font-bold text-white hidden sm:inline max-w-[100px] truncate">
                  {student.prenom?.[0]}. {student.nom}
                </span>
                <button
                  onClick={handleStudentLogout}
                  className="text-[10px] font-black text-uni-red hover:text-uni-red-light transition-colors cursor-pointer sm:ml-1"
                >
                  <LogOut className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={handleVoteClick}
                className="btn-gold px-3 sm:px-4 py-2 sm:py-2.5 text-[10px] sm:text-xs flex items-center gap-1.5 sm:gap-2 cursor-pointer"
              >
                <Vote className="w-3.5 h-3.5" />
                <span>Voter</span>
              </button>
            )}

            <Link
              to="/admin"
              className="hidden sm:block text-[10px] font-bold uppercase tracking-wider text-gray-500 hover:text-gray-300 bg-white/4 hover:bg-white/7 border border-white/6 px-3 py-2 rounded-xl transition-all"
            >
              Admin 🔑
            </Link>

            {/* Mobile Hamburger */}
            <button 
              className="sm:hidden p-2 -mr-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* ── Mobile Menu Dropdown ── */}
        <div className={`sm:hidden absolute top-full left-0 w-full bg-uni-bg/95 backdrop-blur-xl border-b border-white/10 shadow-2xl transition-all duration-300 origin-top ${isMobileMenuOpen ? 'opacity-100 scale-y-100' : 'opacity-0 scale-y-0 pointer-events-none'}`}>
          <div className="flex flex-col gap-2 p-4">
            <Link to="/" className="px-4 py-3 rounded-xl bg-white/5 text-sm font-semibold text-white flex items-center gap-3">
              Accueil
            </Link>
            <Link to="/candidats" className="px-4 py-3 rounded-xl bg-white/5 text-sm font-semibold text-white flex items-center gap-3">
              Candidats
            </Link>
            <Link to="/resultats" className="px-4 py-3 rounded-xl bg-white/5 text-sm font-semibold text-white flex items-center gap-3">
              Résultats
            </Link>
            <Link to="/admin" className="px-4 py-3 rounded-xl bg-white/5 text-sm font-bold text-uni-gold flex items-center gap-3">
              Connexion Admin 🔑
            </Link>
            
            {selectedAmicaleId && amicales.length > 0 && (
              <div className="mt-2 pt-4 border-t border-white/10 flex flex-col gap-2">
                <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider px-2">Changer d'Amicale</span>
                <select
                  value={selectedAmicaleId}
                  onChange={(e) => {
                    handleSelectAmicale(e.target.value);
                    setIsMobileMenuOpen(false);
                  }}
                  className="bg-white/5 text-[#E81B5A] font-bold text-sm focus:outline-none rounded-xl px-4 py-3 cursor-pointer w-full"
                >
                  {amicales.map(a => (
                    <option key={a.id} value={a.id} className="bg-gray-900 text-white">{a.nom}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="relative z-10 flex-grow w-full max-w-7xl mx-auto px-6 md:px-10 py-8 flex items-center justify-center min-h-[70vh]">
        {!selectedAmicaleId ? (
          /* ONBOARDING — Sélection Amicale */
          <div className="w-full max-w-3xl space-y-10 py-8 animate-fade-up">

            <div className="text-center space-y-5">
              <div className="inline-flex p-4 bg-gradient-to-br from-[#1E4DB7]/15 to-[#E81B5A]/10 rounded-3xl border border-[#1E4DB7]/20 text-3xl shadow-lg shadow-black/20">
                🇸🇳
              </div>
              <h1 className="text-4xl md:text-6xl font-display font-black tracking-tight text-white leading-tight">
                Choisissez votre<br />
                <span className="text-gradient-senegal">Amicale</span>
              </h1>
              <p className="text-sm md:text-base text-gray-400 max-w-lg mx-auto leading-relaxed">
                Bienvenue sur la plateforme de vote électronique universitaire.
                Sélectionnez votre amicale pour accéder à votre portail dédié.
              </p>
            </div>

            {amicales.length === 0 ? (
              <div className="glassmorphism p-14 text-center rounded-3xl">
                <div className="w-8 h-8 rounded-full border-2 border-uni-gold border-t-transparent animate-spin mx-auto mb-4" />
                <p className="text-sm text-gray-500">Chargement des amicales...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {amicales.map((am, i) => (
                  <div
                    key={am.id}
                    onClick={() => handleSelectAmicale(am.id)}
                    className={`glassmorphism p-7 rounded-2xl cursor-pointer card-hover group space-y-4 animate-fade-up-delay-${Math.min(i + 1, 3)}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1E4DB7]/30 to-[#1E4DB7]/10 border border-[#1E4DB7]/20 flex items-center justify-center text-[#E81B5A] text-lg">
                        🏛️
                      </div>
                      <span className="text-[10px] font-mono text-gray-600 uppercase tracking-widest">Amicale</span>
                    </div>
                    <div>
                      <h3 className="text-base font-display font-extrabold text-white group-hover:text-gradient-gold transition-all">
                        {am.nom}
                      </h3>
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed line-clamp-2">
                        {am.description || "Regroupement des étudiants pour ce scrutin électoral."}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 text-[#E81B5A] text-xs font-bold group-hover:translate-x-1 transition-transform">
                      <span>Accéder au portail</span>
                      <span>→</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <Outlet />
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="relative z-10 border-t border-white/5 py-6 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3">
          <p className="text-xs text-gray-600">© 2026 Amicale Étudiante – Plateforme de Vote Électronique</p>
          <p className="text-xs text-gray-600">
            {currentAmicale
              ? <span>Portail de <span className="text-uni-gold font-semibold">{currentAmicale.nom}</span> 🇸🇳</span>
              : "Développé pour les amicales universitaires du Sénégal 🇸🇳"
            }
          </p>
        </div>
      </footer>

      <StudentAuthModal />
    </div>
  );
}
