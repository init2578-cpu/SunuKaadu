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

async function seedFakeElection() {
  console.log("Starting fake election seeding...");

  // 1. Find or verify the amicale
  const amicaleId = "amicale-demo-kolda";
  
  // 2. Create the election document
  const electionRef = await addDoc(collection(db, 'elections'), {
    titre: "Élection Fictive à 6 Postes (Test)",
    description: "Scrutin de test complet avec 6 postes pour valider le parcours utilisateur.",
    statut: "ouverte",
    amicale_id: amicaleId,
    created_by: "system",
    created_at: new Date().toISOString()
  });

  const electionId = electionRef.id;
  console.log(`Created Election: ${electionId}`);

  // 3. Define 6 posts
  const postesData = [
    { nom: "Président(e)", ordre: 1, candidats: [
        { prenom: "Awa", nom: "Ndiaye", slogan: "Le changement maintenant !", programme: "1. Transparence totale dans la gestion des fonds.\n2. Modernisation des espaces de travail.\n3. Représentation forte auprès de l'administration." },
        { prenom: "Babacar", nom: "Diagne", slogan: "L'excellence au service de tous !", programme: "1. Digitalisation des services de l'amicale.\n2. Organisation de forums de l'emploi.\n3. Partenariats académiques nationaux." }
      ]
    },
    { nom: "Secrétaire Général(e)", ordre: 2, candidats: [
        { prenom: "Moussa", nom: "Sow", slogan: "Rigueur et efficacité !", programme: "1. Rédaction systématique et publication des PV.\n2. Centralisation des archives numériques.\n3. Suivi rigoureux des décisions." },
        { prenom: "Fatou", nom: "Diallo", slogan: "Une administration moderne !", programme: "1. Création d'une newsletter mensuelle.\n2. Simplification des démarches d'adhésion.\n3. Transparence administrative." }
      ]
    },
    { nom: "Trésorier(e) Général(e)", ordre: 3, candidats: [
        { prenom: "Ousmane", nom: "Gueye", slogan: "Chaque franc compte !", programme: "1. Rapports financiers publiés mensuellement.\n2. Optimisation des dépenses.\n3. Recherche active de financements externes." },
        { prenom: "Mariama", nom: "Ba", slogan: "Transparence financière !", programme: "1. Audit externe indépendant en fin de mandat.\n2. Caisse de solidarité pour les étudiants en difficulté.\n3. Budget participatif." }
      ]
    },
    { nom: "Secrétaire à l'Organisation", ordre: 4, candidats: [
        { prenom: "Abdoulaye", nom: "Cisse", slogan: "Des événements inoubliables !", programme: "1. Organisation de journées d'intégration dynamiques.\n2. Hackathons inter-universitaires.\n3. Amélioration des événements sportifs." },
        { prenom: "Aminata", nom: "Kone", slogan: "L'unité par la culture !", programme: "1. Festival culturel annuel.\n2. Sorties pédagogiques et de cohésion.\n3. Conférences mensuelles avec des professionnels." }
      ]
    },
    { nom: "Chargé(e) de la Communication", ordre: 5, candidats: [
        { prenom: "Cheikh", nom: "Fall", slogan: "Une com active et connectée !", programme: "1. Refonte complète de la présence en ligne.\n2. Podcasts d'informations réguliers.\n3. Écoute active et feedback permanent." },
        { prenom: "Khady", nom: "Sy", slogan: "L'information en temps réel !", programme: "1. Alertes SMS pour les informations cruciales.\n2. Création de canaux de diffusion thématiques.\n3. Réponse rapide aux questions des étudiants." }
      ]
    },
    { nom: "Secrétaire aux Affaires Sociales", ordre: 6, candidats: [
        { prenom: "Ibrahima", nom: "Diop", slogan: "Solidarité et entraide !", programme: "1. Aide au logement pour les nouveaux étudiants.\n2. Partenariats avec des cliniques pour la santé étudiante.\n3. Soutien psychologique gratuit." },
        { prenom: "Safietou", nom: "Sane", slogan: "Le social au cœur de l'action !", programme: "1. Distribution de kits scolaires et alimentaires.\n2. Mentorat étudiant pour lutter contre le décrochage.\n3. Mutuelle de santé étudiante." }
      ]
    }
  ];

  // 4. Create posts and candidates
  for (const p of postesData) {
    const posteRef = await addDoc(collection(db, 'postes'), {
      election_id: electionId,
      nom: p.nom,
      description: `Poste de ${p.nom} pour le mandat 2026.`,
      ordre: p.ordre,
      created_at: new Date().toISOString()
    });

    console.log(`Created Poste: ${p.nom} (${posteRef.id})`);

    for (const c of p.candidats) {
      const candidatRef = await addDoc(collection(db, 'candidats'), {
        poste_id: posteRef.id,
        prenom: c.prenom,
        nom: c.nom,
        slogan: c.slogan,
        programme: c.programme,
        photo_url: `https://api.dicebear.com/7.x/adventurer/svg?seed=${c.prenom}${c.nom}`,
        created_at: new Date().toISOString()
      });
      console.log(`  Added Candidat: ${c.prenom} ${c.nom} (${candidatRef.id})`);
    }
  }

  console.log("\nFake election seeded successfully! You can now test the vote process on the dashboard.");
}

seedFakeElection().catch(err => {
  console.error("Failed seeding fake election:", err);
});
