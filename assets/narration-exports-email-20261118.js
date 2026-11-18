import {narrationCall} from './activity-narration.js?v=20261113';
import {buildRows,workbookBlob,communicationSummary} from './excel-email-20261118.js';
import {communicationText} from './communications-email-20261118.js';
import {printDashboard} from './dashboard-pdf.js?v=details-1';

const time=value=>new Date(value).toLocaleString('pt-BR');
export function narrationText(row) {
  const state=row.status==='completed'?(row.reviewed_at?'Relatório revisado em '+time(row.reviewed_at):'Relatório gerado por IA — conferir com o áudio'):'Relatório ainda não concluído ('+row.status+')';
  return ['Narração: '+row.activity_description,'Registrada em: '+time(row.started_at),state,row.report_text?.trim(),row.transcript?.trim()?'TRANSCRIÇÃO ORIGINAL\n'+row.transcript.trim():'',row.status!=='completed'?row.error_message:''].filter(Boolean).join('\n\n');
}
export function commentsForSegment(rows,segment) {
  return rows.filter(row=>row.segment_id===segment.id).map(narrationText).join('\n\n────────────────────\n\n');
}
// Continua em linhas adicionais, em vez de cortar textos no limite de 32.767 caracteres do Excel.
export function appendComments(rows,comments) {
  const result=[[...rows[0],'Comentários e relatos de narração']];
  for(let i=1;i<rows.length;i++) {
    const values=[...rows[i],comments[i-1]||''];
    const chunks=values.map(value=>typeof value==='string'?Array.from({length:Math.max(1,Math.ceil(value.length/30000))},(_,j)=>value.slice(j*30000,(j+1)*30000)):[value]);
    const count=Math.max(...chunks.map(parts=>parts.length));
    for(let j=0;j<count;j++)result.push(chunks.map(parts=>parts[j]??''));
  }
  return result;
}
export function createNarrationExports(client) {
  let busy=false;
  async function load(sessions) {
    const loaded=new Map();
    for(const session of sessions) {
      const result=await narrationCall(client,{action:'list',sessionId:session.id});
      if(!Array.isArray(result.rows)||result.rows.length>=500)throw Error('Não foi possível confirmar a lista completa de narrações. Tente novamente antes de exportar.');
      loaded.set(session.id,result.rows.slice().sort((a,b)=>a.started_at-b.started_at));
    }
    return loaded;
  }
  async function run(action) {
    if(busy)return;
    busy=true;
    try {await action();}catch(error){window.alert('Não foi possível gerar o relatório completo: '+error.message);}finally{busy=false;}
  }
  async function downloadExcel(sessions,now=Date.now(),observation=()=> '') {
    return run(async()=>{
      const selected=sessions.filter(Boolean),loaded=await load(selected);
      const comments=selected.flatMap(session=>session.segments.map(segment=>commentsForSegment(loaded.get(session.id),segment)));
      const rows=appendComments(buildRows(selected,now,observation),comments);
      for(const session of selected) {
        const orphan=loaded.get(session.id).filter(row=>!session.segments.some(segment=>segment.id===row.segment_id));
        for(const row of orphan) {
          const values=Array(rows[0].length).fill('');
          values[0]=session.supervisor;values[1]=session.observer;values[2]=session.region;
          values[4]=row.activity_description+' — comentário sem intervalo disponível';
          values[values.length-1]=narrationText(row);
          rows.push(...appendComments([rows[0].slice(0,-1),values.slice(0,-1)],[values.at(-1)]).slice(1));
        }
      }
      const blob=workbookBlob(rows,communicationSummary(selected,now)),url=URL.createObjectURL(blob),link=document.createElement('a');
      link.href=url;link.download='rotina-supervisor.xlsx';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
    });
  }
  async function printActivityReport(session,now=Date.now(),observation=()=> '') {
    if(!session)return;
    return run(async()=>{
      const loaded=await load([session]),rows=loaded.get(session.id),content=document.createElement('div');
      const add=(parent,tag,text)=>{const node=document.createElement(tag);node.textContent=text;parent.appendChild(node);return node;};
      const duration=value=>{const seconds=Math.max(0,Math.floor(value/1000));return `${Math.floor(seconds/3600)}h ${Math.floor(seconds/60)%60}min ${seconds%60}s`;};
      const narrations=(card,text)=>{if(text){add(card,'h3','Comentários e relatos de narração');const node=add(card,'p',text);node.className='activity-details';node.style.whiteSpace='pre-wrap';node.style.overflowWrap='anywhere';}};
      let total=0;
      for(const segment of session.segments) {
        const activity=session.activities.find(item=>item.id===segment.activityId),elapsed=Math.max(0,(segment.end??Math.min(now,session.end??now))-segment.start);total+=elapsed;
        const card=document.createElement('article');card.className='activity-report-entry';
        add(card,'h2',activity?.description||'Sem descrição');
        add(card,'p',`${time(segment.start)} até ${segment.end==null?'Em andamento':time(segment.end)} | Duração: ${duration(elapsed)}`);
        add(card,'p',`Categoria: ${activity?.category||'Sem categoria'} | Demanda: ${activity?.demand??(activity?.planned?'Planejada':'Imprevista')}`);
        add(card,'h3','Detalhes da atividade');add(card,'p',activity?.details||'Sem detalhes informados.').className='activity-details';
        const note=activity?observation(session,activity.id):'';if(note)add(card,'p','Observação: '+note).style.whiteSpace='pre-wrap';
        const communications=communicationText(session,segment,now);if(communications){add(card,'h3','Comunicações incluídas nesta atividade');add(card,'p',communications).className='activity-details';}
        narrations(card,commentsForSegment(rows,segment));content.appendChild(card);
      }
      for(const row of rows.filter(row=>!session.segments.some(segment=>segment.id===row.segment_id))) {
        const card=document.createElement('article');card.className='activity-report-entry';add(card,'h2','Comentário sem intervalo disponível');narrations(card,narrationText(row));content.appendChild(card);
      }
      printDashboard(content,{now,reportTitle:'Relatório de atividades e comentários',reportMetadata:`Supervisor: ${session.supervisor} | Observador: ${session.observer} | Território / Posto: ${session.region}\nInício: ${time(session.start)} | Tempo registrado: ${duration(total)} | Gerado em: ${time(now)}`});
    });
  }
  return {downloadExcel,printActivityReport};
}
