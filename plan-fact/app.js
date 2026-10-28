import { summarize } from './economics.js';
import { loadData } from './data-source.js';

const $ = id => document.getElementById(id);
const number = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });
const statuses = { completed: 'Завершён', in_progress: 'В работе', planned: 'Запланирован' };
const planLabels = { approved: 'Утверждённый бюджет', approved_zero: 'Утверждённый нулевой бюджет', draft: 'PLAN не утверждён', missing: 'PLAN отсутствует', incomplete: 'Утверждённый PLAN: данные неполные' };
export function recordCount(count) {
  const form = new Intl.PluralRules('ru').select(count);
  return `${count} ${{ one: 'запись', few: 'записи', many: 'записей', other: 'записи' }[form]}`;
}
const money = value => value === null ? 'Нет данных' : number.format(value);
const signed = value => value === null ? '—' : `${value > 0 ? '+' : ''}${number.format(value)}`;
const tone = value => value === null || value === 0 ? '' : value > 0 ? 'over' : 'under';
function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function tableRow(label, row) {
  const tr = element('tr');
  const th = element('th', label); th.scope = 'row'; tr.append(th);
  [money(row.plan), money(row.fact), signed(row.delta), row.percent === null ? '—' : `${signed(row.percent)} %`].forEach((text, i) => tr.append(element('td', text, i > 1 ? tone(row.delta) : '')));
  return tr;
}
function notice(text) { $('warnings').append(element('p', text, 'notice')); }

function render(object, entries) {
  const result = summarize(object, entries);
  $('objectName').textContent = object.name;
  $('objectMeta').textContent = `ID: ${object.object_id} · CRM ID: ${object.crm_object_id || 'не назначен'}`;
  $('objectStatus').textContent = statuses[object.status];
  $('basis').textContent = `${object.vat_basis === 'net' ? 'Без НДС' : 'С НДС'} · PLAN и FACT: ${object.scope} · Срез данных: ${object.as_of}`;
  $('warnings').replaceChildren();
  if (object.demo_scenario) notice(object.demo_scenario);
  if (['draft', 'missing', 'incomplete'].includes(result.planState)) notice(`${planLabels[result.planState]}. Сравнение с бюджетом недоступно.`);
  if (result.factState === 'absent') notice('FACT отсутствует: нет подтверждённых сумм. Это не нулевая себестоимость.');
  if (result.factState === 'partial') notice('FACT частично подтверждён. Показана сумма известных подтверждённых записей, а не полная себестоимость.');
  if (object.status !== 'completed') notice('Объект не завершён. Отклонения текущие и не означают итоговую экономию.');
  if (!result.basisValid) notice('База НДС записей не совпадает с базой объекта. Сравнение заблокировано до исправления данных.');
  if (result.excludedCount) notice(`Не включены в расчёт неподтверждённые записи: ${result.excludedCount}. Прогнозы и нормативы не являются FACT.`);
  if (result.basisValid && (result.total.plan === null || result.total.fact === null)) notice('Полный итог и общее отклонение недоступны: есть отсутствующие суммы, категории или утверждённый план. Известные категории показаны отдельно.');
  $('metrics').replaceChildren();
  const t = result.total;
  const partial = result.factState === 'partial';
  const metrics = [ ['PLAN, ₽', money(t.plan), planLabels[result.planState]], [partial ? 'FACT частичный, ₽' : 'FACT, ₽', money(partial ? result.knownFact : t.fact), partial ? 'Подтверждено на текущую дату · не полная себестоимость' : result.factState === 'absent' ? 'Подтверждённые суммы отсутствуют' : 'Подтверждённые затраты'], [object.status !== 'completed' ? 'Текущее отклонение, ₽' : 'Отклонение, ₽', signed(t.delta), t.delta === null ? 'Недостаточно данных' : t.delta > 0 ? 'Перерасход' : t.delta < 0 ? object.status !== 'completed' ? 'Пока ниже плана · не итоговая экономия' : 'Ниже плана' : 'В пределах плана'], ['Отклонение, %', t.percent === null ? '—' : `${signed(t.percent)} %`, t.plan === 0 ? 'При нулевом плане не определено' : 'Относительно PLAN'] ];
  metrics.forEach(([label, value, hint], i) => {
    const card = element('article', undefined, 'metric');
    card.append(element('p', label, 'metric-label'), element('p', value, `metric-value ${i > 1 ? tone(t.delta) : ''}`), element('p', hint, 'muted'));
    $('metrics').append(card);
  });
  $('costRows').replaceChildren(...result.rows.map(row => tableRow(row.label, row)));
  $('costTotal').replaceChildren(tableRow(partial ? 'Итого на текущую дату*' : 'Итого', t));
  if (partial) notice('* Итог FACT по всем категориям доступен только при наличии всех сумм. Частичная сумма в карточке FACT учитывает только известные записи.');
  $('details').replaceChildren();
  result.rows.forEach(row => {
    const details = element('details');
    details.append(element('summary', `${row.label} · ${recordCount(row.entries.length)}`));
    const content = element('div', undefined, 'detail-content');
    for (const scenario of ['PLAN', 'FACT']) {
      const group = element('section'); group.append(element('h3', scenario));
      const records = row.entries.filter(e => e.scenario === scenario);
      if (!records.length) group.append(element('p', 'Нет данных', 'muted'));
      records.forEach(entry => {
        const item = element('article', undefined, 'entry');
        item.append(element('strong', `${money(entry.amount)}${entry.amount === null ? '' : ' ₽'}`), element('p', `Тип записи: ${scenario}`), element('p', entry.description), element('p', `Источник: ${entry.source}`, 'muted'), element('p', `${entry.date} · ${entry.entry_id} · ${entry.vat_basis === 'net' ? 'Без НДС' : 'С НДС'} · ${scenario === 'FACT' ? 'Подтверждено (демо)' : 'Утверждено (демо)'}`, 'entry-meta'));
        group.append(item);
      });
      content.append(group);
    }
    details.append(content); $('details').append(details);
  });
}

try {
  const { data, loadedAt } = await loadData();
  const select = $('objectSelect');
  data.objects.forEach(object => { const option = element('option', object.name); option.value = object.object_id; select.append(option); });
  const update = () => render(data.objects.find(o => o.object_id === select.value), data.entries);
  select.addEventListener('change', update);
  update();
  $('loadedAt').textContent = `Источник: demo-data.json · Загружено: ${loadedAt.toLocaleString('ru-RU')}`;
  $('dashboard').hidden = false;
} catch (error) {
  $('error').textContent = `${error.message} Откройте модуль через локальный HTTP-сервер и перезагрузите страницу.`;
  $('error').hidden = false;
} finally { $('loading').hidden = true; }
