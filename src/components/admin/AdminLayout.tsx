import React, { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext';
import {
  LayoutDashboard,
  Vote,
  Award,
  Users,
  CheckSquare,
  BarChart3,
  LogOut,
  Home,
  User,
  Shield,
  ChevronRight,
  UserCog,
  Menu,
  X
} from 'lucide-react';

export default function AdminLayout() {
  const { admin, logout } = useAdminAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const menuItems = [
    { name: 'Tableau de bord', path: '/admin', icon: LayoutDashboard, roles: ['delegue', 'super_admin'] },
    { name: 'Amicales', path: '/admin/amicales', icon: Shield, roles: ['super_admin'] },
    { name: 'Utilisateurs', path: '/admin/utilisateurs', icon: UserCog, roles: ['super_admin'] },
    { name: 'Élections', path: '/admin/elections', icon: Vote, roles: ['delegue', 'super_admin'] },
    { name: 'Postes & Candidats', path: '/admin/postes-candidats', icon: Award, roles: ['delegue', 'super_admin'] },
    { name: 'Étudiants', path: '/admin/etudiants', icon: Users, roles: ['delegue', 'super_admin'] },
    { name: 'Participation', path: '/admin/participation', icon: CheckSquare, roles: ['delegue', 'super_admin'] },
    { name: 'Résultats', path: '/admin/results', icon: BarChart3, roles: ['delegue', 'super_admin'] },
  ].filter(item => !item.roles || (admin && item.roles.includes(admin.role)));

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  const roleBadge = {
    super_admin: { label: 'Super Admin', color: 'text-[#FF3370] bg-[#E81B5A]/10 border-[#E81B5A]/20' },
    delegue: { label: 'Délégué', color: 'text-[#2E62D9] bg-[#1E4DB7]/10 border-[#1E4DB7]/20' },
    representant: { label: 'Représentant', color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
  };
  const badge = admin ? roleBadge[admin.role] : null;

  return (
    <div className="min-h-screen bg-uni-bg text-gray-100 flex flex-col md:flex-row relative">

      {/* ── Ambient Background ── */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-0 left-0 w-[600px] h-[600px] rounded-full bg-uni-green/6 blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-uni-gold/3 blur-[100px]" />
      </div>

      {/* ── Mobile Overlay ── */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden" 
          onClick={() => setIsMobileMenuOpen(false)} 
        />
      )}

      {/* ── Sidebar ── */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-64 shrink-0 flex flex-col justify-between border-r border-white/5 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ background: 'linear-gradient(180deg, #09091a 0%, #07080f 100%)' }}
      >
        <div className="p-6 space-y-8">
          {/* Brand */}
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="relative">
                <div className="absolute inset-0 rounded-xl bg-uni-blue/15 blur-md group-hover:bg-uni-blue/25 transition-all" />
                <img src="/logo.png" className="relative h-8 w-auto object-contain rounded-xl" alt="Logo" />
              </div>
              <div>
                <p className="text-sm font-display font-black text-gradient-white-gold leading-tight">Admin Panel</p>
                <p className="text-[9px] font-mono text-gray-600 uppercase tracking-widest">Sunu Kàddu 🇸🇳</p>
              </div>
            </Link>
            <button 
              className="md:hidden p-1.5 text-gray-400 hover:text-white rounded-lg bg-white/5"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Nav */}
          <nav className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path ||
                (item.path !== '/admin' && location.pathname.startsWith(item.path));
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`sidebar-item ${isActive ? 'active' : ''}`}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isActive ? 'bg-uni-rose/20 text-uni-rose' : 'bg-white/5 text-gray-500'} transition-colors`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <span className="flex-1">{item.name}</span>
                  {isActive && <ChevronRight className="w-3.5 h-3.5 text-uni-rose/50" />}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="p-5 border-t border-white/5 space-y-3">
          {admin && (
            <Link 
              to={admin.role === 'representant' ? "/representant/profile" : "/admin/profile"}
              className="p-3 rounded-xl bg-white/3 hover:bg-white/5 border border-white/5 hover:border-white/10 transition-all flex items-center gap-3 group"
              title="Modifier mon profil"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-uni-blue/40 to-uni-blue/20 border border-white/10 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <User className="w-4 h-4 text-uni-rose" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white truncate group-hover:text-uni-blue transition-colors">{admin.prenom || ''} {admin.nom || 'Admin'}</p>
                <p className="text-[10px] text-gray-600 truncate">{admin.email}</p>
              </div>
            </Link>
          )}

          {admin && badge && (
            <div className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-lg border ${badge.color}`}>
              <Shield className="w-3 h-3" />
              <span>{badge.label}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 pt-1">
            <Link
              to="/"
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider text-gray-500 hover:text-gray-300 bg-white/3 hover:bg-white/6 border border-white/5 transition-all"
            >
              <Home className="w-3 h-3" />
              <span>Public</span>
            </Link>
            <button
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider text-uni-red hover:text-uni-red-light bg-uni-red/5 hover:bg-uni-red/10 border border-uni-red/10 transition-all cursor-pointer"
              onClick={handleLogout}
            >
              <LogOut className="w-3 h-3" />
              <span>Quitter</span>
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <div className="relative z-10 flex-grow flex flex-col min-h-0">
        {/* Top Bar */}
        <header className="border-b border-white/5 py-3.5 px-4 md:px-8 flex justify-between items-center sticky top-0 z-20 backdrop-blur-xl"
           style={{ background: 'rgba(7, 8, 15, 0.9)' }}
        >
          <div className="flex items-center gap-3">
            <button 
              className="md:hidden p-1.5 -ml-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden md:block w-px h-5 bg-[#1E4DB7]/60" />
            <h2 className="text-xs font-mono font-semibold uppercase tracking-widest text-[#2E62D9] hidden sm:block">
              Console d'Administration
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-gray-500 font-mono">
              <div className="relative flex">
                <span className="animate-ping-slow absolute inline-flex h-2 w-2 rounded-full bg-emerald-400 opacity-50" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </div>
              Système en ligne
            </div>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-grow p-6 md:p-8 overflow-y-auto max-w-6xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
