function currentRecord(session,expected) {
 const record=(session.communications||[]).find(item=>item.id===expected.id);
 if(!record||JSON.stringify(record)!==JSON.stringify(expected))throw Error('A subatividade mudou. Atualize a página antes de continuar.');
 const segment=session.segments.find(item=>item.id===record.segmentId);
 if(!segment)throw Error('O intervalo da atividade principal não está disponível.');
 if(!Number.isFinite(record.start)||!Number.isFinite(record.end))throw Error('Encerre a subatividade antes de quebrar ou excluir.');
 if(record.start<segment.start||record.end>(segment.end??Infinity)||record.end>(session.end??Infinity))throw Error('O horário da subatividade está fora da atividade principal. Revise os horários antes de continuar.');
 return record;
}
export function splitCommunication(session,expected,at,now=Date.now()) {
 const record=currentRecord(session,expected);
 if(!Number.isFinite(at)||at<=record.start||at>=record.end)throw Error('Escolha um horário entre o início e o fim da subatividade.');
 const first={...record,end:at},second={...record,id:crypto.randomUUID(),start:at};
 const result=structuredClone(session);
 result.communications=result.communications.flatMap(item=>item.id===record.id?[first,second]:[item]);
 result.audit=[...(result.audit||[]),{at:now,description:JSON.stringify({action:'quebrar-subatividade',before:record,after:[first,second]})}];
 return result;
}
export function deleteCommunication(session,expected,now=Date.now()) {
 const record=currentRecord(session,expected),result=structuredClone(session);
 result.communications=result.communications.filter(item=>item.id!==record.id);
 result.audit=[...(result.audit||[]),{at:now,description:JSON.stringify({action:'excluir-subatividade',before:record})}];
 return result;
}
export function localDateTime(value) {
 const date=new Date(value),pad=n=>String(n).padStart(2,'0');
 return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
