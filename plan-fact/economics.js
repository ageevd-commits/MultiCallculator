export const CATEGORIES = Object.freeze({ labor: 'Труд', materials: 'Материалы', equipment: 'Оборудование', logistics: 'Логистика', other: 'Прочее' });

// null and missing rows mean unknown, while an explicit numeric 0 is valid.
export function sumAmounts(entries) {
  if (!entries.length || entries.some(e => typeof e.amount !== 'number' || !Number.isFinite(e.amount))) return null;
  return entries.reduce((sum, e) => sum + Math.round(e.amount * 100), 0) / 100;
}

export function compare(plan, fact) {
  if (plan === null || fact === null) return { delta: null, percent: null };
  const delta = Math.round((fact - plan) * 100) / 100;
  return { delta, percent: plan === 0 ? null : delta / plan * 100 };
}

export function summarize(object, entries) {
  const own = entries.filter(e => e.object_id === object.object_id);
  const basisValid = own.every(e => e.vat_basis === object.vat_basis);
  const eligible = own.filter(e => e.scenario === 'PLAN' ? object.budget_status === 'approved' && e.approval === 'approved' : e.scenario === 'FACT' && e.approval === 'confirmed');
  const rows = Object.entries(CATEGORIES).map(([key, label]) => {
    const categoryEntries = eligible.filter(e => e.category === key);
    const plan = basisValid ? sumAmounts(categoryEntries.filter(e => e.scenario === 'PLAN')) : null;
    const fact = basisValid ? sumAmounts(categoryEntries.filter(e => e.scenario === 'FACT')) : null;
    return { key, label, plan, fact, ...compare(plan, fact), entries: categoryEntries };
  });
  const plan = sumAmounts(rows.map(r => ({ amount: r.plan })));
  const fact = sumAmounts(rows.map(r => ({ amount: r.fact })));
  const confirmed = eligible.filter(e => e.scenario === 'FACT' && typeof e.amount === 'number' && Number.isFinite(e.amount));
  const knownFact = basisValid ? sumAmounts(confirmed) : null;
  const factState = !confirmed.length ? 'absent' : object.status !== 'completed' || fact === null ? 'partial' : 'complete';
  const planState = object.budget_status !== 'approved' ? object.budget_status : plan === null ? 'incomplete' : plan === 0 ? 'approved_zero' : 'approved';
  return { rows, total: { plan, fact, ...compare(plan, fact) }, basisValid, excludedCount: own.length - eligible.length, knownFact, factState, planState };
}
