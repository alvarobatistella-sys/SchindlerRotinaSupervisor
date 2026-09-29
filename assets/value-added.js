export const valueAddedColors = { VA: '#238636', NVA: '#d93643', NNVA: '#e07818' };
export const valueAddedLabel = value => valueAddedColors[value] ? value : 'Sem classificação';
export const valueAddedColor = value => valueAddedColors[value] || '#8793a0';
const normalize = text => String(text ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/e-mails?/g, 'email').replace(/[^a-z0-9]+/g, ' ').trim();
export function classifyReasons(rows, entries) {
  const byDescription = new Map();
  for (const entry of entries) {
    const key = normalize(entry.description);
    const value = valueAddedColors[entry.value_added] ? entry.value_added : null;
    if (!byDescription.has(key)) byDescription.set(key, value);
    else if (byDescription.get(key) !== value) byDescription.set(key, null);
  }
  return rows.map(row => ({ ...row, classification: byDescription.get(normalize(row.label)) || null }));
}
export function createValueAddedSelect(React, client) {
  const h = React.createElement;
  return function ValueAddedSelect({ entry, catalog, disabled }) {
    const [saving, setSaving] = React.useState(false);
    const [message, setMessage] = React.useState('');
    const busy = React.useRef(false);
    async function save(event) {
      if (busy.current) return;
      const value = event.target.value || null;
      busy.current = true; setSaving(true); setMessage('');
      try {
        const result = await client.rpc('set_description_value_added', { description_id: String(entry.id), classification: value });
        if (result.error) throw result.error;
        await catalog.refresh();
        setMessage('Classificação salva.');
      } catch (error) {
        setMessage('Não foi possível salvar. Confira se valor-agregado.sql foi instalado e se seu acesso é de administrador.');
      } finally { busy.current = false; setSaving(false); }
    }
    return h('div', { className: 'value-added-control' },
      h('select', { 'aria-label': 'Valor agregado de ' + entry.description, value: entry.value_added || '', disabled: disabled || saving || entry.id == null, onChange: save },
        h('option', { value: '' }, 'Sem classificação'),
        ...Object.keys(valueAddedColors).map(value => h('option', { key: value, value }, value))),
      h('small', { role: 'status' }, saving ? 'Salvando…' : message));
  };
}
