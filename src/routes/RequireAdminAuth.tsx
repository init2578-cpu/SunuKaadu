import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';

interface RequireAdminAuthProps {
  allowedRoles?: ('super_admin' | 'delegue' | 'representant')[];
}

export default function RequireAdminAuth({ allowedRoles }: RequireAdminAuthProps) {
  const { admin, loading } = useAdminAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-uni-bg flex flex-col items-center justify-center p-6">
        <div className="w-12 h-12 rounded-full border-4 border-uni-gold border-t-transparent animate-spin mb-4" />
        <p className="text-gray-400 font-display font-medium text-sm">Chargement de la session...</p>
      </div>
    );
  }

  if (!admin) {
    // Redirige vers /representant/login ou /admin/login selon le portail demandé
    const isRepPath = location.pathname.startsWith('/representant');
    const redirectPath = isRepPath ? '/representant/login' : '/admin/login';
    return <Navigate to={redirectPath} state={{ from: location }} replace />;
  }

  // Si des rôles sont spécifiés et que l'utilisateur n'a pas un rôle autorisé
  if (allowedRoles && !allowedRoles.includes(admin.role)) {
    const fallbackPath = admin.role === 'representant' ? '/representant/dashboard' : '/admin';
    return <Navigate to={fallbackPath} replace />;
  }

  return <Outlet />;
}
