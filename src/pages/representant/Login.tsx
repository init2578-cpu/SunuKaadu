import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { supabase } from '../../lib/supabase';
import { Users, ArrowLeft, Mail, Lock, ShieldAlert, CheckCircle2, HelpCircle } from 'lucide-react';

export default function RepresentantLogin() {
  const { loginOrActivate, logout, admin } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [personalPassword, setPersonalPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [tempPasswordInput, setTempPasswordInput] = useState('');
  const [step, setStep] = useState<'login' | 'password_personal'>('login');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  // Si déjà connecté comme représentant, rediriger directement
  useEffect(() => {
    if (admin) {
      if (admin.role !== 'representant') {
        // Si connecté avec un autre rôle, le renvoyer vers l'espace admin général
        setError("Redirection vers l'espace administration...");
        setTimeout(() => {
          navigate('/admin', { replace: true });
        }, 1500);
      } else {
        const from = (location.state as any)?.from?.pathname || '/representant/dashboard';
        navigate(from, { replace: true });
      }
    }
  }, [admin, navigate, location]);

  // Phase 1 : Connexion ou Initialisation de l'activation
  const handleLoginOrActivateInit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email.trim() || !email.includes('@')) {
      setError("Veuillez saisir une adresse email valide.");
      return;
    }

    if (!password || password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }

    setLoading(true);
    const emailLower = email.trim().toLowerCase();

    try {
      // 1. Vérifier si l'email existe dans Supabase (table admins)
      const { data: adminDocs, error: adminErr } = await supabase
        .from('admins')
        .select('*')
        .eq('email', emailLower)
        .limit(1);

      if (adminErr) throw adminErr;

      if (!adminDocs || adminDocs.length === 0) {
        setError("Cet email n'est pas autorisé dans l'espace représentant.");
        setLoading(false);
        return;
      }

      const adminData = adminDocs[0];
      const role = adminData.role;
      const is_activated = adminData.is_activated;

      if (role !== 'representant') {
        setError("Accès réservé aux administrateurs/délégués. Redirection vers l'espace d'administration...");
        setTimeout(() => {
          navigate('/admin/login', { replace: true });
        }, 2000);
        setLoading(false);
        return;
      }

      if (is_activated) {
        // Connexion directe
        const result = await loginOrActivate(emailLower, password, true);
        if (result.success) {
          setSuccess("⚡ Connexion réussie.");
          setTimeout(() => {
            const from = (location.state as any)?.from?.pathname || '/representant/dashboard';
            navigate(from, { replace: true });
          }, 1500);
        } else {
          setError(result.error || "Une erreur est survenue lors de la connexion.");
        }
      } else {
        // Si non activé : valider le mot de passe temporaire saisi
        if (adminData.mot_de_passe && adminData.mot_de_passe !== password) {
          setError("Mot de passe temporaire incorrect. Veuillez saisir le mot de passe fourni par votre délégué.");
        } else {
          // Mot de passe temporaire valide : configurer mot de passe personnel
          setTempPasswordInput(password);
          setPassword('');
          setStep('password_personal');
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Une erreur technique est survenue.");
    } finally {
      setLoading(false);
    }
  };

  // Phase 2 : Activer avec nouveau mot de passe personnel
  const handleActivateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!personalPassword || personalPassword.length < 6) {
      setError("Le mot de passe personnel doit contenir au moins 6 caractères.");
      return;
    }

    if (personalPassword !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    try {
      const result = await loginOrActivate(email, tempPasswordInput, true, personalPassword);

      if (result.success) {
        setSuccess("🎉 Votre espace représentant a été activé avec succès ! Veuillez vous reconnecter avec votre nouveau mot de passe.");
        await logout();
        setTimeout(() => {
          handleBackToLogin();
          setSuccess("🎉 Compte activé ! Saisissez votre nouveau mot de passe pour vous connecter.");
        }, 3000);
      } else {
        setError(result.error || "Une erreur est survenue lors de l'activation.");
      }
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'activation.");
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setPassword('');
    setPersonalPassword('');
    setConfirmPassword('');
    setTempPasswordInput('');
    setStep('login');
    setError('');
  };

  return (
    <div className="min-h-screen bg-uni-bg text-gray-100 flex flex-col justify-center items-center p-6 relative">
      {/* Accentuation visuelle d'arrière-plan */}
      <div className="absolute top-0 left-0 w-full h-[400px] bg-gradient-to-b from-uni-gold/10 to-transparent pointer-events-none z-0" />
      <div className="absolute bottom-[10%] left-[10%] w-[250px] h-[250px] rounded-full bg-uni-green/5 blur-[100px] pointer-events-none z-0" />

      <div className="relative z-10 w-full max-w-md">
        {/* Lien Retour */}
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Retour au portail public</span>
        </Link>

        {/* Boîte de Connexion */}
        <div className="glassmorphism p-8 rounded-3xl space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-uni-gold/15 text-uni-gold border border-uni-gold/20 mb-2">
              <Users className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-display font-extrabold text-white">Espace Représentant</h2>
            <p className="text-xs text-gray-400">
              Suivi et résultats de votre candidat.
            </p>
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-uni-red/10 border border-uni-red/20 text-xs font-semibold text-uni-red-light leading-relaxed flex gap-2.5 items-start">
              <ShieldAlert className="w-4 h-4 shrink-0 text-uni-red-light mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-xs font-semibold text-green-400 leading-relaxed flex gap-2.5 items-start">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-green-400 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          {/* ÉTAPE 1 : FORMULAIRE DE CONNEXION DIRECTE */}
          {step === 'login' && (
            <form className="space-y-4" onSubmit={handleLoginOrActivateInit}>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 block">
                  Adresse Email de Représentant
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 w-4 h-4 text-gray-500" />
                  <input 
                    type="email" 
                    placeholder="etudiant@univ.sn"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-uni-gold focus:ring-1 focus:ring-uni-gold transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 block">
                  Mot de passe
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-500" />
                  <input 
                    type="password" 
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-uni-gold transition-all"
                  />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-uni-gold hover:bg-uni-gold-light text-uni-green-dark font-display font-bold py-3 px-6 rounded-xl transition-all shadow-lg shadow-uni-gold/10 hover:shadow-uni-gold/20 hover:scale-[1.01] active:scale-[0.99] flex justify-center items-center cursor-pointer pt-2"
              >
                {loading ? (
                  <div className="w-5 h-5 rounded-full border-2 border-uni-green-dark border-t-transparent animate-spin" />
                ) : (
                  <span>Se connecter 🗳️</span>
                )}
              </button>
            </form>
          )}

          {/* ÉTAPE 2 : CONFIGURATION DU MOT DE PASSE PERSONNEL */}
          {step === 'password_personal' && (
            <form className="space-y-4" onSubmit={handleActivateAccount}>
              <div className="p-3.5 rounded-xl bg-green-500/5 border border-green-500/20 text-[11px] text-green-400 leading-relaxed flex gap-2 items-start">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-green-400 mt-0.5" />
                <span>
                  <strong>Mot de passe temporaire validé !</strong> Veuillez maintenant configurer votre mot de passe personnel de sécurité.
                </span>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 block">
                  Nouveau mot de passe personnel
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-500" />
                  <input 
                    type="password" 
                    placeholder="6 caractères minimum"
                    value={personalPassword}
                    onChange={(e) => setPersonalPassword(e.target.value)}
                    disabled={loading}
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-uni-gold transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 block">
                  Confirmer le mot de passe personnel
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-500" />
                  <input 
                    type="password" 
                    placeholder="Ressaisissez le mot de passe personnel"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={loading}
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-uni-gold transition-all"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={handleBackToLogin}
                  className="w-1/3 bg-white/5 hover:bg-white/10 text-white border border-white/5 font-semibold py-3 px-4 rounded-xl text-xs transition-all text-center cursor-pointer"
                >
                  Annuler
                </button>
                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-2/3 bg-uni-gold hover:bg-uni-gold-light text-uni-green-dark font-display font-bold py-3 px-6 rounded-xl transition-all shadow-lg shadow-uni-gold/10 hover:shadow-uni-gold/20 flex justify-center items-center cursor-pointer"
                >
                  {loading ? (
                    <div className="w-5 h-5 rounded-full border-2 border-uni-green-dark border-t-transparent animate-spin" />
                  ) : (
                    <span>Activer mon compte 🚀</span>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
