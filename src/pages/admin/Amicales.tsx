import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { 
  Plus, 
  X, 
  Check, 
  AlertTriangle, 
  UserCheck, 
  UserX, 
  Shield, 
  Mail, 
  Calendar,
  Layers,
  Users,
  Vote,
  Info,
  Text,
  Copy,
  RefreshCw,
  Trash2
} from 'lucide-react';

export default function Amicales() {
  const { admin: currentAdmin } = useAdminAuth();
  const navigate = useNavigate();
  
  // Data lists
  const [amicales, setAmicales] = useState<any[]>([]);
  const [delegates, setDelegates] = useState<any[]>([]);
  const [elections, setElections] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Selection for detail pane
  const [selectedAmicaleId, setSelectedAmicaleId] = useState<string | null>(null);

  // Modals & Toasts
  const [showAddModal, setShowAddModal] = useState(false);
  const [successToast, setSuccessToast] = useState('');
  const [errorToast, setErrorToast] = useState('');

  // Form state
  const [amicaleNom, setAmicaleNom] = useState('');
  const [amicaleDesc, setAmicaleDesc] = useState('');
  const [delegueNom, setDelegueNom] = useState('');
  const [deleguePrenom, setDeleguePrenom] = useState('');
  const [delegueEmail, setDelegueEmail] = useState('');
  const [deleguePassword, setDeleguePassword] = useState('');
  const [preActivate, setPreActivate] = useState(true);
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; pass: string; amicale: string; preActivated: boolean } | null>(null);
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  const generateRandomPassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let pass = 'Del-';
    for (let i = 0; i < 6; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pass;
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch Amicales
      const { data: amicalesData, error: amicalesErr } = await supabase
        .from('amicales')
        .select('*')
        .order('nom', { ascending: true });
      if (amicalesErr) throw amicalesErr;
        
      // Fetch Delegates
      const { data: adminsData, error: adminsErr } = await supabase
        .from('admins')
        .select('*')
        .eq('role', 'delegue');
      if (adminsErr) throw adminsErr;

      // Fetch Elections
      const { data: elecData, error: elecErr } = await supabase
        .from('elections')
        .select('*');
      if (elecErr) throw elecErr;

      // Fetch Students
      const { data: studData, error: studErr } = await supabase
        .from('students')
        .select('id, amicale_id');
      if (studErr) throw studErr;

      setAmicales(amicalesData || []);
      setDelegates(adminsData || []);
      setElections(elecData || []);
      setStudents(studData || []);

      // Select first amicale by default if none selected
      if (amicalesData && amicalesData.length > 0 && !selectedAmicaleId) {
        setSelectedAmicaleId(amicalesData[0].id);
      }
    } catch (e: any) {
      console.error(e);
      setErrorToast(e.message || "Erreur de chargement des données.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenAdd = () => {
    setAmicaleNom('');
    setAmicaleDesc('');
    setDelegueNom('');
    setDeleguePrenom('');
    setDelegueEmail('');
    setDeleguePassword(generateRandomPassword());
    setPreActivate(true);
    setCreatedCredentials(null);
    setFormError('');
    setShowAddModal(true);
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setCreatedCredentials(null);
  };

  const handleCreateAmicale = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    // Validations
    if (!amicaleNom.trim() || !delegueNom.trim() || !deleguePrenom.trim() || !delegueEmail.trim()) {
      setFormError("Veuillez remplir tous les champs obligatoires (*).");
      return;
    }

    if (!delegueEmail.includes('@')) {
      setFormError("Veuillez saisir une adresse email de délégué valide.");
      return;
    }

    if (preActivate && (!deleguePassword || deleguePassword.length < 6)) {
      setFormError("Le mot de passe du délégué doit contenir au moins 6 caractères.");
      return;
    }

    setFormLoading(true);

    try {
      const emailLower = delegueEmail.trim().toLowerCase();

      // Check delegate email uniqueness in admins
      const { data: snapAdmin, error: adminErr } = await supabase
        .from('admins')
        .select('id')
        .eq('email', emailLower)
        .limit(1);

      if (adminErr) throw adminErr;

      if (snapAdmin && snapAdmin.length > 0) {
        setFormError("Cet email de délégué est déjà associé à un compte existant.");
        setFormLoading(false);
        return;
      }

      // Check amicale uniqueness
      const { data: snapAm, error: amErr } = await supabase
        .from('amicales')
        .select('id')
        .eq('nom', amicaleNom.trim())
        .limit(1);

      if (amErr) throw amErr;

      if (snapAm && snapAm.length > 0) {
        setFormError("Une amicale portant ce nom existe déjà.");
        setFormLoading(false);
        return;
      }

      // 1. Insert Amicale
      const { data: newAmicale, error: insAmErr } = await supabase
        .from('amicales')
        .insert({
          nom: amicaleNom.trim(),
          description: amicaleDesc.trim() || null,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (insAmErr || !newAmicale) throw insAmErr || new Error("Erreur d'insertion de l'amicale.");

      const newAmicaleId = newAmicale.id;

      // 2. Insert delegate (starting as unactivated to undergo the activation flow on first login)
      const { error: insAdminErr } = await supabase
        .from('admins')
        .insert({
          nom: delegueNom.trim(),
          prenom: deleguePrenom.trim(),
          email: emailLower,
          role: 'delegue',
          amicale_id: newAmicaleId,
          is_activated: preActivate,
          is_revoked: false,
          created_by: currentAdmin?.id || null,
          auth_user_id: null,
          mot_de_passe: deleguePassword,
          created_at: new Date().toISOString()
        });

      if (insAdminErr) throw insAdminErr;

      // Invitation email simulation
      const simulatedEmailContent = `
        -------------------------------------------------------------
        📧 [EMAIL SIMULÉ - INVITATION DELEGUE MULTI-TENANT]
        Destinataire : ${deleguePrenom.trim()} ${delegueNom.trim()} <${emailLower}>
        Amicale : ${amicaleNom.trim()}
        Objet : Vos accès Délégué sur la plateforme
        
        Bonjour ${deleguePrenom.trim()},
        Votre espace Amicale "${amicaleNom.trim()}" a été configuré.
        Activez votre compte et configurez votre mot de passe ici :
        👉 http://localhost:5173/admin/login
        Mot de passe suggéré : ${deleguePassword}
        -------------------------------------------------------------
      `;
      console.log(simulatedEmailContent);

      setCreatedCredentials({
        email: emailLower,
        pass: deleguePassword,
        amicale: amicaleNom.trim(),
        preActivated: preActivate
      });
      setSelectedAmicaleId(newAmicaleId);
      await fetchData();

      setSuccessToast(`🎉 Amicale "${amicaleNom.trim()}" créée avec succès.`);
      setTimeout(() => setSuccessToast(''), 3000);

    } catch (err: any) {
      setFormError(err.message || "Une erreur est survenue.");
    } finally {
      setFormLoading(false);
    }
  };

  const handleToggleRevoke = async (delegate: any) => {
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

      setDelegates(prev => 
        prev.map(d => d.id === delegate.id ? { ...d, is_revoked: nextRevState } : d)
      );

      setSuccessToast(`Le compte délégué a été ${nextRevState ? 'révoqué' : 'réactivé'} avec succès.`);
      setTimeout(() => setSuccessToast(''), 3000);
    } catch (err: any) {
      setErrorToast(err.message || "Erreur de modification du compte.");
      setTimeout(() => setErrorToast(''), 3000);
    }
  };

  const handleDeleteAmicale = async (amicaleId: string) => {
    if (!confirm("Attention : supprimer cette amicale annulera les affiliations des étudiants et élections rattachées, et supprimera le compte du délégué associé. Cette action est irréversible.\n\nVoulez-vous vraiment supprimer cette amicale ?")) {
      return;
    }

    try {
      setLoading(true);
      
      // 1. Delete associated delegate from admins
      const { error: delAdminErr } = await supabase
        .from('admins')
        .delete()
        .eq('amicale_id', amicaleId)
        .eq('role', 'delegue');

      if (delAdminErr) throw delAdminErr;

      // 2. Delete all associated students from students
      const { error: delStudErr } = await supabase
        .from('students')
        .delete()
        .eq('amicale_id', amicaleId);

      if (delStudErr) throw delStudErr;

      // 3. Delete amicale itself
      const { error: delAmErr } = await supabase
        .from('amicales')
        .delete()
        .eq('id', amicaleId);

      if (delAmErr) throw delAmErr;

      setSuccessToast("🎉 Amicale, délégué et liste d'étudiants supprimés avec succès.");
      setTimeout(() => setSuccessToast(''), 3000);
      setSelectedAmicaleId(null);
      await fetchData();
    } catch (err: any) {
      setErrorToast(err.message || "Erreur lors de la suppression de l'amicale.");
      setTimeout(() => setErrorToast(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  // Find active amicale
  const activeAmicale = amicales.find(a => a.id === selectedAmicaleId);
  const activeDelegate = delegates.find(d => d.amicale_id === selectedAmicaleId);
  const activeElections = elections.filter(e => e.amicale_id === selectedAmicaleId);
  const activeStudentCount = students.filter(s => s.amicale_id === selectedAmicaleId).length;

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

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-extrabold text-white">Gestion des Amicales</h1>
          <p className="text-sm text-gray-400">Supervisez les différents groupes d'étudiants et leurs délégués.</p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 bg-uni-gold hover:bg-uni-gold-light text-uni-green-dark font-display font-bold text-sm py-2.5 px-4 rounded-xl transition-all shadow-md cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Nouvelle Amicale</span>
        </button>
      </div>

      {loading ? (
        <div className="p-12 flex flex-col items-center justify-center glassmorphism rounded-2xl">
          <div className="w-8 h-8 rounded-full border-4 border-uni-gold border-t-transparent animate-spin mb-3" />
          <p className="text-sm text-gray-400">Chargement des amicales et délégués...</p>
        </div>
      ) : amicales.length === 0 ? (
        <div className="p-12 text-center text-gray-500 bg-white/3 border border-white/5 rounded-2xl">
          <Layers className="w-12 h-12 mx-auto mb-4 text-gray-600" />
          <p className="text-lg font-semibold text-white">Aucune amicale enregistrée</p>
          <p className="text-sm text-gray-400 mt-1 mb-6">Créez votre première amicale étudiante pour démarrer.</p>
          <button
            onClick={handleOpenAdd}
            className="bg-uni-gold hover:bg-uni-gold-light text-uni-green-dark font-display font-bold text-sm py-2 px-4 rounded-xl transition-all"
          >
            Nouvelle Amicale
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {amicales.map((amicale) => {
            const del = delegates.find(d => d.amicale_id === amicale.id);
            const elCount = elections.filter(e => e.amicale_id === amicale.id).length;
            const studCount = students.filter(s => s.amicale_id === amicale.id).length;

            return (
              <div
                key={amicale.id}
                onClick={() => navigate(`/admin/amicales/${amicale.id}`)}
                className="p-6 rounded-2xl cursor-pointer border bg-uni-card border-white/5 hover:border-uni-gold/40 hover:shadow-lg hover:shadow-uni-gold/5 transition-all relative overflow-hidden group animate-in fade-in duration-200"
              >
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-bold text-white group-hover:text-uni-gold transition-colors truncate">
                      {amicale.nom}
                    </h3>
                    <p className="text-xs text-gray-400 mt-1 line-clamp-2 min-h-[2rem]">
                      {amicale.description || "Aucune description fournie."}
                    </p>
                  </div>

                  {/* Stats Badges */}
                  <div className="flex gap-2.5">
                    <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-white/5 border border-white/5 text-gray-300">
                      <Users className="w-3 h-3 text-uni-gold" />
                      <strong>{studCount}</strong> étud.
                    </span>
                    <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-white/5 border border-white/5 text-gray-300">
                      <Vote className="w-3 h-3 text-uni-gold" />
                      <strong>{elCount}</strong> élect.
                    </span>
                  </div>

                  {/* Delegate Info */}
                  <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs">
                    <span className="text-gray-500">Délégué :</span>
                    <span className="font-semibold text-white truncate max-w-[120px]">
                      {del ? `${del.prenom} ${del.nom}` : <span className="text-uni-red italic font-normal">Aucun</span>}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="glassmorphism w-full max-w-lg p-8 rounded-3xl space-y-6 relative shadow-2xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={handleCloseModal}
              className="absolute right-6 top-6 p-2 rounded-lg text-gray-400 hover:bg-white/5 hover:text-white transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {createdCredentials ? (
              <div className="space-y-6 text-center py-4">
                <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto animate-bounce">
                  <Check className="w-8 h-8" />
                </div>
                
                <div>
                  <h3 className="text-2xl font-display font-extrabold text-white">Amicale Créée !</h3>
                  <p className="text-sm text-gray-400 mt-2">
                    L'amicale <span className="text-uni-gold font-semibold">{createdCredentials.amicale}</span> a été configurée avec succès.
                  </p>
                </div>

                <div className="bg-white/3 border border-white/5 rounded-2xl p-6 text-left space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-uni-gold border-b border-white/5 pb-2">
                    Accès de connexion du Délégué
                  </h4>
                  
                  <div className="space-y-1">
                    <span className="text-[11px] text-gray-500 uppercase tracking-wider block">Identifiant / E-mail</span>
                    <div className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-2.5 border border-white/5">
                      <span className="text-sm font-semibold text-white select-all">{createdCredentials.email}</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(createdCredentials.email);
                          setSuccessToast("E-mail copié !");
                          setTimeout(() => setSuccessToast(''), 2000);
                        }}
                        className="text-gray-400 hover:text-uni-gold transition-colors p-1"
                        title="Copier l'e-mail"
                        type="button"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] text-gray-500 uppercase tracking-wider block">Mot de passe suggéré</span>
                    <div className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-2.5 border border-white/5">
                      <span className="text-sm font-mono font-semibold text-uni-gold select-all">{createdCredentials.pass}</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(createdCredentials.pass);
                          setSuccessToast("Mot de passe copié !");
                          setTimeout(() => setSuccessToast(''), 2000);
                        }}
                        className="text-gray-400 hover:text-uni-gold transition-colors p-1"
                        title="Copier le mot de passe"
                        type="button"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="pt-2">
                    {createdCredentials.preActivated ? (
                      <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-400 text-center leading-relaxed">
                        ⚡ Le compte a été activé. Le délégué peut se connecter immédiatement avec ces identifiants.
                      </div>
                    ) : (
                      <div className="p-3 bg-uni-gold/10 border border-uni-gold/20 rounded-xl text-xs text-uni-gold text-center leading-relaxed">
                        📧 Un e-mail d'activation a été simulé. Le délégué devra activer son compte lors de sa première connexion.
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={handleCloseModal}
                  className="w-full bg-uni-gold hover:bg-uni-gold-light text-uni-green-dark font-display font-bold py-3 px-6 rounded-xl transition-all cursor-pointer"
                >
                  Terminer
                </button>
              </div>
            ) : (
              <>
                <div>
                  <h3 className="text-xl font-display font-extrabold text-white">Créer une Amicale</h3>
                  <p className="text-xs text-gray-400 mt-1">Configurez une nouvelle amicale et attribuez-lui un délégué.</p>
                </div>

                {formError && (
                  <div className="p-3 rounded-xl bg-uni-red/10 border border-uni-red/20 text-xs font-semibold text-uni-red-light text-center leading-relaxed">
                    {formError}
                  </div>
                )}

                <form onSubmit={handleCreateAmicale} className="space-y-6">
                  {/* Amicale Section */}
                  <div className="space-y-4">
                    <div className="border-b border-white/5 pb-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-uni-gold">1. Informations de l'Amicale</h4>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 block">Nom de l'Amicale *</label>
                      <input
                        type="text"
                        required
                        value={amicaleNom}
                        onChange={(e) => setAmicaleNom(e.target.value)}
                        disabled={formLoading}
                        placeholder="Ex: Amicale de Kolda"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-uni-gold"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 block">Description</label>
                      <textarea
                        value={amicaleDesc}
                        onChange={(e) => setAmicaleDesc(e.target.value)}
                        disabled={formLoading}
                        placeholder="Courte description de l'amicale..."
                        rows={2}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-uni-gold resize-none"
                      />
                    </div>
                  </div>

                  {/* Delegate Section */}
                  <div className="space-y-4">
                    <div className="border-b border-white/5 pb-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-uni-gold">2. Profil du Délégué Responsable</h4>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 block">Prénom *</label>
                        <input
                          type="text"
                          required
                          value={deleguePrenom}
                          onChange={(e) => setDeleguePrenom(e.target.value)}
                          disabled={formLoading}
                          placeholder="Ex: Mamadou"
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-uni-gold"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 block">Nom *</label>
                        <input
                          type="text"
                          required
                          value={delegueNom}
                          onChange={(e) => setDelegueNom(e.target.value)}
                          disabled={formLoading}
                          placeholder="Ex: Diallo"
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-uni-gold"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 block">Adresse Email *</label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-3 w-4 h-4 text-gray-500" />
                        <input
                          type="email"
                          required
                          value={delegueEmail}
                          onChange={(e) => setDelegueEmail(e.target.value)}
                          disabled={formLoading}
                          placeholder="Ex: kolda@univ.sn"
                          className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-uni-gold"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 block">Mot de passe pour le délégué</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          required
                          value={deleguePassword}
                          onChange={(e) => setDeleguePassword(e.target.value)}
                          disabled={formLoading}
                          placeholder="Mot de passe"
                          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-mono text-white placeholder-gray-500 focus:outline-none focus:border-uni-gold"
                        />
                        <button
                          type="button"
                          onClick={() => setDeleguePassword(generateRandomPassword())}
                          className="bg-white/5 hover:bg-white/10 border border-white/10 p-2.5 rounded-xl text-gray-400 hover:text-white transition-all cursor-pointer"
                          title="Générer un autre mot de passe"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <label className="flex items-center gap-3 cursor-pointer group text-left pt-2">
                      <input
                        type="checkbox"
                        checked={preActivate}
                        onChange={(e) => setPreActivate(e.target.checked)}
                        disabled={formLoading}
                        className="rounded border-white/10 bg-white/5 text-uni-gold focus:ring-0 focus:ring-offset-0 focus:outline-none w-4 h-4 cursor-pointer"
                      />
                      <div className="text-xs">
                        <p className="font-semibold text-white group-hover:text-uni-gold transition-colors">Activer directement le compte</p>
                        <p className="text-gray-500 text-[10px]">Permet au délégué de se connecter immédiatement sans e-mail d'activation (idéal pour le test/démo).</p>
                      </div>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={formLoading}
                    className="w-full bg-uni-gold hover:bg-uni-gold-light text-uni-green-dark font-display font-bold py-3 px-6 rounded-xl transition-all flex justify-center items-center cursor-pointer mt-2"
                  >
                    {formLoading ? (
                      <div className="w-5 h-5 rounded-full border-2 border-uni-green-dark border-t-transparent animate-spin" />
                    ) : (
                      <span>Enregistrer & Inviter le Délégué ⚡</span>
                    )}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
