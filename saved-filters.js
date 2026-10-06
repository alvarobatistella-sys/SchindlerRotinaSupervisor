const memory = new Map();
export function filterKey(userId,screen){return 'rotina-filtros-v2:'+location.pathname+':'+userId+':'+screen;}
export function readFilters(key,fallback){
 let raw;try{raw=localStorage.getItem(key);}catch{raw=memory.get(key);}
 if(raw==null)return fallback;
 try{const value=JSON.parse(raw);if(typeof fallback==='string')return typeof value==='string'?value:fallback;
 if(!value||typeof value!=='object'||Array.isArray(value))return fallback;
 return Object.fromEntries(Object.keys(fallback).map(k=>[k,typeof value[k]==='string'?value[k]:fallback[k]]));}catch{return fallback;}
}
export function writeFilters(key,value){const raw=JSON.stringify(value);memory.set(key,raw);try{localStorage.setItem(key,raw);}catch{}}
export function useSavedFilters(React,userId,screen,fallback){
 const key=filterKey(userId,screen);
 const [state,setState]=React.useState(()=>({key,value:readFilters(key,fallback)}));
 const current=React.useRef(state);
 if(current.current.key!==key)current.current={key,value:readFilters(key,fallback)};
 const setValue=next=>{const value=typeof next==='function'?next(current.current.value):next;current.current={key,value};writeFilters(key,value);setState(current.current);};
 return [current.current.value,setValue];
}
