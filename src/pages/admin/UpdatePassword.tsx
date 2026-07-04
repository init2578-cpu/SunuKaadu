import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Shield, ArrowLeft, Lock, ShieldAlert, CheckCircle2 } from 'lucide-react';

export default function UpdatePassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSessionValid, setIsSessionValid] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    // Vérifier si l'utilisateur a bien été connecté via le lien de réinitialisation
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setIsSessionValid(true);
      } else {
        setError("Lien invalide ou expiré. Veuillez demander une nouvelle réinitialisation.");
      }
    });
  }, []);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess('');

    if (password.length < 6) {
      return setError("Le mot de passe doit contenir au moins 6 caractères.");
    }
    if (password !== confirmPassword) {
      return setError("Les mots de passe ne correspondent pas.");
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      
      if (error) throw error;
      
      setSuccess("Mot de passe mis à jour avec succès ! Redirection...");
      setTimeout(() => navigate('/admin'), 2000);
    } catch (err: any) {
      setError(err.message || "Erreur lors de la mise à jour du mot de passe.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-uni-bg text-gray-100 flex flex-col justify-center items-center p-6 relative overflow-hidden">
      {/* Ambient Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-[500px] bg-gradient-to-b from-uni-green/10 to-transparent" />
        <div className="absolute bottom-[10%] left-[5%] w-[300px] h-[300px] rounded-full bg-uni-gold/5 blur-[100px]" />
        <div className="absolute top-[20%] right-[5%] w-[200px] h-[200px] rounded-full bg-uni-green/8 blur-[80px]" />
      </div>

      <div className="relative z-10 w-full max-w-md animate-fade-up">
        {/* Back Link */}
        <Link to="/admin/login" className="inline-flex items-center gap-2 text-xs font-semibold text-gray-500 hover:text-gray-300 mb-8 transition-colors group">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span>Retour à la connexion</span>
        </Link>

        {/* Card */}
        <div
          className="rounded-3xl p-8 space-y-7 border border-white/8 relative overflow-hidden"
          style={{ background: 'linear-gradient(145deg, rgba(10,22,16,0.9), rgba(7,15,10,0.95))' }}
        >
          {/* Top glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-px bg-gradient-to-r from-transparent via-uni-gold/50 to-transparent" />

          {/* Header */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-uni-gold/20 to-uni-green/10 border border-uni-gold/20 mb-1">
              <Shield className="w-7 h-7 text-uni-gold" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-black text-white">Nouveau mot de passe</h1>
              <p className="text-xs text-gray-500 mt-1">
                Définissez un nouveau mot de passe sécurisé
              </p>
            </div>
          </div>

          {/* Alerts */}
          {error && (
            <div className="p-3.5 rounded-xl bg-uni-red/8 border border-uni-red/20 text-xs font-medium text-red-300 leading-relaxed flex gap-2.5 items-start animate-fade-up">
              <ShieldAlert className="w-4 h-4 shrink-0 text-uni-red-light mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="p-3.5 rounded-xl bg-emerald-500/8 border border-emerald-500/20 text-xs font-medium text-emerald-400 leading-relaxed flex gap-2.5 items-start animate-fade-up">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          {isSessionValid ? (
            <form className="space-y-5" onSubmit={handleUpdatePassword}>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 block">Nouveau mot de passe</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-600" />
                  <input
                    type="password"
                    placeholder="6 caractères minimum"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading || !!success}
                    className="input-field w-full pl-10 pr-4 py-3 text-sm disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 block">Confirmer le mot de passe</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-600" />
                  <input
                    type="password"
                    placeholder="Ressaisissez le mot de passe"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={loading || !!success}
                    className="input-field w-full pl-10 pr-4 py-3 text-sm disabled:opacity-50"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !!success}
                className="btn-gold w-full py-3.5 flex items-center justify-center gap-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? (
                  <div className="w-4 h-4 rounded-full border-2 border-uni-green-dark border-t-transparent animate-spin" />
                ) : (
                  <span>Enregistrer le mot de passe</span>
                )}
              </button>
            </form>
          ) : (
            !error && (
              <div className="flex justify-center p-8">
                <div className="w-6 h-6 rounded-full border-2 border-uni-gold border-t-transparent animate-spin" />
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
