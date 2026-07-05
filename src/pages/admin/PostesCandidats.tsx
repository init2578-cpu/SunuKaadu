import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAdminAuth } from '../../context/AdminAuthContext';
import * as firestoreService from '../../lib/firestoreService';
import { 
  ArrowLeft, 
  Plus, 
  Edit2, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  Upload, 
  Award, 
  FileText, 
  AlertTriangle, 
  CheckCircle, 
  Image as ImageIcon, 
  User,
  PlusCircle,
  X,
  Eye,
  EyeOff,
  Copy,
  KeyRound,
  UserCheck,
  UserPlus
} from 'lucide-react';

interface Election {
  id: string;
  titre: string;
  description: string | null;
  statut: 'brouillon' | 'ouverte' | 'fermee' | 'publiee';
  amicale_id: string;
}

interface Poste {
  id: string;
  election_id: string;
  nom: string;
  description: string | null;
  ordre: number;
  candidats?: Candidat[];
}

interface Candidat {
  id: string;
  poste_id: string;
  nom: string;
  prenom: string;
  photo_url: string | null;
  slogan: string | null;
  programme: string | null;
  representant?: any;
}

export default function PostesCandidats() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { admin: currentAdmin } = useAdminAuth();

  // Mode Selection vs Mode Election
  const isElectionMode = !!id;

  // États globaux
  const [elections, setElections] = useState<Election[]>([]);
  const [currentElection, setCurrentElection] = useState<Election | null>(null);
  const [postes, setPostes] = useState<Poste[]>([]);
  const [loading, setLoading] = useState(true);

  // Notifications
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Modals et États de formulaire (Poste)
  const [showPosteModal, setShowPosteModal] = useState(false);
  const [posteMode, setPosteMode] = useState<'create' | 'edit'>('create');
  const [selectedPoste, setSelectedPoste] = useState<Poste | null>(null);
  const [posteNom, setPosteNom] = useState('');
  const [posteDescription, setPosteDescription] = useState('');
  const [posteOrdre, setPosteOrdre] = useState(0);
  const [posteLoading, setPosteLoading] = useState(false);

  // Modals et États de formulaire (Candidat)
  const [showCandidatModal, setShowCandidatModal] = useState(false);
  const [candidatMode, setCandidatMode] = useState<'create' | 'edit'>('create');
  const [selectedCandidat, setSelectedCandidat] = useState<Candidat | null>(null);
  const [targetPosteId, setTargetPosteId] = useState('');
  
  const [candNom, setCandNom] = useState('');
  const [candPrenom, setCandPrenom] = useState('');
  const [candSlogan, setCandSlogan] = useState('');
  const [candProgramme, setCandProgramme] = useState('');
  const [candPhotoFile, setCandPhotoFile] = useState<File | null>(null);
  const [candPhotoPreview, setCandPhotoPreview] = useState<string | null>(null);
  const [candLoading, setCandLoading] = useState(false);

  // Recherche représentant
  const [studentSearch, setStudentSearch] = useState('');
  const [studentResults, setStudentResults] = useState<any[]>([]);
  const [selectedRepStudent, setSelectedRepStudent] = useState<any | null>(null);
  const [repSearchFocused, setRepSearchFocused] = useState(false);

  // Recherche candidat étudiant
  const [candStudentSearch, setCandStudentSearch] = useState('');
  const [candStudentResults, setCandStudentResults] = useState<any[]>([]);
  const [selectedCandStudent, setSelectedCandStudent] = useState<any | null>(null);
  const [amicaleStudents, setAmicaleStudents] = useState<any[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [manualCandMode, setManualCandMode] = useState(false);
  const [manualRepMode, setManualRepMode] = useState(false);
  const [manualRepNom, setManualRepNom] = useState('');
  const [manualRepPrenom, setManualRepPrenom] = useState('');
  const [manualRepEmail, setManualRepEmail] = useState('');
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  const [isRepModalOpen, setIsRepModalOpen] = useState(false);
  const [repModalMode, setRepModalMode] = useState<'assign' | 'manage'>('assign');
  const [targetCandidateForRep, setTargetCandidateForRep] = useState<any | null>(null);

  // Modal affichage des identifiants du représentant
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [newRepCredentials, setNewRepCredentials] = useState<{ email: string; password: string; nom: string; prenom: string } | null>(null);

  const togglePasswordVisibility = (repId: string) => {
    setVisiblePasswords(prev => ({
      ...prev,
      [repId]: !prev[repId]
    }));
  };

  const handleSearchStudents = async (queryText: string) => {
    setStudentSearch(queryText);
    if (queryText.trim().length < 2) {
      setStudentResults([]);
      return;
    }
    
    try {
      const amicaleId = currentElection?.amicale_id || currentAdmin?.amicale_id;
      if (!amicaleId) return;

      const { data: studentsData, error } = await supabase
        .from('students')
        .select('id, nom, prenom, email, matricule, numero_carte, filiere, promotion, amicale_id, is_activated, created_at')
        .eq('amicale_id', amicaleId);
      if (error) throw error;
      const data = studentsData || [];
      
      const filtered = data.filter((s: any) => 
        (s.nom?.toLowerCase() || '').includes(queryText.toLowerCase()) ||
        (s.prenom?.toLowerCase() || '').includes(queryText.toLowerCase()) ||
        (s.email?.toLowerCase() || '').includes(queryText.toLowerCase())
      );
      setStudentResults(filtered.slice(0, 5));
    } catch (err) {
      console.error("Erreur lors de la recherche des étudiants", err);
    }
  };

  const handleSearchCandidateStudents = async (queryText: string) => {
    setCandStudentSearch(queryText);
    if (queryText.trim().length < 2) {
      setCandStudentResults([]);
      return;
    }
    
    try {
      const amicaleId = currentElection?.amicale_id || currentAdmin?.amicale_id;
      if (!amicaleId) return;

      const { data: studentsData, error } = await supabase
        .from('students')
        .select('id, nom, prenom, email, matricule, numero_carte, filiere, promotion, amicale_id, is_activated, created_at')
        .eq('amicale_id', amicaleId);
      if (error) throw error;
      const data = studentsData || [];
      
      const filtered = data.filter((s: any) => 
        (s.nom?.toLowerCase() || '').includes(queryText.toLowerCase()) ||
        (s.prenom?.toLowerCase() || '').includes(queryText.toLowerCase()) ||
        (s.email?.toLowerCase() || '').includes(queryText.toLowerCase())
      );
      setCandStudentResults(filtered.slice(0, 5));
    } catch (err) {
      console.error("Erreur lors de la recherche des étudiants pour le candidat", err);
    }
  };

  const filteredStudents = amicaleStudents.filter(s => {
    // Exclude if already a candidate or representative in this election
    const isAlreadyCandidate = postes.some(p => 
      p.candidats?.some(c => 
        c.nom.toLowerCase().trim() === s.nom.toLowerCase().trim() && 
        c.prenom.toLowerCase().trim() === s.prenom.toLowerCase().trim()
      )
    );
    const isAlreadyRepresentative = postes.some(p => 
      p.candidats?.some(c => 
        c.representant?.email?.toLowerCase().trim() === s.email.toLowerCase().trim()
      )
    );

    if (isAlreadyCandidate || isAlreadyRepresentative) {
      return false;
    }

    const query = candStudentSearch.toLowerCase().trim();
    if (!query) return true;
    return (
      (s.nom?.toLowerCase() || '').includes(query) ||
      (s.prenom?.toLowerCase() || '').includes(query) ||
      (s.email?.toLowerCase() || '').includes(query)
    );
  });

  const filteredRepStudents = amicaleStudents.filter(s => {
    // Exclude if the student is the currently selected candidate
    if (selectedCandStudent) {
      const isCurrentCandidate = 
        s.nom.toLowerCase().trim() === selectedCandStudent.nom.toLowerCase().trim() &&
        s.prenom.toLowerCase().trim() === selectedCandStudent.prenom.toLowerCase().trim();
      if (isCurrentCandidate) return false;
    }

    // Exclude if already a candidate in this election
    const isAlreadyCandidate = postes.some(p => 
      p.candidats?.some(c => 
        c.nom.toLowerCase().trim() === s.nom.toLowerCase().trim() && 
        c.prenom.toLowerCase().trim() === s.prenom.toLowerCase().trim()
      )
    );
    if (isAlreadyCandidate) return false;

    // Exclude if already a representative in this election
    // BUT allow if it is the current representative of the candidate we are editing
    const isAlreadyRepresentative = postes.some(p => 
      p.candidats?.some(c => {
        if (candidatMode === 'edit' && selectedCandidat && c.id === selectedCandidat.id) {
          return false;
        }
        if (targetCandidateForRep && c.id === targetCandidateForRep.id) {
          return false;
        }
        return c.representant?.email?.toLowerCase().trim() === s.email.toLowerCase().trim();
      })
    );
    if (isAlreadyRepresentative) return false;

    const query = studentSearch.toLowerCase().trim();
    if (!query) return true;
    return (
      (s.nom?.toLowerCase() || '').includes(query) ||
      (s.prenom?.toLowerCase() || '').includes(query) ||
      (s.email?.toLowerCase() || '').includes(query)
    );
  });

  // 1. Charger les élections (si aucun ID n'est fourni)
  const fetchElections = async () => {
    if (!currentAdmin) return;
    try {
      setLoading(true);
      const data = await firestoreService.getElections(
        currentAdmin.role !== 'super_admin' ? currentAdmin.amicale_id || undefined : undefined
      );
      setElections(data);
    } catch (e: any) {
      console.error(e);
      setErrorMsg("Impossible de charger la liste des scrutins.");
    } finally {
      setLoading(false);
    }
  };

  // 2. Charger les détails de l'élection, postes et candidats
  const fetchElectionDetails = async (electionId: string, silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
      }
      setErrorMsg('');

      // Charger l'élection et les postes en parallèle
      const [election, postesData] = await Promise.all([
        firestoreService.getElection(electionId),
        firestoreService.getPostes(electionId)
      ]);

      if (!election) {
        setErrorMsg("Le scrutin demandé n'existe pas.");
        return;
      }
      setCurrentElection(election);

      // Charger tous les candidats de ces postes
      if (postesData && postesData.length > 0) {
        const posteIds = postesData.map(p => p.id);
        const candidatsData = await firestoreService.getCandidats(posteIds);

        // Récupérer les représentants associés à ces candidats
        const candidatIds = (candidatsData || []).map(c => c.id);
        let repsData: any[] = [];
        if (candidatIds.length > 0) {
          repsData = await firestoreService.getRepresentatives(candidatIds);
        }

        // Attacher le représentant à chaque candidat
        const mappedCandidats = (candidatsData || []).map(cand => ({
          ...cand,
          representant: repsData.find(r => r.candidat_id === cand.id) || null
        }));

        // Attacher les candidats à chaque poste
        const mappedPostes = postesData.map(poste => ({
          ...poste,
          candidats: mappedCandidats.filter(c => c.poste_id === poste.id)
        }));
        setPostes(mappedPostes);
      } else {
        setPostes([]);
      }

    } catch (e: any) {
      console.error(e);
      setErrorMsg("Erreur lors du chargement des postes et candidats.");
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!currentAdmin) return;
    if (isElectionMode && id) {
      fetchElectionDetails(id);
    } else {
      fetchElections();
    }
  }, [id, isElectionMode, currentAdmin]);

  // Réinitialiser les notifications temporairement
  const triggerNotification = (type: 'success' | 'error', text: string) => {
    if (type === 'success') {
      setSuccessMsg(text);
      setErrorMsg('');
      setTimeout(() => setSuccessMsg(''), 4000);
    } else {
      setErrorMsg(text);
      setSuccessMsg('');
      // Ne pas effacer l'erreur automatiquement pour laisser le temps de la lire
    }
  };

  // =========================================================================
  // GESTION DES POSTES (AJOUT / MODIFICATION / DEPLACEMENT / SUPPRESSION)
  // =========================================================================

  const handleOpenPosteCreate = () => {
    setPosteMode('create');
    setPosteNom('');
    setPosteDescription('');
    setPosteOrdre(postes.length + 1);
    setSelectedPoste(null);
    setShowPosteModal(true);
  };

  const handleOpenPosteEdit = (poste: Poste) => {
    setPosteMode('edit');
    setPosteNom(poste.nom);
    setPosteDescription(poste.description || '');
    setPosteOrdre(poste.ordre);
    setSelectedPoste(poste);
    setShowPosteModal(true);
  };

  const handleSavePoste = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!posteNom.trim() || !id) return;

    setErrorMsg('');
    setPosteLoading(true);
    try {
      const payload = {
        nom: posteNom.trim(),
        description: posteDescription.trim() || null,
        ordre: posteOrdre,
        election_id: id
      };

      if (posteMode === 'edit' && selectedPoste) {
        await firestoreService.updatePoste(selectedPoste.id, payload);
        triggerNotification('success', "Le poste a été modifié avec succès.");
      } else {
        await firestoreService.createPoste(payload);
        triggerNotification('success', "Le poste a été créé avec succès.");
      }

      setShowPosteModal(false);
      fetchElectionDetails(id, true);
    } catch (err: any) {
      triggerNotification('error', err.message || "Erreur de sauvegarde du poste.");
    } finally {
      setPosteLoading(false);
    }
  };

  // Changer l'ordre d'affichage (Monter/Descendre)
  const handleShiftPosteOrder = async (poste: Poste, direction: 'up' | 'down') => {
    if (!id) return;
    const index = postes.findIndex(p => p.id === poste.id);
    if (index === -1) return;

    // Déterminer le poste avec lequel permuter
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= postes.length) return;

    const currentPoste = postes[index];
    const swapPoste = postes[swapIndex];

    try {
      // Permuter les valeurs d'ordre
      const currentOrdre = currentPoste.ordre;
      const swapOrdre = swapPoste.ordre;

      // Faire les updates
      await firestoreService.updatePoste(currentPoste.id, { ordre: swapOrdre });
      await firestoreService.updatePoste(swapPoste.id, { ordre: currentOrdre });

      fetchElectionDetails(id, true);
    } catch (err: any) {
      triggerNotification('error', "Impossible de modifier l'ordre : " + err.message);
    }
  };

  const handleDeletePoste = async (posteId: string, nom: string) => {
    if (!id || !currentElection) return;

    // Bloquer la suppression si l'élection n'est plus en brouillon
    if (currentElection.statut !== 'brouillon') {
      // Vérifier s'il y a déjà des votes
      const hasVotes = await firestoreService.hasVotesRecorded(id);

      if (hasVotes) {
        triggerNotification('error', "🚫 Impossible de supprimer un poste : le scrutin est actif ou clos et contient des votes enregistrés.");
        return;
      }
    }

    if (!confirm(`Voulez-vous vraiment supprimer le poste "${nom}" et tous ses candidats associés ?`)) {
      return;
    }

    try {
      await firestoreService.deletePoste(posteId);
      triggerNotification('success', "Le poste a été retiré avec succès.");
      fetchElectionDetails(id, true);
    } catch (err: any) {
      triggerNotification('error', "Erreur lors de la suppression du poste : " + err.message);
    }
  };

  // =========================================================================
  // AMÉLIORATION IMAGE : REDIMENSIONNEMENT & COMPRESSION CANVAS
  // =========================================================================

  const compressImage = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 300;
          let width = img.width;
          let height = img.height;

          // Conserver l'aspect ratio tout en limitant la largeur à 300px
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error("Impossible d'obtenir le contexte Canvas 2D"));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              if (blob) resolve(blob);
              else reject(new Error("Le Canvas toBlob a renvoyé null"));
            },
            'image/jpeg',
            0.8 // Compression qualité 80%
          );
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const handleUploadPhoto = async (file: File): Promise<string> => {
    try {
      const compressedBlob = await compressImage(file);
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(compressedBlob);
        reader.onloadend = () => {
          resolve(reader.result as string);
        };
        reader.onerror = (err) => reject(err);
      });
    } catch (e: any) {
      console.error(e);
      throw new Error("La conversion de la photo a échoué: " + e.message);
    }
  };

  // =========================================================================
  // GESTION DES CANDIDATS (AJOUT / MODIFICATION / SUPPRESSION)
  // =========================================================================

  const handleOpenCandidatCreate = async (posteId: string) => {
    setCandidatMode('create');
    setTargetPosteId(posteId);
    setCandNom('');
    setCandPrenom('');
    setCandSlogan('');
    setCandProgramme('');
    setCandPhotoFile(null);
    setCandPhotoPreview(null);
    setSelectedCandidat(null);
    setSelectedRepStudent(null);
    setStudentSearch('');
    setStudentResults([]);
    setRepSearchFocused(false);
    setCandStudentSearch('');
    setCandStudentResults([]);
    setSelectedCandStudent(null);
    setAmicaleStudents([]);
    setManualCandMode(false);
    setManualRepMode(false);
    setManualRepNom('');
    setManualRepPrenom('');
    setManualRepEmail('');
    setShowCandidatModal(true);

    fetchAmicaleStudents();
  };

  const fetchAmicaleStudents = async () => {
    try {
      setLoadingStudents(true);
      const amicaleId = currentElection?.amicale_id || currentAdmin?.amicale_id;
      if (amicaleId) {
        const studentsData = await firestoreService.getStudents(amicaleId);
        setAmicaleStudents(studentsData);
      }
    } catch (err: any) {
      console.error("Erreur de chargement des étudiants", err);
      triggerNotification('error', "Erreur de chargement des étudiants : " + err.message);
    } finally {
      setLoadingStudents(false);
    }
  };

  const handleOpenCandidatEdit = async (posteId: string, candidat: Candidat) => {
    setCandidatMode('edit');
    setTargetPosteId(posteId);
    setCandNom(candidat.nom);
    setCandPrenom(candidat.prenom);
    setCandSlogan(candidat.slogan || '');
    setCandProgramme(candidat.programme || '');
    setCandPhotoFile(null);
    setCandPhotoPreview(candidat.photo_url);
    setSelectedCandidat(candidat);
    setSelectedRepStudent(candidat.representant || null);
    setStudentSearch('');
    setStudentResults([]);
    setRepSearchFocused(false);
    setCandStudentSearch('');
    setCandStudentResults([]);
    setSelectedCandStudent({ nom: candidat.nom, prenom: candidat.prenom, email: '' });
    setAmicaleStudents([]);
    setShowCandidatModal(true);

    fetchAmicaleStudents();
  };


  const handleSaveCandidat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candNom.trim() || !candPrenom.trim() || !id) return;

    setErrorMsg('');

    setCandLoading(true);
    try {
      let finalPhotoUrl = candPhotoPreview;

      if (candPhotoFile) {
        finalPhotoUrl = await handleUploadPhoto(candPhotoFile);
      }

      const payload = {
        nom: candNom.trim(),
        prenom: candPrenom.trim(),
        slogan: candSlogan.trim() || null,
        programme: candProgramme.trim() || null,
        photo_url: finalPhotoUrl,
        poste_id: targetPosteId
      };

      if (candidatMode === 'edit' && selectedCandidat) {
        await firestoreService.updateCandidat(selectedCandidat.id, payload);
        triggerNotification('success', `Le candidat ${candPrenom} ${candNom} a été modifié.`);
      } else {
        await firestoreService.createCandidat(payload);
        triggerNotification('success', `Le candidat ${candPrenom} ${candNom} a été inscrit.`);
      }

      setShowCandidatModal(false);
      fetchElectionDetails(id, true);
    } catch (err: any) {
      triggerNotification('error', err.message || "Erreur de sauvegarde du candidat.");
    } finally {
      setCandLoading(false);
    }
  };

  const handleDeleteCandidat = async (candidat: Candidat) => {
    if (!id || !currentElection) return;

    // Bloquer la suppression si des votes existent déjà (seulement si l'élection n'est pas brouillon)
    if (currentElection.statut !== 'brouillon') {
      const hasVotes = await firestoreService.hasVotesRecorded(id);

      if (hasVotes) {
        triggerNotification('error', "🚫 Impossible de retirer ce candidat : des votes sont déjà présents dans l'urne pour ce scrutin.");
        return;
      }
    }

    if (!confirm(`Voulez-vous vraiment retirer le candidat ${candidat.prenom} ${candidat.nom} ?`)) {
      return;
    }

    try {
      await firestoreService.deleteCandidat(candidat.id);
      triggerNotification('success', "Le candidat a été retiré du poste.");
      fetchElectionDetails(id, true);
    } catch (err: any) {
      triggerNotification('error', "Erreur lors de la suppression du candidat : " + err.message);
    }
  };

  const handleOpenAssignRep = (candidate: any) => {
    setTargetCandidateForRep(candidate);
    setRepModalMode('assign');
    setSelectedRepStudent(null);
    setManualRepMode(false);
    setManualRepNom('');
    setManualRepPrenom('');
    setManualRepEmail('');
    setStudentSearch('');
    fetchAmicaleStudents();
    setIsRepModalOpen(true);
  };

  const handleOpenManageRep = (candidate: any) => {
    setTargetCandidateForRep(candidate);
    setRepModalMode('manage');
    setSelectedRepStudent(null);
    setManualRepMode(false);
    setManualRepNom('');
    setManualRepPrenom('');
    setManualRepEmail('');
    setStudentSearch('');
    fetchAmicaleStudents();
    setIsRepModalOpen(true);
  };

  const handleAssignRepresentative = async (student: any) => {
    if (!targetCandidateForRep) return;

    setCandLoading(true);
    try {
      const emailLower = student.email.toLowerCase().trim();
      const nom = student.nom;
      const prenom = student.prenom;
      const candidateId = targetCandidateForRep.id;

      // 1. Vérifier si l'email existe déjà dans la table admins (Supabase)
      const { data: snap, error: snapErr } = await supabase
        .from('admins')
        .select('*')
        .eq('email', emailLower)
        .limit(1);

      if (snapErr) throw snapErr;

      if (snap && snap.length > 0) {
        const existingAdmin = snap[0] as any;

        if (existingAdmin.role === 'super_admin' || existingAdmin.role === 'delegue') {
          throw new Error("Cet e-mail est déjà associé à un compte administrateur ou délégué.");
        }

        if (existingAdmin.role === 'representant') {
          if (existingAdmin.candidat_id && existingAdmin.candidat_id !== candidateId && !existingAdmin.is_revoked) {
            throw new Error("Cet étudiant est déjà assigné comme représentant pour un autre candidat.");
          }

          // Générer un mot de passe si non activé
          const passwordToUse = existingAdmin.mot_de_passe || ('Rep-' + Math.random().toString(36).substring(2, 8).toUpperCase());

          // Mettre à jour le représentant existant (pas d'insert → pas de doublon)
          const { error: updateErr } = await supabase
            .from('admins')
            .update({
              nom,
              prenom,
              candidat_id: candidateId,
              is_revoked: false,
              created_by: currentAdmin?.id || null,
              mot_de_passe: existingAdmin.is_activated ? null : passwordToUse
            })
            .eq('id', existingAdmin.id);

          if (updateErr) throw updateErr;

          // Envoyer l'email de bienvenue automatiquement
          const poste = postes.find(p => p.candidats?.some((c: any) => c.id === candidateId));
          const posteNom = poste ? poste.nom : 'Non défini';
          const electionTitre = currentElection ? currentElection.titre : 'Non définie';

          supabase.functions.invoke('send-rep-email', {
            body: {
              to: emailLower,
              prenom,
              nom,
              candidat_prenom: targetCandidateForRep.prenom,
              candidat_nom: targetCandidateForRep.nom,
              poste_nom: posteNom,
              election_titre: electionTitre,
              mot_de_passe: existingAdmin.is_activated ? "(Déjà configuré - Utilisez votre mot de passe habituel)" : passwordToUse,
              role: 'representant'
            }
          }).then(({ data, error }) => {
            if (error) {
              console.warn("Erreur d'envoi d'email de bienvenue:", error);
            } else if (data && data.sandbox_restriction) {
              console.info("Info: Envoi d'email de bienvenue limité par Resend (mode Sandbox).");
            }
          }).catch(err => console.error("Erreur d'envoi d'email de bienvenue:", err));

          triggerNotification('success', "Le représentant a été mis à jour.");
          setIsRepModalOpen(false);
          if (id) fetchElectionDetails(id, true);
          return; // ← sortie anticipée pour éviter l'insert
        }

        // Email utilisé avec un rôle inconnu — bloquer
        throw new Error("Cet e-mail est déjà utilisé dans le système.");
      }

      // 2. Nouvel enregistrement représentant
      const passwordToUse = 'Rep-' + Math.random().toString(36).substring(2, 8).toUpperCase();
      let authUserId: string | null = null;
      let isActivated = student.is_activated;

      // Insérer le représentant dans admins
      const { error: insertErr } = await supabase
        .from('admins')
        .insert([{
          nom,
          prenom,
          email: emailLower,
          role: 'representant',
          candidat_id: candidateId,
          is_revoked: false,
          created_by: currentAdmin?.id || null,
          auth_user_id: authUserId,
          is_activated: isActivated,
          mot_de_passe: isActivated ? null : passwordToUse
        }]);

      if (insertErr) throw insertErr;

      // Envoyer l'email de bienvenue automatiquement
      const poste = postes.find(p => p.candidats?.some((c: any) => c.id === candidateId));
      const posteNom = poste ? poste.nom : 'Non défini';
      const electionTitre = currentElection ? currentElection.titre : 'Non définie';

      supabase.functions.invoke('send-rep-email', {
        body: {
          to: emailLower,
          prenom,
          nom,
          candidat_prenom: targetCandidateForRep.prenom,
          candidat_nom: targetCandidateForRep.nom,
          poste_nom: posteNom,
          election_titre: electionTitre,
          mot_de_passe: isActivated ? "(Déjà configuré - Utilisez votre mot de passe habituel)" : passwordToUse,
          role: 'representant'
        }
      }).then(({ data, error }) => {
        if (error) {
          console.warn("Erreur d'envoi d'email de bienvenue:", error);
        } else if (data && data.sandbox_restriction) {
          console.info("Info: Envoi d'email de bienvenue limité par Resend (mode Sandbox).");
        }
      }).catch(err => console.error("Erreur d'envoi d'email de bienvenue:", err));

      if (isActivated) {
        triggerNotification('success', `✅ Représentant enregistré ! Il peut se connecter directement avec son email sur l'espace représentant.`);
      } else {
        // Afficher les identifiants dans un modal pour que l'admin puisse les transmettre
        setNewRepCredentials({ email: emailLower, password: passwordToUse, nom, prenom });
        setShowCredentialsModal(true);
      }

      setIsRepModalOpen(false);
      if (id) fetchElectionDetails(id, true);
    } catch (err: any) {
      triggerNotification('error', err.message || "Erreur de configuration du représentant.");
    } finally {
      setCandLoading(false);
    }
  };

  const handleRemoveRepresentant = async (candidatId: string, representant: any) => {
    if (!currentElection) return;

    if (currentElection.statut !== 'brouillon') {
      const hasVotes = await firestoreService.hasVotesRecorded(id || '');
      if (hasVotes) {
        triggerNotification('error', "🚫 Impossible de modifier le représentant : le scrutin contient des votes enregistrés.");
        return;
      }
    }

    if (!confirm(`Voulez-vous vraiment détacher le représentant ${representant.prenom} ${representant.nom} de ce candidat ?`)) {
      return;
    }

    try {
      // Supprimer définitivement le représentant de la base de données
      const { error } = await supabase.from('admins').delete().eq('id', representant.id);
      if (error) throw error;

      triggerNotification('success', "Le représentant a été détaché.");
      if (id) fetchElectionDetails(id, true);
    } catch (err: any) {
      triggerNotification('error', "Erreur lors du détachement du représentant : " + err.message);
    }
  };

  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCandPhotoFile(file);
      setCandPhotoPreview(URL.createObjectURL(file));
    }
  };

  // =========================================================================
  // VUES PRINCIPALES (SELECTION D'ELECTION vs CONFIGURATION DETAIL)
  // =========================================================================

  if (!isElectionMode) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-extrabold text-white">Postes & Candidats</h1>
          <p className="text-sm text-gray-400">Sélectionnez une élection pour en configurer la structure des bureaux de vote.</p>
        </div>

        {errorMsg && (
          <div className="p-4 rounded-xl bg-uni-red/10 border border-uni-red/20 text-sm font-semibold text-uni-red-light flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {loading ? (
          <div className="glassmorphism p-12 flex flex-col items-center justify-center rounded-2xl">
            <div className="w-8 h-8 rounded-full border-4 border-uni-gold border-t-transparent animate-spin mb-3" />
            <p className="text-sm text-gray-400">Chargement des scrutins...</p>
          </div>
        ) : elections.length === 0 ? (
          <div className="glassmorphism p-12 text-center text-gray-500 rounded-2xl">
            Aucun scrutin n'est disponible. <Link to="/admin/elections" className="text-uni-gold hover:underline">Créez une élection</Link> d'abord.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {elections.map((election) => (
              <div key={election.id} className="glassmorphism p-6 rounded-2xl flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex justify-between items-start gap-2">
                    <h3 className="text-lg font-bold text-white leading-snug">{election.titre}</h3>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/5 text-gray-400 border border-white/10 shrink-0">
                      {election.statut}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-2 line-clamp-2">{election.description || 'Pas de description'}</p>
                </div>
                <button
                  onClick={() => navigate(`/admin/elections/${election.id}/postes`)}
                  className="w-full bg-white/5 hover:bg-uni-gold hover:text-uni-green-dark border border-white/10 hover:border-uni-gold font-semibold text-sm py-2.5 px-4 rounded-xl text-center transition-all flex justify-center items-center gap-2 cursor-pointer"
                >
                  <Award className="w-4 h-4" />
                  <span>Configurer les Postes</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-2">
          <Link to="/admin/elections" className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-400 hover:text-white transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Retour aux élections</span>
          </Link>
          {currentElection && (
            <div>
              <h1 className="text-3xl font-display font-extrabold text-white flex items-center gap-3">
                <span>{currentElection.titre}</span>
                <span className="text-xs font-sans font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-uni-gold/10 text-uni-gold border border-uni-gold/20">
                  {currentElection.statut}
                </span>
              </h1>
              <p className="text-sm text-gray-400 mt-1">Configuration des postes électoraux et déclaration des candidats.</p>
            </div>
          )}
        </div>

        {currentElection?.statut === 'brouillon' && (
          <button 
            onClick={handleOpenPosteCreate}
            className="flex items-center gap-2 bg-uni-gold hover:bg-uni-gold-light text-uni-green-dark font-display font-bold text-sm py-2.5 px-5 rounded-xl transition-all shadow-md cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Ajouter un Poste</span>
          </button>
        )}
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-sm font-semibold text-green-400 flex items-center gap-2.5">
          <CheckCircle className="w-5 h-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-uni-red/10 border border-uni-red/20 text-sm font-semibold text-uni-red-light flex items-center gap-2.5">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {loading ? (
        <div className="glassmorphism p-12 flex flex-col items-center justify-center rounded-2xl">
          <div className="w-8 h-8 rounded-full border-4 border-uni-gold border-t-transparent animate-spin mb-3" />
          <p className="text-sm text-gray-400">Chargement de la structure...</p>
        </div>
      ) : postes.length === 0 ? (
        <div className="glassmorphism p-12 text-center text-gray-500 rounded-2xl">
          Aucun poste n'a encore été défini pour cette élection.
          {currentElection?.statut === 'brouillon' && (
            <button 
              onClick={handleOpenPosteCreate}
              className="block mt-4 mx-auto text-sm font-bold text-uni-gold hover:underline"
            >
              Créer le premier poste maintenant ⚡
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {postes.map((poste, index) => {
            const candidatList = poste.candidats || [];
            const hasCandidatsAlert = candidatList.length < 2;

            return (
              <div key={poste.id} className="glassmorphism p-6 rounded-3xl space-y-6">
                {/* Poste Header bar */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-white/5">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs font-mono font-bold text-uni-gold/60 bg-uni-gold/5 px-2 py-0.5 rounded">
                        #{poste.ordre}
                      </span>
                      <h2 className="text-xl font-display font-extrabold text-white">{poste.nom}</h2>
                    </div>
                    {poste.description && (
                      <p className="text-xs text-gray-400 leading-relaxed">{poste.description}</p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2.5 shrink-0">
                    {/* Controls ordre (si brouillon) */}
                    {currentElection?.statut === 'brouillon' && (
                      <div className="inline-flex rounded-lg border border-white/10 overflow-hidden bg-white/3">
                        <button
                          onClick={() => handleShiftPosteOrder(poste, 'up')}
                          disabled={index === 0}
                          className="p-2 text-gray-400 hover:text-white hover:bg-white/5 disabled:opacity-30 cursor-pointer"
                          title="Faire monter d'un niveau"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleShiftPosteOrder(poste, 'down')}
                          disabled={index === postes.length - 1}
                          className="p-2 text-gray-400 hover:text-white hover:bg-white/5 disabled:opacity-30 cursor-pointer"
                          title="Faire descendre d'un niveau"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Edition & Suppression */}
                    {currentElection?.statut === 'brouillon' && (
                      <>
                        <button
                          onClick={() => handleOpenPosteEdit(poste)}
                          className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 text-white font-semibold text-xs py-2 px-3 rounded-lg border border-white/5 transition-all cursor-pointer"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Modifier</span>
                        </button>
                        <button
                          onClick={() => handleDeletePoste(poste.id, poste.nom)}
                          className="flex items-center gap-1.5 bg-uni-red/10 hover:bg-uni-red/20 text-uni-red-light font-semibold text-xs py-2 px-3 rounded-lg border border-uni-red/20 transition-all cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Supprimer</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Warning moins de 2 candidats */}
                {hasCandidatsAlert && (
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs font-semibold text-amber-400 flex items-center gap-2.5 leading-relaxed">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                    <span>
                      Moins de 2 candidats déclarés ({candidatList.length}). Vous devez ajouter au moins {2 - candidatList.length} candidat(s) supplémentaire(s) pour pouvoir ouvrir les votes.
                    </span>
                  </div>
                )}

                {/* Candidats Grid list */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                      Candidats déclarés ({candidatList.length})
                    </h3>
                    {currentElection?.statut === 'brouillon' && (
                      <button
                        onClick={() => handleOpenCandidatCreate(poste.id)}
                        className="inline-flex items-center gap-1 text-xs font-bold text-uni-gold hover:underline cursor-pointer"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>Inscrire un Candidat</span>
                      </button>
                    )}
                  </div>

                  {candidatList.length === 0 ? (
                    <div className="bg-white/3 border border-dashed border-white/10 p-6 rounded-2xl text-center text-xs text-gray-500">
                      Aucun candidat déclaré pour ce poste.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {candidatList.map((cand) => (
                        <div key={cand.id} className="bg-white/3 border border-white/5 p-4 rounded-2xl flex gap-4 items-start relative hover:border-white/10 transition-all">
                          {/* Photo Avatar */}
                          <div className="w-16 h-16 rounded-xl bg-white/5 overflow-hidden border border-white/10 flex items-center justify-center shrink-0">
                            {cand.photo_url ? (
                              <img 
                                src={cand.photo_url} 
                                alt={`${cand.prenom} ${cand.nom}`}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <User className="w-6 h-6 text-gray-600" />
                            )}
                          </div>

                          {/* Detail Candidat */}
                          <div className="space-y-1 min-w-0 pr-8">
                            <h4 className="text-sm font-bold text-white truncate flex items-center justify-between gap-1.5">
                              <span className="truncate">{cand.prenom} {cand.nom}</span>
                              {cand.representant && (
                                <span className="flex items-center justify-center p-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0" title="Représentant assigné">
                                  <UserCheck className="w-3.5 h-3.5" />
                                </span>
                              )}
                            </h4>
                            {cand.slogan && (
                              <p className="text-xs font-semibold text-uni-gold italic leading-snug truncate">
                                "{cand.slogan}"
                              </p>
                            )}
                            {cand.representant && (
                              <p className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1 my-0.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                                <span className="truncate">Représentant : {cand.representant.prenom} {cand.representant.nom}</span>
                              </p>
                            )}
                            {cand.programme && (
                              <p className="text-[11px] text-gray-400 line-clamp-2 leading-relaxed">
                                {cand.programme}
                              </p>
                            )}

                            {/* Badge/Bouton Représentant */}
                            <div className="mt-2.5 pt-2.5 border-t border-white/5">
                              {cand.representant ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenManageRep(cand);
                                  }}
                                  className="inline-flex items-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 py-1 px-2.5 rounded-lg text-[10px] font-medium transition-all cursor-pointer"
                                >
                                  <UserCheck className="w-3.5 h-3.5" />
                                  <span className="truncate max-w-[150px]">Rep : {cand.representant.prenom} {cand.representant.nom}</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenAssignRep(cand);
                                  }}
                                  className="inline-flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-dashed border-white/15 text-gray-400 hover:text-white py-1 px-2.5 rounded-lg text-[10px] font-medium transition-all cursor-pointer"
                                >
                                  <UserPlus className="w-3.5 h-3.5" />
                                  <span>Ajouter représentant</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Actions Candidats (si brouillon) */}
                          {currentElection?.statut === 'brouillon' && (
                            <div className="absolute right-3.5 top-3.5 flex gap-1.5">
                              <button
                                onClick={() => handleOpenCandidatEdit(poste.id, cand)}
                                className="p-1.5 rounded-md hover:bg-white/5 text-gray-400 hover:text-uni-gold transition-colors cursor-pointer"
                                title="Modifier candidat"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteCandidat(cand)}
                                className="p-1.5 rounded-md hover:bg-uni-red/10 text-gray-400 hover:text-uni-red-light transition-colors cursor-pointer"
                                title="Retirer candidat"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* POSTE FORM MODAL */}
      {showPosteModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="glassmorphism w-full max-w-md p-8 rounded-3xl space-y-6 relative shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <button 
              onClick={() => { setShowPosteModal(false); setErrorMsg(''); }}
              className="absolute right-6 top-6 p-2 rounded-lg text-gray-400 hover:bg-white/5 hover:text-white transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <h3 className="text-xl font-display font-extrabold text-white">
                {posteMode === 'edit' ? "Modifier le Poste" : "Ajouter un Poste"}
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                Déclarez un nouveau bureau de vote pour cette élection.
              </p>
            </div>

            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-uni-red/10 border border-uni-red/20 text-xs font-semibold text-uni-red-light flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-uni-red" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSavePoste} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 block">Nom du Poste</label>
                <input 
                  type="text" 
                  value={posteNom}
                  onChange={(e) => setPosteNom(e.target.value)}
                  disabled={posteLoading}
                  placeholder="Ex: Président, Secrétaire Général"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-uni-gold"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 block">Description (optionnel)</label>
                <textarea 
                  value={posteDescription}
                  onChange={(e) => setPosteDescription(e.target.value)}
                  disabled={posteLoading}
                  placeholder="Rôle ou attributions associées à cette fonction..."
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-uni-gold resize-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 block">Ordre d'affichage (numérique)</label>
                <input 
                  type="number" 
                  value={posteOrdre}
                  onChange={(e) => setPosteOrdre(parseInt(e.target.value) || 0)}
                  disabled={posteLoading}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-uni-gold"
                />
              </div>

              <button 
                type="submit" 
                disabled={posteLoading}
                className="w-full bg-uni-gold hover:bg-uni-gold-light text-uni-green-dark font-display font-bold py-3 px-6 rounded-xl transition-all flex justify-center items-center cursor-pointer mt-4"
              >
                {posteLoading ? (
                  <div className="w-5 h-5 rounded-full border-2 border-uni-green-dark border-t-transparent animate-spin" />
                ) : (
                  <span>Enregistrer le poste 🚀</span>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CANDIDAT FORM MODAL */}
      {showCandidatModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="glassmorphism w-full max-w-lg p-8 rounded-3xl space-y-6 relative shadow-2xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
            <button 
              onClick={() => { setShowCandidatModal(false); setErrorMsg(''); }}
              className="absolute right-6 top-6 p-2 rounded-lg text-gray-400 hover:bg-white/5 hover:text-white transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <h3 className="text-xl font-display font-extrabold text-white">
                {candidatMode === 'edit'
                  ? "Modifier le Candidat"
                  : !selectedCandStudent
                    ? "Sélectionner le Candidat"
                    : "Inscrire un Candidat"
                }
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                {!selectedCandStudent
                  ? "Choisissez l'étudiant à déclarer comme candidat depuis la liste blanche."
                  : "Renseignez la fiche publique du candidat pour cette fonction."
                }
              </p>
            </div>

            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-uni-red/10 border border-uni-red/20 text-xs font-semibold text-uni-red-light flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-uni-red" />
                <span>{errorMsg}</span>
              </div>
            )}

            {!selectedCandStudent ? (
              /* ÉTAPE 1 : SÉLECTION DE L'ÉTUDIANT */
              <div className="space-y-4">
                {!manualCandMode ? (
                  <>
                    <input 
                      type="text"
                      placeholder="Rechercher un étudiant par nom, prénom ou e-mail..."
                      value={candStudentSearch}
                      onChange={(e) => setCandStudentSearch(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-uni-gold"
                    />

                    {loadingStudents ? (
                      <div className="flex flex-col items-center justify-center py-12">
                        <div className="w-6 h-6 rounded-full border-2 border-uni-gold border-t-transparent animate-spin mb-2" />
                        <p className="text-xs text-gray-400">Chargement des étudiants...</p>
                      </div>
                    ) : filteredStudents.length === 0 ? (
                      <div className="text-center py-8 text-xs text-gray-500 space-y-3">
                        <p>{candStudentSearch ? 'Aucun résultat pour cette recherche.' : 'Aucun étudiant dans la liste blanche.'}</p>
                        <button
                          type="button"
                          onClick={() => setManualCandMode(true)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-white/10 hover:bg-white/15 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer"
                        >
                          ✏️ Saisir manuellement le nom du candidat
                        </button>
                      </div>
                    ) : (
                      <div className="border border-white/10 bg-white/3 rounded-xl divide-y divide-white/5 max-h-60 overflow-y-auto">
                        {filteredStudents.map((student) => (
                          <button
                            key={student.id}
                            type="button"
                            onClick={() => {
                              setSelectedCandStudent(student);
                              setCandNom(student.nom);
                              setCandPrenom(student.prenom);
                              setCandStudentSearch('');
                            }}
                            className="w-full text-left px-4 py-3 hover:bg-white/5 transition-all text-gray-300 hover:text-white flex flex-col cursor-pointer"
                          >
                            <span className="font-semibold text-xs text-white">{student.prenom} {student.nom}</span>
                            <span className="text-[10px] text-gray-500 font-mono mt-0.5">{student.email}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  /* Mode saisie manuelle candidat */
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-uni-gold font-semibold">✏️ Saisie manuelle</span>
                      <button type="button" onClick={() => setManualCandMode(false)} className="text-xs text-gray-400 hover:text-white transition-all cursor-pointer">← Retour à la liste</button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-gray-400 uppercase tracking-wider block mb-1">Prénom *</label>
                        <input
                          type="text"
                          value={candPrenom}
                          onChange={(e) => setCandPrenom(e.target.value)}
                          placeholder="Ex: Amadou"
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-uni-gold"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-400 uppercase tracking-wider block mb-1">Nom *</label>
                        <input
                          type="text"
                          value={candNom}
                          onChange={(e) => setCandNom(e.target.value)}
                          placeholder="Ex: Diallo"
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-uni-gold"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={!candNom.trim() || !candPrenom.trim()}
                      onClick={() => {
                        setSelectedCandStudent({ nom: candNom.trim(), prenom: candPrenom.trim(), email: '' });
                      }}
                      className="w-full bg-uni-gold/20 hover:bg-uni-gold/30 disabled:opacity-40 disabled:cursor-not-allowed text-uni-gold font-semibold text-sm py-2.5 rounded-xl transition-all cursor-pointer"
                    >
                      Continuer →
                    </button>
                  </div>
                )}
              </div>

            ) : (
              /* ÉTAPE 2 : INFORMATIONS COMPLÉMENTAIRES */
              <form onSubmit={handleSaveCandidat} className="space-y-4">
                {/* Selected Candidate Pill */}
                <div className="p-4 rounded-xl bg-uni-gold/5 border border-uni-gold/20 flex justify-between items-center">
                  <div className="min-w-0">
                    <span className="text-[10px] text-uni-gold uppercase tracking-wider font-bold block mb-0.5">Candidat sélectionné</span>
                    <p className="text-sm font-semibold text-white truncate">
                      {selectedCandStudent.prenom} {selectedCandStudent.nom}
                    </p>
                    {selectedCandStudent.email && (
                      <p className="text-[10px] text-gray-400 font-mono truncate">{selectedCandStudent.email}</p>
                    )}
                  </div>
                  {candidatMode === 'create' && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCandStudent(null);
                        setCandNom('');
                        setCandPrenom('');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-semibold text-gray-300 transition-all cursor-pointer"
                    >
                      Changer
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 block">Slogan</label>
                  <input 
                    type="text" 
                    value={candSlogan}
                    onChange={(e) => setCandSlogan(e.target.value)}
                    disabled={candLoading}
                    placeholder="Ex: Unir pour réussir !"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-uni-gold"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 block">Programme / Présentation</label>
                  <textarea 
                    value={candProgramme}
                    onChange={(e) => setCandProgramme(e.target.value)}
                    disabled={candLoading}
                    placeholder="Présentez brièvement les points clés du programme..."
                    rows={4}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-uni-gold resize-none"
                  />
                </div>

                {/* Photo upload block */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 block">Photo du Candidat</label>
                  <div className="flex gap-4 items-center">
                    <div className="w-16 h-16 rounded-xl bg-white/5 border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
                      {candPhotoPreview ? (
                        <img 
                          src={candPhotoPreview} 
                          alt="Aperçu" 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ImageIcon className="w-6 h-6 text-gray-600" />
                      )}
                    </div>
                    <div className="flex-grow">
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={handlePhotoFileChange}
                        disabled={candLoading}
                        id="candidate-photo-input"
                        className="hidden"
                      />
                      <label 
                        htmlFor="candidate-photo-input"
                        className="inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold text-xs py-2.5 px-4 rounded-xl cursor-pointer transition-all"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>{candPhotoPreview ? "Remplacer la photo" : "Choisir une image"}</span>
                      </label>
                      <p className="text-[10px] text-gray-500 mt-1.5">
                        L'image sera automatiquement optimisée et redimensionnée (300px max, JPEG).
                      </p>
                    </div>
                  </div>
                </div>



              <button 
                type="submit" 
                disabled={
                   candLoading || 
                   !selectedCandStudent
                 }
                className="w-full bg-uni-gold hover:bg-uni-gold-light disabled:opacity-40 disabled:cursor-not-allowed text-uni-green-dark font-display font-bold py-3 px-6 rounded-xl transition-all flex justify-center items-center cursor-pointer mt-4"
              >
                {candLoading ? (
                  <div className="w-5 h-5 rounded-full border-2 border-uni-green-dark border-t-transparent animate-spin" />
                ) : (
                  <span>Inscrire le candidat 🏆</span>
                )}
              </button>
            </form>
            )}
          </div>
        </div>
      )}

      {/* Modal de Gestion / Assignation de Représentant */}
      {isRepModalOpen && targetCandidateForRep && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-uni-green-dark border border-white/10 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-fade-in flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-display font-bold text-lg text-white">
                  Représentant du candidat
                </h3>
                <p className="text-[11px] text-uni-gold font-medium mt-0.5 truncate">
                  Candidat : {targetCandidateForRep.prenom} {targetCandidateForRep.nom}
                </p>
              </div>
              <button 
                onClick={() => { setIsRepModalOpen(false); setManualRepMode(false); }}
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto flex-grow space-y-4">
              
              {/* Représentant actuel (si existant) */}
              {targetCandidateForRep.representant && (
                <div className="space-y-3">
                  <div className="bg-white/3 border border-white/5 p-4 rounded-2xl space-y-2.5">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[9px] text-gray-500 uppercase tracking-wider font-bold block">Représentant actuel</span>
                        <h4 className="text-sm font-bold text-white mt-0.5">
                          {targetCandidateForRep.representant.prenom} {targetCandidateForRep.representant.nom}
                        </h4>
                        <p className="text-xs text-gray-400 font-mono mt-0.5">{targetCandidateForRep.representant.email}</p>
                      </div>
                      
                      <button
                        type="button"
                        onClick={() => {
                          handleRemoveRepresentant(targetCandidateForRep.id, targetCandidateForRep.representant);
                          setIsRepModalOpen(false);
                        }}
                        className="bg-uni-red/10 hover:bg-uni-red/20 border border-uni-red/20 text-uni-red text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-all cursor-pointer shrink-0"
                      >
                        Détacher
                      </button>
                    </div>
                    
                    {/* Statut d'activation */}
                    <div className="pt-2 flex items-center justify-between border-t border-white/5">
                      <span className="text-[10px] text-gray-500 font-medium">Statut de connexion :</span>
                      {targetCandidateForRep.representant.is_activated ? (
                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-bold uppercase tracking-wider">
                          Activé
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-uni-gold/10 text-uni-gold border border-uni-gold/20 text-[9px] font-bold uppercase tracking-wider">
                          En attente d'activation
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Accès temporaires si non activé */}
                  {!targetCandidateForRep.representant.is_activated && targetCandidateForRep.representant.mot_de_passe && (
                    <div className="bg-white/3 border border-white/5 p-4 rounded-2xl space-y-2">
                      <div>
                        <span className="text-[9px] text-uni-gold uppercase tracking-wider font-bold block mb-0.5">Accès temporaires</span>
                        <p className="text-[10px] text-gray-400 leading-relaxed">
                          Cet étudiant ne s'est pas encore connecté. Transmettez-lui ces identifiants de connexion :
                        </p>
                      </div>
                      <div className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-2 font-mono text-xs">
                        <div className="flex justify-between items-center text-gray-300">
                          <span>Identifiant : {targetCandidateForRep.representant.email}</span>
                        </div>
                        <div className="flex justify-between items-center text-gray-300">
                          <span className="flex items-center gap-1.5">
                            Mot de passe :{' '}
                            <span className={visiblePasswords[targetCandidateForRep.representant.id] ? 'text-uni-gold font-bold' : 'text-gray-600'}>
                              {visiblePasswords[targetCandidateForRep.representant.id] ? targetCandidateForRep.representant.mot_de_passe : '••••••••'}
                            </span>
                          </span>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => togglePasswordVisibility(targetCandidateForRep.representant.id)}
                              className="text-gray-400 hover:text-white transition-colors cursor-pointer"
                            >
                              {visiblePasswords[targetCandidateForRep.representant.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(targetCandidateForRep.representant.mot_de_passe);
                                triggerNotification('success', "Mot de passe copié !");
                              }}
                              className="text-gray-400 hover:text-uni-gold transition-colors cursor-pointer"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="border-t border-white/5 my-3" />
                </div>
              )}

              {/* Sélection / Remplacement de l'étudiant */}
              <div className="space-y-4">
                {manualRepMode ? (
                  /* Saisie Manuelle */
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-uni-gold font-semibold">✏️ Saisie manuelle</span>
                      <button 
                        type="button" 
                        onClick={() => { setManualRepMode(false); setManualRepNom(''); setManualRepPrenom(''); setManualRepEmail(''); }} 
                        className="text-xs text-gray-400 hover:text-white transition-all cursor-pointer"
                      >
                        ← Retour à la liste
                      </button>
                    </div>

                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] text-gray-400 uppercase tracking-wider block mb-1">Prénom *</label>
                          <input 
                            type="text" 
                            value={manualRepPrenom} 
                            onChange={(e) => setManualRepPrenom(e.target.value)} 
                            placeholder="Prénom" 
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-uni-gold" 
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-400 uppercase tracking-wider block mb-1">Nom *</label>
                          <input 
                            type="text" 
                            value={manualRepNom} 
                            onChange={(e) => setManualRepNom(e.target.value)} 
                            placeholder="Nom" 
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-uni-gold" 
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-400 uppercase tracking-wider block mb-1">Email de l'étudiant *</label>
                        <input 
                          type="email" 
                          value={manualRepEmail} 
                          onChange={(e) => setManualRepEmail(e.target.value)} 
                          placeholder="etudiant@univ.sn" 
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-uni-gold" 
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={candLoading || !manualRepNom.trim() || !manualRepPrenom.trim() || !manualRepEmail.trim()}
                      onClick={() => handleAssignRepresentative({
                        nom: manualRepNom.trim(),
                        prenom: manualRepPrenom.trim(),
                        email: manualRepEmail.trim().toLowerCase(),
                        id: null
                      })}
                      className="w-full bg-uni-gold hover:bg-uni-gold-light disabled:opacity-40 disabled:cursor-not-allowed text-uni-green-dark font-display font-bold py-3 px-6 rounded-xl transition-all flex justify-center items-center cursor-pointer mt-4"
                    >
                      {candLoading ? (
                        <div className="w-5 h-5 rounded-full border-2 border-uni-green-dark border-t-transparent animate-spin" />
                      ) : (
                        <span>Assigner ce représentant 📩</span>
                      )}
                    </button>
                  </div>
                ) : (
                  /* Recherche dans la liste des étudiants */
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 block mb-1">
                        {targetCandidateForRep.representant ? "Remplacer le représentant" : "Sélectionner un étudiant dans la liste blanche"}
                      </label>
                      <input 
                        type="text"
                        placeholder="Rechercher par nom, prénom ou email..."
                        value={studentSearch}
                        onChange={(e) => setStudentSearch(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-uni-gold"
                      />
                    </div>

                    {/* Liste filtrée */}
                    <div className="bg-white/3 border border-white/5 rounded-2xl max-h-60 overflow-y-auto divide-y divide-white/5">
                      {loadingStudents ? (
                        <div className="p-4 text-center text-xs text-gray-500">Chargement de la liste blanche...</div>
                      ) : filteredRepStudents.length === 0 ? (
                        <div className="p-4 text-center text-xs text-gray-500">
                          {studentSearch ? 'Aucun résultat trouvé.' : 'Aucun étudiant disponible dans cette amicale.'}
                        </div>
                      ) : (
                        filteredRepStudents.map((student) => (
                          <button
                            key={student.id}
                            type="button"
                            disabled={candLoading}
                            onClick={() => handleAssignRepresentative(student)}
                            className="w-full text-left px-4 py-3 hover:bg-white/5 transition-all text-gray-300 hover:text-white flex justify-between items-center cursor-pointer"
                          >
                            <div className="min-w-0 pr-2">
                              <span className="font-semibold text-xs text-white block truncate">{student.prenom} {student.nom}</span>
                              <span className="text-[10px] text-gray-500 font-mono block truncate mt-0.5">{student.email}</span>
                            </div>
                            <span className="text-[10px] text-uni-gold shrink-0 border border-uni-gold/20 bg-uni-gold/5 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                              Choisir
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                    {/* Lien de bascule vers saisie manuelle */}
                    <div className="text-center pt-2">
                      <button
                        type="button"
                        onClick={() => setManualRepMode(true)}
                        className="text-xs text-gray-400 hover:text-uni-gold underline underline-offset-2 transition-all cursor-pointer"
                      >
                        ✏️ L'étudiant n'est pas dans la liste ? Saisir manuellement
                      </button>
                    </div>
                  </div>
                )}

                {/* Info Rôle */}
                <div className="p-3 bg-white/3 border border-white/5 rounded-xl text-[10px] text-gray-400 leading-relaxed flex gap-2 items-start mt-2">
                  <span className="text-sm">ℹ️</span>
                  <span>
                    <strong>Accès représentant</strong> : En associant un étudiant, il recevra des identifiants de connexion. Il pourra se connecter sur son espace dédié pour suivre en temps réel les statistiques des votes de son candidat.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL IDENTIFIANTS REPRÉSENTANT ===== */}
      {showCredentialsModal && newRepCredentials && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-white/10 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
            
            {/* Header */}
            <div className="bg-gradient-to-r from-green-600/30 to-emerald-600/20 border-b border-white/10 p-6 text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-green-500/20 border border-green-500/30 text-3xl mb-3">
                ✅
              </div>
              <h2 className="text-xl font-bold text-white">Représentant enregistré !</h2>
              <p className="text-xs text-gray-400 mt-1">
                Transmettez ces identifiants à <span className="text-white font-semibold">{newRepCredentials.prenom} {newRepCredentials.nom}</span>
              </p>
            </div>

            {/* Corps */}
            <div className="p-6 space-y-4">
              <p className="text-xs text-gray-400 text-center">
                Le représentant peut maintenant se connecter sur son espace avec ces identifiants :
              </p>

              {/* Email */}
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Identifiant (Email)</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 font-mono text-sm text-white">
                    {newRepCredentials.email}
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(newRepCredentials.email);
                      triggerNotification('success', 'Email copié !');
                    }}
                    className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-gray-400 hover:text-white transition-colors"
                    title="Copier l'email"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Mot de passe */}
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Mot de passe temporaire</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-uni-gold/10 border border-uni-gold/30 rounded-xl px-4 py-3 font-mono text-xl font-bold text-uni-gold tracking-widest text-center">
                    {newRepCredentials.password}
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(newRepCredentials.password);
                      triggerNotification('success', 'Mot de passe copié !');
                    }}
                    className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-gray-400 hover:text-white transition-colors"
                    title="Copier le mot de passe"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] text-amber-300 leading-relaxed">
                ⚠️ Notez bien ce mot de passe — il ne sera plus visible après fermeture de cette fenêtre. Lors de sa première connexion, le représentant pourra en définir un nouveau.
              </div>

              {/* Lien connexion */}
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 font-mono text-[11px] text-gray-400 truncate">
                  {window.location.origin}/representant/login
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/representant/login`);
                    triggerNotification('success', 'Lien copié !');
                  }}
                  className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-gray-400 hover:text-white transition-colors"
                  title="Copier le lien"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 pb-6">
              <button
                onClick={() => {
                  setShowCredentialsModal(false);
                  setNewRepCredentials(null);
                }}
                className="w-full bg-gradient-to-r from-uni-gold to-amber-500 hover:opacity-90 text-black font-bold py-3 rounded-xl transition-all"
              >
                Compris, j'ai noté les identifiants
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// Generate simple mock ID fallback in case crypto.randomUUID is not available
function generateId() {
  return Math.random().toString(36).substring(2, 9);
}
