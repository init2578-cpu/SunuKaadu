import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, addDoc, collection, getDocs, deleteDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAFHRmV6HSWUI6rbmamskuB5t9VOeX4_8U",
  authDomain: "codefire-bee6c.firebaseapp.com",
  projectId: "codefire-bee6c",
  storageBucket: "codefire-bee6c.firebasestorage.app",
  messagingSenderId: "229875767341",
  appId: "1:229875767341:web:ac994b24677f9b7e3e80a4",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function cleanCollection(colName) {
  const snap = await getDocs(collection(db, colName));
  console.log(`Cleaning ${snap.size} documents from '${colName}'...`);
  for (const d of snap.docs) {
    await deleteDoc(doc(db, colName, d.id));
  }
}

async function seed() {
  console.log("Starting full database seeding for testing...");

  // 1. Nettoyer les anciennes collections pour repartir sur une base propre
  await cleanCollection('amicales');
  await cleanCollection('admins');
  await cleanCollection('students');
  await cleanCollection('elections');
  await cleanCollection('postes');
  await cleanCollection('candidats');
  await cleanCollection('votes');

  // 2. Créer une Amicale régionale de test
  const amicaleId = "amicale-demo-kolda";
  await setDoc(doc(db, 'amicales', amicaleId), {
    nom: "Amicale de Kolda",
    description: "Association des étudiants ressortissants de Kolda.",
    created_at: new Date().toISOString()
  });
  console.log("Created Amicale: Amicale de Kolda");

  // 3. Créer le compte Super Admin
  await addDoc(collection(db, 'admins'), {
    nom: "Admin",
    prenom: "Super",
    email: "admin@saner.sn",
    role: "super_admin",
    is_activated: false,
    is_revoked: false,
    mot_de_passe: "AdminTemp2026",
    candidat_id: null,
    amicale_id: null,
    created_by: null,
    created_at: new Date().toISOString()
  });

  await addDoc(collection(db, 'admins'), {
    nom: "Hadim",
    prenom: "Super Admin",
    email: "ibnrassul05@gmail.com",
    role: "super_admin",
    is_activated: false,
    is_revoked: false,
    mot_de_passe: "@Hadim023",
    candidat_id: null,
    amicale_id: null,
    created_by: null,
    created_at: new Date().toISOString()
  });
  console.log("Created Super Admin accounts");

  // 4. Créer un Délégué d'Amicale
  await addDoc(collection(db, 'admins'), {
    nom: "Diallo",
    prenom: "Moussa",
    email: "delegue@saner.sn",
    role: "delegue",
    is_activated: false,
    is_revoked: false,
    mot_de_passe: "DelTemp2026",
    candidat_id: null,
    amicale_id: amicaleId,
    created_by: "system",
    created_at: new Date().toISOString()
  });
  console.log("Created Delegate: delegue@saner.sn / DelTemp2026");

  // 5. Créer des étudiants dans la liste blanche (Votants éligibles)
  const students = [
    { nom: "Ndiaye", prenom: "Mamadou", email: "mamadou.ndiaye@univ.sn", numero_carte: "N202611", filiere: "Informatique", promotion: "2026" },
    { nom: "Diop", prenom: "Aminata", email: "aminata.diop@univ.sn", numero_carte: "D202522", filiere: "Médecine", promotion: "2025" },
    { nom: "Sow", prenom: "Ousmane", email: "ousmane.sow@univ.sn", numero_carte: "S202633", filiere: "Droit", promotion: "2026" }
  ];

  for (const s of students) {
    await addDoc(collection(db, 'students'), {
      ...s,
      auth_user_id: null,
      is_activated: false,
      amicale_id: amicaleId,
      created_at: new Date().toISOString()
    });
  }
  console.log("Added 3 students to the whitelist");

  console.log("\nSeeding finished! Everything is ready for testing.");
  console.log("1. Super Admin : admin@saner.sn (pwd: AdminTemp2026)");
  console.log("2. Délégué de Kolda : delegue@saner.sn (pwd: DelTemp2026)");
  console.log("3. Électeur étudiant 1 : mamadou.ndiaye@univ.sn (White-list éligible)");
}

seed().catch(err => {
  console.error("Seeding failed:", err);
});
