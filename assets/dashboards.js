import { downloadExcel } from './excel-export.js';
import { classifyReasons, valueAddedColors, valueAddedColor, valueAddedLabel } from './value-added.js';
// Dashboard independente, integrado ao estado e à autenticação existentes.
export function aggregate(sessions, now = Date.now()) {
  const totals = { category: new Map(), reason: new Map(), demand: new Map(), supervisor: new Map() };
  let duration = 0, segments = 0;
  for (const session of sessions) {
    const activities = new Map(session.activities.map(activity => [activity.id, activity]));
    for (const segment of session.segments) {
      const activity = activities.get(segment.activityId);
      const end = segment.end ?? Math.min(now, session.end ?? now);
      const value = Math.max(0, end - segment.start);
      if (!Number.isFinite(value) || value === 0) continue;
      const supervisorKey = session.supervisorId || session.supervisor || 'Sem supervisor';
      const fields = {
        category: activity?.category || 'Sem categoria',
        reason: activity?.description || 'Sem descrição',
        demand: activity?.demand || (activity?.planned === true ? 'Planejada' : activity?.planned === false ? 'Imprevista' : 'Não informada'),
        supervisor: supervisorKey
      };
      for (const [field, key] of Object.entries(fields)) {
        const item = totals[field].get(key) || { key, label: field === 'supervisor' ? session.supervisor || 'Sem supervisor' : key, value: 0 };
        item.value += value;
        totals[field].set(key, item);
      }
      duration += value;
      segments++;
    }
  }
  return { duration, segments, ...Object.fromEntries(Object.entries(totals).map(([key, values]) => [key, [...values.values()].sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, 'pt-BR'))])) };
}

export function filterSessions(sessions, supervisor, from, until, supervisors) {
  if (from && until && from > until) return [];
  return sessions.filter(session => {
    const key = session.supervisorId || supervisors.find(item => item.name === session.supervisor)?.id || session.supervisor || 'Sem supervisor';
    return (!supervisor || key === supervisor) && (!from || session.start >= new Date(from + 'T00:00:00').getTime()) && (!until || session.start <= new Date(until + 'T23:59:59.999').getTime());
  });
}

export function createDashboards(React) {
  const h = React.createElement;
  const duration = value => {
    const seconds = Math.floor(value / 1000);
    return `${Math.floor(seconds / 3600)}h ${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}min ${String(seconds % 60).padStart(2, '0')}s`;
  };
  const percent = value => value.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%';
  function Chart({ title, rows, total, color, classified = false }) {
    return h('section', { className: 'panel dashboard-chart', 'aria-label': title },
      h('h2', null, title),
      h('p', null, 'Tempo registrado e participação no total filtrado'),
      classified && h('div', { className: 'value-added-legend' }, [...Object.keys(valueAddedColors), null].map(value => h('span', { key: value || 'none' }, h('i', { style: { background: valueAddedColor(value) }, 'aria-hidden': true }), valueAddedLabel(value)))),
      rows.length ? h('ul', { className: 'dashboard-bars' }, rows.map(row => h('li', { key: row.key },
        h('div', { className: 'dashboard-bar-label' }, h('span', null, row.label, classified && h('small', { className: 'value-added-badge' }, valueAddedLabel(row.classification))), h('strong', null, duration(row.value))),
        h('div', { className: 'dashboard-bar-line' },
          h('div', { className: 'bar-track', 'aria-hidden': true }, h('div', { style: { width: `${row.value / total * 100}%`, background: classified ? valueAddedColor(row.classification) : color } })),
          h('span', null, percent(row.value / total * 100)))
      ))) : h('div', { className: 'empty' }, h('p', null, 'Nenhum tempo registrado para os filtros selecionados.')));
  }
  return function Dashboards({ sessions, supervisors, now, entries = [], catalogError = '' }) {
    const [supervisor, setSupervisor] = React.useState('');
    const [from, setFrom] = React.useState('');
    const [until, setUntil] = React.useState('');
    const options = new Map(supervisors.map(item => [item.id, item.name]));
    for (const session of sessions) {
      const key = session.supervisorId || supervisors.find(item => item.name === session.supervisor)?.id || session.supervisor || 'Sem supervisor';
      if (!options.has(key)) options.set(key, session.supervisor || 'Sem supervisor');
    }
    const invalid = from && until && from > until;
    const filtered = filterSessions(sessions, supervisor, from, until, supervisors);
    const data = aggregate(filtered, now);
    return h('div', { className: 'dashboards' },
      h('div', { className: 'report-filters' },
        h('label', null, 'Supervisor', h('select', { value: supervisor, onChange: event => setSupervisor(event.target.value) },
          h('option', { value: '' }, 'Todos os supervisores'),
          [...options].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR')).map(([id, name]) => h('option', { key: id, value: id }, name)))),
        h('label', null, 'De', h('input', { type: 'date', value: from, max: until || undefined, onChange: event => setFrom(event.target.value) })),
        h('label', null, 'Até', h('input', { type: 'date', value: until, min: from || undefined, onChange: event => setUntil(event.target.value) })),
        h('button', { type: 'button', onClick: () => { setSupervisor(''); setFrom(''); setUntil(''); } }, 'Limpar filtros'),
        h('button', { type: 'button', disabled: !filtered.some(session => session.segments.length), onClick: () => downloadExcel(filtered, now) }, 'Baixar Excel (.xlsx)')),
      invalid && h('p', { className: 'error', role: 'alert' }, 'A data inicial deve ser anterior ou igual à data final.'),
      catalogError && h('p', { className: 'error', role: 'status' }, 'Não foi possível atualizar as classificações. ' + catalogError),
      h('div', { className: 'stats' },
        h('article', null, h('span', null, 'Tempo registrado'), h('strong', null, duration(data.duration)), h('small', null, 'Inclui pausas e intervalos registrados')),
        h('article', null, h('span', null, 'Acompanhamentos'), h('strong', null, filtered.length), h('small', null, `${data.segments} trechos com tempo registrado`)),
        h('article', null, h('span', null, 'Demanda imprevista'), h('strong', null, percent(data.duration ? (data.demand.find(row => row.key === 'Imprevista')?.value || 0) / data.duration * 100 : 0)), h('small', null, 'Percentual do tempo registrado'))),
      h('p', { className: 'dashboard-note' }, 'Os filtros de data consideram o início de cada acompanhamento. Motivo corresponde à descrição da atividade. Atividades em andamento são atualizadas automaticamente.'),
      h('div', { className: 'dashboard-grid' },
        h(Chart, { title: 'Por supervisor', rows: data.supervisor, total: data.duration, color: '#354c67' }),
        h(Chart, { title: 'Por categoria', rows: data.category, total: data.duration, color: '#d93643' }),
        h(Chart, { title: 'Por demanda', rows: data.demand, total: data.duration, color: '#328573' }),
        h(Chart, { title: 'Por motivo', rows: classifyReasons(data.reason, entries), total: data.duration, classified: true })));
  };
}
