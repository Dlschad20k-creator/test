/* Test der Exporte: Notebook (gültiges JSON + Python), Modelfile, Formate, Import, ZIP (node tests/export_test.js) */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
const root = path.join(__dirname, '..', 'js');
['data.js', 'util.js', 'engine.js', 'store.js', 'providers.js', 'export.js'].forEach((f) => require(path.join(root, f)));
const SK = globalThis.SK;
const X = SK.exporter;

let failures = 0;
function check(cond, msg) {
  if (cond) console.log('  ok   ' + msg);
  else { console.log('  FAIL ' + msg); failures++; }
}
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ski-export-'));

SK.store.load();
const model = SK.store.model('preset-blackout');
const examples = SK.store.examples();

console.log('Trainingsgespräche');
const convs = X.conversations(model, examples, { system: 'kurz', augment: true, offTopic: true });
const st = X.stats(convs);
check(convs.length > 100, convs.length + ' Gespräche für den Blackout-Profi (mit Varianten und Ablehnungen)');
check(convs.every((c) => c.messages.length === 3 && c.messages[0].role === 'system'), 'jedes Gespräch hat System, Frage, Antwort');
check(st.tokens > 10000, 'geschätzt ' + st.tokens + ' Tokens, ' + st.avg + ' pro Gespräch');
const refusals = convs.filter((c) => c.messages[2].content.startsWith('Darauf bin ich nicht spezialisiert'));
check(refusals.length === 24, 'enthält 24 Ablehnungen für fremde Themen');

console.log('\nFormate');
const jsonl = X.toJsonl(convs);
check(jsonl.trim().split('\n').every((l) => JSON.parse(l).messages), 'OpenAI-JSONL: jede Zeile ist gültiges JSON');
check(JSON.parse(X.toAlpaca(convs))[0].instruction, 'Alpaca-JSON gültig');
check(JSON.parse(X.toShareGPT(convs))[0].conversations[1].from === 'human', 'ShareGPT-JSON gültig');
const csv = X.toCsv(examples.slice(0, 5));
check(csv.split('\r\n')[0].includes('frage;antwort'), 'CSV mit Kopfzeile');
const hb = X.toHandbook(examples, 'Test');
check(hb.includes('## Blackout') && hb.includes('#### Wie mache ich Wasser trinkbar?'), 'Handbuch nach Modus und Thema gegliedert');

console.log('\nImport');
const back = X.parseImport(jsonl, 'x.jsonl');
check(back.length === convs.length && back[0].q === convs[0].messages[1].content, 'JSONL wird wieder eingelesen');
check(X.parseImport(X.toAlpaca(convs), 'a.json').length === convs.length, 'Alpaca wird eingelesen');
check(X.parseImport(X.toShareGPT(convs), 's.json').length === convs.length, 'ShareGPT wird eingelesen');
const csvBack = X.parseImport(csv, 'x.csv');
check(csvBack.length === 5 && csvBack[0].a === examples[0].a && csvBack[0].alt.length === examples[0].alt.length, 'CSV mit Zeilenumbrüchen und Varianten wird eingelesen');
const simple = X.parseImport('frage,antwort\n"Wie lange hält Honig?","Praktisch unbegrenzt, wenn er gut verschlossen ist."\n', 'h.csv');
check(simple.length === 1 && simple[0].q === 'Wie lange hält Honig?', 'einfache CSV mit Komma');
const idx = SK.engine.buildIndex(examples);
const assigned = X.assignCategories([{ q: 'Wie lange hält Honig?', a: 'Honig hält praktisch unbegrenzt, Zucker und Salz ebenso.' }], idx);
check(assigned[0].c === 'vorrat' && assigned[0].auto, 'Kategorie wird automatisch erkannt (' + assigned[0].c + ')');
let threw = false;
try { X.parseImport(JSON.stringify({ app: 'survival-ki-studio', state: {} }), 'b.json'); } catch (e) { threw = true; }
check(threw, 'Sicherungsdatei wird als solche erkannt');

console.log('\nOllama');
const mf = X.modelfile(model, 'llama3.2:3b', 4);
check(mf.includes('FROM llama3.2:3b') && mf.includes('SYSTEM """') && (mf.match(/MESSAGE user/g) || []).length === 4, 'Modelfile mit Systemprompt und 4 Beispielen');
const body = X.ollamaCreateBody(model, 'llama3.2:3b', 6);
check(body.model === 'blackout-profi' && body.from === 'llama3.2:3b' && body.messages.length === 12 && body.parameters.temperature === 0.3, 'API-Daten für /api/create');
const cats = new Set(X.fewShot(model, examples, 6).map((e) => e.c));
check(cats.size >= 5, 'Beispiele sind über ' + cats.size + ' Themen verteilt');

