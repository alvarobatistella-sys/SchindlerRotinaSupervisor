export function validWorkLimit(value) {
 if(value==null)return null;
 if(!value || !['time','duration'].includes(value.mode) || typeof value.value!=='string')throw Error('Limite de trabalho inválido.');
 if(value.mode==='time' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.value))throw Error('Informe um horário entre 00:00 e 23:59.');
 if(value.mode==='duration' && (!/^\d{1,2}:[0-5]\d$/.test(value.value) || durationMinutes(value.value)<1 || durationMinutes(value.value)>24*60))throw Error('Informe uma duração entre 00:01 e 24:00.');
 return {mode:value.mode,value:value.value};
}
function durationMinutes(value){const [h,m]=value.split(':').map(Number);return h*60+m;}
export function workDeadline(session,limit){
 if(!session || session.end!==null || !limit)return null;
 validWorkLimit(limit);
 if(limit.mode==='duration')return session.start+durationMinutes(limit.value)*60000;
 const date=new Date(session.start),[h,m]=limit.value.split(':').map(Number);date.setHours(h,m,0,0);return date.getTime();
}
export function createWorkLimits(React,client,manage){
 const h=React.createElement;
 function Fields({value,onChange,disabled=false}){const mode=value?.mode||'none';return h('div',{className:'work-limit-fields'},
 h('select',{'aria-label':'Tipo de limite de trabalho',value:mode,disabled,onChange:e=>onChange(e.target.value==='none'?null:{mode:e.target.value,value:e.target.value==='time'?'18:00':'08:00'})},h('option',{value:'none'},'Sem limite'),h('option',{value:'time'},'Horário do dia'),h('option',{value:'duration'},'Duração máxima')),
 mode!=='none'&&h('input',{'aria-label':mode==='time'?'Horário limite':'Duração máxima em horas e minutos',type:mode==='time'?'time':'text',placeholder:'08:00',required:true,disabled,value:value.value,onChange:e=>onChange({...value,value:e.target.value})}),
 mode!=='none'&&h('small',null,mode==='time'?'Horário local do computador do auditor.':'Horas:minutos desde o início, incluindo pausas.'));
 }
 function Editor({user,onSaved}){const [value,setValue]=React.useState(user.work_limit||null),[busy,setBusy]=React.useState(false),[msg,setMsg]=React.useState('');React.useEffect(()=>setValue(user.work_limit||null),[user.id,JSON.stringify(user.work_limit)]);
 async function save(){if(busy)return;setBusy(true);setMsg('');try{validWorkLimit(value);await manage({action:'set-work-limit',id:user.id,work_limit:value});setMsg('Limite salvo.');await onSaved?.();}catch(e){setMsg(e.message);}finally{setBusy(false);}}
 if(user.role!=='auditor')return h('span',null,'—');return h('div',null,h(Fields,{value,onChange:setValue,disabled:busy}),h('button',{type:'button',disabled:busy,onClick:save},busy?'Salvando…':'Salvar limite'),msg&&h('small',{role:'status'},msg));}
 function Reminder({userId,session,now,onEnd}){
 const [limit,setLimit]=React.useState(null),[loadError,setLoadError]=React.useState(''),[busy,setBusy]=React.useState(false),[until,setUntil]=React.useState(0),[msg,setMsg]=React.useState('');
 React.useEffect(()=>{let alive=true;async function load(){try{const r=await client.from('portal_profiles').select('role,work_limit').eq('id',userId).single();if(r.error)throw r.error;if(alive){setLimit(r.data.role==='auditor'?r.data.work_limit:null);setLoadError('');}}catch{if(alive)setLoadError('Não foi possível consultar o limite de trabalho.');}}load();const id=setInterval(load,30000);const resume=()=>load();window.addEventListener('focus',resume);return()=>{alive=false;clearInterval(id);window.removeEventListener('focus',resume);};},[userId]);
 let deadline=null;try{deadline=workDeadline(session,limit);}catch{}
 const key='work-limit:'+userId+':'+session?.id+':'+JSON.stringify(limit);
 React.useEffect(()=>{try{setUntil(Number(sessionStorage.getItem(key))||0);}catch{setUntil(0);}setMsg('');},[key]);
 if(!session)return null;
 if(loadError)return h('p',{role:'status'},loadError);
 if(deadline==null||now<deadline||now<until)return null;
 async function finish(){setBusy(true);setMsg('');try{if(!await onEnd())setMsg('O acompanhamento ainda não foi encerrado. Confira a mensagem da página.');}catch(e){setMsg(e.message);}finally{setBusy(false);}}
 return h('section',{className:'panel work-limit-alert',role:'alert','aria-label':'Limite de trabalho atingido'},h('h2',null,'Limite de trabalho atingido'),h('p',null,'O limite definido para você foi atingido em '+new Date(deadline).toLocaleString('pt-BR')+'. Deseja encerrar o acompanhamento?'),h('p',null,'O encerramento será registrado no horário em que você confirmar.'),h('div',{className:'actions'},h('button',{className:'primary',disabled:busy,onClick:finish},busy?'Encerrando…':'Encerrar acompanhamento'),h('button',{disabled:busy,onClick:()=>{const next=Date.now()+15*60000;setUntil(next);try{sessionStorage.setItem(key,String(next));}catch{}}},'Continuar e lembrar em 15 minutos')),msg&&h('p',null,msg));
 }
 return {Fields,Editor,Reminder};
}
