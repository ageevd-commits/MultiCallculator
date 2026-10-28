import { CATEGORIES } from './economics.js';

// Replace this adapter with read-only Sheets access later. No local persistence.
export function validateData(data) {
  if (data?.demo !== true || !Array.isArray(data.objects) || !data.objects.length || !Array.isArray(data.entries)) throw new Error('Некорректный демонстрационный набор данных.');
  const objects = new Set();
  for (const obj of data.objects) {
    if (!['approved', 'draft', 'missing'].includes(obj.budget_status)) throw new Error('Не указан статус бюджета объекта.');
    if (!obj.object_id || objects.has(obj.object_id) || !obj.name || !['completed', 'in_progress', 'planned'].includes(obj.status) || !['net', 'gross'].includes(obj.vat_basis) || !obj.scope || !obj.as_of) throw new Error('Некорректные данные объекта.');
    objects.add(obj.object_id);
  }
  const ids = new Set();
  for (const entry of data.entries) {
    if (!entry.entry_id || ids.has(entry.entry_id) || !objects.has(entry.object_id) || !Object.hasOwn(CATEGORIES, entry.category) || !['PLAN', 'FACT'].includes(entry.scenario) || !['net', 'gross'].includes(entry.vat_basis) || !['approved', 'confirmed', 'draft', 'forecast'].includes(entry.approval) || !entry.source || !entry.date || (entry.amount !== null && (typeof entry.amount !== 'number' || !Number.isFinite(entry.amount) || entry.amount < 0))) throw new Error('Некорректная запись затрат.');
    ids.add(entry.entry_id);
  }
  return data;
}

export async function loadData() {
  const response = await fetch(new URL('./demo-data.json', import.meta.url), { cache: 'no-store' });
  if (!response.ok) throw new Error(`Не удалось загрузить данные (HTTP ${response.status}).`);
  return { data: validateData(await response.json()), loadedAt: new Date() };
}
