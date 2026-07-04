import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Auth Provider
import { AdminAuthProvider } from './context/AdminAuthContext';
import { StudentAuthProvider } from './context/StudentAuthContext';

// Route Guards
import RequireAdminAuth from './routes/RequireAdminAuth';

// Layouts
import PublicLayout from './components/shared/PublicLayout';
import AdminLayout from './components/admin/AdminLayout';

// Public Pages
import Home from './pages/public/Home';
import Voter from './pages/public/Voter';
import Resultats from './pages/public/Resultats';
import Candidats from './pages/public/Candidats';

// Admin Pages
import Login from './pages/admin/Login';
import UpdatePassword from './pages/admin/UpdatePassword';
import Dashboard from './pages/admin/Dashboard';
import Elections from './pages/admin/Elections';
import PostesCandidats from './pages/admin/PostesCandidats';
import Etudiants from './pages/admin/Etudiants';
import Participation from './pages/admin/Participation';
import ResultatsAdmin from './pages/admin/ResultatsAdmin';
import Amicales from './pages/admin/Amicales';
import AmicaleDetails from './pages/admin/AmicaleDetails';
import Profile from './pages/admin/Profile';
import Utilisateurs from './pages/admin/Utilisateurs';

// Representant Pages
import RepresentantLogin from './pages/representant/Login';
import RepresentantDashboard from './pages/representant/Dashboard';

function App() {
  return (
    <AdminAuthProvider>
      <StudentAuthProvider>
        <Router>
          <Routes>
            {/* Espace Public (Vitrine, Vote, Résultats) */}
            <Route path="/" element={<PublicLayout />}>
              <Route index element={<Home />} />
              <Route path="candidats" element={<Candidats />} />
              <Route path="voter" element={<Voter />} />
              <Route path="resultats" element={<Resultats />} />
            </Route>

            {/* Page de Connexion Admin (Hors du Layout Admin sécurisé) */}
            <Route path="/admin/login" element={<Login />} />
            <Route path="/admin/update-password" element={<UpdatePassword />} />

            {/* Espace Admin (Sécurisé par le garde de route) */}
            <Route path="/admin" element={<RequireAdminAuth />}>
              <Route element={<AdminLayout />}>
                <Route index element={<Dashboard />} />
                
                {/* Amicales et Utilisateurs gérés uniquement par les Super Admins */}
                <Route element={<RequireAdminAuth allowedRoles={['super_admin']} />}>
                  <Route path="amicales" element={<Amicales />} />
                  <Route path="amicales/:id" element={<AmicaleDetails />} />
                  <Route path="utilisateurs" element={<Utilisateurs />} />
                </Route>

                <Route path="elections" element={<Elections />} />
                <Route path="postes-candidats" element={<PostesCandidats />} />
                <Route path="elections/:id/postes" element={<PostesCandidats />} />
                <Route path="etudiants" element={<Etudiants />} />
                <Route path="participation" element={<Participation />} />
                <Route path="results" element={<ResultatsAdmin />} />
                <Route path="profile" element={<Profile />} />
              </Route>
            </Route>

            {/* Espace Représentants (Page de connexion et tableau de bord sécurisé) */}
            <Route path="/representant/login" element={<RepresentantLogin />} />
            
            <Route path="/representant" element={<RequireAdminAuth allowedRoles={['representant']} />}>
              <Route path="dashboard" element={<RepresentantDashboard />} />
              <Route path="profile" element={<Profile />} />
            </Route>

            {/* Page 404 */}
            <Route path="*" element={
              <div className="min-h-screen bg-uni-bg flex flex-col items-center justify-center p-6 text-center">
                <span className="text-5xl mb-4">🔍</span>
                <h2 className="text-3xl font-display font-extrabold text-white mb-2">Page Introuvable</h2>
                <p className="text-gray-400 mb-6">La page demandée n'existe pas ou a été déplacée.</p>
                <a href="/" className="text-uni-gold hover:underline font-semibold">Retourner à l'accueil</a>
              </div>
            } />
          </Routes>
        </Router>
      </StudentAuthProvider>
    </AdminAuthProvider>
  );
}

export default App;
