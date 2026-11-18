import * as store from './store.js';
import {
  TRACKS,
  DIFFICULTY_LABEL,
  OUTCOME_LABEL,
  today,
  addDays,
  diffDays,
  fromISO,
  toISO,
  startReview,
  applyResult,
  outcome,
  stepLabel,
  phaseFromTopics,
} from './srs.js';
import { ENEM_SUBJECTS, MATH_TOPICS, PHASE_TASKS, PALETTE } from './presets.js';

const app = document.getElementById('app');
const modalRoot = document.getElementById('modal-root');

const ui = {
  view: 'hoje',
  weekStart: mondayOf(today()),
  subjectId: null,
  authMode: 'login', // login | signup | reset
  ready: false,
  user: null,
};

const DOW = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'];
const STATUS = {
  estudar: 'Para estudar',
  visto: 'Já vi',
  treinar: 'Para treinar mais',
};

// ---------------- utilidades ----------------
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
function mondayOf(iso) {
  const d = fromISO(iso);
  const dow = (d.getDay() + 6) % 7; // 0 = segunda
  d.setDate(d.getDate() - dow);
  return toISO(d);
}
function fmtDate(iso, opts = { day: '2-digit', month: 'short' }) {
  return fromISO(iso).toLocaleDateString('pt-BR', opts).replace(/\./g, '');
}
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('show'), 2600);
}
const D = () => store.data();
const subjects = () => Object.values(D().subjects).sort((a, b) => (a.queue ?? 99) - (b.queue ?? 99) || a.name.localeCompare(b.name));
const topicsOf = (sid) => Object.values(D().topics).filter((t) => t.subjectId === sid).sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.createdAt ?? 0) - (b.createdAt ?? 0));
const subjectById = (id) => D().subjects[id];
const cardsOn = (iso) => Object.values(D().cards).filter((c) => c.date === iso).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
function reviewsDueBy(iso) {
  return Object.values(D().topics)
    .filter((t) => t.review && t.review.due <= iso && t.status !== 'estudar')
    .sort((a, b) => a.review.due.localeCompare(b.review.due));
}
function reviewsOn(iso) {
  return Object.values(D().topics).filter((t) => t.review && t.review.due === iso && t.status !== 'estudar');
}
function subjectPhase(s) {
  if (s.phase) return Number(s.phase);
  return phaseFromTopics(topicsOf(s.id));
}

