export const channelNames={whatsapp:'WhatsApp',phone:'Telefone'};
export function communicationRows(session,now=Date.now()){
 return (session?.communications||[]).flatMap(record=>{
  const segment=session.segments.find(s=>s.id===record.segmentId);
  if(!segment)return [];
  const end=Math.min(record.end??now,segment.end??now,session.end??now);
  const start=Math.max(record.start,segment.start);
  return end<start?[]:[{...record,activityId:segment.activityId,start,end,duration:end-start,running:record.end===null&&segment.end===null&&session.end===null}];
 });
}
export function toggleCommunication(session,channel,now=Date.now()){
 if(!channelNames[channel])throw Error('Canal inválido.');
 const segment=session.segments.find(s=>s.end===null);
 const activity=session.activities.find(a=>a.id===segment?.activityId);
 if(session.end!==null||!segment||!activity||activity.idle)throw Error('Inicie uma atividade antes de registrar a comunicação.');
 const next=structuredClone(session);next.communications??=[];
 const active=next.communications.find(r=>r.end===null&&r.segmentId===segment.id);
 if(now<segment.start||next.communications.some(r=>r.end===null&&now<r.start))throw Error('Confira o relógio do dispositivo.');
 for(const record of next.communications)if(record.end===null)record.end=now;
 if(active?.channel!==channel)next.communications.push({id:crypto.randomUUID(),channel,activityId:activity.id,segmentId:segment.id,start:now,end:null});
 return next;
}
export function closeCommunications(session,now){
 for(const record of session.communications||[])if(record.end===null)record.end=Math.max(record.start,now);
 return session;
}
const duration=value=>{const n=Math.floor(value/1000);return [Math.floor(n/3600),Math.floor(n/60)%60,n%60].map(v=>String(v).padStart(2,'0')).join(':');};
export function communicationText(session,segment,now){
 return communicationRows(session,now).filter(r=>r.segmentId===segment.id).map(r=>channelNames[r.channel]+' · '+new Date(r.start).toLocaleTimeString('pt-BR')+'–'+(r.running?'em andamento':new Date(r.end).toLocaleTimeString('pt-BR'))+' · '+duration(r.duration)).join('\n');
}
export function createCommunicationUI(React){
 const h=React.createElement;
 function Icon({channel}){return h('svg',{width:22,height:22,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.8,'aria-hidden':true},
 channel==='whatsapp'&&h('path',{d:'M21 11.5a9 9 0 0 1-13.5 7.8L3 21l1.6-4.6A9 9 0 1 1 21 11.5Z'}),
 h('path',{d:'M8 6l2 3-1.5 1.5a10 10 0 0 0 5 5L15 14l3 2c-1 4-5 2-8-1S5 9 8 6Z'}));}
 function Controls({session,now,disabled,onSave}){
 const [busy,setBusy]=React.useState(false),[error,setError]=React.useState('');const lock=React.useRef(false);
 const segment=session.segments.find(s=>s.end===null),activity=session.activities.find(a=>a.id===segment?.activityId);
 const active=communicationRows(session,now).find(r=>r.running);
 async function toggle(channel){if(lock.current)return;lock.current=true;setBusy(true);setError('');try{if(!await onSave(toggleCommunication(session,channel)))setError('Não foi possível salvar. Tente novamente.');}catch(e){setError(e.message);}finally{lock.current=false;setBusy(false);}}
 return h('div',{className:'communication-controls'},h('p',null,'Comunicação dentro da atividade'),
 h('div',{className:'actions'},...Object.entries(channelNames).map(([key,label])=>h('button',{type:'button',disabled:disabled||busy||!activity||activity.idle||session.end!==null,'aria-pressed':active?.channel===key,onClick:()=>toggle(key),style:{display:'inline-flex',alignItems:'center',gap:8,background:active?.channel===key?'#167a43':'#fff',color:active?.channel===key?'white':'#167a43'}},h(Icon,{channel:key}),label,active?.channel===key?' · Encerrar':''))),
 active&&h('p',{role:'status'},channelNames[active.channel]+' em andamento · '+duration(active.duration)),
 h('small',null,'Clique para iniciar; clique novamente para encerrar. O tempo está incluído na atividade principal.'),error&&h('p',{role:'alert'},error));
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
 return {Controls,History};
}
