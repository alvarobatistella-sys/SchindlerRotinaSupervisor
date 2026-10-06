import { useSavedFilters } from './saved-filters.js';
export function useLastPage(React,userId,isAdmin){
 const [page,setPage]=useSavedFilters(React,userId,'last-page','Acompanhamento');
 const allowed=['Acompanhamento','Supervisores','Revisão diária','Relatórios','Dashboards',...(isAdmin?['Configurações']:[])];
 return [allowed.includes(page)?page:'Acompanhamento',value=>setPage(allowed.includes(value)?value:'Acompanhamento')];
}
