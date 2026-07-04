import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { UserPlus, ShieldOff, ShieldCheck, Mail, Key, ShieldAlert, Loader2, Trash2, Edit } from 'lucide-react';
import { useAdminAuth } from '../../context/AdminAuthContext';

interface UserData {
  id: string;
  nom: string | null;
  prenom: string | null;
  email: string;
  role: 'super_admin' | 'delegue' | 'representant';
  is_activated: boolean;
  is_revoked: boolean;
  amicale_id: string | null;
  mot_de_passe?: string | null; // Pour afficher le mot de passe temporaire si besoin
}

interface AmicaleData {
  id: string;
  nom: string;
}

export default function Utilisateurs() {
  const { admin } = useAdminAuth();
  const [users, setUsers] = useState<UserData[]>([]);
  const [amicales, setAmicales] = useState<AmicaleData[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newNom, setNewNom] = useState('');
  const [newPrenom, setNewPrenom] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'super_admin' | 'delegue' | 'representant'>('delegue');
  const [newAmicaleId, setNewAmicaleId] = useState('');
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [generatedEmail, setGeneratedEmail] = useState('');

  // Edit state
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [editNom, setEditNom] = useState('');
  const [editPrenom, setEditPrenom] = useState('');
  const [editRole, setEditRole] = useState<'super_admin' | 'delegue' | 'representant'>('delegue');
  const [editAmicaleId, setEditAmicaleId] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetch users
      const { data: usersDataDocs, error: userErr } = await supabase
        .from('admins')
        .select('*');
      if (userErr) throw userErr;
      const usersData = (usersDataDocs || []) as UserData[];
      
      // Sort: super_admin first, then delegue, then representant
      const roleOrder = { super_admin: 1, delegue: 2, representant: 3 };
      usersData.sort((a, b) => roleOrder[a.role] - roleOrder[b.role]);
      
      setUsers(usersData);

      // Fetch amicales
      const { data: amicalesDocs, error: amicErr } = await supabase
        .from('amicales')
        .select('id, nom')
        .order('nom', { ascending: true });
      if (amicErr) throw amicErr;
      setAmicales(amicalesDocs || []);
    } catch (e: any) {
      console.error("Erreur fetchData utilisateurs", e);
      setErrorMsg("Impossible de charger les données.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setGeneratedPassword('');

    if (!newEmail || !newNom || !newPrenom) {
      setErrorMsg("Veuillez remplir tous les champs obligatoires.");
      return;
    }

    if ((newRole === 'delegue' || newRole === 'representant') && !newAmicaleId) {
      setErrorMsg("Une amicale doit être sélectionnée pour ce rôle.");
      return;
    }

    try {
      setActionLoading(true);
      
      // Check if email already exists in Supabase
      const { data: existDocs, error: checkErr } = await supabase
        .from('admins')
        .select('id')
        .eq('email', newEmail.trim().toLowerCase())
        .limit(1);
      if (checkErr) throw checkErr;

      if (existDocs && existDocs.length > 0) {
        setErrorMsg("Un utilisateur avec cette adresse e-mail existe déjà.");
        setActionLoading(false);
        return;
      }

      // Generate a secure 8-character temporary password
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#";
      let tempPassword = "";
      for (let i = 0; i < 8; i++) {
        tempPassword += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      const userData = {
        nom: newNom.trim(),
        prenom: newPrenom.trim(),
        email: newEmail.trim().toLowerCase(),
        role: newRole,
        amicale_id: (newRole === 'delegue' || newRole === 'representant') ? newAmicaleId : null,
        is_activated: false,
        is_revoked: false,
        mot_de_passe: tempPassword, // Temporary password
        created_at: new Date().toISOString()
      };

      const { error: insErr } = await supabase
        .from('admins')
        .insert(userData);
      if (insErr) throw insErr;

      // Envoyer l'email de bienvenue avec le mot de passe temporaire
      supabase.functions.invoke('send-rep-email', {
        body: {
          to: newEmail.trim().toLowerCase(),
          prenom: newPrenom.trim(),
          nom: newNom.trim(),
          mot_de_passe: tempPassword,
          role: newRole
        }
      }).then(({ data, error }) => {
        if (error) {
          console.warn("Erreur d'envoi d'email de bienvenue:", error);
        } else if (data && data.sandbox_restriction) {
          setSuccessMsg(`Utilisateur créé avec succès ! L'envoi automatique est limité par Resend (mode Sandbox). Veuillez lui transmettre ses accès manuellement.`);
        } else {
          setSuccessMsg(`Utilisateur créé avec succès ! Un e-mail contenant ses identifiants lui a été envoyé automatiquement.`);
        }
      }).catch(err => console.error("Erreur d'envoi d'email de bienvenue:", err));
      
      setSuccessMsg(`Utilisateur créé avec succès ! Veuillez lui communiquer son mot de passe temporaire.`);
      setGeneratedPassword(tempPassword);
      setGeneratedEmail(newEmail.trim().toLowerCase());
      
      // Reset form
      setNewNom('');
      setNewPrenom('');
      setNewEmail('');
      setShowAddForm(false);
      
      await fetchData();
    } catch (e: any) {
      console.error("Erreur lors de la création", e);
      setErrorMsg("Erreur lors de la création de l'utilisateur.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleRevoke = async (userId: string, isRevoked: boolean) => {
    if (userId === admin?.id) {
      setErrorMsg("Vous ne pouvez pas révoquer votre propre compte.");
      return;
    }

    try {
      setActionLoading(true);
      setErrorMsg('');
      const nextRevoked = !isRevoked;
      const { error } = await supabase
        .from('admins')
        .update({ is_revoked: nextRevoked })
        .eq('id', userId);
      if (error) throw error;
      setSuccessMsg(isRevoked ? "Accès utilisateur réactivé." : "Accès utilisateur révoqué.");
      await fetchData();
    } catch (e: any) {
      console.error("Erreur révocation", e);
      setErrorMsg("Erreur lors du changement de statut.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditClick = (user: UserData) => {
    setEditingUser(user);
    setEditNom(user.nom || '');
    setEditPrenom(user.prenom || '');
    setEditRole(user.role);
    setEditAmicaleId(user.amicale_id || '');
    setShowAddForm(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    
    if (!editingUser) return;
    if (!editNom || !editPrenom) {
      setErrorMsg("Veuillez remplir tous les champs obligatoires.");
      return;
    }
    if ((editRole === 'delegue' || editRole === 'representant') && !editAmicaleId) {
      setErrorMsg("Une amicale doit être sélectionnée pour ce rôle.");
      return;
    }

    try {
      setActionLoading(true);
      const updates: any = {
        nom: editNom.trim(),
        prenom: editPrenom.trim(),
        role: editRole,
        amicale_id: (editRole === 'delegue' || editRole === 'representant') ? editAmicaleId : null
      };
      
      const { error } = await supabase
        .from('admins')
        .update(updates)
        .eq('id', editingUser.id);
      if (error) throw error;

      setSuccessMsg("Utilisateur mis à jour avec succès.");
      setEditingUser(null);
      await fetchData();
    } catch (e: any) {
      console.error("Erreur update", e);
      setErrorMsg("Erreur lors de la modification.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (userId === admin?.id) {
      setErrorMsg("Vous ne pouvez pas supprimer votre propre compte.");
      return;
    }
    if (window.confirm("Êtes-vous sûr de vouloir supprimer DÉFINITIVEMENT cet utilisateur ? Cette action est irréversible.")) {
      try {
        setActionLoading(true);
        const { error } = await supabase
          .from('admins')
          .delete()
          .eq('id', userId);
        if (error) throw error;

        setSuccessMsg("Utilisateur supprimé avec succès.");
        if (editingUser?.id === userId) setEditingUser(null);
        await fetchData();
      } catch (e: any) {
        console.error("Erreur delete", e);
        setErrorMsg("Erreur lors de la suppression.");
      } finally {
        setActionLoading(false);
      }
    }
  };

  const handleResendEmail = async () => {
    try {
      setActionLoading(true);
      setErrorMsg('');
      setSuccessMsg('');
      
      const userToResend = users.find(u => u.email === generatedEmail);
      
      const { data, error } = await supabase.functions.invoke('send-rep-email', {
        body: {
          to: generatedEmail,
          prenom: userToResend?.prenom || '',
          nom: userToResend?.nom || '',
          mot_de_passe: generatedPassword,
          role: userToResend?.role || 'delegue'
        }
      });

      if (error) {
        console.warn("Erreur d'envoi d'email:", error);
        throw error;
      }

      if (data && data.sandbox_restriction) {
        setSuccessMsg("L'envoi automatique est limité par Resend (mode Sandbox). Veuillez lui transmettre ses accès manuellement.");
      } else {
        setSuccessMsg("E-mail renvoyé avec succès !");
      }
    } catch (e: any) {
      console.error("Erreur renvoi email", e);
      setErrorMsg("Erreur lors de l'envoi de l'e-mail automatique.");
    } finally {
      setActionLoading(false);
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'super_admin': return 'Super Admin';
      case 'delegue': return 'Délégué';
      case 'representant': return 'Représentant';
      default: return role;
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'super_admin': return 'bg-[#FF3370]/10 text-[#FF3370] border-[#FF3370]/20';
      case 'delegue': return 'bg-uni-blue/10 text-uni-blue border-uni-blue/20';
      case 'representant': return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 text-uni-blue animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-white">Gestion des Utilisateurs</h1>
          <p className="text-sm text-gray-400 mt-1">Supervisez et gérez les accès des administrateurs, délégués et représentants.</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center justify-center gap-2 bg-uni-blue hover:bg-uni-blue-light text-white font-bold py-2.5 px-4 rounded-xl transition-all"
        >
          <UserPlus className="w-5 h-5" />
          <span>Ajouter un compte</span>
        </button>
      </div>

      {errorMsg && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-sm">
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-xl text-sm">
          {successMsg}
        </div>
      )}

      {/* Generated Password Alert */}
      {generatedPassword && (
        <div className="bg-uni-gold/10 border border-uni-gold/20 p-6 rounded-2xl flex flex-col md:flex-row items-center gap-6">
          <div className="w-12 h-12 rounded-full bg-uni-gold/20 text-uni-gold flex items-center justify-center shrink-0">
            <Key className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="text-uni-gold font-bold mb-1">Mot de passe temporaire généré !</h3>
            <p className="text-gray-300 text-sm">Veuillez copier et transmettre ce mot de passe à l'utilisateur de manière sécurisée. Il devra le changer à sa première connexion.</p>
            <div className="mt-3 bg-black/40 border border-white/10 px-4 py-2 rounded-lg font-mono text-xl text-white inline-block">
              {generatedPassword}
            </div>
            
            <div className="mt-4 flex gap-3">
              <button 
                onClick={handleResendEmail}
                disabled={actionLoading}
                className="inline-flex items-center gap-2 bg-white text-black font-semibold py-2 px-4 rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                Renvoyer automatiquement
              </button>
              <a 
                href={`mailto:${generatedEmail}?subject=Vos identifiants d'accès - Sunukaadu&body=Bonjour, %0D%0A%0D%0AVotre compte d'administration a été créé avec succès sur la plateforme Sunukaadu.%0D%0A%0D%0AVoici vos informations de connexion temporaires :%0D%0A- E-mail : ${generatedEmail}%0D%0A- Mot de passe temporaire : ${generatedPassword}%0D%0A%0D%0ALien de connexion : ${window.location.origin}/admin/login%0D%0A%0D%0AÀ votre première connexion, il vous sera demandé de créer votre propre mot de passe personnel.%0D%0A%0D%0ACordialement,%0D%0AL'équipe Sunukaadu`}
                className="inline-flex items-center gap-2 border border-white/20 text-white font-semibold py-2 px-4 rounded-xl hover:bg-white/10 transition-colors"
              >
                Copier / Ouvrir client mail
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Add User Form */}
      {showAddForm && (
        <div className="bg-white/5 border border-white/10 p-6 rounded-2xl backdrop-blur-sm">
          <h2 className="text-lg font-bold text-white mb-4">Créer un nouveau compte</h2>
          <form onSubmit={handleAddUser} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Prénom</label>
                <input
                  type="text"
                  value={newPrenom}
                  onChange={(e) => setNewPrenom(e.target.value)}
                  required
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-uni-blue focus:ring-1 focus:ring-uni-blue outline-none transition-all"
                  placeholder="Jean"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Nom</label>
                <input
                  type="text"
                  value={newNom}
                  onChange={(e) => setNewNom(e.target.value)}
                  required
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-uni-blue focus:ring-1 focus:ring-uni-blue outline-none transition-all"
                  placeholder="Dupont"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Adresse E-mail</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                  className="w-full bg-black/40 border border-white/10 rounded-xl pl-11 pr-4 py-2.5 text-white focus:border-uni-blue focus:ring-1 focus:ring-uni-blue outline-none transition-all"
                  placeholder="jean.dupont@univ.sn"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Rôle</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-uni-blue focus:ring-1 focus:ring-uni-blue outline-none transition-all"
                >
                  <option value="super_admin" className="bg-gray-900 text-white">Super Administrateur</option>
                  <option value="delegue" className="bg-gray-900 text-white">Délégué</option>
                  <option value="representant" className="bg-gray-900 text-white">Représentant</option>
                </select>
              </div>

              {(newRole === 'delegue' || newRole === 'representant') && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Amicale rattachée</label>
                  <select
                    value={newAmicaleId}
                    onChange={(e) => setNewAmicaleId(e.target.value)}
                    required
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-uni-blue focus:ring-1 focus:ring-uni-blue outline-none transition-all"
                  >
                    <option value="" className="bg-gray-900 text-white">Sélectionner une amicale...</option>
                    {amicales.map(am => (
                      <option key={am.id} value={am.id} className="bg-gray-900 text-white">{am.nom}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="pt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-5 py-2.5 rounded-xl border border-white/10 text-gray-300 hover:bg-white/5 transition-all"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                className="px-5 py-2.5 rounded-xl bg-uni-blue hover:bg-uni-blue-light text-white font-bold transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Créer le compte
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit User Form */}
      {editingUser && (
        <div className="bg-white/5 border border-white/10 p-6 rounded-2xl backdrop-blur-sm">
          <h2 className="text-lg font-bold text-white mb-4">Modifier l'utilisateur</h2>
          <form onSubmit={handleUpdateUser} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Prénom</label>
                <input
                  type="text"
                  value={editPrenom}
                  onChange={(e) => setEditPrenom(e.target.value)}
                  required
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-uni-blue focus:ring-1 focus:ring-uni-blue outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Nom</label>
                <input
                  type="text"
                  value={editNom}
                  onChange={(e) => setEditNom(e.target.value)}
                  required
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-uni-blue focus:ring-1 focus:ring-uni-blue outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Adresse E-mail <span className="text-gray-500 font-normal text-xs ml-2">(Non modifiable par l'admin)</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="email"
                  value={editingUser.email}
                  disabled
                  className="w-full bg-black/20 border border-white/5 rounded-xl pl-11 pr-4 py-2.5 text-gray-500 cursor-not-allowed outline-none"
                  title="Pour des raisons de sécurité, l'utilisateur doit changer son e-mail lui-même depuis son profil."
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Rôle</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as any)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-uni-blue focus:ring-1 focus:ring-uni-blue outline-none transition-all"
                >
                  <option value="super_admin" className="bg-gray-900 text-white">Super Administrateur</option>
                  <option value="delegue" className="bg-gray-900 text-white">Délégué</option>
                  <option value="representant" className="bg-gray-900 text-white">Représentant</option>
                </select>
              </div>

              {(editRole === 'delegue' || editRole === 'representant') && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Amicale rattachée</label>
                  <select
                    value={editAmicaleId}
                    onChange={(e) => setEditAmicaleId(e.target.value)}
                    required
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-uni-blue focus:ring-1 focus:ring-uni-blue outline-none transition-all"
                  >
                    <option value="" className="bg-gray-900 text-white">Sélectionner une amicale...</option>
                    {amicales.map(am => (
                      <option key={am.id} value={am.id} className="bg-gray-900 text-white">{am.nom}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="pt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="px-5 py-2.5 rounded-xl border border-white/10 text-gray-300 hover:bg-white/5 transition-all"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                className="px-5 py-2.5 rounded-xl bg-uni-blue hover:bg-uni-blue-light text-white font-bold transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Enregistrer les modifications
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users List */}
      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-black/20">
                <th className="p-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Utilisateur</th>
                <th className="p-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Rôle</th>
                <th className="p-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Amicale</th>
                <th className="p-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Statut</th>
                <th className="p-4 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {users.map(user => {
                const amicale = amicales.find(a => a.id === user.amicale_id);
                return (
                  <tr key={user.id} className="hover:bg-white/5 transition-colors">
                    <td className="p-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-white">{user.prenom} {user.nom}</span>
                        <span className="text-xs text-gray-400">{user.email}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium border ${getRoleBadgeColor(user.role)}`}>
                        {getRoleLabel(user.role)}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="text-sm text-gray-300">
                        {amicale ? amicale.nom : '-'}
                      </span>
                    </td>
                    <td className="p-4">
                      {user.is_revoked ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-red-400 bg-red-400/10 px-2 py-1 rounded-full">
                          <ShieldAlert className="w-3.5 h-3.5" />
                          Révoqué
                        </span>
                      ) : user.is_activated ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-full">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Actif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs text-uni-gold bg-uni-gold/10 px-2 py-1 rounded-full">
                          <Key className="w-3.5 h-3.5" />
                          En attente
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      {user.id !== admin?.id && (
                        <div className="flex items-center justify-end gap-2">
                          
                          {/* Afficher mot de passe temporaire si non activé */}
                          {!user.is_activated && user.mot_de_passe && (
                            <button
                              onClick={() => {
                                setGeneratedPassword(user.mot_de_passe!);
                                setGeneratedEmail(user.email);
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                              disabled={actionLoading}
                              className="inline-flex items-center justify-center p-2 rounded-lg transition-all bg-uni-gold/10 text-uni-gold hover:bg-uni-gold/20"
                              title="Voir le mot de passe temporaire"
                            >
                              <Key className="w-4 h-4" />
                            </button>
                          )}

                          <button
                            onClick={() => handleEditClick(user)}
                            disabled={actionLoading}
                            className="inline-flex items-center justify-center p-2 rounded-lg transition-all bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white"
                            title="Modifier"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          
                          <button
                            onClick={() => handleToggleRevoke(user.id, user.is_revoked)}
                            disabled={actionLoading}
                            className={`inline-flex items-center justify-center p-2 rounded-lg transition-all ${
                              user.is_revoked 
                                ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20' 
                                : 'bg-uni-gold/10 text-uni-gold hover:bg-uni-gold/20'
                            }`}
                            title={user.is_revoked ? "Réactiver l'accès" : "Révoquer l'accès"}
                          >
                            {user.is_revoked ? <ShieldCheck className="w-4 h-4" /> : <ShieldOff className="w-4 h-4" />}
                          </button>

                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            disabled={actionLoading}
                            className="inline-flex items-center justify-center p-2 rounded-lg transition-all bg-red-500/10 text-red-400 hover:bg-red-500/20"
                            title="Supprimer définitivement"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500">
                    Aucun utilisateur trouvé.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
