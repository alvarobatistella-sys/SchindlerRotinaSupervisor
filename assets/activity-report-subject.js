import {communicationText} from "./communications-subject-20261009.js";
import { printDashboard } from './dashboard-pdf.js?v=details-1';
export function printActivityReport(session, now, observation = () => '') {
  if (!session) return;
  const content = document.createElement('div');
  const time = value => new Date(value).toLocaleString('pt-BR');
  const duration = value => {
    const seconds = Math.max(0, Math.floor(value / 1000));
    return `${Math.floor(seconds / 3600)}h ${Math.floor(seconds / 60) % 60}min ${seconds % 60}s`;
  };
  const add = (parent, tag, text) => { const node = document.createElement(tag); node.textContent = text; parent.appendChild(node); return node; };
  let total = 0;
  for (const segment of session.segments) {
    const activity = session.activities.find(item => item.id === segment.activityId);
    const elapsed = (segment.end ?? Math.min(now, session.end ?? now)) - segment.start;
    total += Math.max(0, elapsed);
    const card = document.createElement('article');
    card.className = 'activity-report-entry';
    add(card, 'h2', activity?.description || 'Sem descrição');
    add(card, 'p', `${time(segment.start)} até ${segment.end == null ? 'Em andamento' : time(segment.end)} | Duração: ${duration(elapsed)}`);
    add(card, 'p', `Categoria: ${activity?.category || 'Sem categoria'} | Demanda: ${activity?.demand ?? (activity?.planned ? 'Planejada' : 'Imprevista')}`);
    add(card, 'h3', 'Detalhes da atividade');
    add(card, 'p', activity?.details || 'Sem detalhes informados.').className = 'activity-details';
    const note = activity ? observation(session, activity.id) : '';
    if (note) add(card, 'p', 'Observação: ' + note);
    const communications=communicationText(session,segment,now);if(communications){add(card,'h3','Comunicações incluídas nesta atividade');add(card,'p',communications).className='activity-details';}content.appendChild(card);
  }
  printDashboard(content, { now, reportTitle: 'Relatório de atividades', reportMetadata: `Supervisor: ${session.supervisor} | Observador: ${session.observer} | Território / Posto: ${session.region}\nInício: ${time(session.start)} | Tempo registrado: ${duration(total)} | Gerado em: ${time(now)}` });
}