// ---------------- tema ----------------
const THEME_KEY = 'plataforma-estudos:theme';
function currentTheme() {
  const set = document.documentElement.dataset.theme;
  if (set) return set;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
function toggleTheme() {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {}
  render();
}

// ---------------- render principal ----------------
function render() {
  if (!ui.ready) return;
  if (store.mode() === 'firebase' && !ui.user) {
    app.className = '';
    app.innerHTML = renderAuth();
    return;
  }
  const due = reviewsDueBy(today()).length;
  app.className = '';
  app.innerHTML = `
    <header class="topbar">
      <div class="brand"><img src="icon.svg" alt="" />Plataforma de Estudos</div>
      <nav class="nav">
        ${navBtn('hoje', 'Hoje', '☀', due ? `<span class="badge danger">${due}</span>` : '')}
        ${navBtn('semana', 'Semana', '▦')}
        ${navBtn('materias', 'Matérias', '◉')}
        ${navBtn('ajustes', 'Ajustes', '⚙')}
      </nav>
      <div class="spacer"></div>
      <button class="btn icon ghost" data-action="theme" title="Trocar tema" aria-label="Trocar tema">${currentTheme() === 'dark' ? '☀' : '☾'}</button>
      <div class="user-chip">${esc(ui.user?.displayName || ui.user?.email || '')}</div>
    </header>
    <main>${renderView()}</main>`;
  if (ui.view === 'semana') bindDrag();
}

function navBtn(view, label, ico, extra = '') {
  return `<button data-action="nav" data-view="${view}" ${ui.view === view ? 'aria-current="page"' : ''}><span class="ico">${ico}</span>${label}${extra}</button>`;
}

function renderView() {
  switch (ui.view) {
    case 'semana':
      return renderWeek();
    case 'materias':
      return ui.subjectId && subjectById(ui.subjectId) ? renderSubject(subjectById(ui.subjectId)) : renderSubjects();
    case 'ajustes':
      return renderSettings();
    default:
      return renderToday();
  }
}

// ---------------- login ----------------
function renderAuth() {
  const m = ui.authMode;
  const title = m === 'signup' ? 'Criar conta' : m === 'reset' ? 'Recuperar senha' : 'Entrar';
  return `
  <div class="auth-wrap"><div class="panel auth">
    <div class="brand"><img src="icon.svg" alt="" />Plataforma de Estudos</div>
    <p class="muted small" style="text-align:center;margin:0 0 20px">Calendário, Lista Sniper e revisões espaçadas, em qualquer aparelho.</p>
    <h2 style="margin-bottom:12px">${title}</h2>
    ${m !== 'reset' ? `<button class="btn" style="width:100%" data-action="google">Continuar com Google</button><div class="divider">ou com e-mail</div>` : ''}
    <form data-form="auth">
      ${m === 'signup' ? `<label class="field">Nome<input type="text" name="name" autocomplete="name" required /></label>` : ''}
      <label class="field">E-mail<input type="email" name="email" autocomplete="email" required /></label>
      ${m !== 'reset' ? `<label class="field">Senha<input type="password" name="password" autocomplete="${m === 'signup' ? 'new-password' : 'current-password'}" minlength="6" required /></label>` : ''}
      <div class="error" id="auth-error"></div>
      <button class="btn primary" type="submit">${m === 'signup' ? 'Criar conta' : m === 'reset' ? 'Enviar link' : 'Entrar'}</button>
    </form>
    <div class="row" style="justify-content:space-between;margin-top:14px">
      ${m === 'login' ? `<button class="btn ghost small" data-action="auth-mode" data-mode="signup">Criar conta</button><button class="btn ghost small" data-action="auth-mode" data-mode="reset">Esqueci a senha</button>` : `<button class="btn ghost small" data-action="auth-mode" data-mode="login">Voltar para o login</button>`}
    </div>
  </div></div>`;
}

async function submitAuth(form) {
  const f = new FormData(form);
  const err = document.getElementById('auth-error');
  err.textContent = '';
  try {
    if (ui.authMode === 'signup') await store.signupEmail(f.get('name'), f.get('email'), f.get('password'));
    else if (ui.authMode === 'reset') {
      await store.resetPassword(f.get('email'));
      err.textContent = '';
      toast('Enviamos um link para o seu e-mail.');
      ui.authMode = 'login';
      render();
    } else await store.loginEmail(f.get('email'), f.get('password'));
  } catch (e) {
    err.textContent = store.authErrorMessage(e);
  }
}

// ---------------- HOJE ----------------
function renderToday() {
  const t = today();
  const s = D().settings;
  const due = reviewsDueBy(t);
  const daysLeft = s.examDate ? diffDays(t, s.examDate) : null;
  const next7 = Object.values(D().topics).filter((x) => x.review && x.review.due > t && x.review.due <= addDays(t, 7) && x.status !== 'estudar').length;
  const cards = cardsOn(t);
  const tasks = cards.flatMap((c) => c.tasks || []);
  const tasksDone = tasks.filter((x) => x.done).length;
  const hasSubjects = subjects().length > 0;

  return `
  <div class="page-head">
    <div>
      <h1>${fmtDate(t, { weekday: 'long', day: 'numeric', month: 'long' })}</h1>
      <p class="muted">${daysLeft !== null && daysLeft >= 0 ? `Faltam <strong>${daysLeft}</strong> dias para ${esc(s.examName || 'a prova')}` : 'Cadastre a data da prova em Ajustes'}</p>
    </div>
  </div>
  ${store.mode() === 'local' ? `<div class="notice">Modo local: os dados ficam só neste navegador. Quando o Firebase for configurado, o login e a sincronização são ativados.</div>` : ''}
  <div class="stats">
    <div class="panel stat"><span class="muted small">Revisões para hoje</span><strong>${due.length}</strong></div>
    <div class="panel stat"><span class="muted small">Próximos 7 dias</span><strong>${next7}</strong></div>
    <div class="panel stat"><span class="muted small">Tarefas de hoje</span><strong>${tasksDone}/${tasks.length}</strong></div>
  </div>
  ${!hasSubjects ? onboarding() : ''}
  <div class="grid-2">
    <section class="panel">
      <div class="panel-head"><h2>Revisões de hoje</h2>${due.length ? `<span class="badge danger">${due.length}</span>` : ''}</div>
      ${due.length ? `<div class="list">${due.map(reviewItem).join('')}</div>` : `<div class="empty">Nenhuma revisão pendente. Quando você marcar um assunto como "Já vi", as revisões aparecem aqui.</div>`}
    </section>
    <section class="panel">
      <div class="panel-head"><h2>Estudo de hoje</h2><button class="btn small" data-action="add-card" data-date="${t}">+ Adicionar</button></div>
      ${cards.length ? `<div class="list">${cards.map(cardMini).join('')}</div>` : `<div class="empty">Nada planejado para hoje. Monte a sua semana na aba Semana.</div>`}
    </section>
  </div>`;
}

function onboarding() {
  return `<section class="panel" style="margin-bottom:16px">
    <h2>Comece pela sua Fila</h2>
    <p class="muted">Cadastre as suas matérias. Se quiser, carregue a Fila sugerida do Sniper para ENEM e depois ajuste.</p>
    <div class="row"><button class="btn primary" data-action="load-enem">Carregar matérias do ENEM</button><button class="btn" data-action="new-subject">Cadastrar uma matéria</button></div>
  </section>`;
}

function reviewItem(t) {
  const s = subjectById(t.subjectId);
  const late = diffDays(t.review.due, today());
  return `<div class="item">
    <span class="dot" style="background:${esc(s?.color || '#999')}"></span>
    <div class="grow">
      <div class="title">${esc(t.name)}</div>
      <div class="meta">${esc(s?.name || 'Sem matéria')} · ${stepLabel(t.review)} · ${DIFFICULTY_LABEL[t.review.track]}
        ${late > 0 ? `<span class="badge warn">atrasada ${late} d</span>` : ''}
        ${t.status === 'treinar' ? `<span class="badge danger">treinar mais</span>` : ''}</div>
    </div>
    <button class="btn small primary" data-action="review" data-id="${t.id}">Registrar</button>
  </div>`;
}

function cardMini(c) {
  const s = subjectById(c.subjectId);
  const tasks = c.tasks || [];
  const done = tasks.filter((x) => x.done).length;
  return `<button class="study-card ${tasks.length && done === tasks.length ? 'done' : ''}" style="--card-color:${esc(s?.color || '#888')}" data-action="open-card" data-id="${c.id}">
    ${c.time ? `<div class="time">${esc(c.time)}</div>` : ''}
    <div class="name">${esc(s?.name || 'Matéria removida')}</div>
    <div class="sub">${tasks.length ? `${done}/${tasks.length} tarefas` : 'sem tarefas'}${c.note ? ' · ' + esc(c.note) : ''}</div>
  </button>`;
}

// ---------------- SEMANA ----------------
function renderWeek() {
  const start = ui.weekStart;
  const end = addDays(start, 6);
  const t = today();
  const days = [...Array(7)].map((_, i) => addDays(start, i));
  return `
  <div class="page-head">
    <div>
      <h1>Esta semana</h1>
      <p class="muted">${fmtDate(start)} – ${fmtDate(end)}</p>
    </div>
    <div class="row">
      <button class="btn icon" data-action="week" data-delta="-7" aria-label="Semana anterior">‹</button>
      <button class="btn" data-action="week" data-delta="0">Hoje</button>
      <button class="btn icon" data-action="week" data-delta="7" aria-label="Próxima semana">›</button>
      <button class="btn" data-action="copy-week" title="Copia os cartões da semana anterior para esta">Copiar semana anterior</button>
    </div>
  </div>
  ${!subjects().length ? `<div class="notice">Cadastre as suas matérias em "Matérias" para encaixá-las aqui.</div>` : ''}
  <div class="week">
    ${days
      .map((iso, i) => {
        const cards = cardsOn(iso);
        const rv = reviewsOn(iso).length + (iso === t ? reviewsDueBy(addDays(t, -1)).length : 0);
        return `<div class="day ${iso === t ? 'is-today' : ''}">
        <div class="day-head"><div class="dow">${DOW[i]}</div><div class="num">${fromISO(iso).getDate()}</div>
          ${rv ? `<div class="day-reviews"><span class="badge accent">${rv} revis${rv > 1 ? 'ões' : 'ão'}</span></div>` : ''}</div>
        <div class="day-body" data-drop="${iso}">
          ${cards.map((c) => cardMini(c).replace('<button class="study-card', `<button draggable="true" data-drag="${c.id}" class="study-card`)).join('')}
          ${!cards.length ? '<div class="dash">—</div>' : ''}
          <button class="add-card" data-action="add-card" data-date="${iso}">+ Matéria</button>
        </div>
      </div>`;
      })
      .join('')}
  </div>
  <p class="muted small">Arraste os cartões entre os dias para reorganizar. No celular, abra o cartão e mude o dia.</p>`;
}

function bindDrag() {
  app.querySelectorAll('[data-drag]').forEach((el) => {
    el.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', el.dataset.drag);
      e.dataTransfer.effectAllowed = 'move';
    });
  });
  app.querySelectorAll('[data-drop]').forEach((zone) => {
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('drop-target');
    });
    zone.addEventListener('dragleave', () => zone.classList.remove('drop-target'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('drop-target');
      const id = e.dataTransfer.getData('text/plain');
      const card = D().cards[id];
      if (!card) return;
      // posição: antes do cartão sobre o qual soltou, ou no fim
      const target = e.target.closest('[data-drag]');
      const list = cardsOn(zone.dataset.drop).filter((c) => c.id !== id);
      let idx = target ? list.findIndex((c) => c.id === target.dataset.drag) : list.length;
      if (idx < 0) idx = list.length;
      list.splice(idx, 0, card);
      list.forEach((c, i) => {
        const changed = c.order !== i || (c.id === id && c.date !== zone.dataset.drop);
        if (changed) store.put('cards', { ...c, date: zone.dataset.drop, order: i });
      });
    });
  });
}

