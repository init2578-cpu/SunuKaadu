import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

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

async function checkAdmins() {
  const snap = await getDocs(collection(db, 'admins'));
  snap.forEach(doc => {
    const data = doc.data();
    console.log(`Email: ${data.email}, Role: ${data.role}, Activated: ${data.is_activated}, TempPassword: ${data.mot_de_passe}`);
  });
}

checkAdmins();