console.log('\nColab-Notebook');
for (const baseId of ['qwen2.5-7b', 'llama3.2-3b', 'gemma2-2b', 'mistral-7b']) {
  const cfg = { baseId, method: 'qlora', maxSeq: 1024, r: 16, alpha: 16, dropout: 0, epochs: 3, lr: 0.0002, batch: 2, accum: 4, warmup: 5, quant: 'q4_k_m', export: 'drive', system: 'kurz', minutes: 20 };
  const nbText = X.notebook(model, cfg, convs);
  let nb = null;
  try { nb = JSON.parse(nbText); } catch (e) { /* unten */ }
  check(nb && nb.nbformat === 4 && nb.cells.length >= 10, baseId + ': gültiges Notebook-JSON mit ' + (nb ? nb.cells.length : 0) + ' Zellen');
  const code = nb.cells.filter((c) => c.cell_type === 'code').map((c) => c.source.join('')).join('\n\n');
  const pyFile = path.join(tmp, baseId + '.py');
  fs.writeFileSync(pyFile, code.split('\n').map((l) => (/^\s*[!%]/.test(l) ? l.replace(/[!%].*/, 'pass') : l)).join('\n'));
  try {
    execFileSync('python3', ['-c', 'import ast,sys; ast.parse(open(sys.argv[1], encoding="utf-8").read())', pyFile]);
    check(true, baseId + ': Python-Code ist fehlerfrei');
  } catch (e) { check(false, baseId + ': Python-Syntaxfehler ' + String(e.stderr || e.message).slice(0, 300)); }
  // Die eingebetteten Daten und Vorlagen lassen sich in Python wirklich lesen
  const probe = path.join(tmp, baseId + '_probe.py');
  const settingsCell = nb.cells[3].source.join('');
  const dataCell = nb.cells[4].source.join('').split('\n').filter((l) => !l.startsWith('print')).join('\n');
  const tplLine = code.split('\n').find((l) => l.startsWith('TEMPLATES = '));
  fs.writeFileSync(probe, settingsCell + '\n' + dataCell + '\n' + tplLine + '\nassert len(DATA) == ' + convs.length + '\nassert DATA[5]["messages"][2]["content"] == ' + JSON.stringify(convs[5].messages[2].content) + '\nassert "\\n" in TEMPLATES[FAMILY]\nprint("ok", FAMILY, len(DATA))\n');
  try {
    const outp = execFileSync('python3', [probe]).toString().trim();
    check(outp.startsWith('ok'), baseId + ': Daten und Vorlagen in Python lesbar (' + outp + ')');
  } catch (e) { check(false, baseId + ': Python liest Daten nicht: ' + String(e.stderr || e.message).slice(0, 300)); }
}

console.log('\nSchätzung');
const e7 = X.estimate(X.base('qwen2.5-7b'), { method: 'qlora', maxSeq: 1024, batch: 2, accum: 4, epochs: 3 }, st);
const e3 = X.estimate(X.base('llama3.2-3b'), { method: 'qlora', maxSeq: 1024, batch: 2, accum: 4, epochs: 3 }, st);
check(e7.fitsT4 && e7.vram > 5 && e7.vram < 10, '7B mit QLoRA passt auf die T4 (' + e7.vram.toFixed(1) + ' GB, ' + Math.round(e7.minutes) + ' min)');
check(e3.minutes < e7.minutes && e3.vram < e7.vram, '3B ist schneller und kleiner (' + e3.vram.toFixed(1) + ' GB, ' + Math.round(e3.minutes) + ' min)');
const full = X.estimate(X.base('qwen2.5-7b'), { method: 'full', maxSeq: 1024, batch: 2, accum: 4, epochs: 3 }, st);
check(!full.fitsT4, 'volles Fine-Tuning von 7B passt nicht auf die T4 (' + full.vram.toFixed(0) + ' GB)');

console.log('\nZIP');
const zipBytes = SK.util.zip([{ name: 'a/hallo.txt', data: 'Hallo Überleben ✓' }, { name: 'a/start.sh', data: '#!/bin/sh\necho ok\n', exec: true }]);
const zipFile = path.join(tmp, 'test.zip');
fs.writeFileSync(zipFile, Buffer.from(zipBytes));
try {
  const outp = execFileSync('python3', ['-c', 'import zipfile,sys; z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; print(z.read("a/hallo.txt").decode("utf-8")); print(oct(z.getinfo("a/start.sh").external_attr >> 16))', zipFile]).toString();
  check(outp.includes('Hallo Überleben ✓'), 'ZIP ist gültig und UTF-8-Namen/Inhalte stimmen');
  check(outp.includes('0o100755'), 'Startskript ist ausführbar markiert');
} catch (e) { check(false, 'ZIP ungültig: ' + (e.stderr || e.message)); }

console.log(failures ? `\n${failures} Fehler` : '\nAlle Tests bestanden');
process.exit(failures ? 1 : 0);
