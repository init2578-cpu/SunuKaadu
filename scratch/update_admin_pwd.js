import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, updateDoc, doc } from 'firebase/firestore';

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

async function updatePassword() {
  const email = "ibnrassul05@gmail.com";
  const newPassword = "@Hadim023";

  console.log(`Searching for admin ${email}...`);
  const q = query(collection(db, 'admins'), where('email', '==', email));
  const snap = await getDocs(q);

  if (snap.empty) {
    console.log(`Admin ${email} not found!`);
    return;
  }

  const adminDoc = snap.docs[0];
  const docRef = doc(db, 'admins', adminDoc.id);

  await updateDoc(docRef, {
    mot_de_passe: newPassword,
    is_activated: false, // ensures they can activate it on first login with the chosen password
    auth_user_id: null // reset auth user ID if they need to register it
  });

  console.log(`Successfully updated temporary password for ${email} to: ${newPassword}`);
}

updatePassword().catch(err => {
  console.error("Error updating admin password:", err);
});