function copyPreviousWeek() {
  const prevStart = addDays(ui.weekStart, -7);
  const prev = Object.values(D().cards).filter((c) => c.date >= prevStart && c.date < ui.weekStart);
  if (!prev.length) return toast('A semana anterior está vazia.');
  for (const c of prev) {
    store.put('cards', {
      subjectId: c.subjectId,
      date: addDays(c.date, 7),
      order: (c.order ?? 0) + 100,
      time: c.time || '',
      note: c.note || '',
      tasks: (c.tasks || []).map((t) => ({ id: store.uid(), text: t.text, done: false })),
    });
  }
  toast(`${prev.length} cartões copiados.`);
}

// ---------------- MATÉRIAS ----------------
function renderSubjects() {
  const list = subjects();
  return `
  <div class="page-head">
    <div><h1>Matérias</h1><p class="muted">Na ordem da sua Fila. A fase é calculada pelos assuntos já vistos.</p></div>
    <div class="row">${!list.length ? '<button class="btn" data-action="load-enem">Carregar matérias do ENEM</button>' : ''}<button class="btn primary" data-action="new-subject">+ Nova matéria</button></div>
  </div>
  ${
    list.length
      ? `<div class="subjects">${list
          .map((s) => {
            const tp = topicsOf(s.id);
            const seen = tp.filter((t) => t.status !== 'estudar').length;
            const pct = tp.length ? Math.round((seen / tp.length) * 100) : 0;
            const ph = subjectPhase(s);
            const due = tp.filter((t) => t.review && t.review.due <= today() && t.status !== 'estudar').length;
            return `<button class="subject-tile" style="--card-color:${esc(s.color)}" data-action="open-subject" data-id="${s.id}">
            <div class="row" style="justify-content:space-between"><span class="badge">${s.queue ?? '–'}º na Fila</span>${ph ? `<span class="badge accent">Fase ${ph}${s.phase ? '' : ''}</span>` : ''}</div>
            <h3>${esc(s.name)}</h3>
            <div class="progress"><span style="width:${pct}%"></span></div>
            <div class="muted small">${seen} de ${tp.length} assuntos vistos${due ? ` · <strong style="color:var(--danger)">${due} para revisar</strong>` : ''}</div>
          </button>`;
          })
          .join('')}</div>`
      : `<div class="empty">Nenhuma matéria ainda.</div>`
  }`;
}

