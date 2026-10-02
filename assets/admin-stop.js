export function endByAdmin(session, reason, actor, now=Date.now()) {
 if(!session || session.end!==null)throw Error('Este acompanhamento já foi encerrado. Atualize a página.');
 if(typeof reason!=='string'||!reason.trim()||reason.trim().length>1000)throw Error('Informe o motivo (até 1000 caracteres).');
 if(!Number.isFinite(session.start)||session.start>now||!Array.isArray(session.segments)||session.segments.some(s=>!Number.isFinite(s.start)||s.start>now||s.start<session.start||(s.end!==null&&(!Number.isFinite(s.end)||s.end<s.start||s.end>now))))throw Error('Os horários registrados estão inconsistentes com o horário do servidor.');
 const result=structuredClone(session);result.end=now;result.paused=[];result.segments=result.segments.map(s=>s.end===null?{...s,end:now}:s);result.adminClosure={at:now,by:actor,reason:reason.trim()};return result;
}
export function createAdminStop(React,client){const h=React.createElement;return function AdminStop({session,isAdmin,onSaved}){
 const [reason,setReason]=React.useState(''),[busy,setBusy]=React.useState(false),[message,setMessage]=React.useState('');const lock=React.useRef(false);
 React.useEffect(()=>{setReason('');setMessage('');},[session?.id]);
 if(!isAdmin||!session)return null;
 if(session.end!==null)return session.adminClosure?h('p',{className:'hint'},'Encerrado pelo administrador em '+new Date(session.adminClosure.at).toLocaleString('pt-BR')+' · '+session.adminClosure.reason+' · '+session.adminClosure.by):null;
 async function submit(event){event.preventDefault();if(lock.current||!reason.trim())return;
 if(!window.confirm('Encerrar agora o acompanhamento de '+session.supervisor+' (observador: '+session.observer+')? A medição será finalizada e as atividades preservadas.'))return;
 lock.current=true;setBusy(true);setMessage('');try{const {ownerId,...expected}=session;const result=await client.functions.invoke('manage-users',{body:{action:'admin-end-session',id:session.id,reason,expected}});if(result.error){let msg=result.error.message;try{msg=(await result.error.context.json()).error||msg;}catch{}throw Error(msg);}if(!result.data?.ok)throw Error(result.data?.error||'Não foi possível encerrar.');setMessage('Acompanhamento encerrado.');try{await onSaved?.();}catch{setMessage('Encerrado. Atualize a página para carregar o resultado.');}}catch(e){setMessage(e.message);}finally{lock.current=false;setBusy(false);}}
 return h('section',{className:'panel'},h('h3',null,'Encerrar acompanhamento do auditor'),h('p',null,'O cronômetro será encerrado no horário atual do servidor. As atividades registradas serão mantidas.'),h('form',{onSubmit:submit},h('label',null,'Motivo do encerramento',h('textarea',{required:true,maxLength:1000,disabled:busy,rows:2,value:reason,onChange:e=>setReason(e.target.value)})),h('button',{className:'primary',disabled:busy||!reason.trim()},busy?'Encerrando…':'Encerrar acompanhamento do auditor')),message&&h('p',{role:'status'},message));
};}
