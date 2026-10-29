// Satu kali login untuk semua panel. Sesi Firebase disimpan per-origin, jadi iframe di domain ini
// otomatis ikut login selama nama app + apiKey-nya sama dengan yang dipakai tiap panel.
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, signInWithPopup, signInWithCredential,
  GoogleAuthProvider, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";

const STORE = { apiKey: "AIzaSyCVL_C4opQiKC6fNG_Rw4l-519rQZICH58", authDomain: "fvcktherules-store.firebaseapp.com", projectId: "fvcktherules-store", storageBucket: "fvcktherules-store.firebasestorage.app", messagingSenderId: "382347904485", appId: "1:382347904485:web:6715a7b395d44ad07a5b0c" };
const JURNAL = { apiKey: "AIzaSyAsbMEwu-h28PsRO-h3tDbHqTp6Wgj44oI", authDomain: "fvck-journal.firebaseapp.com", projectId: "fvck-journal", storageBucket: "fvck-journal.firebasestorage.app", messagingSenderId: "681112457847", appId: "1:681112457847:web:3365af3274eb6d03c8ac72" };
const KEU = { apiKey: "AIzaSyBmm72IP9rcM1vImVr669QCVSQkmYj5m5c", authDomain: "keuangan-fvck.firebaseapp.com", projectId: "keuangan-fvck", storageBucket: "keuangan-fvck.firebasestorage.app", messagingSenderId: "49114814826", appId: "1:49114814826:web:f33f3d3acd89eb4f87ad13" };

// Nama app HARUS sama dengan yang dipakai panel: web=fvckAdminApp, keuangan(order)=main, jurnal=jurnalAdmin, keuangan=keuanganAdmin
const gate = getAuth(initializeApp(STORE, "fvckAdminApp"));
const others = {
  "Keuangan (order web)": getAuth(initializeApp(STORE, "main")),
  "Jurnal": getAuth(initializeApp(JURNAL, "jurnalAdmin")),
  "Keuangan": getAuth(initializeApp(KEU, "keuanganAdmin")),
};

export const onSession = (fn) => onAuthStateChanged(gate, fn);

// Mengembalikan daftar panel yang gagal tersambung (kosong = semua beres).
export async function loginEmail(email, pass) {
  await signInWithEmailAndPassword(gate, email, pass);           // gagal di sini = login ditolak
  const bad = [];
  await Promise.all(Object.entries(others).map(async ([n, a]) => {
    try { await signInWithEmailAndPassword(a, email, pass); } catch (e) { bad.push(n); }
  }));
  return bad;
}

export async function loginGoogle() {
  const r = await signInWithPopup(gate, new GoogleAuthProvider());
  const cred = GoogleAuthProvider.credentialFromResult(r);
  const bad = [];
  await Promise.all(Object.entries(others).map(async ([n, a]) => {
    try { await signInWithCredential(a, cred); } catch (e) { bad.push(n); }
  }));
  return bad;
}

export async function logoutAll() {
  await Promise.all([gate, ...Object.values(others)].map(a => signOut(a).catch(() => {})));
}

export const email = () => gate.currentUser && gate.currentUser.email;
