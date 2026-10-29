import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import * as A from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import * as F from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./jurnal-firebase-config.js";

export const configured = !String(firebaseConfig.apiKey).startsWith("PASTE");
export const app = initializeApp(firebaseConfig, "jurnalAdmin");
export const auth = A.getAuth(app);
export const db = F.getFirestore(app);
export { A, F };
