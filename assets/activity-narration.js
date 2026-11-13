import {createAudioRecorder,createDraftStore} from './narration-recorder.js';
const format=value=>new Date(value).toLocaleString('pt-BR');
const elapsed=ms=>new Date(Math.max(0,ms)).toISOString().slice(11,19);
function download(blob,name) {
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
export async function narrationCall(client,body) {
  const result=await client.functions.invoke('activity-narration',{body});
  if(result.error){let message=result.error.message;try{message=(await result.error.context.json()).error || message;}catch{}throw Error(message);}
  if(result.data?.error)throw Error(result.data.error);
  if(!result.data)throw Error('O serviço de narração não respondeu.');
  return result.data;
}
export function createNarrationFeature(React,client) {
  const h=React.createElement;
  const store=typeof indexedDB!=='undefined'?createDraftStore(indexedDB):null;
  function useNarration(userId,session,page) {
    const [capture,setCapture]=React.useState({state:'idle'}),[drafts,setDrafts]=React.useState([]),[message,setMessage]=React.useState('');
    const [ready,setReady]=React.useState(false),[checked,setChecked]=React.useState(false),[syncing,setSyncing]=React.useState([]),[version,setVersion]=React.useState(0);
    const live=React.useRef(),engine=React.useRef(),mounted=React.useRef(false),inflight=React.useRef(new Set());
    const scope=new URL(client.supabaseUrl).host+'/'+userId;
    const supported=typeof window!=='undefined'&&!!window.MediaRecorder&&!!navigator.mediaDevices?.getUserMedia&&!!store;
    live.current={session,page,userId,scope};
    const refreshDrafts=async()=>{if(store){const rows=await store.list(scope);if(mounted.current)setDrafts(rows);}};
    async function sync(record) {
      if(inflight.current.has(record.id))return;
      inflight.current.add(record.id);setSyncing([...inflight.current]);setMessage('Salvando áudio e preparando o relatório…');
      try {
        if(record.scope!==scope)throw Error('Esta gravação pertence a outro acesso.');
        const sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await record.blob.arrayBuffer()))).map(b=>b.toString(16).padStart(2,'0')).join('');
        const response=await narrationCall(client,{action:'prepare',id:record.id,sessionId:record.sessionId,
          segmentId:record.segmentId,startedAt:record.startedAt,endedAt:record.endedAt,mime:record.mime,bytes:record.blob.size,sha256});
        let row=response.row;
        if(response.upload) {
          const {error}=await client.storage.from('activity-narrations').uploadToSignedUrl(response.upload.path,response.upload.token,record.blob,{contentType:record.mime});
          if(error&&String(error.statusCode)!=='409')throw Error('O envio do áudio falhou. Ele continua salvo neste navegador.');
          row=(await narrationCall(client,{action:'process',id:record.id})).row;
        }
        if(row?.status==='completed') {
          await store.remove(record.id);await refreshDrafts();
          if(mounted.current)setMessage('Áudio, transcrição e relatório salvos. Revise o relatório abaixo.');
        } else if(mounted.current)setMessage('O servidor está processando a narração. Use Atualizar para consultar.');
      }catch(error){if(mounted.current)setMessage(error.message+' O áudio local foi preservado.');}
      finally{inflight.current.delete(record.id);if(mounted.current){setSyncing([...inflight.current]);setVersion(value=>value+1);}}
    }
    React.useEffect(()=>{
      mounted.current=true;
      void refreshDrafts().catch(()=>setMessage('Não foi possível abrir a cópia local de áudio neste navegador.'));
      narrationCall(client,{action:'health'}).then(result=>{if(mounted.current){setReady(!!result.ready);setChecked(true);}}).catch(()=>{if(mounted.current){setReady(false);setChecked(true);}});
      if(supported)engine.current=createAudioRecorder({mediaDevices:navigator.mediaDevices,Recorder:window.MediaRecorder,
        persist:record=>store.save(record),
        onChange:value=>{if(mounted.current)setCapture(value);},
        onSaved:record=>{if(mounted.current){void refreshDrafts();void sync(record);}}
      });
      return()=>{mounted.current=false;engine.current?.dispose();};
    },[scope]);
    const segment=session?.segments.find(item=>item.end===null);
    const activeSegmentId=segment?.id;
    React.useEffect(()=>{const recording=engine.current?.context;
      if(engine.current&&((recording&&recording.segmentId!==activeSegmentId)||page!=='Acompanhamento'))
        void engine.current.stop().catch(error=>{if(mounted.current)setMessage(error.message);});
    },[session?.id,activeSegmentId,page]);
    React.useEffect(()=>{
      const warn=event=>{if(capture.state==='recording'||capture.state==='requesting'||capture.state==='stopping'||capture.state==='unsaved'){event.preventDefault();event.returnValue='';}};
      window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);
    },[capture.state]);
    async function start() {
      try {
        const {session:current,page:currentPage}=live.current;
        const segment=current?.segments.find(s=>s.end===null),activity=current?.activities.find(a=>a.id===segment?.activityId);
        if(!ready||!supported)throw Error('Narração ainda não disponível neste navegador.');
        if(currentPage!=='Acompanhamento'||!segment||!activity||activity.idle||current.end!==null)throw Error('Inicie uma atividade antes de narrar.');
        setMessage('');
        await engine.current.start({scope,sessionId:current.id,segmentId:segment.id,activityId:activity.id,activityDescription:activity.description});
      }catch(error){setMessage(error.message);}
    }
    async function finish(){try{await engine.current?.stop();}catch(error){setMessage(error.message);}}
    async function stop(){try{await finish();}catch(error){setMessage(error.message);}}
    function rescue() {
      const record=engine.current?.pendingAudio;if(!record)return;
      download(record.blob,'narracao-recuperada.'+record.mime.split('/')[1]);
      engine.current.acknowledgeRecovery();
    }
    return {capture,drafts,message,ready,checked,supported,syncing,version,start,stop,finish,sync,rescue,refreshDrafts,
      activeId:engine.current?.context?.id,busyRecording:capture.state!=='idle',recording:capture.state==='recording'};
  }
  function SavedNarration({row,refresh}) {
    const [audio,setAudio]=React.useState(''),[editing,setEditing]=React.useState(false),[draft,setDraft]=React.useState(''),[busy,setBusy]=React.useState(false),[error,setError]=React.useState('');
    const lock=React.useRef(false);
    async function task(work){if(lock.current)return;lock.current=true;setBusy(true);setError('');try{await work();}catch(error){setError(error.message);}finally{lock.current=false;setBusy(false);}}
    return h('article',{className:'narration-saved'},
      h('h4',null,row.activity_description),h('p',{className:'hint'},format(row.started_at)+' · áudio '+elapsed(row.ended_at-row.started_at)),
      row.status==='processing'&&h('p',{role:'status'},'Preparando transcrição e relatório…'),
      row.error_message&&h('p',{role:'alert'},row.error_message),
      h('div',{className:'actions'},
        h('button',{type:'button',disabled:busy,onClick:()=>task(async()=>setAudio((await narrationCall(client,{action:'audio',id:row.id})).url))},'Ouvir áudio original'),
        row.report_text&&h('button',{type:'button',onClick:()=>download(new Blob([
          'RELATÓRIO DA NARRAÇÃO\nAtividade: '+row.activity_description+'\nNarração: '+format(row.started_at)+'\n'+
          (row.reviewed_at?'Revisado em '+format(row.reviewed_at):'Rascunho gerado por IA, pendente de revisão')+'\n\n'+row.report_text+
          '\n\nTRANSCRIÇÃO ORIGINAL\n'+row.transcript],{type:'text/plain;charset=utf-8'}),'relatorio-narracao-'+row.id+'.txt')},'Baixar relatório'),
        row.status==='failed'&&h('button',{type:'button',disabled:busy,onClick:()=>task(async()=>{await narrationCall(client,{action:'process',id:row.id});await refresh();})},'Tentar gerar novamente')),
      audio&&h('audio',{controls:true,src:audio,preload:'none',onError:()=>{setAudio('');setError('O link do áudio expirou. Clique em Ouvir áudio original novamente.');}}),
      row.transcript&&h('details',null,h('summary',null,'Transcrição original'),h('p',{style:{whiteSpace:'pre-wrap'}},row.transcript)),
      row.report_text&&h('div',null,
        h('p',{className:'hint'},row.reviewed_at?'Relatório revisado em '+format(row.reviewed_at):'Relatório gerado por IA. Confira com o áudio antes de usar.'),
        editing?h('form',{onSubmit:event=>{event.preventDefault();void task(async()=>{await narrationCall(client,{action:'review',id:row.id,text:draft,revision:row.revision});setEditing(false);await refresh();});}},
          h('textarea',{rows:16,maxLength:60000,value:draft,disabled:busy,'aria-label':'Revisão do relatório',onChange:event=>setDraft(event.target.value)}),
          h('div',{className:'actions'},h('button',{disabled:busy||!draft.trim()},'Salvar revisão'),h('button',{type:'button',disabled:busy,onClick:()=>setEditing(false)},'Cancelar')))
          :h(React.Fragment,null,h('pre',{className:'narration-report'},row.report_text),h('button',{type:'button',onClick:()=>{setDraft(row.report_text);setEditing(true);}},'Revisar relatório'))),
      error&&h('p',{role:'alert'},error));
  }
  function Panel({narration:n,session,canRecord}) {
    const [rows,setRows]=React.useState([]),[error,setError]=React.useState(''),[refreshId,setRefreshId]=React.useState(0);
    const requestId=React.useRef(0);
    async function refresh(){if(!session||!n.ready)return;const id=++requestId.current;
      try{const result=await narrationCall(client,{action:'list',sessionId:session.id});if(id===requestId.current){setRows(result.rows);setError('');}}
      catch(error){if(id===requestId.current)setError(error.message);}
    }
    React.useEffect(()=>{setRows([]);setError('');void refresh();return()=>{requestId.current++;};},[session?.id,n.ready,n.version,refreshId]);
    React.useEffect(()=>{if(!rows.some(row=>row.status==='processing'))return;const timer=setInterval(()=>void refresh(),10000);return()=>clearInterval(timer);},[session?.id,rows.some(row=>row.status==='processing')]);
    if(!session)return null;
    const pending=n.drafts.filter(record=>record.sessionId===session.id&&!(n.busyRecording&&record.id===n.activeId)&&!rows.some(row=>row.id===record.id&&row.status==='completed'));
    const canStart=canRecord&&session.end===null&&session.segments.some(s=>s.end===null)&&n.ready&&n.supported;
    return h('section',{className:'panel narration-panel','aria-label':'Narração e relatório da atividade'},
      h('h3',null,'Narração da atividade'),
      h('p',null,'Narre o que está observando enquanto o cronômetro continua. Ao terminar a narração ou trocar de atividade, o áudio será salvo e transformado em relatório.'),
      h('p',{className:'hint'},'O microfone só é aberto ao clicar em Iniciar narração. O áudio fica privado no banco deste aplicativo e é enviado à OpenAI para transcrição e organização do relatório. Cada gravação pode ter até 10 minutos.'),
      !n.checked?h('p',{role:'status'},'Verificando serviço de narração…'):!n.ready?h('p',{role:'status'},'A narração está aguardando a ativação do armazenamento privado e da IA pelo administrador.'):null,
      !n.supported&&h('p',null,'A gravação requer microfone e armazenamento local disponíveis. Use Chrome ou Edge atualizado.'),
      n.capture.state==='idle'?h('button',{type:'button',className:'primary',disabled:!canStart,onClick:()=>void n.start()},'Iniciar narração'):
        h('div',{className:'actions'},h('strong',{role:'status'},n.capture.state==='recording'?'● Gravando narração · '+elapsed(Date.now()-n.capture.startedAt):n.capture.state==='requesting'?'Aguardando permissão do microfone…':n.capture.state==='unsaved'?'Gravação aguardando recuperação':'Salvando gravação…'),
          h('button',{type:'button',disabled:n.capture.state==='stopping'||n.capture.state==='unsaved',onClick:()=>void n.stop()},'Finalizar narração'),
          n.capture.state==='unsaved'&&h('button',{type:'button',onClick:n.rescue},'Baixar áudio de recuperação')),
      n.capture.error&&h('p',{role:'alert'},n.capture.error),n.message&&h('p',{role:'status'},n.message),error&&h('p',{role:'alert'},error),
      pending.length>0&&h('div',null,h('h4',null,'Áudios aguardando envio neste navegador'),...pending.map(record=>h('div',{key:record.id,className:'narration-draft'},
        h('p',null,record.activityDescription+' · '+format(record.startedAt)+(record.complete?'':' · trecho recuperado após interrupção')),
        h('div',{className:'actions'},h('button',{type:'button',disabled:!n.ready||n.syncing.includes(record.id),onClick:()=>void n.sync(record)},n.syncing.includes(record.id)?'Processando…':'Enviar e gerar relatório'),
          h('button',{type:'button',onClick:()=>download(record.blob,'narracao-'+record.id+'.'+record.mime.split('/')[1])},'Baixar áudio'))))),
      n.ready&&h('button',{type:'button',onClick:()=>setRefreshId(value=>value+1)},'Atualizar narrações'),
      ...rows.map(row=>h(SavedNarration,{key:row.id,row,refresh})));
  }
  return {useNarration,Panel};
}
