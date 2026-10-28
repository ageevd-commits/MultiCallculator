import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { sumAmounts, compare, summarize } from '../plan-fact/economics.js';
import { validateData } from '../plan-fact/data-source.js';

const data = validateData(JSON.parse(await readFile(new URL('../plan-fact/demo-data.json', import.meta.url), 'utf8')));
let passed = 0;
function test(name, fn) { fn(); passed++; console.log(`PASS ${name}`); }
test('completed object totals and percentage', () => {
  const result = summarize(data.objects[0], data.entries);
  assert.equal(result.rows.length, 5);
  assert.deepEqual(result.total, { plan: 550000, fact: 590000, delta: 40000, percent: 40000 / 550000 * 100 });
});
test('unknown amount blocks full total, keeps known categories', () => {
  const result = summarize(data.objects[1], data.entries);
  assert.equal(result.total.plan, 380000);
  assert.equal(result.total.fact, null);
  assert.equal(result.total.delta, null);
  assert.equal(result.rows[0].fact, 125000);
  assert.equal(result.rows[1].fact, null);
});
test('absent rows are unknown, explicit zero remains zero', () => {
  assert.equal(sumAmounts([]), null);
  assert.equal(sumAmounts([{ amount: null }]), null);
  assert.equal(sumAmounts([{ amount: undefined }]), null);
  assert.equal(sumAmounts([{ amount: 10 }, { amount: null }]), null);
  assert.equal(sumAmounts([{ amount: 0 }]), 0);
  assert.equal(summarize(data.objects[2], data.entries).total.fact, null);
});
test('zero plan never yields infinite percentage', () => {
  assert.deepEqual(compare(0, 5000), { delta: 5000, percent: null });
  assert.deepEqual(compare(0, 0), { delta: 0, percent: null });
  assert.equal(summarize(data.objects[1], data.entries).rows[4].percent, null);
});
test('underspend, equality and decimal precision', () => {
  assert.deepEqual(compare(100, 80), { delta: -20, percent: -20 });
  assert.deepEqual(compare(100, 100), { delta: 0, percent: 0 });
  assert.equal(sumAmounts([{ amount: 0.1 }, { amount: 0.2 }]), 0.3);
});
test('VAT mismatch blocks comparison', () => {
  const entries = structuredClone(data.entries); entries[0].vat_basis = 'gross';
  const result = summarize(data.objects[0], entries);
  assert.equal(result.basisValid, false);
  assert.equal(result.total.plan, null); assert.equal(result.total.fact, null);
});
test('forecasts cannot inflate confirmed FACT', () => {
  const entries = [...data.entries, { ...data.entries[5], entry_id: 'forecast', amount: 999999, approval: 'forecast' }];
  const result = summarize(data.objects[0], entries);
  assert.equal(result.total.fact, 590000); assert.equal(result.excludedCount, 1);
});
test('invalid data and duplicate identifiers are rejected', () => {
  assert.throws(() => validateData({ ...data, demo: false }));
  assert.throws(() => validateData({ ...data, entries: [...data.entries, data.entries[0]] }));
  assert.throws(() => validateData({ ...data, entries: [{ ...data.entries[0], amount: '10' }] }));
  assert.throws(() => validateData({ ...data, entries: [{ ...data.entries[0], amount: -1 }] }));
});