function renderSubject(s) {
  const tp = topicsOf(s.id);
  const ph = subjectPhase(s);
  const col = (status) => {
    const items = tp.filter((t) => t.status === status);
    return `<div class="kcol"><h3>${STATUS[status]}<span class="badge">${items.length}</span></h3>
      ${items.map(topicCard).join('') || '<div class="muted small">Vazio</div>'}</div>`;
  };
  const isMath = /mat/i.test(s.name);
  return `
  <div class="page-head">
    <div>
      <button class="btn ghost small" data-action="back-subjects">‹ Matérias</button>
      <h1 style="margin-top:6px"><span class="dot" style="background:${esc(s.color)};width:14px;height:14px"></span> ${esc(s.name)}</h1>
      <p class="muted">${s.queue ?? '–'}º na Fila · ${ph ? `Fase ${ph}${s.phase ? ' (definida por você)' : ' (automática)'}` : 'Sem assuntos ainda'}</p>
    </div>
    <div class="row"><button class="btn" data-action="edit-subject" data-id="${s.id}">Editar matéria</button></div>
  </div>
  <section class="panel">
    <div class="panel-head"><h2>Lista Sniper</h2></div>
    <form class="row" data-form="topic" data-subject="${s.id}" style="margin-bottom:12px">
      <input type="text" name="name" placeholder="Novo assunto (ex.: Funções)" required style="flex:1;min-width:180px" />
      <button class="btn primary" type="submit">Adicionar</button>
      ${isMath && !tp.length ? `<button class="btn" type="button" data-action="load-math" data-id="${s.id}">Carregar assuntos (3 grupos Sniper)</button>` : ''}
    </form>
    <p class="muted small" style="margin-top:0">Quando estudar um assunto, mova para "Já vi" e escolha a dificuldade: as revisões começam sozinhas. Se errar muito numa revisão, ele vai para "Para treinar mais".</p>
    <div class="kanban">${col('estudar')}${col('visto')}${col('treinar')}</div>
  </section>`;
}

function topicCard(t) {
  const r = t.review;
  const last = r?.history?.length ? r.history[r.history.length - 1] : null;
  let meta = '';
  if (r && t.status !== 'estudar') {
    const late = diffDays(r.due, today());
    meta = `<div class="meta"><span class="badge">${DIFFICULTY_LABEL[r.track]}</span>
      <span class="badge ${late >= 0 ? 'danger' : ''}">${late > 0 ? `atrasada ${late} d` : late === 0 ? 'revisar hoje' : `revisão ${fmtDate(r.due)}`}</span>
      ${last ? `<span class="badge ${last.pct >= 80 ? 'ok' : last.pct >= 50 ? 'warn' : 'danger'}">último ${last.pct}%</span>` : ''}</div>`;
  } else if (t.group) {
    meta = `<div class="meta"><span class="badge">Grupo ${t.group}</span></div>`;
  }
  const moves = Object.keys(STATUS)
    .filter((k) => k !== t.status)
    .map((k) => `<button class="btn small" data-action="move-topic" data-id="${t.id}" data-to="${k}">→ ${STATUS[k]}</button>`)
    .join('');
  return `<div class="topic">
    <div class="title">${esc(t.name)}</div>${meta}
    <div class="actions">${moves}
      ${r && t.status !== 'estudar' ? `<button class="btn small" data-action="review" data-id="${t.id}">Revisar</button>` : ''}
      <button class="btn small ghost danger" data-action="del-topic" data-id="${t.id}" aria-label="Excluir">✕</button></div>
  </div>`;
}

