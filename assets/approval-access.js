export function createApprovalAccess(React, client, manage) {
  const h = React.createElement;
  function FirstAccess({ onBack }) {
    const [email,setEmail] = React.useState('');
    const [password,setPassword] = React.useState('');
    const [confirmation,setConfirmation] = React.useState('');
    const [busy,setBusy] = React.useState(false);
    const [done,setDone] = React.useState(false);
    const [message,setMessage] = React.useState('');
    const lock = React.useRef(false);
    async function submit(event) {
      event.preventDefault(); if(lock.current) return;
      if(password!==confirmation) {setMessage('As senhas não coincidem.');return;}
      if(password.length<12 || new TextEncoder().encode(password).length>72) {setMessage('Use pelo menos 12 caracteres e até 72 bytes.');return;}
      lock.current=true;setBusy(true);setMessage('');
      try {
        const result = await client.functions.invoke('first-access',{body:{email:email.trim(),password}});
        if(result.error || !result.data?.ok) throw Error(result.data?.error || 'Não foi possível enviar. Aguarde alguns minutos e tente novamente.');
        setPassword('');setConfirmation('');setDone(true);setMessage(result.data.message);
      } catch(error) {setMessage(error.message);} finally {lock.current=false;setBusy(false);}
    }
    const field = (label,props) => h('label',null,label,h('input',{required:true,disabled:busy,...props}));
    return h('section',{className:'panel auth-card'},h('h1',null,'Primeiro acesso — criar senha'),
      h('p',null,'Informe o e-mail cadastrado pelo administrador e escolha sua senha. O acesso será liberado após a aprovação.'),
      !done && h('form',{onSubmit:submit},
        field('E-mail cadastrado',{type:'email',autoComplete:'email',value:email,onChange:e=>setEmail(e.target.value)}),
        field('Nova senha (mínimo 12 caracteres)',{type:'password',autoComplete:'new-password',minLength:12,value:password,onChange:e=>setPassword(e.target.value)}),
        field('Confirmar senha',{type:'password',autoComplete:'new-password',minLength:12,value:confirmation,onChange:e=>setConfirmation(e.target.value)}),
        h('button',{className:'primary',disabled:busy},busy?'Enviando…':'Solicitar aprovação')),
      message && h('p',{role:'status'},message),h('button',{disabled:busy,onClick:onBack},'Voltar ao login'));
  }
  function PendingApprovals() {
    const [rows,setRows]=React.useState([]),[busy,setBusy]=React.useState(false),[message,setMessage]=React.useState('');
    const alive=React.useRef(true), lock=React.useRef(false);
    async function load() {const result=await manage({action:'list'});if(alive.current)setRows(result.enrollments||[]);}
    React.useEffect(()=>{alive.current=true;load().catch(()=>{if(alive.current)setMessage('Não foi possível carregar os primeiros acessos.');});return()=>{alive.current=false;};},[]);
    async function action(row,type) {
      const text=type==='approve'?`Você confirmou diretamente com ${row.name} (${row.email}) que foi essa pessoa quem solicitou acesso? Perfil: ${row.role==='admin'?'Administrador':'Auditor'}.`:'Rejeitar esta solicitação e permitir que a pessoa envie uma nova senha?';
      if(lock.current||!window.confirm(text))return;
      lock.current=true;setBusy(true);setMessage('');
      try{await manage({action:type,id:row.id});await load();setMessage(type==='approve'?'Acesso aprovado. Avise a pessoa para entrar com a senha escolhida.':'Solicitação rejeitada. A pessoa pode tentar novamente.');}
      catch(error){setMessage(error.message);await load().catch(()=>{});}finally{lock.current=false;setBusy(false);}
    }
    const states={registered:'Aguardando definição de senha',processing:'Recebendo solicitação',pending:'Aguardando aprovação',approving:'Aprovação em processamento',error:'Revisão técnica necessária'};
    return h('section',{className:'panel history'},h('h2',null,'Primeiros acessos'),
      h('p',null,'Antes de aprovar, confirme com a pessoa por um contato que você já conhece. Nenhum e-mail é enviado por este fluxo.'),
      h('button',{disabled:busy,onClick:()=>load().catch(()=>setMessage('Não foi possível atualizar.'))},'Atualizar solicitações'),
      message&&h('p',{role:'status'},message),
      rows.length?h('div',{className:'table-wrap'},h('table',null,h('thead',null,h('tr',null,...['Nome / E-mail','Perfil','Situação','Solicitado em','Ações'].map(text=>h('th',{key:text},text)))),
        h('tbody',null,...rows.map(row=>h('tr',{key:row.id},h('td',null,row.name,h('small',null,row.email)),h('td',null,row.role==='admin'?'Administrador':'Auditor'),h('td',null,states[row.status]||row.status),h('td',null,row.requested_at?new Date(row.requested_at).toLocaleString('pt-BR'):'—'),h('td',null,row.status==='pending'&&h('div',{className:'actions'},h('button',{className:'primary',disabled:busy,onClick:()=>action(row,'approve')},'Aprovar acesso'),h('button',{disabled:busy,onClick:()=>action(row,'reject')},'Rejeitar e permitir nova tentativa')))))))):
      h('p',null,'Nenhum primeiro acesso pendente.'));
  }
  return {FirstAccess,PendingApprovals};
}
