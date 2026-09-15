// Camada de dados: autenticação e base de dados (Firebase Authentication + Cloud Firestore).
// O resto da aplicação só fala com o Firebase através destas funções.
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendEmailVerification, sendPasswordResetEmail, signOut, GoogleAuthProvider, signInWithPopup, updateProfile
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  getFirestore, collection, doc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot, query, where, writeBatch
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

let auth, db, appRef;

export function init(config) {
  const app = initializeApp(config);
  appRef = app;
  auth = getAuth(app);
  auth.languageCode = "pt";
  db = getFirestore(app);
}

const mapUser = u => u && { email: (u.email || "").toLowerCase(), verified: !!u.emailVerified, nome: u.displayName || "" };

export const onAuth = cb => onAuthStateChanged(auth, u => cb(mapUser(u)));
export const login = (email, senha) => signInWithEmailAndPassword(auth, email, senha);
export async function registar(email, senha, nome) {
  const c = await createUserWithEmailAndPassword(auth, email, senha);
  if (nome) await updateProfile(c.user, { displayName: nome });
  await sendEmailVerification(c.user);
}
export const reenviarVerificacao = () => sendEmailVerification(auth.currentUser);
export async function recarregarUtilizador() {
  if (!auth.currentUser) return null;
  await auth.currentUser.reload();
  await auth.currentUser.getIdToken(true);   // atualiza a confirmação de e-mail nas regras
  return mapUser(auth.currentUser);
}
export const redefinirSenha = email => sendPasswordResetEmail(auth, email);
export const entrarGoogle = () => signInWithPopup(auth, new GoogleAuthProvider());
export const sair = () => signOut(auth);

// Subscrição em tempo real de uma coleção (opcionalmente filtrada: ["campo", "==", valor]).
export function watch(col, filtro, cb, erro) {
  const ref = filtro ? query(collection(db, col), where(filtro[0], filtro[1], filtro[2])) : collection(db, col);
  return onSnapshot(ref, s => cb(s.docs.map(d => ({ id: d.id, ...d.data() }))), erro);
}
export function watchDoc(col, id, cb, erro) {
  return onSnapshot(doc(db, col, id), s => cb(s.exists() ? s.data() : null), erro);
}
// Lê um documento uma vez. Devolve null se não houver permissão; {} se não existir.
export async function lerUmaVez(col, id) {
  try { const s = await getDoc(doc(db, col, id)); return s.exists() ? s.data() : {}; }
  catch (e) { return null; }
}
export const gravar = (col, id, dados) => setDoc(doc(db, col, id), dados);
export const alterar = (col, id, dados) => updateDoc(doc(db, col, id), dados);
export const apagar = (col, id) => deleteDoc(doc(db, col, id));
export const novoId = col => doc(collection(db, col)).id;

// Várias escritas de uma vez (em blocos de 400).
export async function lote(ops) {
  for (let i = 0; i < ops.length; i += 400) {
    const b = writeBatch(db);
    for (const o of ops.slice(i, i + 400)) {
      const r = doc(db, o.col, o.id);
      if (o.op === "set") b.set(r, o.dados);
      else if (o.op === "update") b.update(r, o.dados);
      else b.delete(r);
    }
    await b.commit();
  }
}

/* Anexos (Cloud Storage) — carregado só quando é usado. */
let _st = null;
async function storage() {
  if (!_st) {
    const m = await import("https://www.gstatic.com/firebasejs/12.19.0/firebase-storage.js");
    _st = { m, inst: m.getStorage(appRef) };
  }
  return _st;
}
export async function enviarFicheiro(file, caminho) {
  const { m, inst } = await storage();
  const ref = m.ref(inst, caminho);
  await m.uploadBytes(ref, file, { contentType: file.type || "application/octet-stream" });
  return await m.getDownloadURL(ref);
}
export async function apagarFicheiro(caminho) {
  const { m, inst } = await storage();
  await m.deleteObject(m.ref(inst, caminho));
}
