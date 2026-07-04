import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface AdminUser {
  id: string;
  auth_user_id: string | null;
  role: 'super_admin' | 'delegue' | 'representant';
  candidat_id: string | null;
  amicale_id: string | null;
  is_activated: boolean;
  is_revoked: boolean;
  nom: string | null;
  prenom: string | null;
  email: string;
  created_by: string | null;
  created_at?: string;
  mot_de_passe?: string | null;
}

interface AdminAuthContextType {
  admin: AdminUser | null;
  loading: boolean;
  loginOrActivate: (email: string, password: string, isRepresentantPortal?: boolean, personalPassword?: string) => Promise<{ success: boolean; status?: 'activated' | 'logged_in'; error?: string }>;
  logout: () => Promise<void>;
  updateProfile: (data: { nom?: string; prenom?: string; password?: string; email?: string }) => Promise<{ success: boolean; error?: string }>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
}

const AdminAuthContext = createContext<AdminAuthContextType | null>(null);

const REP_SESSION_KEY = 'sunu_kaadu_rep_session';

export const AdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Vérifier le profil admin via auth_user_id (pour super_admin et délégués)
  const checkAdminProfile = async (userId: string): Promise<AdminUser | null> => {
    try {
      const { data, error } = await supabase
        .from('admins')
        .select('*')
        .eq('auth_user_id', userId)
        .maybeSingle();

      if (error) throw error;
      return data as AdminUser;
    } catch (e) {
      console.error("Erreur lors de la vérification du profil admin", e);
      return null;
    }
  };

  // Charger le profil représentant depuis localStorage
  const loadRepSession = (): AdminUser | null => {
    try {
      const raw = localStorage.getItem(REP_SESSION_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as AdminUser;
    } catch {
      return null;
    }
  };

  const saveRepSession = (user: AdminUser) => {
    localStorage.setItem(REP_SESSION_KEY, JSON.stringify(user));
  };

  const clearRepSession = () => {
    localStorage.removeItem(REP_SESSION_KEY);
  };

  useEffect(() => {
    let active = true;

    const initSession = async () => {
      try {
        // 1. Vérifier d'abord la session représentant (localStorage)
        const repSession = loadRepSession();
        if (repSession && repSession.role === 'representant') {
          // Valider que le compte n'a pas été révoqué via RPC sécurisé
          const { data, error } = await supabase.rpc('check_representative_active', {
            p_email: repSession.email.toLowerCase().trim()
          });
          
          if (!error && data) {
            if (active) {
              setAdmin(repSession);
              setLoading(false);
            }
            return;
          }
          clearRepSession();
        }

        // 2. Vérifier la session Supabase Auth (super_admin / délégué)
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const profile = await checkAdminProfile(session.user.id);
          if (profile && !profile.is_revoked) {
            // Synchronisation de l'email si nécessaire
            if (session.user.email && profile.email !== session.user.email) {
              await supabase
                .from('admins')
                .update({ email: session.user.email })
                .eq('id', profile.id);
              profile.email = session.user.email;
            }
            if (active) setAdmin(profile);
          } else {
            await supabase.auth.signOut();
            if (active) setAdmin(null);
          }
        } else {
          const currentRep = loadRepSession();
          if (!currentRep && active) {
            setAdmin(null);
          }
        }
      } catch (e) {
        console.error("Erreur d'initialisation de session", e);
      } finally {
        if (active) setLoading(false);
      }
    };

    initSession();

    // Écouter les changements d'état d'authentification
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const profile = await checkAdminProfile(session.user.id);
        if (profile && !profile.is_revoked) {
          if (active) setAdmin(profile);
        } else {
          await supabase.auth.signOut();
          if (active) setAdmin(null);
        }
      } else {
        const currentRep = loadRepSession();
        if (!currentRep && active) {
          setAdmin(null);
        }
      }
      if (active) setLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const loginOrActivate = async (email: string, password: string, isRepresentantPortal?: boolean, personalPassword?: string) => {
    try {
      setLoading(true);
      const emailLower = email.trim().toLowerCase();

      // =========================================================================
      // CAS REPRÉSENTANT : RPC Sécurisée
      // =========================================================================
      if (isRepresentantPortal) {
        const { data, error } = await supabase.rpc('login_representative', {
          p_email: emailLower,
          p_password: password,
          p_personal_password: personalPassword || null
        });

        if (error) throw error;
        if (!data.success) {
          return { success: false, error: data.error };
        }

        const adminData = data.admin as AdminUser;
        saveRepSession(adminData);
        setAdmin(adminData);
        return { success: true, status: data.status };
      }

      // =========================================================================
      // CAS SUPER_ADMIN / DÉLÉGUÉ : Inscription/Authentification via Supabase Auth
      // =========================================================================
      // 1. Vérifier si le compte est déjà activé ou si le mot de passe temporaire est correct
      const { data: checkData, error: checkError } = await supabase.rpc('verify_temp_admin_password', {
        p_email: emailLower,
        p_temp_password: password
      });

      if (checkError) throw checkError;
      if (!checkData.success) {
        return { success: false, error: checkData.error };
      }

      if (!checkData.is_activated) {
        // Le compte n'est pas encore activé, on procède à l'inscription avec le mot de passe personnel
        if (!personalPassword || personalPassword.length < 6) {
          return {
            success: false,
            error: "Veuillez fournir un mot de passe personnel de 6 caractères minimum."
          };
        }

        // Créer le compte d'authentification Supabase avec le mot de passe personnel
        let user;
        try {
          const { data: authData, error: signUpError } = await supabase.auth.signUp({
            email: emailLower,
            password: personalPassword
          });

          if (signUpError) {
            // Si déjà existant dans Auth, on tente de lier
            if (signUpError.message.includes('already registered') || signUpError.message.includes('already exists')) {
              try {
                // Essayer de se connecter avec le temporaire
                const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                  email: emailLower,
                  password: password
                });
                if (!signInError && signInData.user) {
                  await supabase.auth.updateUser({ password: personalPassword });
                  user = signInData.user;
                } else {
                  // Essayer directement avec le nouveau personnel
                  const { data: signInData2, error: signInError2 } = await supabase.auth.signInWithPassword({
                    email: emailLower,
                    password: personalPassword
                  });
                  if (!signInError2 && signInData2.user) {
                    user = signInData2.user;
                  } else {
                    return {
                      success: false,
                      error: "Un compte existe déjà avec cet e-mail. Veuillez réinitialiser votre mot de passe."
                    };
                  }
                }
              } catch (err) {
                return {
                  success: false,
                  error: "L'e-mail est déjà utilisé dans la base d'authentification."
                };
              }
            } else {
              throw signUpError;
            }
          } else {
            user = authData.user;
          }
        } catch (authErr: any) {
          return {
            success: false,
            error: "Erreur d'authentification: " + (authErr.message || "Impossible de créer le compte.")
          };
        }

        if (!user) {
          return { success: false, error: "Impossible de générer le profil d'authentification." };
        }

        // Notre trigger on_auth_user_created va automatiquement lier l'id et activer l'admin dans public.admins
        const profile = await checkAdminProfile(user.id);
        setAdmin(profile);
        return { success: true, status: 'activated' as const };

      } else {
        // Connexion standard
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: emailLower,
          password: password
        });

        if (signInError) {
          return { success: false, error: "Identifiants de connexion incorrects." };
        }

        const profile = await checkAdminProfile(signInData.user.id);
        if (profile && !profile.is_revoked) {
          setAdmin(profile);
          return { success: true, status: 'logged_in' as const };
        } else {
          await supabase.auth.signOut();
          return { success: false, error: "Accès non autorisé : Votre compte a été révoqué ou désactivé." };
        }
      }
    } catch (e: any) {
      return { success: false, error: e.message || "Erreur de connexion." };
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/admin/update-password`,
      });
      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      console.error('Erreur lors de la réinitialisation du mot de passe:', err);
      return { success: false, error: err.message || "Erreur lors de l'envoi de l'e-mail." };
    }
  };

  const logout = async () => {
    setLoading(true);
    clearRepSession();
    Object.keys(localStorage)
      .filter(k => k.startsWith('rep_pwd_'))
      .forEach(k => localStorage.removeItem(k));
    await supabase.auth.signOut();
    setAdmin(null);
    setLoading(false);
  };

  const updateProfile = async (data: { nom?: string; prenom?: string; password?: string; email?: string }) => {
    if (!admin) return { success: false, error: "Vous n'êtes pas connecté." };
    try {
      setLoading(true);

      const updates: any = {};
      if (data.nom !== undefined) updates.nom = data.nom;
      if (data.prenom !== undefined) updates.prenom = data.prenom;

      if (data.email !== undefined && admin.role === 'super_admin') {
        const newEmail = data.email.trim().toLowerCase();
        if (newEmail !== admin.email) {
          const { error: emailErr } = await supabase.auth.updateUser({ email: newEmail });
          if (emailErr) throw emailErr;
          updates.email = newEmail;
        }
      }

      if (Object.keys(updates).length > 0) {
        const { error: updateErr } = await supabase
          .from('admins')
          .update(updates)
          .eq('id', admin.id);

        if (updateErr) throw updateErr;

        const updatedAdmin = { ...admin, ...updates };
        if (admin.role === 'representant') {
          saveRepSession(updatedAdmin);
        }
        setAdmin(updatedAdmin);
      }

      if (data.password) {
        if (admin.role === 'representant') {
          localStorage.setItem(`rep_pwd_${admin.id}`, data.password);
        } else {
          const { error: pwdErr } = await supabase.auth.updateUser({ password: data.password });
          if (pwdErr) throw pwdErr;
        }
      }

      return { success: true };
    } catch (e: any) {
      console.error("Erreur lors de la mise à jour du profil", e);
      return { success: false, error: e.message || "Erreur lors de la mise à jour." };
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminAuthContext.Provider value={{ admin, loading, loginOrActivate, logout, updateProfile, resetPassword }}>
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth doit être utilisé au sein de AdminAuthProvider');
  }
  return context;
};
