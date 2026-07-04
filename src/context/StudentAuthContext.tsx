import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface StudentProfile {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  numero_carte: string;
  filiere: string | null;
  promotion: string | null;
  auth_user_id: string | null;
  is_activated: boolean;
  amicale_id: string;
}

interface StudentAuthContextType {
  student: StudentProfile | null;
  loading: boolean;
  isAuthModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  sendOtpCode: (email: string) => Promise<{ success: boolean; error?: string; demoCode?: string }>;
  verifyOtpCode: (email: string, code: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const StudentAuthContext = createContext<StudentAuthContextType | null>(null);

export const StudentAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const openAuthModal = () => setIsAuthModalOpen(true);
  const closeAuthModal = () => setIsAuthModalOpen(false);

  useEffect(() => {
    let active = true;
    const savedStudent = localStorage.getItem('active_student_session');
    if (savedStudent) {
      try {
        const parsed = JSON.parse(savedStudent);
        const checkDoc = async () => {
          const { data, error } = await supabase
            .from('students')
            .select('*')
            .eq('id', parsed.id)
            .maybeSingle();

          if (active) {
            if (!error && data) {
              setStudent(data as StudentProfile);
            } else {
              localStorage.removeItem('active_student_session');
              setStudent(null);
            }
            setLoading(false);
          }
        };
        checkDoc();
      } catch (e) {
        localStorage.removeItem('active_student_session');
        if (active) {
          setStudent(null);
          setLoading(false);
        }
      }
    } else {
      if (active) {
        setStudent(null);
        setLoading(false);
      }
    }

    return () => {
      active = false;
    };
  }, []);

  const sendOtpCode = async (email: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('request_student_otp', { p_email: email });
      if (error) throw error;
      if (!data.success) {
        return { success: false, error: data.error };
      }
      return { success: true };
    } catch (err: any) {
      console.error(err);
      return { success: false, error: err.message || "Une erreur est survenue lors de l'envoi du code." };
    } finally {
      setLoading(false);
    }
  };

  const verifyOtpCode = async (email: string, code: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('verify_student_otp', { p_email: email, p_code: code });
      if (error) throw error;
      if (!data.success) {
        return { success: false, error: data.error };
      }

      const profile = data.student as StudentProfile;
      localStorage.setItem('active_student_session', JSON.stringify(profile));
      setStudent(profile);
      closeAuthModal();

      return { success: true };
    } catch (err: any) {
      console.error(err);
      return { success: false, error: err.message || "Erreur de validation du code." };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    localStorage.removeItem('active_student_session');
    setStudent(null);
    setLoading(false);
  };

  return (
    <StudentAuthContext.Provider value={{
      student,
      loading,
      isAuthModalOpen,
      openAuthModal,
      closeAuthModal,
      sendOtpCode,
      verifyOtpCode,
      logout
    }}>
      {children}
    </StudentAuthContext.Provider>
  );
};

export const useStudentAuth = () => {
  const context = useContext(StudentAuthContext);
  if (!context) {
    throw new Error('useStudentAuth doit être utilisé au sein de StudentAuthProvider');
  }
  return context;
};
