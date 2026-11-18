import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startReview, applyResult, outcome, phaseFromTopics, fitDue, addDays } from '../js/srs.js';

const ON = '2026-11-18';

test('primeira revisão segue a trilha', () => {
  assert.equal(startReview('medio', ON).due, '2026-11-19');
  assert.equal(startReview('facil', ON).due, '2026-11-21');
  assert.equal(startReview('dificil', ON).due, '2026-11-19');
  assert.equal(startReview('xyz', ON).track, 'medio');
});

test('faixas de acerto', () => {
  assert.equal(outcome(49), 'reiniciar');
  assert.equal(outcome(50), 'repetir');
  assert.equal(outcome(79), 'repetir');
  assert.equal(outcome(80), 'avancar');
  assert.equal(outcome(90), 'pular');
});

test('avançar, repetir, pular e reiniciar', () => {
  const r0 = { track: 'medio', step: 0, due: ON, history: [] };
  let r = applyResult(r0, 8, 10, { on: ON });
  assert.equal(r.review.step, 1);
  assert.equal(r.review.due, addDays(ON, 3));
  r = applyResult(r.review, 6, 10, { on: ON });
  assert.equal(r.review.step, 1);
  assert.equal(r.review.due, addDays(ON, 3));
  r = applyResult(r.review, 10, 10, { on: ON });
  assert.equal(r.review.step, 3);
  assert.equal(r.review.due, addDays(ON, 21));
  r = applyResult(r.review, 2, 10, { on: ON });
  assert.equal(r.review.step, 0);
  assert.equal(r.review.due, addDays(ON, 1));
  assert.equal(r.moveToTrain, true);
  assert.equal(r.review.history.length, 4);
});

test('depois da trilha entra em manutenção', () => {
  const r = applyResult({ track: 'facil', step: 4, due: ON, history: [] }, 9, 10, { on: ON });
  assert.equal(r.review.due, addDays(ON, 75));
});

test('não passa de 3 dias antes da prova', () => {
  assert.equal(fitDue('2027-12-01', ON, { examDate: '2027-11-07' }), '2027-11-04');
});

test('limite diário empurra para o dia seguinte', () => {
  const load = (iso) => (iso === '2026-11-20' ? 15 : 0);
  assert.equal(fitDue('2026-11-20', ON, { load, maxPerDay: 15 }), '2026-11-21');
});

test('fase pela porcentagem de assuntos vistos', () => {
  const mk = (seen, total) => [...Array(total)].map((_, i) => ({ status: i < seen ? 'visto' : 'estudar' }));
  assert.equal(phaseFromTopics(mk(5, 10)), 1);
  assert.equal(phaseFromTopics(mk(6, 10)), 2);
  assert.equal(phaseFromTopics(mk(8, 10)), 3);
  assert.equal(phaseFromTopics([]), null);
});
