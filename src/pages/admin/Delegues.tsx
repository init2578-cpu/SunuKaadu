import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { 
  Search, 
  Plus, 
  X, 
  Check, 
  AlertTriangle, 
  UserCheck, 
  UserX, 
  ChevronLeft, 
  ChevronRight,
  Mail,
  Calendar,
  Eye,
  EyeOff,
  Copy,
  KeyRound,
  RefreshCw
} from 'lucide-react';

export default function Delegues() {
  const { admin: currentAdmin } = useAdminAuth();
  
  // Liste des délégués
  const [delegates, setDelegates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Recherche
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Modals et alertes
  const [showFormModal, setShowFormModal] = useState(false);
  const [successToast, setSuccessToast] = useState('');
  const [errorToast, setErrorToast] = useState('');

  // Affichage des mots de passe (set d'IDs avec mdp visible)
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());

  // États du formulaire
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; pass: string } | null>(null);
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

  const fetchDelegates = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('admins')
        .select('*')
        .eq('role', 'delegue');

      if (error) throw error;
      const sortedData = (data || []) as any[];
      sortedData.sort((a, b) => (a.nom || '').localeCompare(b.nom || ''));
      setDelegates(sortedData);
    } catch (e) {
      console.error(e);
      setErrorToast("Erreur lors de la récupération des délégués.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDelegates();
  }, []);

  // Filtrage des données
  const filteredDelegates = delegates.filter((del) => {
    const matchesSearch = 
      del.nom?.toLowerCase().includes(search.toLowerCase()) ||
      del.prenom?.toLowerCase().includes(search.toLowerCase()) ||
      del.email.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = 
      statusFilter === 'all' 
        ? true 
        : statusFilter === 'revoked'
          ? del.is_revoked === true
          : statusFilter === 'activated'
            ? (del.is_activated === true && del.is_revoked === false)
            : (del.is_activated === false && del.is_revoked === false);

    return matchesSearch && matchesStatus;
  });

  // Calculs de pagination
  const totalPages = Math.ceil(filteredDelegates.length / itemsPerPage);
  const paginatedDelegates = filteredDelegates.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter]);

  const togglePasswordVisibility = (id: string) => {
    setVisiblePasswords(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setSuccessToast(`${label} copié !`);
    setTimeout(() => setSuccessToast(''), 2000);
  };

  // Ouvrir formulaire d'ajout
  const handleOpenAdd = () => {
    setNom('');
    setPrenom('');
    setEmail('');
    setPassword(generateRandomPassword());
    setFormError('');
    setCreatedCredentials(null);
    setShowFormModal(true);
  };

  const handleCloseModal = () => {
    setShowFormModal(false);
    setCreatedCredentials(null);
  };

  const handleSaveDelegate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!nom.trim() || !prenom.trim() || !email.trim()) {
      setFormError('Le nom, le prénom et l\'adresse email sont obligatoires.');
      return;
    }

    if (!email.includes('@')) {
      setFormError("Veuillez saisir une adresse email valide.");
      return;
    }

    if (!password || password.length < 6) {
      setFormError("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }

    setFormLoading(true);

    try {
      const emailLower = email.trim().toLowerCase();

      const { data: existingAdmin, error: checkErr } = await supabase
        .from('admins')
        .select('id')
        .eq('email', emailLower)
        .limit(1);

      if (checkErr) throw checkErr;
      
      if (existingAdmin && existingAdmin.length > 0) {
        setFormError("Cet email est déjà lié à un compte administrateur.");
        setFormLoading(false);
        return;
      }

      const { error: insErr } = await supabase
        .from('admins')
        .insert({
          nom: nom.trim(),
          prenom: prenom.trim(),
          email: emailLower,
          role: 'delegue',
          is_activated: false,
          is_revoked: false,
          created_by: currentAdmin?.id || null,
          mot_de_passe: password,
          created_at: new Date().toISOString()
        });

      if (insErr) throw insErr;

      // Envoyer l'email de bienvenue avec mot de passe temporaire au délégué
      supabase.functions.invoke('send-rep-email', {
        body: {
          to: emailLower,
          prenom: prenom.trim(),
          nom: nom.trim(),
          mot_de_passe: password,
          role: 'delegue'
        }
      }).then(({ data, error }) => {
        if (error) {
          console.warn("Erreur d'envoi d'email au délégué:", error);
        } else if (data && data.sandbox_restriction) {
          console.info("Info: Envoi d'email automatique limité par Resend (mode Sandbox).");
        }
      }).catch(err => console.error("Erreur d'envoi d'email au délégué:", err));

      setCreatedCredentials({ email: emailLower, pass: password });
      fetchDelegates();
    } catch (err: any) {
      setFormError(err.message || "Erreur de sauvegarde.");
    } finally {
      setFormLoading(false);
    }
  };

  const handleToggleRevoke = async (delegate: any) => {
    const actionName = delegate.is_revoked ? 'réactiver' : 'révoquer';
    if (!confirm(`Voulez-vous vraiment ${actionName} le délégué ${delegate.prenom} ${delegate.nom} ?`)) {
      return;
    }

    try {
      const nextRevokedState = !delegate.is_revoked;
      const { error } = await supabase
        .from('admins')
        .update({ is_revoked: nextRevokedState })
        .eq('id', delegate.id);

      if (error) throw error;

      setDelegates(prev => 
        prev.map(d => d.id === delegate.id ? { ...d, is_revoked: nextRevokedState } : d)
      );

      setSuccessToast(`Le compte du délégué a été ${nextRevokedState ? 'révoqué' : 'réactivé'} avec succès.`);
      setTimeout(() => setSuccessToast(''), 3000);
    } catch (err: any) {
      setErrorToast(err.message || "Erreur lors du changement de statut.");
      setTimeout(() => setErrorToast(''), 3000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Notifications */}
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

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-extrabold text-white">Gestion des Délégués</h1>
          <p className="text-sm text-gray-400">Inscrivez, surveillez et révoquez les comptes des délégués électoraux.</p>
        </div>
        <button 
          onClick={handleOpenAdd}
          className="flex items-center gap-2 bg-uni-gold hover:bg-uni-gold-light text-uni-green-dark font-display font-bold text-sm py-2.5 px-4 rounded-xl transition-all shadow-md cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Ajouter un Délégué</span>
        </button>
      </div>

      {/* Filters */}
      <div className="glassmorphism p-4 rounded-2xl flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-gray-500" />
          <input 
            type="text"
            placeholder="Rechercher par nom, prénom ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-uni-gold focus:ring-1 focus:ring-uni-gold transition-all"
          />
        </div>

        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 w-full md:w-auto justify-between md:justify-start">
          <span className="text-xs text-gray-400">Statut :</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-transparent text-xs text-gray-300 font-medium focus:outline-none border-none pr-6 cursor-pointer"
          >
            <option value="all" className="bg-gray-900 text-white">Tous les statuts</option>
            <option value="activated" className="bg-gray-900 text-white">Comptes Activés</option>
            <option value="pending" className="bg-gray-900 text-white">En attente d'activation</option>
            <option value="revoked" className="bg-gray-900 text-white">Comptes Révoqués</option>
          </select>
        </div>
      </div>

      {/* Table Data */}
      <div className="glassmorphism rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center">
            <div className="w-8 h-8 rounded-full border-4 border-uni-gold border-t-transparent animate-spin mb-3" />
            <p className="text-sm text-gray-400">Chargement des délégués...</p>
          </div>
        ) : filteredDelegates.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            Aucun délégué enregistré.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-400">
                <thead className="text-xs uppercase bg-white/5 text-gray-300 border-b border-white/5">
                  <tr>
                    <th className="px-6 py-4">Identité</th>
                    <th className="px-6 py-4">Adresse Email</th>
                    <th className="px-6 py-4">
                      <span className="flex items-center gap-1.5">
                        <KeyRound className="w-3.5 h-3.5 text-uni-gold" />
                        Mot de passe
                      </span>
                    </th>
                    <th className="px-6 py-4">Date de Création</th>
                    <th className="px-6 py-4">Statut</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {paginatedDelegates.map((delegate) => {
                    const isVisible = visiblePasswords.has(delegate.id);
                    return (
                      <tr key={delegate.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-6 py-4 font-semibold text-white whitespace-nowrap">
                          {delegate.prenom} {delegate.nom}
                        </td>
                        <td className="px-6 py-4 font-mono text-xs whitespace-nowrap">{delegate.email}</td>
                        
                        {/* Colonne Mot de passe */}
                        <td className="px-6 py-4">
                          {delegate.mot_de_passe ? (
                            <div className="flex items-center gap-2">
                              <span className={`font-mono text-sm font-bold transition-all ${isVisible ? 'text-uni-gold' : 'text-gray-600 tracking-widest text-xs'}`}>
                                {isVisible ? delegate.mot_de_passe : '••••••••'}
                              </span>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => togglePasswordVisibility(delegate.id)}
                                  className="p-1 rounded hover:bg-white/5 text-gray-500 hover:text-white transition-colors cursor-pointer"
                                  title={isVisible ? "Masquer" : "Afficher"}
                                >
                                  {isVisible 
                                    ? <EyeOff className="w-3.5 h-3.5" /> 
                                    : <Eye className="w-3.5 h-3.5" />
                                  }
                                </button>
                                <button
                                  onClick={() => copyToClipboard(delegate.mot_de_passe, 'Mot de passe')}
                                  className="p-1 rounded hover:bg-uni-gold/10 text-gray-500 hover:text-uni-gold transition-colors cursor-pointer"
                                  title="Copier le mot de passe"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <span className="text-[10px] text-gray-600 italic">Non disponible</span>
                          )}
                        </td>

                        <td className="px-6 py-4 font-mono text-xs whitespace-nowrap">
                          <span className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-gray-500" />
                            {delegate.created_at ? new Date(delegate.created_at).toLocaleDateString('fr-FR', {
                              year: 'numeric', month: 'long', day: 'numeric'
                            }) : '—'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {delegate.is_revoked ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase bg-uni-red/10 text-uni-red-light border border-uni-red/25">
                              <X className="w-3 h-3" /> Révoqué
                            </span>
                          ) : delegate.is_activated ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                              <Check className="w-3 h-3" /> Activé
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase bg-uni-gold/10 text-uni-gold border border-uni-gold/25">
                              En attente
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {delegate.is_revoked ? (
                            <button 
                              onClick={() => handleToggleRevoke(delegate)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-xs font-bold transition-all cursor-pointer"
                              title="Réactiver le compte"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>Réactiver</span>
                            </button>
                          ) : (
                            <button 
                              onClick={() => handleToggleRevoke(delegate)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-uni-red/10 hover:bg-uni-red/20 text-uni-red-light border border-uni-red/20 text-xs font-bold transition-all cursor-pointer"
                              title="Révoquer le compte"
                            >
                              <UserX className="w-3.5 h-3.5" />
                              <span>Révoquer</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-white/5">
                <span className="text-xs text-gray-500">
                  Affichage de {(currentPage - 1) * itemsPerPage + 1} à {Math.min(currentPage * itemsPerPage, filteredDelegates.length)} sur {filteredDelegates.length} délégués
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
          </>
        )}
      </div>

      {/* FORM MODAL */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="glassmorphism w-full max-w-md p-8 rounded-3xl space-y-6 relative shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <button 
              onClick={handleCloseModal}
              className="absolute right-6 top-6 p-2 rounded-lg text-gray-400 hover:bg-white/5 hover:text-white transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {createdCredentials ? (
              /* Écran de confirmation avec les accès */
              <div className="space-y-6 text-center py-2">
                <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                  <Check className="w-8 h-8" />
                </div>
                
                <div>
                  <h3 className="text-2xl font-display font-extrabold text-white">Délégué Créé !</h3>
                  <p className="text-sm text-gray-400 mt-2">
                    Transmettez ces identifiants au délégué pour sa première connexion.
                  </p>
                </div>

                <div className="bg-white/3 border border-white/5 rounded-2xl p-6 text-left space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-uni-gold border-b border-white/5 pb-2">
                    Accès de connexion
                  </h4>
                  
                  <div className="space-y-1">
                    <span className="text-[11px] text-gray-500 uppercase tracking-wider block">Identifiant / E-mail</span>
                    <div className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-2.5 border border-white/5">
                      <span className="text-sm font-semibold text-white select-all">{createdCredentials.email}</span>
                      <button
                        onClick={() => copyToClipboard(createdCredentials.email, 'E-mail')}
                        className="text-gray-400 hover:text-uni-gold transition-colors p-1 cursor-pointer"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] text-gray-500 uppercase tracking-wider block">Mot de passe</span>
                    <div className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-2.5 border border-white/5">
                      <span className="text-sm font-mono font-bold text-uni-gold select-all">{createdCredentials.pass}</span>
                      <button
                        onClick={() => copyToClipboard(createdCredentials.pass, 'Mot de passe')}
                        className="text-gray-400 hover:text-uni-gold transition-colors p-1 cursor-pointer"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="p-3 bg-uni-gold/5 border border-uni-gold/20 rounded-xl text-xs text-uni-gold-light leading-relaxed">
                    ℹ️ Ce mot de passe est également visible dans la fiche de l'amicale du délégué à tout moment.
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
              /* Formulaire d'ajout */
              <>
                <div>
                  <h3 className="text-xl font-display font-extrabold text-white">
                    Ajouter un Délégué
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">
                    Enregistrez un nouveau compte délégué électoral.
                  </p>
                </div>

                {formError && (
                  <div className="p-3 rounded-xl bg-uni-red/10 border border-uni-red/20 text-xs font-semibold text-uni-red-light text-center leading-relaxed">
                    {formError}
                  </div>
                )}

                <form onSubmit={handleSaveDelegate} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 block">Prénom *</label>
                      <input 
                        type="text" 
                        value={prenom}
                        onChange={(e) => setPrenom(e.target.value)}
                        disabled={formLoading}
                        placeholder="Ex: Moussa"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-uni-gold"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 block">Nom *</label>
                      <input 
                        type="text" 
                        value={nom}
                        onChange={(e) => setNom(e.target.value)}
                        disabled={formLoading}
                        placeholder="Ex: Diallo"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-uni-gold"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 block">Email *</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-3 w-4 h-4 text-gray-500" />
                      <input 
                        type="email" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={formLoading}
                        placeholder="Ex: moussa.diallo@univ.sn"
                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-uni-gold"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 block">
                      <span className="flex items-center gap-1.5">
                        <KeyRound className="w-3.5 h-3.5 text-uni-gold" />
                        Mot de passe *
                      </span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={formLoading}
                        placeholder="Mot de passe"
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-mono text-uni-gold placeholder-gray-500 focus:outline-none focus:border-uni-gold"
                      />
                      <button
                        type="button"
                        onClick={() => setPassword(generateRandomPassword())}
                        className="bg-white/5 hover:bg-white/10 border border-white/10 p-2.5 rounded-xl text-gray-400 hover:text-white transition-all cursor-pointer"
                        title="Générer un nouveau mot de passe"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-[10px] text-gray-500">
                      Ce mot de passe sera visible dans la liste des délégués après création.
                    </p>
                  </div>

                  <button 
                    type="submit" 
                    disabled={formLoading}
                    className="w-full bg-uni-gold hover:bg-uni-gold-light text-uni-green-dark font-display font-bold py-3 px-6 rounded-xl transition-all flex justify-center items-center cursor-pointer mt-4"
                  >
                    {formLoading ? (
                      <div className="w-5 h-5 rounded-full border-2 border-uni-green-dark border-t-transparent animate-spin" />
                    ) : (
                      <span>Créer le compte Délégué ⚡</span>
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
