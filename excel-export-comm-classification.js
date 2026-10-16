import {communicationText} from "./communications-classification-20261009.js";
// OOXML com textos literais: descrições nunca são interpretadas como fórmulas.
const xml = value => String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char]));
const ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const encoder = new TextEncoder();
function zip(files) {
  const chunks = [], directory = [];
  let offset = 0;
  const header = size => { const bytes = new Uint8Array(size); return [bytes, new DataView(bytes.buffer)]; };
  for (const [path, text] of Object.entries(files)) {
    const name = encoder.encode(path), data = encoder.encode(text);
    let crc = 0xffffffff;
    for (const byte of data) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); }
    crc = (crc ^ 0xffffffff) >>> 0;
    const [local, l] = header(30);
    l.setUint32(0, 0x04034b50, true); l.setUint16(4, 20, true); l.setUint16(12, 33, true);
    l.setUint32(14, crc, true); l.setUint32(18, data.length, true); l.setUint32(22, data.length, true); l.setUint16(26, name.length, true);
    chunks.push(local, name, data);
    const [central, c] = header(46);
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(14, 33, true);
    c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true); c.setUint32(42, offset, true);
    directory.push(central, name); offset += local.length + name.length + data.length;
  }
  const directorySize = directory.reduce((sum, item) => sum + item.length, 0);
  const [end, e] = header(22);
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, directory.length / 2, true); e.setUint16(10, directory.length / 2, true); e.setUint32(12, directorySize, true); e.setUint32(16, offset, true);
  return new Blob([...chunks, ...directory, end], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
export function buildRows(sessions, now = Date.now(), observation = () => '') {
  const date = value => new Date(value).toLocaleDateString('pt-BR');
  const time = value => new Date(value).toLocaleTimeString('pt-BR', { hour12: false });
  return [['Supervisor', 'Observador', 'Território / Posto', 'Data', 'Motivo / Atividade', 'Categoria', 'Demanda', 'Início', 'Fim', 'Duração (segundos)', 'Situação', 'Observação', 'Detalhes da atividade', 'Comunicações (incluídas no tempo)'],
    ...sessions.flatMap(session => session.segments.map(segment => {
      const activity = session.activities.find(item => item.id === segment.activityId);
      return [session.supervisor, session.observer, session.region, date(segment.start), activity?.description || 'Sem descrição', activity?.category || 'Sem categoria', activity?.demand ?? (activity?.planned === true ? 'Planejada' : activity?.planned === false ? 'Imprevista' : 'Não informada'), time(segment.start), segment.end === null ? 'Em andamento' : time(segment.end), Math.max(0, Math.floor(((segment.end ?? Math.min(now, session.end ?? now)) - segment.start) / 1000)), session.end === null ? 'Em andamento' : 'Encerrado', activity ? observation(session, activity.id) : '', activity?.details || '',communicationText(session,segment,now)];
    }))];
}
export function workbookBlob(rows) {
  if (rows.length > 1048576) throw Error('O limite do Excel foi excedido. Selecione um período menor.');
  const sheet = `<worksheet xmlns="${ns}"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="3" width="25" customWidth="1"/><col min="4" max="4" width="14" customWidth="1"/><col min="5" max="5" width="60" customWidth="1"/><col min="6" max="7" width="22" customWidth="1"/><col min="8" max="9" width="18" customWidth="1"/><col min="10" max="12" width="25" customWidth="1"/><col min="13" max="13" width="70" customWidth="1"/></cols><sheetData>${rows.map((row, index) => `<row r="${index + 1}">${row.map((value, column) => { const ref = String.fromCharCode(65 + column) + (index + 1); return typeof value === 'number' && Number.isFinite(value) ? `<c r="${ref}"><v>${value}</v></c>` : `<c r="${ref}" t="inlineStr" s="${index === 0 ? 1 : 0}"><is><t xml:space="preserve">${xml(value)}</t></is></c>`; }).join('')}</row>`).join('')}</sheetData><autoFilter ref="A1:N${rows.length}"/></worksheet>`;
  return zip({
    '[Content_Types].xml': '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
    '_rels/.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml': `<workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Atividades" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    'xl/styles.xml': `<styleSheet xmlns="${ns}"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF354C67"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf fontId="0" fillId="0" borderId="0" numFmtId="0" xfId="0"/><xf fontId="1" fillId="2" borderId="0" numFmtId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
    'xl/worksheets/sheet1.xml': sheet
  });
}
export function downloadExcel(sessions, now, observation) {
  try {
    const blob = workbookBlob(buildRows(sessions, now, observation));
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = 'rotina-supervisor.xlsx'; document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  } catch (error) { window.alert('Não foi possível exportar: ' + error.message); }
}
