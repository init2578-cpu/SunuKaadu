import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, limit, query } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyAFHRmV6HSWUI6rbmamskuB5t9VOeX4_8U",
  authDomain: "codefire-bee6c.firebaseapp.com",
  projectId: "codefire-bee6c",
  storageBucket: "codefire-bee6c.firebasestorage.app",
  messagingSenderId: "229875767341",
  appId: "1:229875767341:web:ac994b24677f9b7e3e80a4",
};

async function runDiagnostic() {
  console.log("=== DIAGNOSTIC COMPLET DE LA MIGRATION FIREBASE ===");
  
  // 1. Initialisation
  console.log("\n1. Initialisation du SDK Firebase...");
  let app, db, auth;
  try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    console.log("✅ SDK Firebase initialisé avec succès.");
  } catch (err) {
    console.error("❌ Échec d'initialisation du SDK:", err);
    return;
  }

  // 2. Vérification des collections Firestore
  const collections = ['amicales', 'admins', 'students', 'elections', 'postes', 'candidats', 'votes'];
  console.log("\n2. Vérification de l'accès aux collections Firestore...");
  
  for (const colName of collections) {
    try {
      const q = query(collection(db, colName), limit(1));
      const snap = await getDocs(q);
      console.log(`✅ Collection '${colName}' : Accès OK (trouvé ${snap.size} doc(s) de test/limité à 1).`);
    } catch (err) {
      console.error(`❌ Erreur d'accès à la collection '${colName}' :`, err.message);
    }
  }

  // 3. Validation de la liste blanche d'admins
  console.log("\n3. Diagnostic des rôles admin requis...");
  try {
    const snap = await getDocs(collection(db, 'admins'));
    let hasSuperAdmin = false;
    let hasDelegate = false;
    
    snap.forEach(doc => {
      const data = doc.data();
      if (data.role === 'super_admin') hasSuperAdmin = true;
      if (data.role === 'delegue') hasDelegate = true;
    });

    if (hasSuperAdmin) console.log("✅ Super Administrateur trouvé dans la collection 'admins'.");
    else console.log("⚠️ Aucun Super Administrateur trouvé.");
    
    if (hasDelegate) console.log("✅ Délégué d'amicale trouvé dans la collection 'admins'.");
    else console.log("⚠️ Aucun Délégué trouvé.");
  } catch (err) {
    console.error("❌ Échec de lecture des profils administrateurs:", err.message);
  }

  console.log("\n=== FIN DU DIAGNOSTIC ===");
}

runDiagnostic();
