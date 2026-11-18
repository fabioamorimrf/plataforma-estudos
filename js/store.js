// Camada de dados: Firebase (login + sincronização) ou modo local (localStorage).
import { firebaseConfig } from './firebase-config.js';

const SDK = 'https://www.gstatic.com/firebasejs/11.0.2';
const COLLECTIONS = ['subjects', 'topics', 'cards'];
const LOCAL_KEY = 'plataforma-estudos:data';

export const DEFAULT_SETTINGS = {
  examName: 'ENEM 2027',
  examDate: '2027-11-07',
  maxPerDay: 15,
};

const state = {
  mode: 'local', // 'local' | 'firebase'
  user: null,
  data: emptyData(),
  listeners: new Set(),
  fb: null, // módulos e instâncias do Firebase
  unsub: [],
};

function emptyData() {
  return { subjects: {}, topics: {}, cards: {}, settings: { ...DEFAULT_SETTINGS } };
}

export function hasFirebase() {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
}

export function onChange(fn) {
  state.listeners.add(fn);
  return () => state.listeners.delete(fn);
}
function emit() {
  for (const fn of state.listeners) fn();
}

export const data = () => state.data;
export const mode = () => state.mode;
export const user = () => state.user;

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ---------------- inicialização ----------------
export async function init(onAuth) {
  if (!hasFirebase()) {
    state.mode = 'local';
    loadLocal();
    onAuth({ mode: 'local', user: { displayName: 'Modo local' } });
    return;
  }
  state.mode = 'firebase';
  const [appMod, authMod, fsMod] = await Promise.all([
    import(`${SDK}/firebase-app.js`),
    import(`${SDK}/firebase-auth.js`),
    import(`${SDK}/firebase-firestore.js`),
  ]);
  const app = appMod.initializeApp(firebaseConfig);
  const auth = authMod.getAuth(app);
  authMod.useDeviceLanguage(auth);
  let db;
  try {
    db = fsMod.initializeFirestore(app, {
      localCache: fsMod.persistentLocalCache({ tabManager: fsMod.persistentMultipleTabManager() }),
    });
  } catch {
    db = fsMod.getFirestore(app);
  }
  state.fb = { auth, db, authMod, fsMod };

  authMod.onAuthStateChanged(auth, (u) => {
    stopListening();
    state.user = u;
    state.data = emptyData();
    if (u) startListening(u.uid);
    onAuth({ mode: 'firebase', user: u });
    emit();
  });
}

// ---------------- autenticação ----------------
export async function loginGoogle() {
  const { auth, authMod } = state.fb;
  await authMod.signInWithPopup(auth, new authMod.GoogleAuthProvider());
}
export async function loginEmail(email, password) {
  const { auth, authMod } = state.fb;
  await authMod.signInWithEmailAndPassword(auth, email, password);
}
export async function signupEmail(name, email, password) {
  const { auth, authMod } = state.fb;
  const cred = await authMod.createUserWithEmailAndPassword(auth, email, password);
  if (name) await authMod.updateProfile(cred.user, { displayName: name });
}
export async function resetPassword(email) {
  const { auth, authMod } = state.fb;
  await authMod.sendPasswordResetEmail(auth, email);
}
export async function logout() {
  if (state.mode === 'firebase') await state.fb.authMod.signOut(state.fb.auth);
}

export function authErrorMessage(err) {
  const code = (err && err.code) || '';
  const map = {
    'auth/invalid-email': 'E-mail inválido.',
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/wrong-password': 'E-mail ou senha incorretos.',
    'auth/user-not-found': 'Não existe conta com esse e-mail.',
    'auth/email-already-in-use': 'Já existe uma conta com esse e-mail.',
    'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
    'auth/popup-closed-by-user': 'A janela de login foi fechada.',
    'auth/unauthorized-domain': 'Este endereço ainda não está autorizado no Firebase (Authentication > Configurações > Domínios autorizados).',
    'auth/too-many-requests': 'Muitas tentativas. Espere um pouco e tente de novo.',
  };
  return map[code] || 'Não foi possível concluir. Tente de novo.';
}

// ---------------- sincronização ----------------
function userCol(u, col) {
  const { db, fsMod } = state.fb;
  return fsMod.collection(db, 'users', u, col);
}

function startListening(u) {
  const { db, fsMod } = state.fb;
  for (const col of COLLECTIONS) {
    state.unsub.push(
      fsMod.onSnapshot(userCol(u, col), (snap) => {
        const map = {};
        snap.forEach((d) => (map[d.id] = { ...d.data(), id: d.id }));
        state.data[col] = map;
        emit();
      }),
    );
  }
  state.unsub.push(
    fsMod.onSnapshot(fsMod.doc(db, 'users', u, 'meta', 'settings'), (snap) => {
      state.data.settings = { ...DEFAULT_SETTINGS, ...(snap.exists() ? snap.data() : {}) };
      emit();
    }),
  );
}

function stopListening() {
  state.unsub.forEach((fn) => fn());
  state.unsub = [];
}

// ---------------- escrita ----------------
export function put(col, obj) {
  if (!obj.id) obj.id = uid();
  obj.updatedAt = Date.now();
  state.data[col][obj.id] = obj;
  if (state.mode === 'local') saveLocal();
  else {
    const { db, fsMod } = state.fb;
    fsMod.setDoc(fsMod.doc(db, 'users', state.user.uid, col, obj.id), clean(obj)).catch(report);
  }
  emit();
  return obj;
}

export function remove(col, id) {
  delete state.data[col][id];
  if (state.mode === 'local') saveLocal();
  else {
    const { db, fsMod } = state.fb;
    fsMod.deleteDoc(fsMod.doc(db, 'users', state.user.uid, col, id)).catch(report);
  }
  emit();
}

export function setSettings(patch) {
  state.data.settings = { ...state.data.settings, ...patch };
  if (state.mode === 'local') saveLocal();
  else {
    const { db, fsMod } = state.fb;
    fsMod
      .setDoc(fsMod.doc(db, 'users', state.user.uid, 'meta', 'settings'), clean(state.data.settings))
      .catch(report);
  }
  emit();
}

function clean(obj) {
  // Firestore não aceita undefined.
  return JSON.parse(JSON.stringify(obj));
}

function report(err) {
  console.error(err);
  window.dispatchEvent(new CustomEvent('store-error', { detail: err }));
}

// ---------------- modo local ----------------
function loadLocal() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      state.data = { ...emptyData(), ...parsed, settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) } };
    }
  } catch (e) {
    console.warn('Não foi possível ler os dados locais', e);
  }
}
function saveLocal() {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(state.data));
  } catch (e) {
    report(e);
  }
}

// ---------------- backup ----------------
export function exportJSON() {
  return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), ...state.data }, null, 2);
}

export function importJSON(text) {
  const parsed = JSON.parse(text);
  for (const col of COLLECTIONS) {
    for (const obj of Object.values(parsed[col] || {})) put(col, obj);
  }
  if (parsed.settings) setSettings(parsed.settings);
}
