import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const catalogSource = await readFile(new URL('./assets/activity-catalog.js', import.meta.url), 'utf8');
const catalogUrl = 'data:text/javascript;base64,' + Buffer.from(catalogSource).toString('base64');
const source = (await readFile(new URL('./assets/activity-codes.js', import.meta.url), 'utf8')).replace('./activity-catalog.js', catalogUrl);
const { activityCatalog, resolveActivityCode, resolveActivityInput, activityCodeError, createCodePreview } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
assert.equal(activityCatalog.length, 34);
for (const entry of activityCatalog) {
  for (const input of [entry.code, entry.code.toLowerCase(), 'código ' + entry.code, entry.code.slice(0, 2) + ' ' + entry.code.slice(2)]) {
    assert.deepEqual(resolveActivityCode(input), entry);
    assert.deepEqual(resolveActivityInput(input, [], 'Outra'), { description: entry.description, category: entry.group_name, code: entry.code });
  }
}
for (const [speech, code] of [['gê pê um', 'GP1'], ['gê cê dois.', 'GC2'], ['gê ene três', 'GN3'], ['gê a oito', 'GA8'], ['o u um', 'OU1'], ['código: GP nove', 'GP9']]) assert.equal(resolveActivityCode(speech)?.code, code);
for (const text of ['GP99', 'código XYZ', 'GA9']) {
  assert.ok(activityCodeError(text));
  assert.throws(() => resolveActivityInput(text, [], 'Pessoas'), /Código não cadastrado/);
}
for (const text of ['Ligar para cliente', 'Revisar GP1 com técnico', 'GP1 e GC1']) assert.equal(resolveActivityCode(text), null);
assert.deepEqual(resolveActivityInput('  Reunião  ', [{ description: 'Reunião', group_name: 'Gestão' }], 'Pessoas'), { description: 'Reunião', category: 'Gestão' });
assert.deepEqual(resolveActivityInput('Atividade livre', [], 'Clientes'), { description: 'Atividade livre', category: 'Clientes' });
const Preview = createCodePreview({ createElement: (type, props, ...children) => ({ type, props, children }) });
assert.ok(JSON.stringify(Preview({ text: 'GC5' })).includes('Atendimento a solicitações de clientes'));
assert.ok(JSON.stringify(Preview({ text: 'GA99' })).includes('Código não cadastrado'));
assert.equal(Preview({ text: 'Descrição livre' }), null);
const bundle = await readFile(new URL('./assets/index-DWd9uucD.js', import.meta.url), 'utf8');
assert.ok(bundle.includes('...resolveActivityInput(t??ee,a.entries,w),planned:re,demand:s'));
assert.ok(bundle.includes('await e(u.trim())'));
console.log('OK: 34 códigos, entrada digitada, variantes faladas, prévia, códigos inválidos e descrições existentes.');
