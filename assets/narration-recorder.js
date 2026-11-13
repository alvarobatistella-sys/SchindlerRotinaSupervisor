export const MAX_RECORDING_MS = 600000;
export const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
export function audioMime(Recorder) {
  return ['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus','audio/webm']
    .find(type=>Recorder.isTypeSupported(type));
}
export function createAudioRecorder({mediaDevices,Recorder,persist,onChange=()=>{},onSaved=()=>{},now=Date.now,
  setTimer=setTimeout,clearTimer=clearTimeout,setTick=setInterval,clearTick=clearInterval}) {
  let recorder,stream,timer,tick,context,chunks=[],bytes=0,startedAt=0,pendingStart,stopPromise;
  let stopResolve,stopReject,write=Promise.resolve(),cancelled=false,state='idle',lastWrite=0,endedAt=0;
  const update=(next,error='')=>{state=next;onChange({state,error,startedAt,bytes,id:context?.id});};
  const closeStream=()=>{stream?.getTracks().forEach(track=>track.stop());stream=undefined;clearTimer(timer);clearTick(tick);};
  const snapshot=endedAt=>({...context,startedAt,endedAt,mime:recorder.mimeType.split(';')[0],
    blob:new Blob(chunks,{type:recorder.mimeType.split(';')[0]}),complete:state==='stopping'});
  function saveSnapshot(final=false) {
    if(!bytes)return write;
    const record=snapshot(now());record.complete=final;
    write=write.catch(()=>{}).then(()=>persist(record));
    if(!final)void write.catch(()=>onChange({state,startedAt,bytes,error:'Não foi possível criar a cópia local. Pare e baixe o áudio antes de sair.'}));
    return write.then(()=>record);
  }
  async function start(metadata) {
    if(state!=='idle')throw Error('Já existe uma narração em andamento.');
    const mime=audioMime(Recorder);
    if(!mime)throw Error('Este navegador não oferece um formato de áudio compatível. Use Chrome ou Edge atualizado.');
    context={...metadata,id:crypto.randomUUID()};cancelled=false;chunks=[];bytes=0;endedAt=0;stopPromise=undefined;write=Promise.resolve();
    update('requesting');
    pendingStart=(async()=>{
      try {
        stream=await mediaDevices.getUserMedia({audio:true});
        if(cancelled){closeStream();update('idle');return false;}
        recorder=new Recorder(stream,{mimeType:mime,audioBitsPerSecond:64000});
        recorder.ondataavailable=event=>{
          if(!event.data.size)return;
          chunks.push(event.data);bytes+=event.data.size;
          if(now()-lastWrite>=5000&&state==='recording'){lastWrite=now();void saveSnapshot().catch(()=>{});}
          if(bytes>=MAX_AUDIO_BYTES&&state==='recording')void stop().catch(()=>{});
        };
        recorder.onerror=()=>{onChange({state,startedAt,bytes,error:'O navegador interrompeu a captura. O trecho disponível será preservado.'});void stop().catch(()=>{});};
        recorder.onstop=async()=>{
          closeStream();
          try {
            const record=snapshot(endedAt);record.complete=true;
            if(!bytes)throw Error('Nenhum áudio foi capturado.');
            await write.catch(()=>{});await persist(record);
            if(!record)throw Error('Nenhum áudio foi capturado.');
            update('idle');stopResolve?.(record);onSaved(record);
          }catch(error){update(bytes?'unsaved':'idle',error.message);stopReject?.(error);}
        };
        startedAt=now();lastWrite=startedAt;recorder.start(1000);update('recording');
        timer=setTimer(()=>void stop().catch(()=>{}),MAX_RECORDING_MS);
        tick=setTick(()=>onChange({state,startedAt,bytes}),1000);
        for(const track of stream.getTracks())track.onended=()=>{if(state==='recording')void stop().catch(()=>{});};
        return true;
      }catch(error){closeStream();update('idle',error.name==='NotAllowedError'?'Permita o microfone no navegador para narrar.':error.message);throw error;}
      finally{pendingStart=undefined;}
    })();
    return pendingStart;
  }
  async function stop() {
    if(state==='requesting'){cancelled=true;return;}
    if(state==='idle')return;
    if(state==='unsaved')throw Error('Baixe a gravação que não pôde ser salva antes de trocar de atividade.');
    if(stopPromise)return stopPromise;
    stopPromise=new Promise((resolve,reject)=>{stopResolve=resolve;stopReject=reject;});
    // A catch is attached immediately for browser-initiated stops; callers still receive rejection.
    void stopPromise.catch(()=>{});
    endedAt=now();update('stopping');recorder.stop();return stopPromise;
  }
  return {start,stop,get state(){return state;},get context(){return context;},get pendingAudio(){return bytes?snapshot(endedAt||now()):null;},
    acknowledgeRecovery(){if(state==='unsaved'){chunks=[];bytes=0;stopPromise=undefined;update('idle');}},
    dispose(){cancelled=true;if(state==='recording')void stop().catch(()=>{});else if(state!=='requesting')closeStream();}};
}
export function createDraftStore(indexedDB) {
  let opening;
  const database=()=>opening??=(new Promise((resolve,reject)=>{
    const request=indexedDB.open('rotina-activity-narration',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('drafts',{keyPath:'id'});
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
  }));
  async function operation(mode,run) {
    const db=await database();return new Promise((resolve,reject)=>{
      const tx=db.transaction('drafts',mode),request=run(tx.objectStore('drafts'));
      tx.oncomplete=()=>resolve(request.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error || Error('Cópia local cancelada.'));
    });
  }
  return {save:record=>operation('readwrite',store=>store.put(record)),remove:id=>operation('readwrite',store=>store.delete(id)),
    async list(scope){return (await operation('readonly',store=>store.getAll())).filter(record=>record.scope===scope);}};
}