// ---------------- AJUSTES ----------------
function renderSettings() {
  const s = D().settings;
  return `
  <div class="page-head"><div><h1>Ajustes</h1></div></div>
  <section class="panel">
    <h2 style="margin-bottom:12px">Prova</h2>
    <form class="form-grid" data-form="settings">
      <label class="field">Nome da prova<input type="text" name="examName" value="${esc(s.examName)}" /></label>
      <label class="field">Data da prova<input type="date" name="examDate" value="${esc(s.examDate)}" /></label>
      <label class="field">Máximo de revisões por dia<input type="number" name="maxPerDay" min="1" max="200" value="${esc(s.maxPerDay)}" /></label>
      <div class="full"><button class="btn primary" type="submit">Salvar</button></div>
    </form>
    <p class="muted small">A data do ENEM 2027 ainda não foi divulgada; 07/11/2027 é uma estimativa. Perto da prova, as revisões são puxadas para no máximo 3 dias antes dela.</p>
  </section>
  <section class="panel">
    <h2 style="margin-bottom:8px">Como as revisões funcionam</h2>
    <p class="muted small" style="margin-top:0">Cada número é o intervalo em dias até a próxima revisão.</p>
    <div class="list">
      ${Object.entries(TRACKS).map(([k, v]) => `<div class="item"><strong style="width:70px">${DIFFICULTY_LABEL[k]}</strong><span class="grow">${v.join(', ')} → manutenção a cada 75 dias</span></div>`).join('')}
    </div>
    <p class="muted small">Em cada revisão você registra os acertos. Abaixo de 50%: volta para o início e vai para "Para treinar mais". De 50 a 79%: repete o intervalo. De 80 a 89%: avança. 90% ou mais: pula um intervalo.</p>
  </section>
  <section class="panel">
    <h2 style="margin-bottom:12px">Aparência e dados</h2>
    <div class="row">
      <button class="btn" data-action="theme">Tema: ${currentTheme() === 'dark' ? 'escuro' : 'claro'}</button>
      <button class="btn" data-action="export">Exportar backup</button>
      <label class="btn">Importar backup<input type="file" accept="application/json" data-action="import" hidden /></label>
    </div>
  </section>
  <section class="panel">
    <h2 style="margin-bottom:12px">Conta</h2>
    ${
      store.mode() === 'firebase'
        ? `<p class="muted" style="margin-top:0">Conectado como ${esc(ui.user?.email || ui.user?.displayName || '')}. Seus dados sincronizam entre aparelhos.</p><button class="btn danger" data-action="logout">Sair</button>`
        : `<p class="muted" style="margin-top:0">Modo local: os dados ficam só neste navegador. Para login e sincronização, preencha <code>js/firebase-config.js</code>.</p>`
    }
  </section>`;
}

// ---------------- modais ----------------
function openModal(html) {
  const wasOpen = Boolean(modalRoot.innerHTML);
  const scroll = modalRoot.querySelector('.modal-backdrop')?.scrollTop || 0;
  modalRoot.innerHTML = `<div class="modal-backdrop" data-action="close-modal-bg"><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`;
  if (wasOpen) {
    // re-desenho do mesmo modal: mantém a rolagem e não abre o teclado
    modalRoot.querySelector('.modal-backdrop').scrollTop = scroll;
    return;
  }
  const first = modalRoot.querySelector('input:not([type="date"]):not([type="checkbox"]), select, textarea');
  if (first && matchMedia('(min-width: 721px)').matches) first.focus();
}
function closeModal() {
  modalRoot.innerHTML = '';
  modalCtx = null;
}
let modalCtx = null;

function subjectForm(s = {}) {
  const isNew = !s.id;
  const color = s.color || PALETTE[subjects().length % PALETTE.length];
  modalCtx = { type: 'subject', id: s.id };
  openModal(`
    <div class="modal-head"><h2>${isNew ? 'Nova matéria' : 'Editar matéria'}</h2><button class="btn icon ghost" data-action="close-modal" aria-label="Fechar">✕</button></div>
    <form class="form-grid" data-form="subject">
      <label class="field full">Nome<input type="text" name="name" value="${esc(s.name || '')}" required /></label>
      <label class="field">Posição na Fila<input type="number" name="queue" min="1" value="${esc(s.queue ?? subjects().length + 1)}" /></label>
      <label class="field">Cor<input type="color" name="color" value="${esc(color)}" /></label>
      <label class="field full">Fase
        <select name="phase">
          <option value="">Automática (pelos assuntos vistos)</option>
          ${[1, 2, 3].map((p) => `<option value="${p}" ${String(s.phase) === String(p) ? 'selected' : ''}>Fase ${p}</option>`).join('')}
        </select></label>
      <div class="full modal-foot" style="margin-top:4px">
        ${isNew ? '<span></span>' : `<button type="button" class="btn danger" data-action="del-subject" data-id="${s.id}">Excluir matéria</button>`}
        <button class="btn primary" type="submit">Salvar</button>
      </div>
    </form>`);
}

function addCardForm(date) {
  const list = subjects();
  if (!list.length) {
    toast('Cadastre uma matéria primeiro.');
    ui.view = 'materias';
    render();
    return;
  }
  modalCtx = { type: 'new-card', date };
  openModal(`
    <div class="modal-head"><h2>Encaixar matéria · ${fmtDate(date, { weekday: 'short', day: 'numeric', month: 'short' })}</h2><button class="btn icon ghost" data-action="close-modal" aria-label="Fechar">✕</button></div>
    <form class="form-grid" data-form="new-card">
      <label class="field full">Matéria<select name="subjectId" required>${list.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></label>
      <label class="field">Horário (opcional)<input type="text" name="time" placeholder="ex.: 14:00–16:00" /></label>
      <label class="field">Observação (opcional)<input type="text" name="note" placeholder="ex.: Funções" /></label>
      <label class="field full" style="flex-direction:row;align-items:center;gap:8px;color:var(--text)"><input type="checkbox" name="suggest" checked /> Já criar as tarefas sugeridas para a fase da matéria</label>
      <div class="full modal-foot" style="margin-top:4px"><span></span><button class="btn primary" type="submit">Adicionar</button></div>
    </form>`);
}

