import { activityCatalog } from './activity-catalog.js';
export { activityCatalog };
const normalize = text => String(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
export function parseActivityCode(text) {
  const value = normalize(text).replace(/^codigo\s*[:\-]?\s*/, '').replace(/[.,!?;:]+$/, '').trim();
  const match = value.match(/^(gp|gc|gn|ga|ou|g\s*p|g\s*c|g\s*n|g\s*a|o\s*u|ge\s*pe|ge\s*ce|ge\s*ene|ge\s*a|o\s*u)\s*[- ]?\s*(\d+|um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|zero)$/);
  if (!match) return null;
  const prefixes = { gepe: 'GP', gece: 'GC', geene: 'GN', gea: 'GA' };
  const prefix = match[1].replace(/\s/g, '');
  const numbers = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, zero: 0 };
  return (prefixes[prefix] || prefix.toUpperCase()) + (numbers[match[2]] ?? Number(match[2]));
}
export function resolveActivityCode(text) {
  const code = parseActivityCode(text);
  return code ? activityCatalog.find(entry => entry.code === code) || null : null;
}
export function activityCodeError(text) {
  if (resolveActivityCode(text)) return '';
  return parseActivityCode(text) || /^codigo\b/.test(normalize(text)) ? 'Código não cadastrado. Confira a tabela ou informe a descrição da atividade.' : '';
}
export function resolveActivityInput(text, entries, fallbackGroup) {
  const error = activityCodeError(text);
  if (error) throw Error(error);
  const entry = resolveActivityCode(text);
  return entry ? { description: entry.description, category: entry.group_name, code: entry.code } : {
    description: text.trim().slice(0, 500),
    category: entries.find(item => normalize(item.description) === normalize(text))?.group_name ?? fallbackGroup
  };
}
export function createCodePreview(React) {
  const h = React.createElement;
  return function CodePreview({ text }) {
    const entry = resolveActivityCode(text), error = activityCodeError(text);
    if (error) return h('p', { className: 'error', role: 'status' }, error);
    if (!entry) return null;
    return h('div', { className: 'activity-code-preview', role: 'status' },
      h('strong', null, entry.code + ' — ' + entry.description),
      h('p', null, 'Grupo: ' + entry.group_name),
      h('small', null, 'Confira e inicie a atividade para registrar esta descrição.'));
  };
}
