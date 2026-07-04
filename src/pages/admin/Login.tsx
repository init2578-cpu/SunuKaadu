import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { supabase } from '../../lib/supabase';
import { Shield, ArrowLeft, Mail, Lock, ShieldAlert, CheckCircle2, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const { loginOrActivate, logout, admin, resetPassword } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [personalPassword, setPersonalPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [tempPasswordInput, setTempPasswordInput] = useState('');
  const [step, setStep] = useState<'login' | 'password_personal' | 'forgot_password'>('login');
  const [showPwd, setShowPwd] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (admin) {
      if (admin.role === 'representant') {
        setError("Accès refusé. Redirection vers l'espace représentant...");
        setTimeout(() => navigate('/representant/login', { replace: true }), 1500);
      } else {
        const from = (location.state as any)?.from?.pathname || '/admin';
        navigate(from, { replace: true });
      }
    }
  }, [admin, navigate, location]);

  const handleLoginOrActivateInit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!email.trim() || !email.includes('@')) return setError("Adresse email invalide.");
    if (!password || password.length < 6) return setError("Le mot de passe doit contenir au moins 6 caractères.");

    setLoading(true);
    const emailLower = email.trim().toLowerCase();
    try {
      // 1. Verify credentials and role
      const { data: checkData, error: checkError } = await supabase.rpc('verify_temp_admin_password', {
        p_email: emailLower,
        p_temp_password: password
      });

      if (checkError) throw checkError;

      if (!checkData.success) {
        setError(checkData.error || "Cet email n'est pas autorisé ou le mot de passe est incorrect.");
        
        // Optionnel : si l'erreur indique qu'il n'est pas admin, on peut suggérer l'espace représentant
        if (checkData.error && checkData.error.includes("enregistré comme administrateur")) {
           // We keep the error but add a hint below the form, which is already there ("Espace représentant ?")
        }
        return;
      }

      if (checkData.is_activated) {
        const result = await loginOrActivate(emailLower, password);
        if (result.success) {
          setSuccess("✓ Connexion réussie. Redirection...");
          setTimeout(() => {
            const from = (location.state as any)?.from?.pathname || '/admin';
            navigate(from, { replace: true });
          }, 1200);
        } else {
          setError(result.error || "Erreur lors de la connexion.");
        }
      } else {
        setTempPasswordInput(password);
        setPassword('');
        setStep('password_personal');
      }
    } catch (err: any) {
      setError(err.message || "Erreur technique.");
    } finally {
      setLoading(false);
    }
  };

  const handleActivateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!personalPassword || personalPassword.length < 6) return setError("Mot de passe de 6 caractères minimum requis.");
    if (personalPassword !== confirmPassword) return setError("Les mots de passe ne correspondent pas.");

    setLoading(true);
    try {
      const result = await loginOrActivate(email, tempPasswordInput, false, personalPassword);
      if (result.success) {
        setSuccess("🎉 Compte activé ! Reconnectez-vous avec votre nouveau mot de passe.");
        await logout();
        setTimeout(() => { handleBackToLogin(); setSuccess("Compte activé ! Saisissez votre nouveau mot de passe."); }, 3000);
      } else {
        setError(result.error || "Erreur lors de l'activation.");
      }
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'activation.");
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setPassword(''); setPersonalPassword(''); setConfirmPassword(''); setTempPasswordInput('');
    setStep('login'); setError(''); setSuccess('');
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!email.trim() || !email.includes('@')) return setError("Veuillez saisir une adresse email valide.");
    
    setLoading(true);
    try {
      const result = await resetPassword(email);
      if (result.success) {
        setSuccess("Un lien de réinitialisation a été envoyé à votre adresse e-mail. Veuillez vérifier votre boîte de réception.");
        setTimeout(() => handleBackToLogin(), 5000);
      } else {
        setError(result.error || "Erreur lors de l'envoi de l'e-mail.");
      }
    } catch (err: any) {
      setError("Une erreur est survenue.");
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
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '50px 50px'
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-md animate-fade-up">

        {/* Back Link */}
        <Link to="/" className="inline-flex items-center gap-2 text-xs font-semibold text-gray-500 hover:text-gray-300 mb-8 transition-colors group">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span>Retour au portail public</span>
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
              <h1 className="text-2xl font-display font-black text-white">Administration</h1>
              <p className="text-xs text-gray-500 mt-1">
                {step === 'login' ? 'Console de gestion électorale sécurisée' : 
                 step === 'password_personal' ? 'Activation du compte administrateur' : 
                 'Réinitialisation du mot de passe'}
              </p>
            </div>

            {/* Step indicator */}
            <div className="flex items-center justify-center gap-2 pt-1">
              <div className="flex items-center gap-1.5">
                <div className={`w-6 h-1 rounded-full transition-all ${step === 'login' ? 'bg-uni-gold' : 'bg-uni-gold/30'}`} />
                <div className={`w-6 h-1 rounded-full transition-all ${step === 'password_personal' ? 'bg-uni-gold' : 'bg-white/10'}`} />
                <div className={`w-6 h-1 rounded-full transition-all ${step === 'forgot_password' ? 'bg-uni-gold' : 'bg-white/10'}`} />
              </div>
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

          {/* Step 1: Login */}
          {step === 'login' && (
            <form className="space-y-5" onSubmit={handleLoginOrActivateInit}>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 block">Adresse Email</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-600" />
                  <input
                    type="email"
                    placeholder="prenom.nom@univ.sn"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    className="input-field w-full pl-10 pr-4 py-3 text-sm placeholder-gray-600 disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 block">Mot de passe</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-600" />
                  <input
                    type={showPwd ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    className="input-field w-full pl-10 pr-12 py-3 text-sm disabled:opacity-50"
                  />
                  <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-3.5 top-3 text-gray-600 hover:text-gray-400 transition-colors cursor-pointer">
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex justify-end pt-1">
                  <button 
                    type="button" 
                    onClick={() => { setError(''); setSuccess(''); setStep('forgot_password'); }}
                    className="text-[10px] font-semibold text-gray-400 hover:text-uni-gold transition-colors cursor-pointer"
                  >
                    Mot de passe oublié ?
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-gold w-full py-3.5 flex items-center justify-center gap-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? (
                  <div className="w-4 h-4 rounded-full border-2 border-uni-green-dark border-t-transparent animate-spin" />
                ) : (
                  <>
                    <Shield className="w-4 h-4" />
                    <span>Se connecter</span>
                  </>
                )}
              </button>

              <div className="divider" />

              <p className="text-center text-[10px] text-gray-600">
                Espace représentant ?{' '}
                <Link to="/representant/login" className="text-uni-gold hover:underline font-semibold">
                  Connexion Représentant →
                </Link>
              </p>
            </form>
          )}

          {/* Step 2: Set Personal Password */}
          {step === 'password_personal' && (
            <form className="space-y-5" onSubmit={handleActivateAccount}>
              <div className="p-3.5 rounded-xl bg-emerald-500/6 border border-emerald-500/15 text-[11px] text-emerald-400 leading-relaxed flex gap-2 items-start">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  <strong>Mot de passe temporaire validé !</strong> Définissez maintenant votre mot de passe personnel.
                </span>
              </div>

              {[
                { label: 'Nouveau mot de passe', value: personalPassword, onChange: setPersonalPassword, placeholder: '6 caractères minimum' },
                { label: 'Confirmer le mot de passe', value: confirmPassword, onChange: setConfirmPassword, placeholder: 'Ressaisissez le mot de passe' },
              ].map(({ label, value, onChange, placeholder }) => (
                <div key={label} className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 block">{label}</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-600" />
                    <input
                      type="password"
                      placeholder={placeholder}
                      value={value}
                      onChange={(e) => onChange(e.target.value)}
                      disabled={loading}
                      className="input-field w-full pl-10 pr-4 py-3 text-sm disabled:opacity-50"
                    />
                  </div>
                </div>
              ))}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleBackToLogin}
                  className="btn-ghost w-1/3 py-3 text-xs flex items-center justify-center cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-gold w-2/3 py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
                >
                  {loading ? (
                    <div className="w-4 h-4 rounded-full border-2 border-uni-green-dark border-t-transparent animate-spin" />
                  ) : (
                    <span>Activer mon compte 🚀</span>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Step 3: Forgot Password */}
          {step === 'forgot_password' && (
            <form className="space-y-5" onSubmit={handleForgotPassword}>
              <div className="p-3.5 rounded-xl bg-uni-gold/10 border border-uni-gold/20 text-[11px] text-uni-gold leading-relaxed flex gap-2 items-start">
                <Mail className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Saisissez l'adresse e-mail associée à votre compte administrateur. Un lien de réinitialisation vous sera envoyé.
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 block">Adresse Email</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-600" />
                  <input
                    type="email"
                    placeholder="prenom.nom@univ.sn"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    className="input-field w-full pl-10 pr-4 py-3 text-sm placeholder-gray-600 disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleBackToLogin}
                  className="btn-ghost w-1/3 py-3.5 text-xs flex items-center justify-center cursor-pointer"
                >
                  Retour
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-gold w-2/3 py-3.5 text-sm flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
                >
                  {loading ? (
                    <div className="w-4 h-4 rounded-full border-2 border-uni-green-dark border-t-transparent animate-spin" />
                  ) : (
                    <span>Envoyer le lien</span>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Branding */}
        <p className="text-center text-[10px] text-gray-700 mt-6 font-mono">
          SUNU KÀDDU — Plateforme Électorale Universitaire 🇸🇳
        </p>
      </div>
    </div>
  );
}
