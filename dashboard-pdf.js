// Congela o dashboard exibido para impressão, sem alterar o registro em andamento.
export function printDashboard(source, { supervisor, from, until, now, reportTitle, reportMetadata }) {
  if (!source) return;
  document.getElementById('dashboard-print')?.remove();
  const report = document.createElement('section');
  report.id = 'dashboard-print';
  const title = document.createElement('h1');
  title.textContent = reportTitle || 'Rotina do Supervisor — Dashboards';
  const metadata = document.createElement('p');
  const date = value => value ? value.split('-').reverse().join('/') : '';
  metadata.textContent = `Supervisor: ${supervisor} | Período: ${date(from) || 'Sem limite inicial'} até ${date(until) || 'Sem limite final'} | Gerado em: ${new Date(now).toLocaleString('pt-BR')}`;
  if (reportMetadata) metadata.textContent = reportMetadata;
  const snapshot = source.cloneNode(true);
  snapshot.querySelectorAll('.report-filters, button').forEach(node => node.remove());
  report.append(title, metadata, snapshot);
  document.body.appendChild(report);
  const previousTitle = document.title;
  document.title = 'Dashboard-Rotina-Supervisor';
  const cleanup = () => { report.remove(); document.title = previousTitle; };
  window.addEventListener('afterprint', cleanup, { once: true });
  try { window.print(); } catch (error) {
    window.removeEventListener('afterprint', cleanup);
    cleanup();
    window.alert('Não foi possível abrir a impressão. Tente novamente neste navegador.');
  }
}
