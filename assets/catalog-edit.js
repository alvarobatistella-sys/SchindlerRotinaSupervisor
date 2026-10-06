export function createCatalogEditors(React,client,ValueAddedSelect){
 const h=React.createElement;
 function Editor({entry,kind,onSaved,onDelete,disabled=false,catalog}){
  const [editing,setEditing]=React.useState(false),[draft,setDraft]=React.useState({}),[history,setHistory]=React.useState(true),[preview,setPreview]=React.useState(null),[busy,setBusy]=React.useState(false),[message,setMessage]=React.useState('');const lock=React.useRef(false);
  const description=kind==='description';
  function change(key,value){setDraft(previous=>({...previous,[key]:value}));setPreview(null);setMessage('');}
  async function run(save){if(lock.current)return;lock.current=true;setBusy(true);setMessage('');try{
   const {data,error}=await client.rpc('edit_catalog_history',{edit_kind:kind,entry_id:String(entry.id),new_values:draft,include_history:history,confirm_token:save?preview.token:null});
   if(error)throw Error(error.message);if(save){setEditing(false);setPreview(null);setMessage('Salvo. '+data.activities+' atividades anteriores atualizadas.');await onSaved?.();}else setPreview(data);
  }catch(e){setMessage(e.message);setPreview(null);}finally{lock.current=false;setBusy(false);}}
  const buttons=h('div',{className:'actions'},h('button',{type:'button',disabled:disabled||busy,onClick:()=>{setDraft(description?{description:entry.description,group_name:entry.group_name,keywords:entry.keywords||''}:{name:entry.name});setEditing(true);setPreview(null);setMessage('');}},'Editar'),onDelete&&h('button',{type:'button',disabled:disabled||busy,onClick:onDelete},'Excluir'));
  const field=(label,key,max)=>h('label',null,label,h('input',{required:key!=='keywords',maxLength:max,value:draft[key]||'',disabled:busy,onChange:e=>change(key,e.target.value)}));
  const form=h('form',{className:'catalog-inline',onSubmit:e=>{e.preventDefault();run(false);}},description?field('Descrição curta','description',500):field(kind==='category'?'Categoria':'Tipo de demanda','name',100),description&&field('Grupo','group_name',100),description&&field('Palavras-chave','keywords',1000),
   h('label',{className:'catalog-history-choice'},h('input',{type:'checkbox',checked:history,disabled:busy,onChange:e=>{setHistory(e.target.checked);setPreview(null);}}),'Atualizar registros anteriores com a mesma denominação'),
   h('p',null,'A busca ignora maiúsculas/minúsculas e espaços nas pontas. Não altera textos apenas parecidos. Tempos, detalhes e classificação VA/NVA/NNVA são preservados.'),
   kind==='category'&&h('p',null,'As descrições do catálogo que usam esta categoria também serão atualizadas.'),
   h('div',{className:'actions'},h('button',{disabled:busy},busy?'Processando…':'Ver prévia'),h('button',{type:'button',disabled:busy,onClick:()=>{setEditing(false);setPreview(null);setMessage('');}},'Cancelar')),
   preview&&h('div',{className:'catalog-preview'},h('p',null,preview.old_name+' → '+preview.new_name),h('strong',null,preview.activities+' atividades em '+preview.sessions+' acompanhamentos. '+preview.linked_descriptions+' descrições vinculadas.'),
    h('ul',null,...preview.samples.map((row,i)=>h('li',{key:i},row.supervisor+' · '+new Date(row.start).toLocaleString('pt-BR')+' · '+row.activities+' atividades'))),preview.sessions>100&&h('p',null,'Exibindo os primeiros 100 acompanhamentos; todos os '+preview.sessions+' serão atualizados.'),h('button',{type:'button',className:'primary',disabled:busy,onClick:()=>run(true)},'Confirmar e salvar')));
  const status=message&&h('p',{role:'status'},message);
  if(description){if(editing)return h('tr',null,h('td',{colSpan:5},form,status));return h('tr',null,h('td',null,entry.description),h('td',null,entry.group_name),h('td',null,entry.keywords||'—'),h('td',null,h(ValueAddedSelect,{entry,catalog,disabled})),h('td',null,buttons,status));}
  return h('div',null,editing?form:h('div',null,h('span',null,entry.name),buttons),status);
 }
 return {DescriptionRow:props=>h(Editor,{...props,kind:'description'}),OptionEditor:Editor};
}
