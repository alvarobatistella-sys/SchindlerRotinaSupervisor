import {communicationRows,channelNames} from "./communications-clientes-20261016.js";
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
  const date = value => { const d=new Date(value); return {excelValue:Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())/86400000+25569,style:2}; };
  const clock = value => {const d=new Date(value);return {excelValue:(d.getHours()*3600+d.getMinutes()*60+d.getSeconds())/86400,style:3};};
  const groups = sessions.map(session => ({session, communications:communicationRows(session,now)}));
  const count = Math.max(1,...groups.flatMap(({session,communications})=>session.segments.map(segment=>communications.filter(row=>row.segmentId===segment.id).length)));
  const fields=['Tipo','Início','Fim','Duração (incluída no tempo)','Categoria','Classificação','Assunto'];
  const headers=Array.from({length:count},(_,i)=>fields.map(field=>'Comunicação '+(i+1)+' — '+field)).flat();
  const time = value => new Date(value).toLocaleTimeString('pt-BR', { hour12: false });
  return [['Supervisor', 'Observador', 'Território / Posto', 'Data', 'Motivo / Atividade', 'Categoria', 'Demanda', 'Início', 'Fim', 'Duração (segundos)', 'Situação', 'Observação', 'Detalhes da atividade', ...headers],
    ...groups.flatMap(({session,communications}) => session.segments.map(segment => {
      const activity = session.activities.find(item => item.id === segment.activityId);
      return [session.supervisor, session.observer, session.region, date(segment.start), activity?.description || 'Sem descrição', activity?.category || 'Sem categoria', activity?.demand ?? (activity?.planned === true ? 'Planejada' : activity?.planned === false ? 'Imprevista' : 'Não informada'), time(segment.start), segment.end === null ? 'Em andamento' : time(segment.end), Math.max(0, Math.floor(((segment.end ?? Math.min(now, session.end ?? now)) - segment.start) / 1000)), session.end === null ? 'Em andamento' : 'Encerrado', activity ? observation(session, activity.id) : '', activity?.details || '',...Array.from({length:count},(_,i)=>{
        const row=communications.filter(item=>item.segmentId===segment.id)[i];
        return row?[channelNames[row.channel]||'Comunicação',clock(row.start),row.running?'Em andamento':clock(row.end),{excelValue:Math.floor(row.duration/1000)/86400,style:4},row.category||'Sem categoria',row.value_added||'Sem classificação',row.subject||'']:Array(7).fill('');
      }).flat()];
    }))];
}
const columnName = index => {let result='';for(index++;index;index=Math.floor((index-1)/26))result=String.fromCharCode(65+(index-1)%26)+result;return result;};
export function communicationSummary(sessions, now = Date.now()) {
  const totals = Object.fromEntries(Object.keys(channelNames).map(channel => [channel, {count:0, hours:0}]));
  let first=Infinity, last=-Infinity;
  for(const session of sessions) {
    for(const segment of session.segments) {
      first=Math.min(first,segment.start);
      last=Math.max(last,Math.min(segment.end ?? now,session.end ?? now));
    }
    for(const row of communicationRows(session,now)) {
      if(!totals[row.channel]) continue;
      totals[row.channel].count++;
      totals[row.channel].hours+=row.duration/3600000;
    }
  }
  const date=value=>new Date(value).toLocaleDateString('pt-BR');
  return {totals, title:'Comunicação'+(Number.isFinite(first)?' — '+date(first)+' a '+date(last):'')};
}
function communicationSheet(summary) {
  const {totals,title}=summary;
  const cell=(ref,value,style,formula)=>typeof value==='number'
    ? '<c r="'+ref+'" s="'+style+'">'+(formula?'<f>'+formula+'</f>':'')+'<v>'+value+'</v></c>'
    : '<c r="'+ref+'" s="'+style+'" t="inlineStr"><is><t>'+xml(value)+'</t></is></c>';
  const detail=(row,channel)=>'<row r="'+row+'">'+cell('A'+row,channelNames[channel],9)+cell('B'+row,totals[channel].count,9)+cell('C'+row,totals[channel].hours,7)+'</row>';
  const total=(row,label,channels,start,end)=>'<row r="'+row+'">'+cell('A'+row,label,6)+cell('B'+row,channels.reduce((sum,key)=>sum+totals[key].count,0),6,'SUM(B'+start+':B'+end+')')+cell('C'+row,channels.reduce((sum,key)=>sum+totals[key].hours,0),8,'SUM(C'+start+':C'+end+')')+'</row>';
  return '<worksheet xmlns="'+ns+'"><sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews><cols><col min="1" max="1" width="60" customWidth="1"/><col min="2" max="2" width="16" customWidth="1"/><col min="3" max="3" width="20" customWidth="1"/></cols><sheetData><row r="1" ht="26" customHeight="1">'+cell('A1',title,9)+'</row><row r="3">'+cell('A3','Tipo de atendimento',5)+cell('B3','Quantidade',5)+cell('C3','Total de horas',5)+'</row>'+detail(4,'phone_client')+detail(5,'phone')+total(6,'Total telefonemas',['phone_client','phone'],4,5)+detail(7,'whatsapp_client')+detail(8,'whatsapp')+total(9,'Total WhatsApp',['whatsapp_client','whatsapp'],7,8)+'</sheetData><mergeCells count="1"><mergeCell ref="A1:C1"/></mergeCells><pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/></worksheet>';
}
export function workbookBlob(rows, summary = communicationSummary([])) {
  const columns=Math.max(1,...rows.map(row=>row.length));
  if(columns>16384)throw Error('O limite de colunas do Excel foi excedido. Selecione menos comunicações.');
  if (rows.length > 1048576) throw Error('O limite do Excel foi excedido. Selecione um período menor.');
  const sheet = `<worksheet xmlns="${ns}"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="3" width="25" customWidth="1"/><col min="4" max="4" width="14" customWidth="1"/><col min="5" max="5" width="60" customWidth="1"/><col min="6" max="7" width="22" customWidth="1"/><col min="8" max="9" width="18" customWidth="1"/><col min="10" max="12" width="25" customWidth="1"/><col min="13" max="13" width="70" customWidth="1"/><col min="14" max="${columns}" width="24" customWidth="1"/></cols><sheetData>${rows.map((row, index) => `<row r="${index + 1}">${row.map((value, column) => { const ref = columnName(column) + (index + 1); if(value && typeof value === "object" && Number.isFinite(value.excelValue))return `<c r="${ref}" s="${value.style}"><v>${value.excelValue}</v></c>`; return typeof value === 'number' && Number.isFinite(value) ? `<c r="${ref}"><v>${value}</v></c>` : `<c r="${ref}" t="inlineStr" s="${index === 0 ? 1 : 0}"><is><t xml:space="preserve">${xml(value)}</t></is></c>`; }).join('')}</row>`).join('')}</sheetData><autoFilter ref="A1:${columnName(columns-1)}${rows.length}"/></worksheet>`;
  return zip({
    '[Content_Types].xml': '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
    '_rels/.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml': `<workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Atividades" sheetId="1" r:id="rId1"/><sheet name="Comunicação" sheetId="2" r:id="rId3"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/></Relationships>',
    'xl/styles.xml': `<styleSheet xmlns="${ns}"><numFmts count="4"><numFmt numFmtId="167" formatCode="0.0"/><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/><numFmt numFmtId="165" formatCode="hh:mm:ss"/><numFmt numFmtId="166" formatCode="[h]:mm:ss"/></numFmts><fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF354C67"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFD9D9D9"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF8EAADB"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border/><border><left style="thin"><color rgb="FF000000"/></left><right style="thin"><color rgb="FF000000"/></right><top style="thin"><color rgb="FF000000"/></top><bottom style="thin"><color rgb="FF000000"/></bottom></border></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="10"><xf fontId="0" fillId="0" borderId="0" numFmtId="0" xfId="0"/><xf fontId="1" fillId="2" borderId="0" numFmtId="0" xfId="0" applyFont="1" applyFill="1"/><xf fontId="0" fillId="0" borderId="0" numFmtId="164" xfId="0" applyNumberFormat="1"/><xf fontId="0" fillId="0" borderId="0" numFmtId="165" xfId="0" applyNumberFormat="1"/><xf fontId="0" fillId="0" borderId="0" numFmtId="166" xfId="0" applyNumberFormat="1"/><xf fontId="2" fillId="3" borderId="1" numFmtId="0" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/><xf fontId="2" fillId="4" borderId="1" numFmtId="0" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/><xf fontId="0" fillId="0" borderId="1" numFmtId="167" xfId="0" applyNumberFormat="1" applyBorder="1"/><xf fontId="2" fillId="4" borderId="1" numFmtId="167" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/><xf fontId="2" fillId="0" borderId="1" numFmtId="0" xfId="0" applyFont="1" applyBorder="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
    'xl/worksheets/sheet1.xml': sheet,
    'xl/worksheets/sheet2.xml': communicationSheet(summary)
  });
}
export function downloadExcel(sessions, now, observation) {
  try {
    const blob = workbookBlob(buildRows(sessions, now, observation), communicationSummary(sessions, now));
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = 'rotina-supervisor.xlsx'; document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  } catch (error) { window.alert('Não foi possível exportar: ' + error.message); }
}
