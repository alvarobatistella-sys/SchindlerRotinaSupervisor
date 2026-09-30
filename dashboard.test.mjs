import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const valueAddedSource = await readFile(new URL('./assets/value-added.js', import.meta.url), 'utf8');
const valueAddedUrl = 'data:text/javascript;base64,' + Buffer.from(valueAddedSource).toString('base64');
const source = (await readFile(new URL('./assets/dashboards.js', import.meta.url), 'utf8')).replace("import { downloadExcel } from './excel-export.js?v=details-1';", 'const downloadExcel = () => {};').replace('./value-added.js?v=review-va-1', valueAddedUrl).replace("import { printDashboard } from './dashboard-pdf.js';", 'const printDashboard = () => {};');
const { aggregate, filterSessions, categorySessions, createDashboards } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const start = new Date('2026-09-28T09:00:00').getTime();
const sessions = [
  { supervisorId: 'a', supervisor: 'Ana', start, end: null,
    activities: [{ id: 'one', category: 'Clientes', description: 'Atendimento', demand: 'Planejada' }, { id: 'two', category: 'Pessoas', description: 'Reunião', planned: false }],
    segments: [{ activityId: 'one', start, end: start + 60000 }, { activityId: 'two', start: start + 60000, end: start + 90000 }, { activityId: 'one', start: start + 90000, end: null }] },
  { supervisorId: 'b', supervisor: 'Bruno', start, end: start + 60000,
    activities: [{ id: 'one', category: 'Clientes', description: 'Atendimento', planned: true }],
    segments: [{ activityId: 'one', start, end: start + 60000 }] }
];
const data = aggregate(sessions, start + 120000);
assert.equal(aggregate(categorySessions(sessions, 'Clientes'), start + 120000).duration, 150000);
assert.equal(aggregate(categorySessions(filterSessions(sessions, 'a', '', '', []), 'Clientes'), start + 120000).duration, 90000);
assert.equal(aggregate(categorySessions(sessions, 'Ausente'), start + 120000).duration, 0);
assert.equal(categorySessions(sessions, ''), sessions);
assert.equal(sessions[0].activities.length, 2);
assert.equal(data.duration, 180000);
assert.equal(data.reason.find(row => row.key === 'Atendimento').value, 150000);
assert.equal(data.demand.find(row => row.key === 'Imprevista').value, 30000);
for (const dimension of ['category', 'reason', 'demand', 'supervisor']) assert.equal(data[dimension].reduce((sum, row) => sum + row.value, 0), data.duration);
assert.equal(filterSessions(sessions, 'a', '2026-09-28', '2026-09-28', []).length, 1);
assert.equal(filterSessions(sessions, '', '2026-09-29', '', []).length, 0);
assert.equal(filterSessions(sessions, '', '2026-09-29', '2026-09-28', []).length, 0);
assert.equal(filterSessions([{ ...sessions[0], supervisorId: undefined }], 'a', '', '', [{ id: 'a', name: 'Ana' }]).length, 1);
assert.equal(aggregate([], start).duration, 0);
assert.equal(aggregate([{ ...sessions[0], activities: [], segments: [{ activityId: 'missing', start, end: start + 1000 }] }], start).demand[0].key, 'Não informada');
assert.equal(aggregate([{ ...sessions[0], segments: [{ start, end: start - 1000 }, { start: NaN, end: null }] }], start).duration, 0);
const React = {
  useState: initial => [initial, () => {}],
  createElement: (type, props, ...children) => typeof type === 'function' ? type({ ...props, children }) : ({ type, props, children })
};
const Dashboard = createDashboards(React);
const tree = JSON.stringify(Dashboard({ sessions, supervisors: [], now: start + 120000 }));
for (const title of ['Por supervisor', 'Por categoria', 'Por motivo', 'Por demanda', 'Ana', 'Bruno']) assert.ok(tree.includes(title));
assert.ok(!tree.includes('NaN'));
assert.ok(JSON.stringify(Dashboard({ sessions: [], supervisors: [], now: start })).includes('Nenhum tempo registrado'));
const bundle = await readFile(new URL('./assets/index-DWd9uucD.js', import.meta.url), 'utf8');
assert.ok(bundle.includes('`Relatórios`,`Dashboards`'));
assert.ok(bundle.includes('SupervisorDashboards,{sessions:u.sessions,supervisors:u.supervisors,now:x,entries:a.entries,catalogError:a.error}'));
console.log('OK: agregações, filtros, períodos, dados legados, estado vazio e integração do menu.');
