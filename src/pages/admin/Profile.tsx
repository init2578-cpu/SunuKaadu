import React, { useState } from 'react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { User, Lock, Save, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function Profile() {
  const { admin, updateProfile } = useAdminAuth();
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Info State
  const [nom, setNom] = useState(admin?.nom || '');
  const [prenom, setPrenom] = useState(admin?.prenom || '');
  const [email, setEmail] = useState(admin?.email || '');

  // Password State
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleUpdateInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    if (!admin) return;
    const updateData: any = { nom, prenom };
    if (admin.role === 'super_admin') {
      updateData.email = email;
    }

    const { success, error } = await updateProfile(updateData);
    if (success) {
      setSuccessMsg('Informations personnelles mises à jour avec succès.' + (error || ''));
    } else {
      setErrorMsg(error || 'Erreur lors de la mise à jour.');
    }
    setLoading(false);
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (password.length < 6) {
      setErrorMsg('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Les mots de passe ne correspondent pas.');
      return;
    }

    setLoading(true);
    const { success, error } = await updateProfile({ password });
    if (success) {
      setSuccessMsg('Mot de passe mis à jour avec succès.');
      setPassword('');
      setConfirmPassword('');
    } else {
      setErrorMsg(error || 'Erreur lors de la mise à jour du mot de passe.');
    }
    setLoading(false);
  };

  if (!admin) return null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-display font-bold text-white">Mon Profil</h1>
        <p className="text-sm text-gray-400 mt-1">Gérez vos informations personnelles et votre sécurité.</p>
      </header>

      {errorMsg && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm">{errorMsg}</p>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-xl flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <p className="text-sm">{successMsg}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Informations Personnelles */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-uni-blue/20 text-uni-blue flex items-center justify-center">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Informations Personnelles</h2>
              <p className="text-xs text-gray-400">Modifiez votre identité sur la plateforme</p>
            </div>
          </div>

          <form onSubmit={handleUpdateInfo} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Adresse E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={admin.role !== 'super_admin'}
                className={`w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white transition-all ${
                  admin.role !== 'super_admin' ? 'opacity-50 cursor-not-allowed' : 'focus:border-uni-blue focus:ring-1 focus:ring-uni-blue'
                }`}
              />
              {admin.role !== 'super_admin' && (
                <p className="text-[10px] text-gray-500 mt-1">L'adresse e-mail ne peut pas être modifiée.</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Prénom</label>
                <input
                  type="text"
                  value={prenom}
                  onChange={(e) => setPrenom(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-uni-blue focus:ring-1 focus:ring-uni-blue transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Nom</label>
                <input
                  type="text"
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-uni-blue focus:ring-1 focus:ring-uni-blue transition-all"
                  required
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-uni-blue hover:bg-uni-blue-light text-white font-bold py-2.5 px-4 rounded-xl transition-all disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {loading ? 'Enregistrement...' : 'Enregistrer les modifications'}
              </button>
            </div>
          </form>
        </div>

        {/* Sécurité */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-uni-gold/20 text-uni-gold flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Sécurité</h2>
              <p className="text-xs text-gray-400">Mettez à jour votre mot de passe</p>
            </div>
          </div>

          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Nouveau mot de passe</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 6 caractères"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-uni-gold focus:ring-1 focus:ring-uni-gold transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Confirmer le mot de passe</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Retapez le mot de passe"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-uni-gold focus:ring-1 focus:ring-uni-gold transition-all"
                required
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-uni-gold/20 hover:bg-uni-gold/30 text-uni-gold font-bold py-2.5 px-4 rounded-xl border border-uni-gold/30 transition-all disabled:opacity-50"
              >
                <Lock className="w-4 h-4" />
                {loading ? 'Mise à jour...' : 'Mettre à jour le mot de passe'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
