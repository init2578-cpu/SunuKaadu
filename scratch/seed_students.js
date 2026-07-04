import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, addDoc, collection, getDocs, deleteDoc, query, where } from 'firebase/firestore';

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

const studentsData = [
  { numero_carte: "20270001", nom: "Gomis", prenom: "Adama", email: "adama.gomis01@example.com" },
  { numero_carte: "20270002", nom: "Thiam", prenom: "Aissatou", email: "aissatou.thiam02@example.com" },
  { numero_carte: "20270003", nom: "Coly", prenom: "Mamadou", email: "mamadou.coly03@example.com" },
  { numero_carte: "20270004", nom: "Sané", prenom: "Fatoumata", email: "fatoumata.sane04@example.com" },
  { numero_carte: "20270005", nom: "Ndour", prenom: "Oumar", email: "oumar.ndour05@example.com" },
  { numero_carte: "20270006", nom: "Badji", prenom: "Khadija", email: "khadija.badji06@example.com" },
  { numero_carte: "20270007", nom: "Samb", prenom: "Cheikh", email: "cheikh.samb07@example.com" },
  { numero_carte: "20270008", nom: "Diedhiou", prenom: "Marième", email: "marieme.diedhiou08@example.com" },
  { numero_carte: "20270009", nom: "Mané", prenom: "Ibrahima", email: "ibrahima.mane09@example.com" },
  { numero_carte: "20270010", nom: "Tall", prenom: "Sokhna", email: "sokhna.tall10@example.com" },
  { numero_carte: "20270011", nom: "Bop", prenom: "Pape", email: "pape.bop11@example.com" },
  { numero_carte: "20270012", nom: "Cissokho", prenom: "Aminata", email: "aminata.cissokho12@example.com" },
  { numero_carte: "20270013", nom: "Dramé", prenom: "Abdoulaye", email: "abdoulaye.drame13@example.com" },
  { numero_carte: "20270014", nom: "Sagna", prenom: "Ndeye", email: "ndeye.sagna14@example.com" },
  { numero_carte: "20270015", nom: "Kébé", prenom: "Mouhamed", email: "mouhamed.kebe15@example.com" },
  { numero_carte: "20270016", nom: "Wane", prenom: "Astou", email: "astou.wane16@example.com" },
  { numero_carte: "20270017", nom: "Fofana", prenom: "Boubacar", email: "boubacar.fofana17@example.com" },
  { numero_carte: "20270018", nom: "Ly", prenom: "Awa", email: "awa.ly18@example.com" },
  { numero_carte: "20270019", nom: "Dia", prenom: "El Hadji", email: "elhadji.dia19@example.com" },
  { numero_carte: "20270020", nom: "Guèye", prenom: "Rokhaya", email: "rokhaya.gueye20@example.com" }
];

async function seedStudents() {
  const amicaleId = "amicale-demo-kolda";
  console.log("Cleaning old students for amicale-demo-kolda...");
  
  const qClean = query(collection(db, 'students'), where('amicale_id', '==', amicaleId));
  const snapClean = await getDocs(qClean);
  for (const d of snapClean.docs) {
    await deleteDoc(doc(db, 'students', d.id));
  }
  console.log(`Removed ${snapClean.size} old students.`);

  console.log("Inserting new students list...");
  for (const student of studentsData) {
    const docRef = await addDoc(collection(db, 'students'), {
      nom: student.nom,
      prenom: student.prenom,
      email: student.email,
      numero_carte: student.numero_carte,
      filiere: "Sciences & Technologies",
      promotion: "2027",
      auth_user_id: null,
      amicale_id: amicaleId,
      is_activated: false,
      created_at: new Date().toISOString()
    });
    console.log(`Inserted student: ${student.prenom} ${student.nom} (${docRef.id})`);
  }
  
  console.log("Students insertion completed successfully!");
}

seedStudents().catch(err => {
  console.error("Failed to seed students:", err);
});