// Lightweight DOM harness exercises the actual app initialization/change handler.
// This harness checks rendered content, not browser layout or native disclosure behavior.
class Element {
  constructor(tag) { this.tag = tag; this.children = []; this.textContent = ''; this.hidden = true; this.listeners = {}; this._value = ''; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  addEventListener(name, handler) { this.listeners[name] = handler; }
  get value() { return this._value || this.children[0]?.value || ''; }
  set value(value) { this._value = value; }
}
const html = await readFile(new URL('../plan-fact/index.html', import.meta.url), 'utf8');
const dom = new Map([...html.matchAll(/id="([^"]+)"/g)].map(match => [match[1], new Element(match[1])]));
globalThis.document = { getElementById: id => { assert.ok(dom.has(id), `DOM id exists: ${id}`); return dom.get(id); }, createElement: tag => new Element(tag) };
globalThis.fetch = async () => ({ ok: true, json: async () => structuredClone(data) });
const { recordCount } = await import('../plan-fact/app.js');
function allText(node) { return [node.textContent, ...node.children.map(allText)].join(' '); }
test('app loads and renders completed object', () => {
  assert.equal(dom.get('dashboard').hidden, false);
  assert.equal(dom.get('error').hidden, true);
  assert.equal(dom.get('objectSelect').children.length, 3);
  assert.equal(dom.get('objectName').textContent, data.objects[0].name);
  assert.equal(dom.get('costRows').children.length, 5);
  assert.equal(dom.get('details').children.length, 5);
});
test('object selection updates title, warnings, amounts and details', () => {
  const select = dom.get('objectSelect');
  select.value = 'DEMO-002'; select.listeners.change();
  assert.equal(dom.get('objectName').textContent, data.objects[1].name);
  assert.ok(dom.get('warnings').children.some(e => e.textContent.includes('FACT')));
  assert.equal(dom.get('metrics').children[1].children[1].textContent.replace(/\s/g, ''), '183000');
  assert.match(dom.get('metrics').children[1].children[0].textContent, /частичный/);
  assert.match(allText(dom.get('costTotal')), /Нет данных/);
  select.value = 'DEMO-003'; select.listeners.change();
  assert.equal(dom.get('metrics').children[0].children[1].textContent, '0');
  assert.match(allText(dom.get('metrics').children[0]), /Утверждённый нулевой/);
  assert.match(allText(dom.get('warnings')), /Демонстрационный сценарий/);
  assert.match(allText(dom.get('warnings')), /FACT отсутствует/);
  assert.equal(dom.get('metrics').children[1].children[1].textContent, 'Нет данных');
  select.value = 'DEMO-001'; select.listeners.change();
  assert.equal(dom.get('warnings').children.length, 0);
  assert.equal(dom.get('metrics').children[1].children[1].textContent.replace(/\s/g, ''), '590000');
});
test('approved zero, draft and missing budgets remain distinct', () => {
  const gamma = data.objects[2];
  assert.equal(summarize(gamma, data.entries).planState, 'approved_zero');
  for (const state of ['draft', 'missing']) {
    const result = summarize({ ...gamma, budget_status: state }, data.entries);
    assert.equal(result.planState, state);
    assert.equal(result.total.plan, null);
    assert.equal(result.total.delta, null);
    assert.ok(result.rows.every(row => row.plan === null));
  }
  const result = summarize(gamma, []);
  assert.equal(result.planState, 'incomplete');
  assert.equal(result.total.plan, null);
});
test('FACT distinguishes absent, partial and complete including explicit zero', () => {
  assert.equal(summarize(data.objects[0], data.entries).factState, 'complete');
  const beta = summarize(data.objects[1], data.entries);
  assert.equal(beta.factState, 'partial'); assert.equal(beta.knownFact, 183000);
  assert.equal(summarize(data.objects[2], data.entries).factState, 'absent');
  const zero = { ...data.entries[5], amount: 0 };
  const result = summarize({ ...data.objects[0], status: 'in_progress' }, [zero]);
  assert.equal(result.factState, 'partial'); assert.equal(result.knownFact, 0);
  assert.equal(result.total.fact, null);
  assert.equal(summarize(data.objects[0], [{ ...zero, amount: null }]).factState, 'absent');
});
test('known partial sum survives unknown entry in the same category', () => {
  const result = summarize(data.objects[0], [...data.entries, { ...data.entries[5], entry_id: 'unknown', amount: null }]);
  assert.equal(result.knownFact, 590000);
  assert.equal(result.total.fact, null);
  assert.equal(result.rows[0].fact, null);
  assert.equal(result.factState, 'partial');
});
test('Russian record declension includes teens and compound numbers', () => {
  for (const [n, expected] of [[0,'0 записей'],[1,'1 запись'],[2,'2 записи'],[5,'5 записей'],[11,'11 записей'],[12,'12 записей'],[21,'21 запись'],[22,'22 записи'],[25,'25 записей'],[111,'111 записей']]) assert.equal(recordCount(n), expected);
});
test('disclosure content includes amounts, dates, record types and sources', () => {
  const details = dom.get('details').children[0];
  assert.equal(details.tag, 'details');
  assert.equal(details.children[0].tag, 'summary');
  assert.match(details.children[0].textContent, /2 записи/);
  const text = allText(details);
  assert.match(text.replace(/\s/g, ''), /300000/);
  assert.match(text.replace(/\s/g, ''), /330000/);
  assert.match(text, /Тип записи: PLAN/); assert.match(text, /Тип записи: FACT/);
  assert.match(text, /2026-10-01/); assert.match(text, /2026-10-27/);
  assert.ok(text.includes(data.entries[0].source)); assert.ok(text.includes(data.entries[5].source));
});
// Re-import with separate fixtures to exercise actual UI states without changing demo objects.
const draftData = structuredClone(data); draftData.objects[0].budget_status = 'draft';
globalThis.fetch = async () => ({ ok: true, json: async () => draftData });
await import('../plan-fact/app.js?draft');
test('draft budget is never labelled approved or displayed as zero', () => {
  assert.match(allText(dom.get('metrics').children[0]), /PLAN не утверждён/);
  assert.equal(dom.get('metrics').children[0].children[1].textContent, 'Нет данных');
});
const missingData = structuredClone(data); missingData.objects[0].budget_status = 'missing';
globalThis.fetch = async () => ({ ok: true, json: async () => missingData });
await import('../plan-fact/app.js?missing');
test('missing budget has its own visible label', () => {
  assert.match(allText(dom.get('metrics').children[0]), /PLAN отсутствует/);
});
const ongoingData = structuredClone(data); ongoingData.objects[0].status = 'in_progress';
ongoingData.entries.find(e => e.object_id === 'DEMO-001' && e.scenario === 'FACT').amount = 100000;
globalThis.fetch = async () => ({ ok: true, json: async () => ongoingData });
await import('../plan-fact/app.js?ongoing');
test('ongoing negative variance is current and not final savings', () => {
  assert.match(allText(dom.get('metrics').children[2]), /Текущее отклонение/);
  assert.match(allText(dom.get('metrics').children[2]), /не итоговая экономия/);
  assert.match(allText(dom.get('metrics').children[1]), /не полная себестоимость/);
  assert.match(allText(dom.get('costTotal')), /на текущую дату/);
});
globalThis.fetch = async () => ({ ok: false, status: 503 });
await import('../plan-fact/app.js?failure');
test('HTTP error produces visible message', () => {
  assert.equal(dom.get('error').hidden, false);
  assert.match(dom.get('error').textContent, /503/);
});
console.log(`${passed} checks passed`);
