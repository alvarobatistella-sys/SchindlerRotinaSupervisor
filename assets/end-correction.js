export function correctSessionEnd(session, end, reason, actor, now = Date.now()) {
  if (!session || !Number.isFinite(session.start) || !Number.isFinite(session.end)) throw Error('Selecione uma medição encerrada.');
  if (!Number.isSafeInteger(end) || end <= session.start || end >= session.end || end > now) throw Error('O encerramento deve ser posterior ao início e anterior ao encerramento atual.');
  if (typeof reason !== 'string' || !reason.trim() || reason.trim().length > 1000) throw Error('Informe o motivo da correção (até 1000 caracteres).');
  if (!Array.isArray(session.segments) || session.segments.some(s => !Number.isFinite(s.start) || !Number.isFinite(s.end) || s.end < s.start || s.start < session.start || s.end > session.end)) throw Error('A linha do tempo contém horários inválidos. Revise os registros antes de corrigir.');
  const result = structuredClone(session);
  result.segments = result.segments.filter(s => s.start < end).map(s => ({...s, end: Math.min(s.end, end)}));
  result.end = end;
  result.endCorrections = [...(session.endCorrections || []), {at:now, by:actor, reason:reason.trim(), previousEnd:session.end, correctedEnd:end, previousSegments:structuredClone(session.segments)}];
  return result;
}
export function samePayload(a,b) {
  const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key,stable(value[key])])) : value;
  return JSON.stringify(stable(a)) === JSON.stringify(stable(b));
}
export function createEndCorrection(React,client) {
 const h=React.createElement;
 const local=value=>{const d=new Date(value);return new Date(value-d.getTimezoneOffset()*60000).toISOString().slice(0,19);};
 return function EndCorrection({session,isAdmin,onSaved}) {
  const [base,setBase]=React.useState(null),[value,setValue]=React.useState(''),[reason,setReason]=React.useState(''),[busy,setBusy]=React.useState(false),[message,setMessage]=React.useState('');
  const lock=React.useRef(false);
  React.useEffect(()=>{setBase(null);setMessage('');},[session?.id]);
  if(!isAdmin || !session || session.end==null)return null;
  let preview=null,error='';
  if(base)try{preview=correctSessionEnd(base,new Date(value).getTime(),reason,'preview');}catch(e){error=e.message;}
  async function save(event) {
   event.preventDefault();if(lock.current||!preview)return;
   if(!window.confirm('Salvar a correção? Os trechos posteriores ao novo encerramento serão retirados dos totais. O histórico anterior será preservado.'))return;
   lock.current=true;setBusy(true);setMessage('');
   try {
    const {ownerId,...expected}=base;
    const result=await client.functions.invoke('manage-users',{body:{action:'correct-session-end',id:base.id,end:new Date(value).getTime(),reason,expected}});
    if(result.error){let msg=result.error.message;try{msg=(await result.error.context.json()).error||msg;}catch{}throw Error(msg);}
    if(!result.data?.ok)throw Error(result.data?.error||'Não foi possível salvar.');
    setBase(null);setMessage('Encerramento corrigido. Os totais foram recalculados.');
    try{await onSaved?.();}catch{setMessage('Correção salva. Atualize a página para carregar os totais.');}
   }catch(e){setMessage(e.message);}finally{lock.current=false;setBusy(false);}
  }
  const fmt=value=>new Date(value).toLocaleString('pt-BR');
  return h('section',{className:'panel end-correction'},
   h('h3',null,'Encerramento da medição'),h('p',null,'Início: '+fmt(session.start)+' · Encerramento: '+fmt(session.end)),
   !base?h('button',{type:'button',onClick:()=>{setBase(structuredClone(session));setValue(local(session.end));setReason('');setMessage('');}},'Corrigir horário de encerramento'):
   h('form',{onSubmit:save},h('p',null,'Use esta opção quando a medição foi encerrada depois do horário correto. Os trechos posteriores ao novo horário deixam de entrar nos relatórios.'),
    h('label',null,'Encerramento correto',h('input',{type:'datetime-local',step:1,required:true,disabled:busy,value,onChange:e=>setValue(e.target.value)})),
    h('label',null,'Motivo da correção',h('textarea',{required:true,maxLength:1000,rows:3,disabled:busy,value:reason,onChange:e=>setReason(e.target.value)})),
    preview?h('p',{role:'status'},'Tempo retirado dos registros: '+Math.round((base.segments.reduce((t,s)=>t+s.end-s.start,0)-preview.segments.reduce((t,s)=>t+s.end-s.start,0))/1000)+' segundos. Trechos retirados: '+(base.segments.length-preview.segments.length)+'.'):h('p',null,error),
    h('div',{className:'actions'},h('button',{className:'primary',disabled:busy||!preview},busy?'Salvando…':'Salvar encerramento'),h('button',{type:'button',disabled:busy,onClick:()=>setBase(null)},'Cancelar'))),
   message&&h('p',{role:'status'},message),
   (session.endCorrections||[]).length>0&&h('details',null,h('summary',null,'Histórico de correções'),...(session.endCorrections||[]).map((item,i)=>h('p',{key:i},fmt(item.at)+' · '+fmt(item.previousEnd)+' → '+fmt(item.correctedEnd)+' · '+item.reason+' · Administrador: '+item.by)))
  );
 };
}
