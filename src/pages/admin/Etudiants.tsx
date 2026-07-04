import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import type { Student } from '../../types/database';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { 
  Search, 
  Plus, 
  Upload, 
  Edit2, 
  Trash2, 
  X, 
  Check, 
  AlertTriangle, 
  FileText, 
  CheckSquare, 
  ChevronLeft, 
  ChevronRight,
  Filter,
  UserCheck,
  UserX,
  RefreshCw,
  ArrowLeft,
  Download
} from 'lucide-react';

export default function Etudiants() {
  const { admin } = useAdminAuth();
  
  // Liste des étudiants
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Recherche et filtres
  const [search, setSearch] = useState('');
  const [filiereFilter, setFiliereFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, activated, pending
  const [filieres, setFilieres] = useState<string[]>([]);
  
  // États additionnels pour super_admin
  const [amicales, setAmicales] = useState<any[]>([]);
  const [amicaleFilter, setAmicaleFilter] = useState('');
  const [selectedAmicaleId, setSelectedAmicaleId] = useState('');
  const [activeAmicaleId, setActiveAmicaleId] = useState<string | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Modals
  const [showFormModal, setShowFormModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);

  // États du formulaire
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [email, setEmail] = useState('');
  const [numeroCarte, setNumeroCarte] = useState('');
  const [filiere, setFiliere] = useState('');
  const [promotion, setPromotion] = useState('');
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  // États d'importation CSV
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvPreview, setCsvPreview] = useState<any[]>([]);
  const [importError, setImportError] = useState('');
  const [importReport, setImportReport] = useState<{
    added: number;
    updated: number;
    ignored: number;
    details: string[];
  } | null>(null);
  const [importing, setImporting] = useState(false);

  // Charger la liste des amicales (si super_admin)
  const fetchAmicales = async () => {
    try {
      const { data, error } = await supabase
        .from('amicales')
        .select('*')
        .order('nom', { ascending: true });
      if (error) throw error;
      setAmicales(data || []);
    } catch (e) {
      console.error("Erreur de chargement des amicales", e);
    }
  };

  // Charger la liste
  const fetchStudents = async () => {
    if (!admin) return;
    try {
      let queryBuilder = supabase
        .from('students')
        .select('id, nom, prenom, email, matricule, numero_carte, filiere, promotion, amicale_id, is_activated, created_at');
      
      if (admin.role !== 'super_admin' && admin.amicale_id) {
        queryBuilder = queryBuilder.eq('amicale_id', admin.amicale_id);
      }

      const { data: studentsDocs, error: studErr } = await queryBuilder;
      if (studErr) throw studErr;

      const data = (studentsDocs || []) as unknown as Student[];

      // Récupérer la map des amicales pour le tri
      const amicaleMap = new Map<string, string>();
      const { data: amicalesDocs, error: amicErr } = await supabase
        .from('amicales')
        .select('id, nom');
      if (amicErr) throw amicErr;

      (amicalesDocs || []).forEach(d => {
        amicaleMap.set(d.id, d.nom || '');
      });

      data.sort((a, b) => {
        if (admin.role === 'super_admin') {
          const amicaleA = amicaleMap.get(a.amicale_id || '') || '';
          const amicaleB = amicaleMap.get(b.amicale_id || '') || '';
          const compAmicale = amicaleA.localeCompare(amicaleB);
          if (compAmicale !== 0) return compAmicale;
        }
        return (a.nom || '').localeCompare(b.nom || '');
      });

      setStudents(data);

      // Extraire la liste unique des filières pour le filtre
      const uniqueFilieres = Array.from(
        new Set(data.map((s) => s.filiere).filter(Boolean))
      ) as string[];
      setFilieres(uniqueFilieres);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
    if (admin && admin.role === 'super_admin') {
      fetchAmicales();
    }
  }, [admin]);

  // Filtrage des données
  const filteredStudents = students.filter((student) => {
    const matchesSearch = 
      student.nom.toLowerCase().includes(search.toLowerCase()) ||
      student.prenom.toLowerCase().includes(search.toLowerCase()) ||
      student.email.toLowerCase().includes(search.toLowerCase()) ||
      (student.numero_carte && student.numero_carte.toLowerCase().includes(search.toLowerCase()));

    const matchesFiliere = filiereFilter ? student.filiere === filiereFilter : true;
    
    const matchesStatus = 
      statusFilter === 'all' 
        ? true 
        : statusFilter === 'activated' 
          ? student.is_activated === true 
          : student.is_activated === false;

    const matchesAmicale = admin?.role === 'super_admin'
      ? (activeAmicaleId ? student.amicale_id === activeAmicaleId : true)
      : (admin?.amicale_id ? student.amicale_id === admin.amicale_id : true);

    return matchesSearch && matchesFiliere && matchesStatus && matchesAmicale;
  });

  // Calculs de pagination
  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage);
  const paginatedStudents = filteredStudents.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  useEffect(() => {
    setCurrentPage(1);
  }, [search, filiereFilter, statusFilter, amicaleFilter, activeAmicaleId]);

  // Ouvrir formulaire d'ajout
  const handleOpenAdd = () => {
    setSelectedStudent(null);
    setNom('');
    setPrenom('');
    setEmail('');
    setNumeroCarte('');
    setFiliere('');
    setPromotion('');
    setSelectedAmicaleId(amicales[0]?.id || '');
    setFormError('');
    setShowFormModal(true);
  };

  // Ouvrir formulaire de modification
  const handleOpenEdit = (student: any) => {
    setSelectedStudent(student);
    setNom(student.nom);
    setPrenom(student.prenom);
    setEmail(student.email);
    setNumeroCarte(student.numero_carte || '');
    setFiliere(student.filiere || '');
    setPromotion(student.promotion || '');
    setSelectedAmicaleId(student.amicale_id || '');
    setFormError('');
    setShowFormModal(true);
  };

  // Enregistrer (Ajouter ou Modifier)
  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!nom.trim() || !prenom.trim() || !email.trim() || !numeroCarte.trim()) {
      setFormError('Nom, prénom, email et numéro de carte sont obligatoires.');
      return;
    }

    const targetAmicaleId = admin?.role === 'super_admin' ? selectedAmicaleId : admin?.amicale_id;
    if (!targetAmicaleId) {
      setFormError('Veuillez associer cet étudiant à une amicale.');
      return;
    }

    setFormLoading(true);

    try {
      const emailLower = email.trim().toLowerCase();
      const cardTrimmed = numeroCarte.trim();

      // Vérifier l'unicité globale de l'email et du numéro de carte (Supabase queries)
      let emailExistsGlobal = false;
      let cardExistsGlobal = false;

      // check email uniqueness
      const { data: emailDocs, error: emailErr } = await supabase
        .from('students')
        .select('id')
        .eq('email', emailLower)
        .limit(1);
      if (emailErr) throw emailErr;
      if (emailDocs && emailDocs.length > 0) {
        emailExistsGlobal = true;
      }

      // check card uniqueness
      const { data: cardDocs, error: cardErr } = await supabase
        .from('students')
        .select('id')
        .eq('numero_carte', cardTrimmed)
        .limit(1);
      if (cardErr) throw cardErr;
      if (cardDocs && cardDocs.length > 0) {
        cardExistsGlobal = true;
      }

      if (emailExistsGlobal && (!selectedStudent || selectedStudent.email.toLowerCase() !== emailLower)) {
        setFormError("Cet email est déjà enregistré sur la liste blanche.");
        setFormLoading(false);
        return;
      }

      if (cardExistsGlobal && (!selectedStudent || selectedStudent.numero_carte !== cardTrimmed)) {
        setFormError("Ce numéro de carte est déjà enregistré sur la liste blanche.");
        setFormLoading(false);
        return;
      }

      if (selectedStudent) {
        // Modification
        const { error: updErr } = await supabase
          .from('students')
          .update({
            nom: nom.trim(),
            prenom: prenom.trim(),
            email: emailLower,
            numero_carte: cardTrimmed,
            matricule: cardTrimmed,
            filiere: filiere.trim() || null,
            promotion: promotion.trim() || null,
            amicale_id: targetAmicaleId
          })
          .eq('id', selectedStudent.id);
        if (updErr) throw updErr;
      } else {
        // Ajout
        const { error: insErr } = await supabase
          .from('students')
          .insert({
            nom: nom.trim(),
            prenom: prenom.trim(),
            email: emailLower,
            numero_carte: cardTrimmed,
            matricule: cardTrimmed,
            filiere: filiere.trim() || null,
            promotion: promotion.trim() || null,
            is_activated: false,
            amicale_id: targetAmicaleId,
            created_at: new Date().toISOString()
          });
        if (insErr) throw insErr;
      }

      setShowFormModal(false);
      fetchStudents();
    } catch (err: any) {
      setFormError(err.message || "Erreur de sauvegarde.");
    } finally {
      setFormLoading(false);
    }
  };

  // Supprimer un étudiant
  const handleDeleteStudent = async (student: any) => {
    let warning = `Voulez-vous vraiment retirer ${student.prenom} ${student.nom} de la liste blanche ?`;
    if (student.is_activated) {
      warning = `⚠️ ATTENTION : ${student.prenom} ${student.nom} a déjà activé son compte et défini un mot de passe. Sa suppression réinitialisera son compte et annulera son éligibilité. Confirmer ?`;
    }

    if (confirm(warning)) {
      try {
        const { error } = await supabase
          .from('students')
          .delete()
          .eq('id', student.id);
        if (error) throw error;
        fetchStudents();
      } catch (err: any) {
        alert(err.message || "Erreur lors de la suppression.");
      }
    }
  };
  
  // Changer manuellement l'état d'activation
  const toggleStudentStatus = async (student: any) => {
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
    } catch (err: any) {
      alert(err.message || "Erreur lors du changement de statut.");
    }
  };

  // Réinitialiser la liaison Auth (dissocier)
  const resetStudentAuth = async (student: any) => {
    if (!confirm(`Voulez-vous vraiment réinitialiser le compte de ${student.prenom} ${student.nom} ? Cela dissociera son accès d'authentification.`)) {
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
      alert("Le compte de l'étudiant a été dissocié avec succès. Il pourra s'enregistrer à nouveau avec un nouveau mot de passe.");
    } catch (err: any) {
      alert(err.message || "Erreur lors de la réinitialisation.");
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

  // Parser le fichier CSV
  const handleCSVSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError('');
    setImportReport(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (!text) {
        setImportError("Impossible de lire le contenu du fichier.");
        return;
      }

      const rows = text.split('\n');
      if (rows.length === 0) {
        setImportError("Le fichier CSV est vide.");
        return;
      }

      // Nettoyer d'éventuels caractères BOM UTF-8 invisibles et déterminer le séparateur (virgule ou point-vivgule)
      const firstLine = rows[0].replace(/^\ufeff/, '').trim();
      const delimiter = firstLine.includes(';') ? ';' : ',';

      // Lire les en-têtes
      const headers = firstLine.split(delimiter).map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ''));
      
      const nomIdx = headers.indexOf('nom');
      const prenomIdx = headers.indexOf('prenom');
      const emailIdx = headers.indexOf('email');
      const filiereIdx = headers.indexOf('filiere');
      const promotionIdx = headers.indexOf('promotion');

      // Chercher le numéro de carte par alias
      const possibleCardHeaders = ['numero_carte', 'numero de carte', 'numero carte', 'num_carte', 'n° carte', 'carte'];
      let carteIdx = -1;
      for (const h of possibleCardHeaders) {
        carteIdx = headers.indexOf(h);
        if (carteIdx !== -1) break;
      }

      if (nomIdx === -1 || prenomIdx === -1 || emailIdx === -1 || carteIdx === -1) {
        setImportError("Le fichier CSV doit obligatoirement avoir les colonnes : 'nom', 'prenom', 'email' et 'numero_carte' (ou 'carte').");
        return;
      }

      const parsed: any[] = [];
      const seenEmails = new Set<string>();
      const seenCards = new Set<string>();

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i].trim();
        if (!row) continue;

        // Séparation par le séparateur détecté
        const cols = row.split(delimiter).map((c) => c.trim().replace(/^"|"$/g, ''));
        if (cols.length < 4) continue;

        const mail = cols[emailIdx]?.toLowerCase();
        const card = cols[carteIdx]?.trim();
        if (!mail || !mail.includes('@') || !card) continue;

        // Éliminer les doublons locaux dans le fichier
        if (seenEmails.has(mail) || seenCards.has(card.toLowerCase())) continue;
        seenEmails.add(mail);
        seenCards.add(card.toLowerCase());

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

  // Vider la liste
  const handleClearAllStudents = async () => {
    const confirmMessage = admin?.role === 'super_admin'
      ? "⚠️ ATTENTION : Voulez-vous vraiment supprimer TOUS les étudiants de toutes les amicales ? Cette action est irréversible !"
      : "⚠️ ATTENTION : Voulez-vous vraiment supprimer tous les étudiants de votre amicale ? Cette action est irréversible !";
      
    if (!confirm(confirmMessage)) return;
    
    setLoading(true);
    try {
      let queryBuilder = supabase
        .from('students')
        .delete();
      
      if (admin?.role !== 'super_admin' && admin?.amicale_id) {
        queryBuilder = queryBuilder.eq('amicale_id', admin.amicale_id);
      } else {
        queryBuilder = queryBuilder.not('id', 'is', null);
      }
      
      const { error } = await queryBuilder;
      if (error) throw error;
      
      alert("Tous les étudiants ont été supprimés avec succès.");
      fetchStudents();
    } catch (err: any) {
      alert("Erreur lors de la suppression : " + err.message);
      setLoading(false);
    }
  };

  // Exécuter l'importation en lot
  const handleExecuteImport = async () => {
    if (csvPreview.length === 0) return;
    
    const targetAmicaleId = admin?.role === 'super_admin' ? (activeAmicaleId || amicaleFilter) : admin?.amicale_id;
    if (!targetAmicaleId) {
      setImportError("Veuillez sélectionner une amicale spécifique avant d'importer des étudiants.");
      return;
    }

    setImporting(true);
    setImportError('');

    try {
      // Charger tous les étudiants existants
      const { data: existingDocs, error: existErr } = await supabase
        .from('students')
        .select('id, nom, prenom, email, matricule, numero_carte, filiere, promotion, amicale_id, is_activated, created_at');
      if (existErr) throw existErr;
      
      // Créer une map pour associer chaque email à son document et ses données actuelles
      const studentMapByEmail = new Map<string, { id: string; data: any }>();
      (existingDocs || []).forEach((data) => {
        if (data.email) {
          studentMapByEmail.set(data.email.toLowerCase(), { id: data.id, data });
        }
      });

      let addedCount = 0;
      let updatedCount = 0;
      let ignoredCount = 0;
      const details: string[] = [];

      const toUpsert: any[] = [];
      const toInsert: any[] = [];

      csvPreview.forEach((student) => {
        const emailLower = student.email.toLowerCase();
        const existing = studentMapByEmail.get(emailLower);

        if (existing) {
          // Si l'étudiant existe déjà, on le met à jour
          toUpsert.push({
            id: existing.id,
            nom: student.nom,
            prenom: student.prenom,
            email: emailLower,
            numero_carte: student.numero_carte,
            matricule: student.numero_carte,
            filiere: student.filiere || existing.data.filiere,
            promotion: student.promotion || existing.data.promotion,
            amicale_id: targetAmicaleId
          });
          updatedCount++;
          details.push(`Mis à jour (e-mail existant) : ${student.email}`);
        } else {
          // Sinon, on le crée
          toInsert.push({
            nom: student.nom,
            prenom: student.prenom,
            email: emailLower,
            numero_carte: student.numero_carte,
            matricule: student.numero_carte,
            filiere: student.filiere,
            promotion: student.promotion,
            is_activated: true,
            amicale_id: targetAmicaleId,
            created_at: new Date().toISOString()
          });
          addedCount++;
        }
      });

      if (toUpsert.length > 0) {
        const { error: upsErr } = await supabase
          .from('students')
          .upsert(toUpsert);
        if (upsErr) throw upsErr;
      }

      if (toInsert.length > 0) {
        const { error: insErr } = await supabase
          .from('students')
          .insert(toInsert);
        if (insErr) throw insErr;
      }

      setImportReport({
        added: addedCount,
        updated: updatedCount,
        ignored: ignoredCount,
        details
      });

      // Vider l'aperçu
      setCsvPreview([]);
      fetchStudents();
    } catch (e: any) {
      console.error(e);
      setImportError(e.message || "Une erreur est survenue lors de l'importation.");
    } finally {
      setImporting(false);
    }
  };

  if (admin?.role === 'super_admin' && activeAmicaleId === null) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-extrabold text-white">Liste Blanche des Électeurs</h1>
          <p className="text-sm text-gray-400">Sélectionnez une amicale pour gérer la liste des électeurs associés.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {amicales.map((amicale) => {
            const studentCount = students.filter(s => s.amicale_id === amicale.id).length;
            return (
              <div 
                key={amicale.id}
                onClick={() => {
                  setActiveAmicaleId(amicale.id);
                  setSelectedAmicaleId(amicale.id);
                }}
                className="glassmorphism p-6 rounded-3xl border border-white/5 hover:border-uni-gold/30 hover:bg-uni-card-hover transition-all cursor-pointer group flex flex-col justify-between min-h-[160px]"
              >
                <div>
                  <div className="w-10 h-10 rounded-xl bg-uni-gold/10 text-uni-gold flex items-center justify-center font-bold text-lg border border-uni-gold/20 mb-4 group-hover:scale-110 transition-transform">
                    🎓
                  </div>
                  <h3 className="text-lg font-display font-extrabold text-white group-hover:text-uni-gold transition-colors">{amicale.nom}</h3>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">{amicale.description || 'Pas de description.'}</p>
                </div>
                <div className="mt-4 pt-4 border-t border-white/5 flex justify-between items-center text-xs text-gray-400">
                  <span>Électeurs inscrits :</span>
                  <span className="font-mono font-bold text-uni-gold bg-uni-gold/10 px-2 py-0.5 rounded border border-uni-gold/20">{studentCount}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const activeAmicaleNom = amicales.find(a => a.id === activeAmicaleId)?.nom || '';

  return (
    <div className="space-y-6">
      {admin?.role === 'super_admin' && (
        <button
          onClick={() => {
            setActiveAmicaleId(null);
            setSelectedAmicaleId('');
          }}
          className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-400 hover:text-white transition-colors mb-2 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Retour aux Amicales</span>
        </button>
      )}

      {/* Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-extrabold text-white">
            Liste Blanche {activeAmicaleNom ? `- ${activeAmicaleNom}` : ''}
          </h1>
          <p className="text-sm text-gray-400">Gérez les étudiants habilités à voter aux différents scrutins.</p>
        </div>
        <div className="flex gap-3">
          {students.length > 0 && (
            <button 
              onClick={handleClearAllStudents}
              className="flex items-center gap-2 bg-uni-red/10 hover:bg-uni-red/20 text-uni-red-light font-semibold text-sm py-2.5 px-4 rounded-xl border border-uni-red/20 transition-all cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>Vider la liste</span>
            </button>
          )}
          <button 
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white font-semibold text-sm py-2.5 px-4 rounded-xl border border-uni-border transition-all cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Importer CSV</span>
          </button>
          <button 
            onClick={handleOpenAdd}
            className="flex items-center gap-2 bg-uni-gold hover:bg-uni-gold-light text-uni-green-dark font-display font-bold text-sm py-2.5 px-4 rounded-xl transition-all shadow-md cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Ajouter un Étudiant</span>
          </button>
        </div>
      </div>

      {/* Filters Area */}
      <div className="glassmorphism p-4 rounded-2xl flex flex-col md:flex-row gap-4 items-center justify-between">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-gray-500" />
          <input 
            type="text"
            placeholder="Rechercher nom ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-uni-gold focus:ring-1 focus:ring-uni-gold transition-all"
          />
        </div>

        {/* dropdown filters */}
        <div className="flex flex-wrap w-full md:w-auto gap-3 items-center justify-end">
          {/* Amicale filter for super_admin */}
          {admin?.role === 'super_admin' && (
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5">
              <Filter className="w-3.5 h-3.5 text-uni-gold" />
              <select
                value={amicaleFilter}
                onChange={(e) => setAmicaleFilter(e.target.value)}
                className="bg-transparent text-xs text-gray-300 font-medium focus:outline-none border-none pr-6 cursor-pointer"
              >
                <option value="" className="bg-gray-900 text-white">Toutes les Amicales</option>
                {amicales.map(a => (
                  <option key={a.id} value={a.id} className="bg-gray-900 text-white">{a.nom}</option>
                ))}
              </select>
            </div>
          )}

          {/* Filière filter */}
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5">
            <Filter className="w-3.5 h-3.5 text-uni-gold" />
            <select
              value={filiereFilter}
              onChange={(e) => setFiliereFilter(e.target.value)}
              className="bg-transparent text-xs text-gray-300 font-medium focus:outline-none border-none pr-6 cursor-pointer"
            >
              <option value="" className="bg-gray-900 text-white">Toutes les Filières</option>
              {filieres.map(f => (
                <option key={f} value={f} className="bg-gray-900 text-white">{f}</option>
              ))}
            </select>
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5">
            <CheckSquare className="w-3.5 h-3.5 text-uni-gold" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-xs text-gray-300 font-medium focus:outline-none border-none pr-6 cursor-pointer"
            >
              <option value="all" className="bg-gray-900 text-white">Tous les comptes</option>
              <option value="activated" className="bg-gray-900 text-white">Comptes Activés</option>
              <option value="pending" className="bg-gray-900 text-white">Comptes non Activés</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table Data */}
      {loading ? (
        <div className="glassmorphism p-12 flex flex-col items-center justify-center rounded-2xl">
          <div className="w-8 h-8 rounded-full border-4 border-uni-gold border-t-transparent animate-spin mb-3" />
          <p className="text-sm text-gray-400">Chargement des étudiants...</p>
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="glassmorphism p-12 text-center text-gray-500 rounded-2xl">
          Aucun étudiant trouvé dans la liste blanche.
        </div>
      ) : (
        /* REGULAR PAGINATED TABLE */
        <div className="glassmorphism rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-400">
              <thead className="text-xs uppercase bg-white/5 text-gray-300 border-b border-white/5">
                <tr>
                  <th className="px-6 py-4">N° Carte</th>
                  <th className="px-6 py-4">Identité</th>
                  <th className="px-6 py-4">Adresse Email</th>
                  <th className="px-6 py-4">Filière</th>
                  <th className="px-6 py-4">Promotion</th>
                  <th className="px-6 py-4">Statut Compte</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {paginatedStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-uni-gold text-xs">
                      {student.numero_carte || '—'}
                    </td>
                    <td className="px-6 py-4 font-semibold text-white">
                      {student.prenom} {student.nom}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs">{student.email}</td>
                    <td className="px-6 py-4">{student.filiere || '—'}</td>
                    <td className="px-6 py-4">{student.promotion || '—'}</td>
                    <td className="px-6 py-4">
                      {student.is_activated ? (
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
                      <div className="inline-flex gap-2">
                        {student.is_activated ? (
                          <button 
                            onClick={() => toggleStudentStatus(student)}
                            className="p-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 transition-all cursor-pointer"
                            title="Désactiver le compte (Bloquer le vote)"
                          >
                            <UserX className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button 
                            onClick={() => toggleStudentStatus(student)}
                            className="p-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-all cursor-pointer"
                            title="Activer le compte"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                          </button>
                        )}
                        
                        {student.auth_user_id && (
                          <button 
                            onClick={() => resetStudentAuth(student)}
                            className="p-2 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 transition-all cursor-pointer"
                            title="Dissocier/Réinitialiser l'accès d'authentification"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button 
                          onClick={() => handleOpenEdit(student)}
                          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-uni-gold border border-white/5 transition-all cursor-pointer"
                          title="Modifier"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => handleDeleteStudent(student)}
                          className="p-2 rounded-lg bg-uni-red/10 hover:bg-uni-red/20 text-uni-red-light border border-uni-red/20 transition-all cursor-pointer"
                          title="Supprimer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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
            <div className="flex items-center justify-between px-6 py-4 border-t border-white/5">
              <span className="text-xs text-gray-500">
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

      {/* FORM MODAL (Ajout/Modification) */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="glassmorphism w-full max-w-md p-8 rounded-3xl space-y-6 relative shadow-2xl animate-in fade-in zoom-in-95 duration-200">
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
                {selectedStudent ? "Ajustez les informations de la liste blanche." : "Ajoutez manuellement un étudiant à la liste blanche."}
              </p>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-uni-red/10 border border-uni-red/20 text-xs font-semibold text-uni-red-light text-center leading-relaxed">
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
                    placeholder="Ex: Abdoulaye"
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
                    placeholder="Ex: Sow"
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
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 block">Email</label>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={formLoading}
                  placeholder="nom.prenom@etu.univ.sn"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-uni-gold disabled:opacity-50"
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

              {/* Choix de l'amicale si super_admin */}
              {admin?.role === 'super_admin' && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 block">Amicale de rattachement *</label>
                  <select
                    value={selectedAmicaleId}
                    onChange={(e) => setSelectedAmicaleId(e.target.value)}
                    disabled={formLoading}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-uni-gold cursor-pointer"
                  >
                    <option value="" className="bg-gray-900 text-white">Sélectionner une amicale</option>
                    {amicales.map(a => (
                      <option key={a.id} value={a.id} className="bg-gray-900 text-white">{a.nom}</option>
                    ))}
                  </select>
                </div>
              )}
 
              <button 
                type="submit" 
                disabled={formLoading}
                className="w-full bg-uni-gold hover:bg-uni-gold-light text-uni-green-dark font-display font-bold py-3 px-6 rounded-xl transition-all flex justify-center items-center cursor-pointer mt-4"
              >
                {formLoading ? (
                  <div className="w-5 h-5 rounded-full border-2 border-uni-green-dark border-t-transparent animate-spin" />
                ) : (
                  <span>Enregistrer ⚡</span>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CSV IMPORT MODAL */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="glassmorphism w-full max-w-2xl p-8 rounded-3xl space-y-6 relative shadow-2xl max-h-[85vh] flex flex-col min-h-0 animate-in fade-in zoom-in-95 duration-200">
            <button 
              onClick={() => {
                setShowImportModal(false);
                setCsvPreview([]);
                setImportReport(null);
                setImportError('');
              }}
              className="absolute right-6 top-6 p-2 rounded-lg text-gray-400 hover:bg-white/5 hover:text-white transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="shrink-0 space-y-3">
              <div>
                <h3 className="text-xl font-display font-extrabold text-white">Importer par CSV</h3>
                <p className="text-xs text-gray-400 mt-1">
                  Chargez un lot d'étudiants d'un coup. Le fichier doit inclure les en-têtes obligatoires : <span className="font-semibold text-uni-gold">numero_carte, nom, prenom, email</span>.
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

            {/* Error Message */}
            {importError && (
              <div className="shrink-0 p-3 rounded-xl bg-uni-red/10 border border-uni-red/20 text-xs font-semibold text-uni-red-light text-center">
                {importError}
              </div>
            )}

            {/* Main scrollable body */}
            <div className="flex-grow overflow-y-auto pr-2 space-y-4">
              {/* File Upload Zone */}
              {!importReport && csvPreview.length === 0 && (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-white/10 hover:border-uni-gold/50 bg-white/3 hover:bg-white/5 p-10 rounded-2xl text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-3"
                >
                  <FileText className="w-12 h-12 text-gray-500" />
                  <p className="text-sm font-semibold text-white">Cliquez pour choisir un fichier</p>
                  <p className="text-xs text-gray-500">Format accepté : .csv uniquement</p>
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleCSVSelect}
                    accept=".csv"
                    className="hidden"
                  />
                </div>
              )}

              {/* Preview Table */}
              {csvPreview.length > 0 && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-white/3 p-3.5 rounded-xl border border-white/5">
                    <span className="text-sm text-gray-300 font-medium">{csvPreview.length} étudiant(s) détecté(s) dans le fichier.</span>
                    <button 
                      onClick={() => setCsvPreview([])}
                      className="text-xs text-uni-red hover:underline"
                    >
                      Annuler
                    </button>
                  </div>
                  <div className="border border-white/5 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                    <table className="w-full text-left text-xs text-gray-400">
                      <thead className="bg-white/5 text-gray-300 uppercase sticky top-0">
                        <tr>
                          <th className="px-4 py-3">N° Carte</th>
                          <th className="px-4 py-3">Identité</th>
                          <th className="px-4 py-3">Email</th>
                          <th className="px-4 py-3">Filière</th>
                          <th className="px-4 py-3">Promotion</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {csvPreview.slice(0, 10).map((row, index) => (
                          <tr key={index}>
                            <td className="px-4 py-2.5 text-uni-gold font-bold">{row.numero_carte}</td>
                            <td className="px-4 py-2.5 text-white font-medium">{row.prenom} {row.nom}</td>
                            <td className="px-4 py-2.5 font-mono text-[10px]">{row.email}</td>
                            <td className="px-4 py-2.5">{row.filiere || '—'}</td>
                            <td className="px-4 py-2.5">{row.promotion || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {csvPreview.length > 10 && (
                      <div className="p-2 text-center text-[10px] text-gray-500 bg-white/3 border-t border-white/5">
                        Et {csvPreview.length - 10} autres lignes...
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Final Report */}
              {importReport && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-uni-green/10 border border-uni-green/20 space-y-2">
                    <h4 className="font-bold text-uni-gold">Rapport final d'importation :</h4>
                    <div className="grid grid-cols-3 gap-4 text-xs font-semibold text-gray-300 py-1">
                      <div>✨ Électeurs ajoutés : <span className="text-white text-sm font-black">{importReport.added}</span></div>
                      <div>🔄 Électeurs mis à jour : <span className="text-white text-sm font-black">{importReport.updated}</span></div>
                      <div>⚠️ Lignes ignorées : <span className="text-white text-sm font-black">{importReport.ignored}</span></div>
                    </div>
                  </div>

                  {importReport.details.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-xs font-bold text-gray-400">Détails des ignorés/doublons :</span>
                      <div className="border border-white/5 p-3 rounded-xl max-h-40 overflow-y-auto bg-black/10 font-mono text-[10px] text-uni-gold space-y-1.5">
                        {importReport.details.map((detail, idx) => (
                          <div key={idx}>{detail}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Import Footer Actions */}
            <div className="shrink-0 border-t border-white/5 pt-4 flex justify-end gap-3">
              {csvPreview.length > 0 && (
                <button 
                  onClick={handleExecuteImport}
                  disabled={importing}
                  className="bg-uni-gold hover:bg-uni-gold-light disabled:bg-uni-gold/50 text-uni-green-dark font-display font-bold text-sm py-2.5 px-6 rounded-xl flex items-center gap-2 cursor-pointer"
                >
                  {importing ? (
                    <div className="w-4 h-4 rounded-full border-2 border-uni-green-dark border-t-transparent animate-spin" />
                  ) : (
                    <span>Lancer l'importation 🚀</span>
                  )}
                </button>
              )}
              <button 
                onClick={() => {
                  setShowImportModal(false);
                  setCsvPreview([]);
                  setImportReport(null);
                  setImportError('');
                }}
                className="bg-white/5 hover:bg-white/10 text-white border border-uni-border font-semibold text-sm py-2.5 px-6 rounded-xl cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
