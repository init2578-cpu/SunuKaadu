import React, { useState } from 'react';
import { useStudentAuth } from '../../context/StudentAuthContext';
import { X, ShieldAlert, CheckCircle2, Lock, Mail, Key } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function StudentAuthModal() {
  const { 
    isAuthModalOpen, 
    closeAuthModal, 
    sendOtpCode,
    verifyOtpCode
  } = useStudentAuth();

  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [demoCode, setDemoCode] = useState('');

  if (!isAuthModalOpen) return null;

  const handleClose = () => {
    setEmail('');
    setOtpCode('');
    setErrorMsg('');
    setSuccessMsg('');
    setDemoCode('');
    setLoading(false);
    closeAuthModal();
  };

  // Phase 1 : Renvoyer ou obtenir le code OTP
  const handleResendOtp = async (e: React.MouseEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setDemoCode('');

    if (!email.trim() || !email.includes('@')) {
      setErrorMsg("Veuillez d'abord saisir une adresse email universitaire valide.");
      return;
    }

    setLoading(true);
    try {
      const result = await sendOtpCode(email);
      if (result.success) {
        setSuccessMsg(`📧 Un code de validation à 6 chiffres a été envoyé par e-mail.`);
        if (result.demoCode) {
          setDemoCode(result.demoCode);
        }
      } else {
        setErrorMsg(result.error || "Une erreur est survenue.");
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Une erreur technique est survenue lors de l'envoi du code.");
    } finally {
      setLoading(false);
    }
  };

  // Phase 2 : Valider & voter
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!email.trim() || !email.includes('@')) {
      setErrorMsg("Veuillez saisir une adresse email universitaire valide.");
      return;
    }

    if (!otpCode || otpCode.length !== 6) {
      setErrorMsg("Veuillez saisir le code de validation à 6 chiffres.");
      return;
    }

    setLoading(true);
    try {
      const result = await verifyOtpCode(email, otpCode);
      if (result.success) {
        setSuccessMsg("🎉 Validation réussie ! Vous allez être redirigé...");
        setTimeout(() => {
          handleClose();
          navigate('/voter');
        }, 1500);
      } else {
        setErrorMsg(result.error || "Code de validation incorrect ou expiré.");
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Une erreur de connexion est survenue.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-uni-bg/80 backdrop-blur-md flex items-center justify-center p-6 transition-all duration-300">
      <div className="glassmorphism w-full max-w-md p-8 rounded-3xl space-y-6 relative shadow-2xl animate-fade-up border border-white/10 overflow-hidden">
        {/* Decorative corner glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-uni-rose/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-uni-blue/10 rounded-full blur-3xl pointer-events-none" />

        <button 
          onClick={handleClose}
          className="absolute right-6 top-6 p-2 rounded-xl text-gray-400 hover:bg-white/10 hover:text-white transition-all duration-200 cursor-pointer z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center space-y-3 relative">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-uni-blue/20 to-uni-rose/20 text-uni-rose border border-uni-rose/25 shadow-inner mb-2">
            <Lock className="w-6 h-6 animate-pulse" />
          </div>
          <h2 className="text-2xl font-display font-extrabold text-white tracking-tight">
            Espace Électeur
          </h2>
          <p className="text-xs text-gray-400 max-w-xs mx-auto leading-relaxed">
            Identifiez-vous à l'aide de votre adresse email universitaire et du code reçu par e-mail.
          </p>
        </div>

        {errorMsg && (
          <div className="p-4 rounded-xl bg-uni-rose/10 border border-uni-rose/20 text-xs font-semibold text-uni-rose-light leading-relaxed flex gap-2.5 items-start animate-fade-up">
            <ShieldAlert className="w-4 h-4 shrink-0 text-uni-rose mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-400 leading-relaxed flex gap-2.5 items-start animate-fade-up">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5 relative">
          {/* Email Field */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400 block">
              Adresse Email Universitaire
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-500" />
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                placeholder="prenom.nom@univ.sn"
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-uni-rose focus:ring-2 focus:ring-uni-rose/20 transition-all duration-200"
              />
            </div>
          </div>

          {/* OTP Code Field */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400 block">
                Code de validation (6 chiffres)
              </label>
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={loading}
                className="text-[11px] font-bold text-uni-rose hover:text-uni-rose-light hover:underline focus:outline-none cursor-pointer transition-colors duration-200"
              >
                Renvoyer le code par e-mail
              </button>
            </div>
            <div className="relative">
              <Key className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-500" />
              <input 
                type="text" 
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                disabled={loading}
                placeholder="123456"
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3.5 text-lg text-white placeholder-gray-500 focus:outline-none focus:border-uni-rose focus:ring-2 focus:ring-uni-rose/20 font-mono tracking-widest text-center font-bold"
              />
            </div>
          </div>

          {/* Validation Button */}
          <button 
            type="submit" 
            disabled={loading}
            className="w-full btn-gold py-3.5 px-6 rounded-xl flex justify-center items-center cursor-pointer mt-6 active:scale-95"
          >
            {loading ? (
              <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
            ) : (
              <span className="flex items-center gap-2">Valider & Voter 🗳️</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