function cardModal(id) {
  const c = D().cards[id];
  if (!c) return closeModal();
  const s = subjectById(c.subjectId);
  modalCtx = { type: 'card', id };
  const tasks = c.tasks || [];
  openModal(`
    <div class="modal-head">
      <h2><span class="dot" style="background:${esc(s?.color || '#888')}"></span> ${esc(s?.name || 'Matéria removida')}</h2>
      <button class="btn icon ghost" data-action="close-modal" aria-label="Fechar">✕</button>
    </div>
    <div class="form-grid">
      <label class="field">Dia<input type="date" data-card-field="date" value="${esc(c.date)}" /></label>
      <label class="field">Horário (opcional)<input type="text" data-card-field="time" value="${esc(c.time || '')}" placeholder="ex.: 14:00–16:00" /></label>
      <label class="field full">Observação<input type="text" data-card-field="note" value="${esc(c.note || '')}" /></label>
    </div>
    <h3 style="margin-top:18px">Tarefas</h3>
    <ul class="tasks">
      ${tasks.map((t) => `<li class="${t.done ? 'done' : ''}"><input type="checkbox" data-action="toggle-task" data-task="${t.id}" ${t.done ? 'checked' : ''} aria-label="Concluir" /><span>${esc(t.text)}</span><button class="btn icon ghost small" data-action="del-task" data-task="${t.id}" aria-label="Excluir tarefa">✕</button></li>`).join('') || '<li class="muted">Nenhuma tarefa.</li>'}
    </ul>
    <form class="row" data-form="task"><input type="text" name="text" placeholder="Nova tarefa" required style="flex:1;min-width:160px" /><button class="btn" type="submit">Adicionar</button></form>
    <div class="row" style="margin-top:8px"><button class="btn small" data-action="suggest-tasks">+ Tarefas da fase ${subjectPhase(s || {}) || 1}</button></div>
    <div class="modal-foot">
      <div class="row">
        <button class="btn small" data-action="card-move" data-delta="-1" title="Subir no dia">↑</button>
        <button class="btn small" data-action="card-move" data-delta="1" title="Descer no dia">↓</button>
        <button class="btn small danger" data-action="del-card">Excluir cartão</button>
      </div>
      <button class="btn primary" data-action="close-modal">Pronto</button>
    </div>`);
}

function reviewModal(id) {
  const t = D().topics[id];
  if (!t?.review) return;
  const s = subjectById(t.subjectId);
  modalCtx = { type: 'review', id };
  const hist = (t.review.history || []).slice(-5).reverse();
  openModal(`
    <div class="modal-head"><h2>Revisar: ${esc(t.name)}</h2><button class="btn icon ghost" data-action="close-modal" aria-label="Fechar">✕</button></div>
    <p class="muted" style="margin-top:0">${esc(s?.name || '')} · ${stepLabel(t.review)} · ${DIFFICULTY_LABEL[t.review.track]}</p>
    <p class="small" style="margin-top:0">Resolva um bloco de questões desse assunto e registre quantas acertou.</p>
    <form class="form-grid" data-form="review">
      <label class="field">Acertos<input type="number" name="correct" min="0" value="" required /></label>
      <label class="field">Questões feitas<input type="number" name="total" min="1" value="10" required /></label>
      <div class="full result-preview" id="review-preview">Preencha os acertos para ver o que acontece.</div>
      ${hist.length ? `<div class="full muted small">Últimas: ${hist.map((h) => `${fmtDate(h.date)} ${h.pct}%`).join(' · ')}</div>` : ''}
      <div class="full modal-foot" style="margin-top:4px"><span></span><button class="btn primary" type="submit">Registrar revisão</button></div>
    </form>`);
}

function updateReviewPreview(form) {
  const t = D().topics[modalCtx?.id];
  const correct = Number(form.correct.value);
  const total = Number(form.total.value);
  const el = document.getElementById('review-preview');
  if (!el || !t) return;
  if (form.correct.value === '' || !total) return (el.textContent = 'Preencha os acertos para ver o que acontece.');
  if (correct > total) return (el.textContent = 'Os acertos não podem passar do total.');
  const res = applyResult(t.review, correct, total, scheduleOpts());
  el.innerHTML = `<strong>${res.pct}%</strong> · ${OUTCOME_LABEL[res.action]}. Próxima revisão: <strong>${fmtDate(res.review.due, { weekday: 'short', day: 'numeric', month: 'short' })}</strong>.`;
}

function scheduleOpts() {
  const s = D().settings;
  const counts = {};
  for (const t of Object.values(D().topics)) if (t.review && t.status !== 'estudar') counts[t.review.due] = (counts[t.review.due] || 0) + 1;
  return { examDate: s.examDate, maxPerDay: Number(s.maxPerDay) || 0, load: (iso) => counts[iso] || 0 };
}

