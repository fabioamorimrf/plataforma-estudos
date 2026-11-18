// Revisão espaçada (método Sniper + trilhas por dificuldade).
// Os números de cada trilha são o intervalo, em dias, desde a revisão anterior.

export const TRACKS = {
  dificil: [1, 2, 4, 7, 14, 21, 30, 45, 60],
  medio: [1, 3, 7, 21, 30, 45, 60],
  facil: [3, 7, 21, 45, 60],
};

export const DIFFICULTY_LABEL = { facil: 'Fácil', medio: 'Médio', dificil: 'Difícil' };

// Depois da última etapa da trilha, o assunto entra em manutenção.
export const MAINTENANCE_DAYS = 75;

// ---- datas no formato 'AAAA-MM-DD' (horário local) ----
export function toISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
export function fromISO(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(iso, n) {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}
export function today() {
  return toISO(new Date());
}
export function diffDays(a, b) {
  // b - a, em dias
  return Math.round((fromISO(b) - fromISO(a)) / 86400000);
}

function intervalFor(track, step) {
  const t = TRACKS[track] || TRACKS.medio;
  return step < t.length ? t[step] : MAINTENANCE_DAYS;
}

// Cria o estado de revisão quando o assunto passa para "Já vi".
export function startReview(difficulty, studiedOn = today()) {
  const track = TRACKS[difficulty] ? difficulty : 'medio';
  return { track, step: 0, due: addDays(studiedOn, intervalFor(track, 0)), history: [] };
}

// Decide o que acontece a partir do percentual de acerto.
export function outcome(pct) {
  if (pct < 50) return 'reiniciar';
  if (pct < 80) return 'repetir';
  if (pct < 90) return 'avancar';
  return 'pular';
}

export const OUTCOME_LABEL = {
  reiniciar: 'Volta para o início e vai para "Para treinar mais"',
  repetir: 'Repete o mesmo intervalo',
  avancar: 'Avança para o próximo intervalo',
  pular: 'Pula um intervalo',
};

/**
 * Aplica o resultado de uma revisão.
 * opts.examDate: data da prova; revisões não passam de 3 dias antes dela.
 * opts.load: função (iso) => quantas revisões já existem nesse dia.
 * opts.maxPerDay: limite por dia; se lotado, empurra até 2 dias.
 * Retorna { review, action, moveToTrain }.
 */
export function applyResult(review, correct, total, opts = {}) {
  const on = opts.on || today();
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  const action = outcome(pct);
  let step = review.step;
  let interval;
  if (action === 'reiniciar') {
    step = 0;
    interval = 1;
  } else if (action === 'repetir') {
    interval = intervalFor(review.track, step);
  } else {
    step = step + (action === 'pular' ? 2 : 1);
    interval = intervalFor(review.track, step);
  }
  let due = addDays(on, interval);
  due = fitDue(due, on, opts);
  return {
    review: {
      ...review,
      step,
      due,
      history: [...(review.history || []), { date: on, correct, total, pct }],
    },
    action,
    pct,
    moveToTrain: action === 'reiniciar',
  };
}

// Ajusta a data pela proximidade da prova e pelo limite diário.
export function fitDue(due, on, { examDate, load, maxPerDay } = {}) {
  if (examDate && diffDays(on, examDate) > 3) {
    const limit = addDays(examDate, -3);
    if (due > limit) due = limit;
  }
  if (load && maxPerDay) {
    for (let i = 0; i < 3; i++) {
      const candidate = addDays(due, i);
      if (load(candidate) < maxPerDay) return candidate;
    }
  }
  return due;
}

export function stepLabel(review) {
  const t = TRACKS[review.track] || TRACKS.medio;
  if (review.step >= t.length) return 'Manutenção';
  return `Etapa ${review.step + 1} de ${t.length} (${t[review.step]} d)`;
}

// Fase da matéria pelo percentual de assuntos já vistos (planner 4F).
export function phaseFromTopics(topics) {
  if (!topics.length) return null;
  const seen = topics.filter((t) => t.status !== 'estudar').length;
  const pct = (seen / topics.length) * 100;
  if (pct >= 80) return 3;
  if (pct >= 60) return 2;
  return 1;
}
