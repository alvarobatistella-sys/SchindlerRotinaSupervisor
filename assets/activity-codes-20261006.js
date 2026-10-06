import { activityCatalog } from './activity-catalog.js';
export { activityCatalog };
const normalize = text => String(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
export function parseActivityCode(text) {
  const value = normalize(text).replace(/^codigo\s*[:\-]?\s*/, '').replace(/[.,!?;:]+$/, '').trim();
  const match = value.match(/^(gp|gc|gn|ga|ou|g\s*p|g\s*c|g\s*n|g\s*a|o\s*u|ge\s*pe|ge\s*ce|ge\s*ene|ge\s*a|o\s*u)\s*[- ]?\s*(\d+|um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|zero)$/);
  if (!match) { const direct=value.match(/^([a-z]{2,6})\s*[- ]?\s*(\d+)$/);return direct?direct[1].toUpperCase()+Number(direct[2]):null; }
  const prefixes = { gepe: 'GP', gece: 'GC', geene: 'GN', gea: 'GA' };
  const prefix = match[1].replace(/\s/g, '');
  const numbers = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, zero: 0 };
  return (prefixes[prefix] || prefix.toUpperCase()) + (numbers[match[2]] ?? Number(match[2]));
}
export function resolveActivityCode(text, entries = []) {
  const code = parseActivityCode(text);
  return code ? entries.find(entry => entry.code?.toUpperCase() === code) || null : null;
}
export function activityCodeError(text, entries = []) {
  if (resolveActivityCode(text, entries)) return '';
  return parseActivityCode(text) || /^codigo\b/.test(normalize(text)) ? 'Código não cadastrado. Confira a tabela ou informe a descrição da atividade.' : '';
}
export function resolveActivityInput(text, entries = []) {
 const codeEntry = resolveActivityCode(text,entries);
 const entry = codeEntry || entries.find(item => normalize(item.description) === normalize(text));
 if (!entry) throw Error('Atividade não cadastrada. Escolha uma descrição de Configurações ou informe um código válido.');
 return {description:entry.description,category:entry.group_name,code:entry.code||null};
}
export function nextCodePreview(group,entries=[]) {
 const prefix=({administrativas:'GA',administrativo:'GA',administrativa:'GA',administrativos:'GA',clientes:'GC',negocios:'GN',pessoas:'GP',outras:'OU',outros:'OU'})[normalize(group)];
 if(!prefix)return 'Gerado ao salvar para esta categoria';
 const numbers=entries.map(e=>e.code?.match(new RegExp('^'+prefix+'(\\d+)$'))).filter(Boolean).map(m=>Number(m[1]));
 return prefix+(Math.max(0,...numbers)+1)+' (prévia)';
}
export function createCodePreview(React) {
  const h = React.createElement;
  return function CodePreview({ text, entries = [] }) {
    const entry = resolveActivityCode(text, entries), error = activityCodeError(text, entries);
    if (error) return h('p', { className: 'error', role: 'status' }, error);
    if (!entry) return null;
    return h('div', { className: 'activity-code-preview', role: 'status' },
      h('strong', null, entry.code + ' — ' + entry.description),
      h('p', null, 'Grupo: ' + entry.group_name),
      h('small', null, 'Confira e inicie a atividade para registrar esta descrição.'));
  };
}