function difficultyModal(id) {
  const t = D().topics[id];
  modalCtx = { type: 'difficulty', id };
  openModal(`
    <div class="modal-head"><h2>Qual a dificuldade de "${esc(t.name)}"?</h2><button class="btn icon ghost" data-action="close-modal" aria-label="Fechar">✕</button></div>
    <p class="muted" style="margin-top:0">Define a trilha de revisões. Você pode ajustar depois pelo desempenho.</p>
    <div class="list">
      ${Object.entries(TRACKS).map(([k, v]) => `<button class="item btn" style="justify-content:flex-start" data-action="set-difficulty" data-level="${k}"><strong style="width:70px">${DIFFICULTY_LABEL[k]}</strong><span class="muted small">${v.join(', ')} dias</span></button>`).join('')}
    </div>`);
}

// ---------------- ações ----------------
function loadEnem() {
  const existing = new Set(subjects().map((s) => s.name.toLowerCase()));
  ENEM_SUBJECTS.forEach((name, i) => {
    if (!existing.has(name.toLowerCase())) store.put('subjects', { name, queue: i + 1, color: PALETTE[i % PALETTE.length], createdAt: Date.now() });
  });
  toast('Matérias carregadas. Ajuste a ordem da Fila se precisar.');
}

function loadMath(subjectId) {
  let order = 0;
  MATH_TOPICS.forEach((g) => g.topics.forEach((name) => store.put('topics', { subjectId, name, status: 'estudar', group: g.group, order: order++, createdAt: Date.now() })));
  toast('Assuntos de Matemática carregados na ordem dos 3 grupos.');
}

function moveTopic(id, to) {
  const t = D().topics[id];
  if (!t) return;
  if (to === 'visto' && !t.review) return difficultyModal(id);
  const next = { ...t, status: to };
  if (to === 'estudar') delete next.review;
  store.put('topics', next);
}

function phaseTasks(subject) {
  const ph = subjectPhase(subject || {}) || 1;
  return PHASE_TASKS[ph].map((text) => ({ id: store.uid(), text, done: false }));
}

