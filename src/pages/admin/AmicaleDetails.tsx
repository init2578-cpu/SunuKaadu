import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { 
  ArrowLeft, 
  Mail, 
  Calendar, 
  Layers, 
  Users, 
  Check, 
  X, 
  UserCheck, 
  UserX, 
  Trash2, 
  Plus, 
  Search, 
  ChevronLeft, 
  ChevronRight,
  AlertTriangle,
  Info,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Upload,
  RefreshCw,
  Edit2,
  Download
} from 'lucide-react';

interface Student {
  id: string;
  prenom: string;
  nom: string;
  email: string;
  numero_carte: string;
  filiere: string | null;
  promotion: string | null;
  is_activated: boolean;
  auth_user_id: string | null;
  amicale_id: string;
  created_at?: string;
}

export default function AmicaleDetails() {
  const { id } = useParams<{ id: string }>();
  const { admin: currentAdmin } = useAdminAuth();
  const navigate = useNavigate();

  // Data states
  const [amicale, setAmicale] = useState<any>(null);
  const [delegate, setDelegate] = useState<any>(null);
  const [elections, setElections] = useState<any[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  
  // UI states
  const [loading, setLoading] = useState(true);
  const [successToast, setSuccessToast] = useState('');
  const [errorToast, setErrorToast] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Student list search & pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Add / Edit Student modal states
  const [showFormModal, setShowFormModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [numeroCarte, setNumeroCarte] = useState('');
  const [email, setEmail] = useState('');
  const [filiere, setFiliere] = useState('');
  const [promotion, setPromotion] = useState('');
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  // CSV Import modal states
  const [showImportModal, setShowImportModal] = useState(false);
  const [csvPreview, setCsvPreview] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [importStats, setImportStats] = useState<{
    added: number;
    updated: number;
    ignored: number;
    details: string[];
  } | null>(null);

  const fetchData = async () => {
    if (!id) return;
    try {
      setLoading(true);
      
      // 1. Fetch Amicale
      const { data: amData, error: amErr } = await supabase
        .from('amicales')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (amErr || !amData) {
        throw new Error("Amicale introuvable.");
      }
      setAmicale(amData);

      // 2. Fetch Delegate
      const { data: delDocs, error: delErr } = await supabase
        .from('admins')
        .select('*')
        .eq('amicale_id', id)
        .eq('role', 'delegue')
        .limit(1);

      if (delErr) throw delErr;
      setDelegate(delDocs && delDocs.length > 0 ? delDocs[0] : null);

      // 3. Fetch Elections
      const { data: elecDocs, error: elecErr } = await supabase
        .from('elections')
        .select('*')
        .eq('amicale_id', id);

      if (elecErr) throw elecErr;
      const electionsData = (elecDocs || []) as any[];
      electionsData.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
      setElections(electionsData);

      // 4. Fetch Students
      const { data: studentsData, error: studErr } = await supabase
        .from('students')
        .select('*')
        .eq('amicale_id', id);

      if (studErr) throw studErr;
      const sortedStudents = (studentsData || []) as Student[];
      sortedStudents.sort((a, b) => (a.nom || '').localeCompare(b.nom || ''));
      setStudents(sortedStudents);

    } catch (err: any) {
      console.error(err);
      setErrorToast(err.message || "Erreur lors du chargement des données.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleToggleRevoke = async () => {
    if (!delegate) return;
    const action = delegate.is_revoked ? 'réactiver' : 'révoquer';
    if (!confirm(`Voulez-vous vraiment ${action} le délégué ${delegate.prenom} ${delegate.nom} ?`)) {
      return;
    }

    try {
      const nextRevState = !delegate.is_revoked;
      const { error } = await supabase
        .from('admins')
        .update({ is_revoked: nextRevState })
        .eq('id', delegate.id);

      if (error) throw error;

      setDelegate({ ...delegate, is_revoked: nextRevState });
      setSuccessToast(`Le compte délégué a été ${nextRevState ? 'révoqué' : 'réactivé'} avec succès.`);
      setTimeout(() => setSuccessToast(''), 3000);
    } catch (err: any) {
      setErrorToast(err.message || "Erreur de modification du compte.");
      setTimeout(() => setErrorToast(''), 3000);
    }
  };

  const handleDeleteAmicale = async () => {
    if (!confirm("Attention : supprimer cette amicale annulera les affiliations des étudiants et élections rattachées, et supprimera le compte du délégué associé. Cette action est irréversible.\n\nVoulez-vous vraiment supprimer cette amicale ?")) {
      return;
    }

    try {
      setLoading(true);

      // 1. Delete delegate
      if (delegate) {
        const { error } = await supabase
          .from('admins')
          .delete()
          .eq('id', delegate.id);
        if (error) throw error;
      }

      // 2. Delete all associated students from students
      const { error: delStudErr } = await supabase
        .from('students')
        .delete()
        .eq('amicale_id', id);

      if (delStudErr) throw delStudErr;

      // 3. Delete amicale
      const { error: delAmErr } = await supabase
        .from('amicales')
        .delete()
        .eq('id', id || '');

      if (delAmErr) throw delAmErr;

      alert("Amicale, délégué et liste d'étudiants associés supprimés avec succès.");
      navigate('/admin/amicales');
    } catch (err: any) {
      setErrorToast(err.message || "Erreur lors du suppression.");
      setTimeout(() => setErrorToast(''), 3000);
      setLoading(false);
    }
  };

  // Student Actions
  const toggleStudentStatus = async (student: Student) => {
    try {
      const nextStatus = !student.is_activated;
      const { error } = await supabase
        .from('students')
        .update({ is_activated: nextStatus })
        .eq('id', student.id);

      if (error) throw error;

      setStudents(prev => 
        prev.map(s => s.id === student.id ? { ...s, is_activated: nextStatus } : s)
      );
      setSuccessToast("Statut de l'étudiant mis à jour.");
      setTimeout(() => setSuccessToast(''), 2000);
    } catch (err: any) {
      alert(err.message || "Erreur de mise à jour du statut.");
    }
  };

  const resetStudentAuth = async (student: Student) => {
    if (!confirm(`Réinitialiser le compte de ${student.prenom} ${student.nom} ? Cela dissociera son accès d'authentification.`)) {
      return;
    }
    try {
      const { error } = await supabase
        .from('students')
        .update({ 
          is_activated: false
        })
        .eq('id', student.id);

      if (error) throw error;

      setStudents(prev => 
        prev.map(s => s.id === student.id ? { ...s, is_activated: false, auth_user_id: null } : s)
      );
      setSuccessToast("Compte dissocié avec succès.");
      setTimeout(() => setSuccessToast(''), 2000);
    } catch (err: any) {
      alert(err.message || "Erreur de réinitialisation.");
    }
  };

  const handleDeleteStudent = async (student: Student) => {
    if (!confirm(`Voulez-vous vraiment retirer ${student.prenom} ${student.nom} de la liste blanche ?`)) {
      return;
    }
    try {
      const { error } = await supabase
        .from('students')
        .delete()
        .eq('id', student.id);

      if (error) throw error;

      setStudents(prev => prev.filter(s => s.id !== student.id));
      setSuccessToast("Étudiant retiré de la liste blanche.");
      setTimeout(() => setSuccessToast(''), 2000);
    } catch (err: any) {
      alert(err.message || "Erreur de suppression.");
    }
  };

  const handleClearAllStudents = async () => {
    if (!confirm("⚠️ ATTENTION : Voulez-vous vraiment supprimer TOUS les étudiants de cette amicale ? Cette action est irréversible !")) {
      return;
    }
    try {
      setLoading(true);
      const { error } = await supabase
        .from('students')
        .delete()
        .eq('amicale_id', id);

      if (error) throw error;
      
      setStudents([]);
      setSuccessToast("Tous les étudiants ont été supprimés.");
      setTimeout(() => setSuccessToast(''), 2000);
    } catch (err: any) {
      alert(err.message || "Erreur de vidage.");
    } finally {
      setLoading(false);
    }
  };

  // Add / Edit Modal handlers
  const handleOpenAdd = () => {
    setSelectedStudent(null);
    setPrenom('');
    setNom('');
    setNumeroCarte('');
    setEmail('');
    setFiliere('');
    setPromotion('');
    setFormError('');
    setShowFormModal(true);
  };

  const handleOpenEdit = (student: Student) => {
    setSelectedStudent(student);
    setPrenom(student.prenom);
    setNom(student.nom);
    setNumeroCarte(student.numero_carte);
    setEmail(student.email);
    setFiliere(student.filiere || '');
    setPromotion(student.promotion || '');
    setFormError('');
    setShowFormModal(true);
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!prenom.trim() || !nom.trim() || !numeroCarte.trim() || !email.trim()) {
      setFormError("Les champs Prénom, Nom, Numéro de Carte et Email sont obligatoires.");
      return;
    }

    setFormLoading(true);
    try {
      if (selectedStudent) {
        // Edit mode
        const { error } = await supabase
          .from('students')
          .update({
            prenom: prenom.trim(),
            nom: nom.trim(),
            numero_carte: numeroCarte.trim(),
            matricule: numeroCarte.trim(),
            email: email.trim().toLowerCase(),
            filiere: filiere.trim() || null,
            promotion: promotion.trim() || null
          })
          .eq('id', selectedStudent.id);

        if (error) throw error;

        setStudents(prev => 
          prev.map(s => s.id === selectedStudent.id ? { 
            ...s, 
            prenom: prenom.trim(),
            nom: nom.trim(),
            numero_carte: numeroCarte.trim(),
            email: email.trim().toLowerCase(),
            filiere: filiere.trim() || null,
            promotion: promotion.trim() || null
          } : s)
        );
        setSuccessToast("Étudiant mis à jour avec succès.");
      } else {
        // Add mode
        // Vérifier doublon email ou carte localement
        const isDuplicate = students.some(
          s => s.email.toLowerCase() === email.trim().toLowerCase() || 
          s.numero_carte.toLowerCase() === numeroCarte.trim().toLowerCase()
        );
        if (isDuplicate) {
          throw new Error("Un étudiant possède déjà cet e-mail ou ce numéro de carte dans cette amicale.");
        }

        const newStudentDoc = {
          prenom: prenom.trim(),
          nom: nom.trim(),
          numero_carte: numeroCarte.trim(),
          matricule: numeroCarte.trim(),
          email: email.trim().toLowerCase(),
          filiere: filiere.trim() || null,
          promotion: promotion.trim() || null,
          is_activated: false,
          amicale_id: id || '',
          created_at: new Date().toISOString()
        };

        const { data: newStud, error } = await supabase
          .from('students')
          .insert(newStudentDoc)
          .select()
          .single();

        if (error || !newStud) throw error || new Error("Erreur d'ajout de l'étudiant.");

        setStudents(prev => [...prev, newStud as Student]);
        setSuccessToast("Étudiant ajouté avec succès.");
      }
      setTimeout(() => setSuccessToast(''), 3000);
      setShowFormModal(false);
    } catch (err: any) {
      setFormError(err.message || "Une erreur est survenue lors de l'enregistrement.");
    } finally {
      setFormLoading(false);
    }
  };

  // Télécharger le prototype de modèle CSV
  const downloadCSVTemplate = () => {
    const headers = 'numero_carte;nom;prenom;email;filiere;promotion';
    const row1 = 'N202601;NDIAYE;Mamadou;mamadou.ndiaye@univ.sn;Informatique;2026';
    const row2 = 'D202502;DIOP;Aminata;aminata.diop@univ.sn;Médecine;2025';
    const csvContent = '\uFEFF' + [headers, row1, row2].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'sunukaadu_modele_electeurs.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CSV Import handlers
  const handleCSVSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError('');
    setImportStats(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (!text) {
        setImportError("Impossible de lire le fichier.");
        return;
      }
      const rows = text.split('\n');
      if (rows.length === 0) {
        setImportError("Le fichier CSV est vide.");
        return;
      }

      const firstLine = rows[0].replace(/^\ufeff/, '').trim();
      const delimiter = firstLine.includes(';') ? ';' : ',';
      const headers = firstLine.split(delimiter).map(h => h.trim().toLowerCase().replace(/^"|"$/g, ''));

      const nomIdx = headers.indexOf('nom');
      const prenomIdx = headers.indexOf('prenom');
      const emailIdx = headers.indexOf('email');

      const possibleCardHeaders = ['numero_carte', 'numero de carte', 'numero carte', 'num_carte', 'n° carte', 'carte'];
      let carteIdx = -1;
      for (const h of possibleCardHeaders) {
        carteIdx = headers.indexOf(h);
        if (carteIdx !== -1) break;
      }

      const filiereIdx = headers.indexOf('filiere');
      const promotionIdx = headers.indexOf('promotion');

      if (nomIdx === -1 || prenomIdx === -1 || emailIdx === -1 || carteIdx === -1) {
        setImportError("En-têtes manquants. Requis : 'nom', 'prenom', 'email' et 'numero_carte'.");
        return;
      }

      const parsed: any[] = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i].trim();
        if (!row) continue;
        const cols = row.split(delimiter).map(c => c.trim().replace(/^"|"$/g, ''));
        if (cols.length < 4) continue;

        const mail = cols[emailIdx]?.toLowerCase();
        const card = cols[carteIdx]?.trim();
        if (!mail || !mail.includes('@') || !card) continue;

        parsed.push({
          nom: cols[nomIdx] || '',
          prenom: cols[prenomIdx] || '',
          email: mail,
          numero_carte: card,
          filiere: filiereIdx !== -1 ? cols[filiereIdx] || null : null,
          promotion: promotionIdx !== -1 ? cols[promotionIdx] || null : null
        });
      }

      if (parsed.length === 0) {
        setImportError("Aucun électeur valide trouvé dans le fichier.");
      } else {
        setCsvPreview(parsed);
      }
    };
    reader.readAsText(file);
  };

  const handleExecuteImport = async () => {
    if (csvPreview.length === 0 || !id) return;
    setImporting(true);
    setImportError('');

    let addedCount = 0;
    let updatedCount = 0;
    let ignoredCount = 0;
    const details: string[] = [];

    try {
      // 1. Récupérer les étudiants actuels de cette amicale pour les doublons
      const { data: existingSnap, error: getExistErr } = await supabase
        .from('students')
        .select('*')
        .eq('amicale_id', id);

      if (getExistErr) throw getExistErr;

      const existingMapByEmail = new Map<string, any>();
      const existingMapByCard = new Map<string, any>();
      
      (existingSnap || []).forEach(d => {
        existingMapByEmail.set(d.email.toLowerCase(), d);
        existingMapByCard.set(d.numero_carte.toLowerCase(), d);
      });

      const inserts: any[] = [];
      const updates: any[] = [];

      for (const item of csvPreview) {
        const itemEmail = item.email.toLowerCase();
        const itemCard = item.numero_carte.toLowerCase();

        const existByEmail = existingMapByEmail.get(itemEmail);
        const existByCard = existingMapByCard.get(itemCard);

        if (existByEmail) {
          updates.push({
            id: existByEmail.id,
            prenom: item.prenom,
            nom: item.nom,
            numero_carte: item.numero_carte,
            matricule: item.numero_carte,
            filiere: item.filiere || existByEmail.filiere,
            promotion: item.promotion || existByEmail.promotion
          });
          updatedCount++;
          details.push(`Mis à jour : ${item.prenom} ${item.nom} (${item.email})`);
        } else if (existByCard) {
          updates.push({
            id: existByCard.id,
            prenom: item.prenom,
            nom: item.nom,
            email: item.email,
            numero_carte: item.numero_carte,
            matricule: item.numero_carte,
            filiere: item.filiere || existByCard.filiere,
            promotion: item.promotion || existByCard.promotion
          });
          updatedCount++;
          details.push(`Mis à jour : ${item.prenom} ${item.nom} (${item.email})`);
        } else {
          inserts.push({
            prenom: item.prenom,
            nom: item.nom,
            email: item.email,
            numero_carte: item.numero_carte,
            matricule: item.numero_carte,
            filiere: item.filiere,
            promotion: item.promotion,
            is_activated: true,
            amicale_id: id,
            created_at: new Date().toISOString()
          });
          addedCount++;
          details.push(`Ajouté : ${item.prenom} ${item.nom} (${item.email})`);
        }
      }

      // Execute bulk insert
      if (inserts.length > 0) {
        const { error: insErr } = await supabase
          .from('students')
          .insert(inserts);
        if (insErr) throw insErr;
      }

      if (updates.length > 0) {
        const { error: upsErr } = await supabase
          .from('students')
          .upsert(updates);
        if (upsErr) throw upsErr;
      }

      setImportStats({
        added: addedCount,
        updated: updatedCount,
        ignored: ignoredCount,
        details
      });

      setCsvPreview([]);
      fetchData();
    } catch (err: any) {
      setImportError(err.message || "Erreur de traitement.");
    } finally {
      setImporting(false);
    }
  };

  // Filter students locally
  const filteredStudents = students.filter(student => 
    student.nom.toLowerCase().includes(searchQuery.toLowerCase()) ||
    student.prenom.toLowerCase().includes(searchQuery.toLowerCase()) ||
    student.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (student.numero_carte && student.numero_carte.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Pagination
  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage);
  const paginatedStudents = filteredStudents.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  if (loading && !amicale) {
    return (
      <div className="p-12 flex flex-col items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 rounded-full border-4 border-uni-gold border-t-transparent animate-spin mb-3" />
        <p className="text-sm text-gray-400">Chargement des détails de l'amicale...</p>
      </div>
    );
  }

  if (!amicale) {
    return (
      <div className="p-12 text-center space-y-4">
        <AlertTriangle className="w-12 h-12 text-uni-red mx-auto" />
        <h3 className="text-xl font-bold text-white">Amicale introuvable</h3>
        <p className="text-sm text-gray-400">L'amicale demandée n'existe pas ou a été supprimée.</p>
        <Link to="/admin/amicales" className="inline-flex items-center gap-2 text-uni-gold hover:underline text-sm font-semibold">
          <ArrowLeft className="w-4 h-4" /> Retour aux amicales
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast notifications */}
      {successToast && (
        <div className="fixed top-6 right-6 z-50 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-400 max-w-sm shadow-2xl leading-relaxed flex gap-2.5 items-start">
          <Check className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
          <span>{successToast}</span>
        </div>
      )}

      {errorToast && (
        <div className="fixed top-6 right-6 z-50 p-4 rounded-xl bg-uni-red/10 border border-uni-red/20 text-xs font-semibold text-uni-red-light max-w-sm shadow-2xl leading-relaxed flex gap-2.5 items-start">
          <AlertTriangle className="w-4 h-4 shrink-0 text-uni-red-light mt-0.5" />
          <span>{errorToast}</span>
        </div>
      )}

      {/* Header and Back Link */}
      <div className="flex flex-col gap-2">
        <Link 
          to="/admin/amicales" 
          className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Retour aux Amicales</span>
        </Link>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mt-2">
          <div>
            <h1 className="text-3xl font-display font-extrabold text-white flex items-center gap-3">
              <Layers className="w-8 h-8 text-uni-gold" />
              <span>{amicale.nom}</span>
            </h1>
            <p className="text-sm text-gray-400 mt-1">{amicale.description || "Aucune description renseignée."}</p>
          </div>
          <button
            onClick={handleDeleteAmicale}
            className="flex items-center gap-2 bg-uni-red/15 hover:bg-uni-red/80 border border-uni-red/20 text-uni-red-light hover:text-white font-display font-bold text-sm py-2.5 px-4 rounded-xl transition-all shadow-md cursor-pointer animate-in fade-in duration-200"
          >
            <Trash2 className="w-4 h-4" />
            <span>Supprimer l'Amicale</span>
          </button>
        </div>
      </div>

      {/* Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Delegate & Elections */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Delegate Card */}
          <div className="glassmorphism p-6 rounded-3xl border border-white/10 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-uni-gold border-b border-white/5 pb-2">
              Délégué de l'Amicale
            </h3>
            {delegate ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-uni-gold/10 text-uni-gold flex items-center justify-center font-bold text-lg border border-uni-gold/20">
                    {delegate.prenom?.[0]}{delegate.nom?.[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-semibold text-white truncate">{delegate.prenom} {delegate.nom}</p>
                    <p className="text-xs text-gray-400 truncate flex items-center gap-1 mt-0.5">
                      <Mail className="w-3.5 h-3.5 text-gray-500" />
                      {delegate.email}
                    </p>
                  </div>
                </div>

                <div className="pt-2 flex justify-between items-center text-xs">
                  <span className="text-gray-500">Statut du compte :</span>
                  {delegate.is_revoked ? (
                    <span className="px-2 py-0.5 rounded-full bg-uni-red/10 text-uni-red border border-uni-red/20 font-bold uppercase text-[9px] tracking-wider">
                      Révoqué
                    </span>
                  ) : delegate.is_activated ? (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold uppercase text-[9px] tracking-wider">
                      Activé
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-uni-gold/10 text-uni-gold border border-uni-gold/20 font-bold uppercase text-[9px] tracking-wider">
                      En attente
                    </span>
                  )}
                </div>

                {/* Mot de passe du délégué */}
                <div className="pt-3 border-t border-white/5 space-y-2">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    <KeyRound className="w-3 h-3" />
                    <span>Mot de passe initial</span>
                  </div>
                  {delegate.mot_de_passe ? (
                    <div className="flex items-center justify-between gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
                      <span className={`text-sm font-mono font-bold flex-1 ${showPassword ? 'text-uni-gold' : 'text-gray-500 tracking-widest'}`}>
                        {showPassword ? delegate.mot_de_passe : '••••••••••'}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => setShowPassword(v => !v)}
                          className="p-1 rounded text-gray-400 hover:text-white transition-colors cursor-pointer"
                          title={showPassword ? "Masquer" : "Afficher"}
                        >
                          {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(delegate.mot_de_passe);
                            setSuccessToast("Mot de passe copié !");
                            setTimeout(() => setSuccessToast(''), 2000);
                          }}
                          className="p-1 rounded text-gray-400 hover:text-uni-gold transition-colors cursor-pointer"
                          title="Copier le mot de passe"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[10px] text-gray-600 italic">
                      Mot de passe non disponible.
                    </p>
                  )}
                </div>

                <div className="pt-3 border-t border-white/5 flex justify-end">
                  {delegate.is_revoked ? (
                    <button
                      onClick={handleToggleRevoke}
                      className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:underline font-semibold cursor-pointer"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Réactiver le délégué</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleToggleRevoke}
                      className="inline-flex items-center gap-1 text-xs text-uni-red hover:underline font-semibold cursor-pointer"
                    >
                      <UserX className="w-3.5 h-3.5" />
                      <span>Révoquer le délégué</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-uni-red/5 border border-uni-red/10 text-center text-xs text-uni-red-light leading-relaxed">
                ⚠️ Aucun délégué assigné à cette amicale.
              </div>
            )}
          </div>

          {/* Elections Card */}
          <div className="glassmorphism p-6 rounded-3xl border border-white/10 space-y-4">
            <div className="flex justify-between items-center border-b border-white/5 pb-2">
              <h3 className="text-sm font-bold uppercase tracking-wider text-uni-gold">
                Élections de l'Amicale
              </h3>
              <span className="bg-white/5 border border-white/10 px-2 py-0.5 rounded-md text-xs font-bold text-gray-300">
                {elections.length}
              </span>
            </div>

            {elections.length === 0 ? (
              <p className="text-xs text-gray-500 italic py-2">Aucun scrutin créé pour le moment.</p>
            ) : (
              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                {elections.map((elec) => (
                  <div key={elec.id} className="p-3 bg-white/3 border border-white/5 rounded-xl flex items-center justify-between hover:border-white/10 transition-colors">
                    <div className="min-w-0 pr-2">
                      <p className="text-xs font-semibold text-white truncate">{elec.titre}</p>
                      <p className="text-[9px] text-gray-500 mt-0.5 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {elec.created_at ? new Date(elec.created_at).toLocaleDateString('fr-FR') : '—'}
                      </p>
                    </div>
                    <div className="shrink-0">
                      {elec.statut === 'ouverte' ? (
                        <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">Ouvert</span>
                      ) : elec.statut === 'fermee' ? (
                        <span className="text-[9px] font-bold uppercase tracking-wider text-uni-red-light bg-uni-red/10 px-1.5 py-0.5 rounded">Clos</span>
                      ) : elec.statut === 'publiee' ? (
                        <span className="text-[9px] font-bold uppercase tracking-wider text-uni-gold bg-uni-gold/10 px-1.5 py-0.5 rounded">Publié</span>
                      ) : (
                        <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 bg-white/5 px-1.5 py-0.5 rounded">Brouillon</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Whitelisted Students List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glassmorphism p-6 rounded-3xl border border-white/10 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/5 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white font-display">Étudiants Inscrits (Liste Blanche)</h3>
                <p className="text-xs text-gray-400 mt-0.5">Nombre total d'électeurs éligibles : <strong>{students.length}</strong></p>
              </div>
              <div className="flex gap-2 shrink-0">
                {students.length > 0 && (
                  <button 
                    onClick={handleClearAllStudents}
                    className="flex items-center gap-1.5 bg-uni-red/10 hover:bg-uni-red/20 text-uni-red-light font-semibold text-xs py-2 px-3.5 rounded-xl border border-uni-red/20 transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Vider la liste</span>
                  </button>
                )}
                <button 
                  onClick={() => setShowImportModal(true)}
                  className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 text-white font-semibold text-xs py-2 px-3.5 rounded-xl border border-uni-border transition-all cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Importer CSV</span>
                </button>
                <button 
                  onClick={handleOpenAdd}
                  className="flex items-center gap-1.5 bg-uni-gold hover:bg-uni-gold-light text-uni-green-dark font-display font-bold text-xs py-2 px-3.5 rounded-xl transition-all shadow-md cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Ajouter</span>
                </button>
              </div>
            </div>

            {/* Whitelist Search */}
            <div className="relative">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Rechercher un étudiant par nom, e-mail, numéro de carte..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-uni-gold"
              />
            </div>

            {/* Whitelist Table */}
            {filteredStudents.length === 0 ? (
              <div className="p-8 text-center text-gray-500 border border-dashed border-white/5 rounded-2xl">
                <Info className="w-8 h-8 mx-auto mb-2 text-gray-600" />
                Aucun étudiant ne correspond à cette recherche.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-gray-400">
                    <thead className="text-xs uppercase bg-white/5 text-gray-300 border-b border-white/5">
                      <tr>
                        <th className="px-4 py-3">N° Carte</th>
                        <th className="px-4 py-3">Nom Complet</th>
                        <th className="px-4 py-3">Email</th>
                        <th className="px-4 py-3">Filière / Pro</th>
                        <th className="px-4 py-3">Statut</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {paginatedStudents.map((stud) => (
                        <tr key={stud.id} className="hover:bg-white/[0.01] transition-colors">
                          <td className="px-4 py-3 font-mono text-xs font-bold text-uni-gold">{stud.numero_carte || '—'}</td>
                          <td className="px-4 py-3 font-semibold text-white">{stud.prenom} {stud.nom}</td>
                          <td className="px-4 py-3 text-xs">{stud.email}</td>
                          <td className="px-4 py-3 text-xs text-gray-500">
                            {stud.filiere} <span className="text-[10px] bg-white/5 px-1.5 py-0.5 rounded text-gray-400 font-bold ml-1">{stud.promotion}</span>
                          </td>
                          <td className="px-4 py-3">
                            {stud.is_activated ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wide uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                                Activé
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wide uppercase bg-uni-gold/10 text-uni-gold border border-uni-gold/25">
                                En attente
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex gap-1.5">
                              {stud.is_activated ? (
                                <button 
                                  onClick={() => toggleStudentStatus(stud)}
                                  className="p-1.5 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 transition-all cursor-pointer"
                                  title="Désactiver (bloquer)"
                                >
                                  <UserX className="w-3 h-3" />
                                </button>
                              ) : (
                                <button 
                                  onClick={() => toggleStudentStatus(stud)}
                                  className="p-1.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-all cursor-pointer"
                                  title="Activer"
                                >
                                  <UserCheck className="w-3 h-3" />
                                </button>
                              )}
                              
                              {stud.auth_user_id && (
                                <button 
                                  onClick={() => resetStudentAuth(stud)}
                                  className="p-1.5 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 transition-all cursor-pointer"
                                  title="Dissocier"
                                >
                                  <RefreshCw className="w-3 h-3" />
                                </button>
                              )}

                              <button 
                                onClick={() => handleOpenEdit(stud)}
                                className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-gray-300 hover:text-uni-gold border border-white/5 transition-all cursor-pointer"
                                title="Modifier"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button 
                                onClick={() => handleDeleteStudent(stud)}
                                className="p-1.5 rounded bg-uni-red/10 hover:bg-uni-red/20 text-uni-red-light border border-uni-red/20 transition-all cursor-pointer"
                                title="Supprimer"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-4 border-t border-white/5 text-xs">
                    <span className="text-gray-500">
                      Affichage de {(currentPage - 1) * itemsPerPage + 1} à {Math.min(currentPage * itemsPerPage, filteredStudents.length)} sur {filteredStudents.length} étudiants
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="p-2 rounded-lg border border-white/10 hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="p-2 rounded-lg border border-white/10 hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* FORM MODAL (Add/Edit Student) */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="glassmorphism w-full max-w-md p-8 rounded-3xl space-y-6 relative shadow-2xl">
            <button 
              onClick={() => setShowFormModal(false)}
              className="absolute right-6 top-6 p-2 rounded-lg text-gray-400 hover:bg-white/5 hover:text-white transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <h3 className="text-xl font-display font-extrabold text-white">
                {selectedStudent ? "Modifier l'Électeur" : "Ajouter un Électeur"}
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                L'étudiant sera rattaché à l'amicale en cours d'édition.
              </p>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-uni-red/10 border border-uni-red/20 text-xs font-semibold text-uni-red-light text-center">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveStudent} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 block">Prénom</label>
                  <input 
                    type="text" 
                    value={prenom}
                    onChange={(e) => setPrenom(e.target.value)}
                    disabled={formLoading}
                    placeholder="Abdoulaye"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-uni-gold"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 block">Nom</label>
                  <input 
                    type="text" 
                    value={nom}
                    onChange={(e) => setNom(e.target.value)}
                    disabled={formLoading}
                    placeholder="Sow"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-uni-gold"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 block">Numéro de Carte</label>
                <input 
                  type="text" 
                  value={numeroCarte}
                  onChange={(e) => setNumeroCarte(e.target.value)}
                  disabled={formLoading}
                  placeholder="Ex: N202611"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-uni-gold"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 block">Adresse Email</label>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={formLoading}
                  placeholder="nom@universite.edu"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-uni-gold"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 block">Filière</label>
                  <input 
                    type="text" 
                    value={filiere}
                    onChange={(e) => setFiliere(e.target.value)}
                    disabled={formLoading}
                    placeholder="Ex: Informatique"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-uni-gold"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 block">Promotion</label>
                  <input 
                    type="text" 
                    value={promotion}
                    onChange={(e) => setPromotion(e.target.value)}
                    disabled={formLoading}
                    placeholder="Ex: 2026"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-uni-gold"
                  />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={formLoading}
                className="w-full bg-uni-gold hover:bg-uni-gold-light text-uni-green-dark font-display font-bold py-3 rounded-xl transition-all shadow-md flex justify-center items-center gap-2 cursor-pointer"
              >
                {formLoading ? (
                  <div className="w-5 h-5 rounded-full border-2 border-uni-green-dark border-t-transparent animate-spin" />
                ) : (
                  <span>Confirmer</span>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CSV IMPORT MODAL */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="glassmorphism w-full max-w-xl p-8 rounded-3xl space-y-6 relative shadow-2xl max-h-[85vh] overflow-y-auto">
            <button 
              onClick={() => {
                setShowImportModal(false);
                setCsvPreview([]);
                setImportStats(null);
                setImportError('');
              }}
              className="absolute right-6 top-6 p-2 rounded-lg text-gray-400 hover:bg-white/5 hover:text-white transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-3">
              <div>
                <h3 className="text-xl font-display font-extrabold text-white">Importer des Électeurs (CSV)</h3>
                <p className="text-xs text-gray-400 mt-1">
                  Importez une liste d'étudiants en lot à partir d'un fichier CSV.
                </p>
              </div>
              <button
                type="button"
                onClick={downloadCSVTemplate}
                className="inline-flex items-center gap-2 bg-uni-gold/10 hover:bg-uni-gold/20 text-uni-gold font-semibold text-xs py-2 px-3.5 rounded-xl border border-uni-gold/20 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Télécharger le modèle CSV (.csv)</span>
              </button>
            </div>

            {importError && (
              <div className="p-3 rounded-xl bg-uni-red/10 border border-uni-red/20 text-xs font-semibold text-uni-red-light">
                {importError}
              </div>
            )}

            {importStats && (
              <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 space-y-2 text-xs">
                <p className="font-bold text-green-400 text-sm">🎉 Importation terminée avec succès !</p>
                <div className="flex gap-4 font-mono font-semibold text-gray-300">
                  <span>Ajoutés: {importStats.added}</span>
                  <span>Mis à jour: {importStats.updated}</span>
                  <span>Ignorés: {importStats.ignored}</span>
                </div>
                <div className="max-h-32 overflow-y-auto pt-2 border-t border-white/5 text-[10px] text-gray-500 space-y-1 font-mono">
                  {importStats.details.map((d, i) => (
                    <div key={i}>{d}</div>
                  ))}
                </div>
              </div>
            )}

            {csvPreview.length === 0 && !importStats && (
              <div className="space-y-4">
                <div className="border border-dashed border-white/10 rounded-2xl p-8 text-center flex flex-col items-center justify-center space-y-3 bg-white/2">
                  <Upload className="w-8 h-8 text-uni-gold" />
                  <div>
                    <p className="text-sm font-semibold text-white">Sélectionner un fichier CSV</p>
                    <p className="text-xs text-gray-500 mt-1">Requis : nom, prenom, email, numero_carte</p>
                  </div>
                  <label className="bg-uni-gold hover:bg-uni-gold-light text-uni-green-dark font-display font-bold text-xs py-2 px-4 rounded-xl transition-all shadow-md cursor-pointer inline-block">
                    Choisir un fichier
                    <input 
                      type="file" 
                      accept=".csv"
                      onChange={handleCSVSelect}
                      className="hidden" 
                    />
                  </label>
                </div>
              </div>
            )}

            {csvPreview.length > 0 && (
              <div className="space-y-4">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-400">Aperçu : <strong>{csvPreview.length}</strong> lignes prêtes à être importées</span>
                  <button 
                    onClick={() => setCsvPreview([])}
                    className="text-uni-red hover:underline font-semibold cursor-pointer"
                  >
                    Effacer
                  </button>
                </div>

                <div className="max-h-48 overflow-y-auto border border-white/10 rounded-xl">
                  <table className="w-full text-left text-[11px] text-gray-400">
                    <thead className="bg-white/5 text-gray-300 font-bold border-b border-white/5">
                      <tr>
                        <th className="px-3 py-2">Carte</th>
                        <th className="px-3 py-2">Prénom & Nom</th>
                        <th className="px-3 py-2">Email</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {csvPreview.slice(0, 10).map((row, i) => (
                        <tr key={i}>
                          <td className="px-3 py-1.5 font-mono text-uni-gold font-bold">{row.numero_carte}</td>
                          <td className="px-3 py-1.5 text-white">{row.prenom} {row.nom}</td>
                          <td className="px-3 py-1.5">{row.email}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {csvPreview.length > 10 && (
                    <div className="p-2 text-center text-[10px] text-gray-500 bg-white/2 border-t border-white/5">
                      Et {csvPreview.length - 10} autres lignes...
                    </div>
                  )}
                </div>

                <button 
                  onClick={handleExecuteImport}
                  disabled={importing}
                  className="w-full bg-uni-gold hover:bg-uni-gold-light text-uni-green-dark font-display font-bold py-3 rounded-xl transition-all shadow-md flex justify-center items-center gap-2 cursor-pointer"
                >
                  {importing ? (
                    <div className="w-5 h-5 rounded-full border-2 border-uni-green-dark border-t-transparent animate-spin" />
                  ) : (
                    <span>Lancer l'importation 🚀</span>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
