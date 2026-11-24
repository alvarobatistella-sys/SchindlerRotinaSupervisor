import {splitCommunication,deleteCommunication,localDateTime} from './communication-actions-20261124-troca.js';
export const channelNames={whatsapp:'WhatsApp interno',phone:'Telefone interno',whatsapp_client:'WhatsApp cliente',phone_client:'Telefone cliente',email_client:'E-mail cliente',email_internal:'E-mail interno',experience_exchange:'Troca Experiencia'};
export function communicationRows(session,now=Date.now()){
 return (session?.communications||[]).flatMap(record=>{
  const segment=session.segments.find(s=>s.id===record.segmentId);
  if(!segment)return [];
  const end=Math.min(record.end??now,segment.end??now,session.end??now);
  const start=Math.max(record.start,segment.start);
  return end<start?[]:[{...record,activityId:segment.activityId,start,end,duration:end-start,running:record.end===null&&segment.end===null&&session.end===null}];
 });
}
export function communicationDefaults(channel,entries){
 const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
 const names=({whatsapp:['whatsapp interno','whatsapp internos'],phone:['telefone interno','telefone internos'],whatsapp_client:['whatsapp cliente','whatsapp clientes'],phone_client:['telefone cliente','telefone clientes'],email_client:['e-mail cliente','email cliente','e-mail clientes','email clientes'],email_internal:['e-mail interno','email interno','e-mail internos','email internos'],experience_exchange:['troca experiencia','troca de experiencia','troca experiencias','troca de experiencias']})[channel]||[];
 const matches=entries.filter(e=>names.includes(normalize(e.description)));
 if(matches.length===0&&channel==='experience_exchange')return {category:'Pessoas',value_added:null,catalogId:null,code:null};
 if(matches.length===0&&channel.startsWith('email_'))return {category:channel==='email_client'?'Clientes':'Administrativas',value_added:null,catalogId:null,code:null};
 if(matches.length!==1)throw Error('Cadastre uma única descrição '+channelNames[channel]+' em Configurações, com categoria e valor agregado.');
 const e=matches[0];return {category:e.group_name,value_added:['VA','NVA','NNVA'].includes(e.value_added)?e.value_added:null,catalogId:e.id,code:e.code||null};
}
export function toggleCommunication(session,channel,now=Date.now(),entries=[]){
 if(!channelNames[channel])throw Error('Canal inválido.');
 const segment=session.segments.find(s=>s.end===null);
 const activity=session.activities.find(a=>a.id===segment?.activityId);
 if(session.end!==null||!segment||!activity||activity.idle)throw Error('Inicie uma atividade antes de registrar a comunicação.');
 const next=structuredClone(session);next.communications??=[];
 const active=next.communications.find(r=>r.end===null&&r.segmentId===segment.id);
 if(now<segment.start||next.communications.some(r=>r.end===null&&now<r.start))throw Error('Confira o relógio do dispositivo.');
 for(const record of next.communications)if(record.end===null)record.end=now;
 if(active?.channel!==channel)next.communications.push({...communicationDefaults(channel,entries),id:crypto.randomUUID(),channel,description:channelNames[channel],activityId:activity.id,segmentId:segment.id,start:now,end:null});
 return next;
}
export function closeCommunications(session,now){
 for(const record of session.communications||[])if(record.end===null)record.end=Math.max(record.start,now);
 return session;
}
const duration=value=>{const n=Math.floor(value/1000);return [Math.floor(n/3600),Math.floor(n/60)%60,n%60].map(v=>String(v).padStart(2,'0')).join(':');};
export function communicationText(session,segment,now){
 return communicationRows(session,now).filter(r=>r.segmentId===segment.id).map(r=>channelNames[r.channel]+' · '+new Date(r.start).toLocaleTimeString('pt-BR')+'–'+(r.running?'em andamento':new Date(r.end).toLocaleTimeString('pt-BR'))+' · '+duration(r.duration)+(r.subject?' · Assunto: '+r.subject:'')+' · Categoria: '+(r.category||'Sem categoria')+' · Classificação: '+(r.value_added||'Sem classificação')).join('\n');
}
export function updateCommunicationSubject(session,id,subject,expected){
 const record=(session.communications||[]).find(r=>r.id===id);
 if(!record)throw Error('Comunicação não encontrada. Atualize a página.');
 if((record.subject||'')!==expected)throw Error('O assunto mudou em outro aparelho. Cancele e abra novamente.');
 const text=subject.trim();if(text.length>5000)throw Error('O assunto deve ter até 5000 caracteres.');
 return {...session,communications:session.communications.map(r=>r.id===id?{...r,subject:text}:r)};
}
export function updateCommunicationDetails(session,id,draft,expected,categories=[]){
 const record=(session.communications||[]).find(r=>r.id===id);
 if(!record)throw Error('Comunicação não encontrada.');
 for(const key of ['subject','category','value_added'])if((record[key]||'')!==(expected[key]||''))throw Error('A comunicação mudou em outro aparelho. Cancele e abra novamente.');
 const subject=(draft.subject||'').trim(),category=draft.category||'',value_added=draft.value_added||null;
 if(subject.length>5000)throw Error('O assunto deve ter até 5000 caracteres.');
 if(category&&!categories.includes(category)&&category!==(record.category||''))throw Error('Escolha uma categoria cadastrada.');
 if(value_added&&!['VA','NVA','NNVA'].includes(value_added))throw Error('Classificação inválida.');
 return {...session,communications:session.communications.map(r=>r.id===id?{...r,subject,category,value_added}:r)};
}
export function createCommunicationUI(React){
 const h=React.createElement;
 function Icon({channel}){if(channel.startsWith('email_'))return h('svg',{width:22,height:22,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.8,'aria-hidden':true},h('rect',{x:3,y:5,width:18,height:14,rx:2}),h('path',{d:'m3 6 9 7 9-7'}));return h('svg',{width:22,height:22,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.8,'aria-hidden':true},
 channel.startsWith('whatsapp')&&h('path',{d:'M21 11.5a9 9 0 0 1-13.5 7.8L3 21l1.6-4.6A9 9 0 1 1 21 11.5Z'}),
 h('path',{d:'M8 6l2 3-1.5 1.5a10 10 0 0 0 5 5L15 14l3 2c-1 4-5 2-8-1S5 9 8 6Z'}));}
 function Controls({session,now,disabled,onSave,entries=[]}){
 const [busy,setBusy]=React.useState(false),[error,setError]=React.useState('');const lock=React.useRef(false);
 const segment=session.segments.find(s=>s.end===null),activity=session.activities.find(a=>a.id===segment?.activityId);
 const active=communicationRows(session,now).find(r=>r.running);
 async function toggle(channel){if(lock.current)return;lock.current=true;setBusy(true);setError('');try{if(!await onSave(toggleCommunication(session,channel,Date.now(),entries)))setError('Não foi possível salvar. Tente novamente.');}catch(e){setError(e.message);}finally{lock.current=false;setBusy(false);}}
 return h('div',{className:'communication-controls'},h('p',null,'Comunicação dentro da atividade'),
 h('div',{className:'actions',style:{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:8,alignItems:'stretch',maxWidth:620}},
 h('strong',{style:{color:'#167a43',fontSize:12}},'Clientes'),h('strong',{style:{color:'#167a43',fontSize:12}},'Internos'),
 ...['whatsapp_client','whatsapp','phone_client','phone','email_client','email_internal'].map(key=>h('button',{key,type:'button',disabled:disabled||busy||!activity||activity.idle||session.end!==null,'aria-pressed':active?.channel===key,onClick:()=>toggle(key),style:{display:'inline-flex',alignItems:'center',justifyContent:'flex-start',gap:8,width:'100%',minWidth:0,whiteSpace:'normal',textAlign:'left',background:active?.channel===key?'#167a43':'#fff',color:active?.channel===key?'white':'#167a43'}},h(Icon,{channel:key}),channelNames[key],active?.channel===key?' · Encerrar':''))),
 h('div',{className:'actions',style:{marginTop:12}},h('button',{type:'button',disabled:disabled||busy||!activity||activity.idle||session.end!==null,'aria-pressed':active?.channel==='experience_exchange',onClick:()=>toggle('experience_exchange'),style:{display:'inline-flex',alignItems:'center',justifyContent:'center',gap:8,background:active?.channel==='experience_exchange'?'#164c91':'#2467b4',borderColor:'#164c91',color:'#fff'}},'Troca Experiencia',active?.channel==='experience_exchange'?' · Encerrar':'')),
 active&&h('p',{role:'status'},channelNames[active.channel]+' em andamento · '+duration(active.duration)),
 h('small',null,'Clique para iniciar; clique novamente para encerrar. O tempo está incluído na atividade principal.'),error&&h('p',{role:'alert'},error));
 }


 function SubjectRow({session,row,columns,disabled,onSave,categories=[]}){
 const [splitting,setSplitting]=React.useState(false),[splitAt,setSplitAt]=React.useState(''),[snapshot,setSnapshot]=React.useState(null);
 const [editing,setEditing]=React.useState(false),[draft,setDraft]=React.useState({}),[original,setOriginal]=React.useState(null),[busy,setBusy]=React.useState(false),[error,setError]=React.useState('');const lock=React.useRef(false);
 const fields=r=>({subject:r.subject||'',category:r.category||'',value_added:r.value_added||''});
 const change=(key,value)=>setDraft(previous=>({...previous,[key]:value}));
 async function save(event){event.preventDefault();if(lock.current||disabled)return;lock.current=true;setBusy(true);setError('');try{if(await onSave(updateCommunicationDetails(session,row.id,draft,original,categories)))setEditing(false);else setError('Não foi possível salvar. Tente novamente.');}catch(e){setError(e.message);}finally{lock.current=false;setBusy(false);}}
 const raw=(session.communications||[]).find(item=>item.id===row.id),ended=Number.isFinite(raw?.end);
 async function applyChange(change){if(lock.current||disabled)return;lock.current=true;setBusy(true);setError('');try{if(await onSave(change())){setSplitting(false);setSnapshot(null);}else setError('Não foi possível salvar. Tente novamente.');}catch(e){setError(e.message);}finally{lock.current=false;setBusy(false);}}
 const edit=h('div',{className:'actions'},h('button',{type:'button',disabled:disabled||busy,onClick:()=>{setDraft(fields(row));setOriginal(fields(row));setError('');setSplitting(false);setEditing(true);}},'Editar comunicação'),
 h('button',{type:'button',disabled:disabled||busy||!ended,title:ended?'Dividir o horário desta subatividade':'Encerre a subatividade primeiro',onClick:()=>{setSnapshot(structuredClone(raw));setSplitAt(localDateTime(Math.floor((raw.start+raw.end)/2000)*1000));setError('');setSplitting(true);setEditing(false);}},'Quebrar'),
 h('button',{type:'button',disabled:disabled||busy||!ended,style:{color:'#d52846'},title:ended?'Excluir somente esta subatividade':'Encerre a subatividade primeiro',onClick:()=>{const expected=structuredClone(raw);if(window.confirm('Excluir '+channelNames[row.channel]+' de '+new Date(row.start).toLocaleString('pt-BR')+' até '+new Date(row.end).toLocaleString('pt-BR')+'? O tempo da atividade principal será mantido.'))void applyChange(()=>deleteCommunication(session,expected));}},'Excluir'));
 return h(React.Fragment,null,h('tr',{className:'communication-subrow',style:{background:'#f5faf7'}},
 h('td',null,new Date(row.start).toLocaleTimeString('pt-BR'),h('small',null,row.running?'Em andamento':'até '+new Date(row.end).toLocaleTimeString('pt-BR'))),
 h('td',null,h('strong',null,'↳ '+channelNames[row.channel]),h('p',{style:{whiteSpace:'pre-wrap'}},row.subject||'Assunto ainda não informado.'),columns===6&&!editing&&!splitting&&edit),
 h('td',null,h('span',{className:'category'},row.category||'Sem categoria'),h('small',null,row.value_added||'Sem classificação')),
 h('td',null,'—'),
 h('td',{className:'mono'},duration(row.duration),h('small',null,'Incluído no tempo principal')),
 h('td',null,'Subatividade'),
 columns===7&&h('td',null,!editing&&!splitting&&edit)),
 splitting&&h('tr',{style:{background:'#f5faf7'}},h('td',{colSpan:columns},h('form',{onSubmit:event=>{event.preventDefault();void applyChange(()=>splitCommunication(session,snapshot,new Date(splitAt).getTime()));}},
 h('h4',null,'Quebrar subatividade — '+channelNames[row.channel]),h('p',null,'Escolha onde dividir o intervalo. Os dois trechos manterão o assunto e a classificação; você poderá editá-los separadamente.'),
 h('label',null,'Data e horário da quebra',h('input',{type:'datetime-local',step:1,required:true,min:localDateTime(snapshot.start),max:localDateTime(snapshot.end),value:splitAt,disabled:busy,onChange:event=>setSplitAt(event.target.value)})),
 h('div',{className:'actions'},h('button',{type:'submit',disabled:busy||disabled},busy?'Salvando…':'Confirmar quebra'),h('button',{type:'button',disabled:busy,onClick:()=>{setSplitting(false);setError('');}},'Cancelar')),error&&h('p',{role:'alert'},error)))),
 !editing&&!splitting&&error&&h('tr',null,h('td',{colSpan:columns},h('p',{role:'alert'},error))),
 editing&&h('tr',{style:{background:'#f5faf7'}},h('td',{colSpan:columns},h('form',{onSubmit:save},
 h('label',null,'Do que se tratou?',h('textarea',{rows:3,maxLength:5000,value:draft.subject,disabled:busy,onChange:e=>change('subject',e.target.value)})),
 h('div',{className:'fields two'},h('label',null,'Categoria',h('select',{value:draft.category,disabled:busy,onChange:e=>change('category',e.target.value)},h('option',{value:''},'Sem categoria'),...[...new Set([...categories,row.category].filter(Boolean))].sort().map(c=>h('option',{key:c,value:c},c)))),
 h('label',null,'Valor agregado',h('select',{value:draft.value_added,disabled:busy,onChange:e=>change('value_added',e.target.value)},h('option',{value:''},'Sem classificação'),...['VA','NVA','NNVA'].map(v=>h('option',{key:v,value:v},v))))),
 h('div',{className:'actions'},h('button',{type:'submit',disabled:busy||disabled},busy?'Salvando…':'Salvar comunicação'),h('button',{type:'button',disabled:busy,onClick:()=>setEditing(false)},'Cancelar')),
 error&&h('p',{role:'alert'},error)))));
 }
 function InlineRows({session,segment,now,columns,disabled,onSave,categories=[]}){
 return h(React.Fragment,null,...communicationRows(session,now).filter(r=>r.segmentId===segment.id).sort((a,b)=>a.start-b.start).map(row=>h(SubjectRow,{key:row.id,session,row,columns,disabled,onSave,categories})));
 }
 function History({session,now}){
 const rows=communicationRows(session,now);if(!rows.length)return null;
 return h('section',{className:'panel'},h('h3',null,'Comunicações dentro das atividades'),...session.activities.filter(a=>rows.some(r=>r.activityId===a.id)).map(a=>{
 const items=rows.filter(r=>r.activityId===a.id),total=items.reduce((sum,r)=>sum+r.duration,0),parent=session.segments.filter(s=>s.activityId===a.id).reduce((sum,s)=>sum+Math.max(0,(s.end??Math.min(now,session.end??now))-s.start),0);
 return h('details',{key:a.id,open:true},h('summary',null,a.description+' · '+duration(total)+' de comunicação ('+(parent?total/parent*100:0).toFixed(1)+'%)'),
 ...Object.entries(channelNames).map(([key,label])=>{const list=items.filter(r=>r.channel===key);return list.length?h('p',{key},label+': '+list.length+' uso(s) · '+duration(list.reduce((s,r)=>s+r.duration,0))):null;}),
 h('ul',null,...items.map(r=>h('li',{key:r.id},channelNames[r.channel]+' · '+new Date(r.start).toLocaleTimeString('pt-BR')+' até '+(r.running?'Em andamento':new Date(r.end).toLocaleTimeString('pt-BR'))+' · '+duration(r.duration)))));
 }),h('small',null,'Esses tempos já estão incluídos na atividade principal.'));
 }
 return {Controls,History,InlineRows};
}