const actions = {
  nav: (el) => {
    ui.view = el.dataset.view;
    if (ui.view !== 'materias') ui.subjectId = null;
    render();
    window.scrollTo(0, 0);
  },
  theme: toggleTheme,
  google: async () => {
    try {
      await store.loginGoogle();
    } catch (e) {
      const err = document.getElementById('auth-error');
      if (err) err.textContent = store.authErrorMessage(e);
    }
  },
  'auth-mode': (el) => {
    ui.authMode = el.dataset.mode;
    render();
  },
  logout: () => store.logout(),
  week: (el) => {
    const d = Number(el.dataset.delta);
    ui.weekStart = d === 0 ? mondayOf(today()) : addDays(ui.weekStart, d);
    render();
  },
  'copy-week': copyPreviousWeek,
  'add-card': (el) => addCardForm(el.dataset.date),
  'open-card': (el) => cardModal(el.dataset.id),
  'new-subject': () => subjectForm(),
  'edit-subject': (el) => subjectForm(subjectById(el.dataset.id)),
  'open-subject': (el) => {
    ui.subjectId = el.dataset.id;
    render();
    window.scrollTo(0, 0);
  },
  'back-subjects': () => {
    ui.subjectId = null;
    render();
  },
  'del-subject': (el) => {
    const id = el.dataset.id;
    const n = topicsOf(id).length;
    if (!confirm(`Excluir esta matéria${n ? ` e os seus ${n} assuntos` : ''}? Os cartões do calendário também saem.`)) return;
    topicsOf(id).forEach((t) => store.remove('topics', t.id));
    Object.values(D().cards).filter((c) => c.subjectId === id).forEach((c) => store.remove('cards', c.id));
    store.remove('subjects', id);
    ui.subjectId = null;
    closeModal();
  },
  'load-enem': loadEnem,
  'load-math': (el) => loadMath(el.dataset.id),
  'move-topic': (el) => moveTopic(el.dataset.id, el.dataset.to),
  'del-topic': (el) => {
    if (confirm('Excluir este assunto e o histórico de revisões dele?')) store.remove('topics', el.dataset.id);
  },
  'set-difficulty': (el) => {
    const t = D().topics[modalCtx.id];
    const review = startReview(el.dataset.level);
    store.put('topics', { ...t, status: 'visto', review });
    closeModal();
    toast(`Primeira revisão em ${fmtDate(review.due, { weekday: 'short', day: 'numeric', month: 'short' })}.`);
  },
  review: (el) => reviewModal(el.dataset.id),
  'toggle-task': (el) => {
    const c = D().cards[modalCtx.id];
    store.put('cards', { ...c, tasks: c.tasks.map((t) => (t.id === el.dataset.task ? { ...t, done: el.checked } : t)) });
    cardModal(c.id);
  },
  'del-task': (el) => {
    const c = D().cards[modalCtx.id];
    store.put('cards', { ...c, tasks: c.tasks.filter((t) => t.id !== el.dataset.task) });
    cardModal(c.id);
  },
  'suggest-tasks': () => {
    const c = D().cards[modalCtx.id];
    const have = new Set((c.tasks || []).map((t) => t.text));
    const add = phaseTasks(subjectById(c.subjectId)).filter((t) => !have.has(t.text));
    store.put('cards', { ...c, tasks: [...(c.tasks || []), ...add] });
    cardModal(c.id);
  },
  'card-move': (el) => {
    const c = D().cards[modalCtx.id];
    const list = cardsOn(c.date);
    const i = list.findIndex((x) => x.id === c.id);
    const j = i + Number(el.dataset.delta);
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    list.forEach((x, k) => x.order !== k && store.put('cards', { ...x, order: k }));
    toast('Ordem atualizada.');
  },
  'del-card': () => {
    if (!confirm('Excluir este cartão e as tarefas dele?')) return;
    store.remove('cards', modalCtx.id);
    closeModal();
  },
  'close-modal': closeModal,
  'close-modal-bg': (el, e) => {
    if (e.target === el) closeModal();
  },
  export: () => {
    const blob = new Blob([store.exportJSON()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `plataforma-estudos-${today()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  },
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || el.tagName === 'INPUT' && el.type === 'file') return;
  const fn = actions[el.dataset.action];
  if (!fn) return;
  if (el.dataset.action !== 'close-modal-bg') e.preventDefault();
  if (el.dataset.action === 'toggle-task') {
    // checkbox: deixa o navegador marcar antes de ler
    setTimeout(() => fn(el, e));
    return;
  }
  fn(el, e);
});

document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.dataset.action === 'import' && el.files[0]) {
    el.files[0].text().then((txt) => {
      try {
        store.importJSON(txt);
        toast('Backup importado.');
      } catch {
        toast('Arquivo de backup inválido.');
      }
    });
  }
  if (el.dataset.cardField && modalCtx?.type === 'card') {
    const c = D().cards[modalCtx.id];
    const patch = { [el.dataset.cardField]: el.value };
    if (el.dataset.cardField === 'date') {
      if (!el.value) return;
      patch.order = cardsOn(el.value).length;
    }
    store.put('cards', { ...c, ...patch });
    if (el.dataset.cardField === 'date') toast(`Movido para ${fmtDate(el.value, { weekday: 'short', day: 'numeric', month: 'short' })}.`);
  }
});

document.addEventListener('input', (e) => {
  const form = e.target.closest('[data-form="review"]');
  if (form) updateReviewPreview(form);
});

document.addEventListener('submit', (e) => {
  const form = e.target.closest('[data-form]');
  if (!form) return;
  e.preventDefault();
  const f = new FormData(form);
  switch (form.dataset.form) {
    case 'auth':
      return submitAuth(form);
    case 'subject': {
      const old = modalCtx.id ? D().subjects[modalCtx.id] : { createdAt: Date.now() };
      store.put('subjects', {
        ...old,
        name: f.get('name').trim(),
        queue: Number(f.get('queue')) || null,
        color: f.get('color'),
        phase: f.get('phase') ? Number(f.get('phase')) : null,
      });
      closeModal();
      return;
    }
    case 'topic': {
      const name = f.get('name').trim();
      if (!name) return;
      store.put('topics', { subjectId: form.dataset.subject, name, status: 'estudar', order: Date.now(), createdAt: Date.now() });
      form.reset();
      form.querySelector('input').focus();
      return;
    }
    case 'new-card': {
      const sid = f.get('subjectId');
      const date = modalCtx.date;
      store.put('cards', {
        subjectId: sid,
        date,
        order: cardsOn(date).length,
        time: f.get('time').trim(),
        note: f.get('note').trim(),
        tasks: f.get('suggest') ? phaseTasks(subjectById(sid)) : [],
      });
      closeModal();
      return;
    }
    case 'task': {
      const c = D().cards[modalCtx.id];
      const text = f.get('text').trim();
      if (!text) return;
      store.put('cards', { ...c, tasks: [...(c.tasks || []), { id: store.uid(), text, done: false }] });
      cardModal(c.id);
      document.querySelector('[data-form="task"] input')?.focus();
      return;
    }
    case 'review': {
      const t = D().topics[modalCtx.id];
      const correct = Number(f.get('correct'));
      const total = Number(f.get('total'));
      if (!total || correct > total || correct < 0) return toast('Confira os números.');
      const res = applyResult(t.review, correct, total, scheduleOpts());
      store.put('topics', { ...t, review: res.review, status: res.moveToTrain ? 'treinar' : t.status });
      closeModal();
      toast(`${res.pct}% · próxima revisão ${fmtDate(res.review.due, { weekday: 'short', day: 'numeric', month: 'short' })}.`);
      return;
    }
    case 'settings':
      store.setSettings({ examName: f.get('examName').trim(), examDate: f.get('examDate'), maxPerDay: Number(f.get('maxPerDay')) || 15 });
      toast('Ajustes salvos.');
      return;
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modalRoot.innerHTML) closeModal();
});

window.addEventListener('store-error', () => toast('Não foi possível salvar. Confira a conexão.'));

// Re-renderiza quando os dados mudam (inclusive vindos de outro aparelho).
store.onChange(() => {
  render();
  if (modalCtx?.type === 'card' && D().cards[modalCtx.id] === undefined) closeModal();
});

store
  .init(({ user }) => {
    ui.user = user;
    ui.ready = true;
    render();
  })
  .catch((e) => {
    console.error(e);
    app.innerHTML = `<div class="boot">Não foi possível iniciar. Recarregue a página.</div>`;
  });
