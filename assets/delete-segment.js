// Remove only the selected interval. Retain activities for interruptions and audit references.
export function deleteSegment(session, expected, actor, now = Date.now()) {
  const segment = session.segments.find(item => item.id === expected.id);
  if (!segment || JSON.stringify(segment) !== JSON.stringify(expected)) {
    throw Error('O intervalo mudou. Atualize a página antes de excluir.');
  }
  if (!Number.isFinite(segment.end)) throw Error('Finalize a atividade antes de excluir seu horário.');
  const result = structuredClone(session);
  result.segments = result.segments.filter(item => item.id !== segment.id);
  result.audit = [...(result.audit || []), {
    at: now,
    description: JSON.stringify({action: 'excluir-horario', by: actor, before: segment})
  }];
  return result;
}
