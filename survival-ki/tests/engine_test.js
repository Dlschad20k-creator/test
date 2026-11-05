/* Test der Offline-KI: Suche, Training des neuronalen Netzes, Prüfung (node tests/engine_test.js) */
const path = require('path');
const root = path.join(__dirname, '..', 'js');
require(path.join(root, 'data.js'));
require(path.join(root, 'util.js'));
require(path.join(root, 'engine.js'));
const SK = globalThis.SK;
const E = SK.engine;

let failures = 0;
function check(cond, msg) {
  if (cond) console.log('  ok   ' + msg);
  else { console.log('  FAIL ' + msg); failures++; }
}

function runBench(model, ctx) {
  let total = 0, weight = 0;
  const per = {};
  const fails = [];
  for (const item of SK.BENCHMARK) {
    const r = E.answer(model, item.q, ctx);
    const s = E.scoreAnswer(item, r.text, r);
    const w = item.critical ? 2 : 1;
    total += s.score * w; weight += w;
    per[item.mode] = per[item.mode] || { s: 0, n: 0 };
    per[item.mode].s += s.score; per[item.mode].n++;
    if (s.score < 0.6) fails.push(item.id + ' ' + item.q + ' -> ' + (r.sources[0] ? r.sources[0].q : r.kind) + ' | fehlt: ' + s.misses.join(', '));
  }
  return { score: total / weight, per, fails };
}

(async function main() {
  const model = { name: 'Krisen-Allrounder', modes: ['blackout', 'survival', 'apokalypse'], categories: [], style: 'normal', strict: true };
  const cats = E.modelCategories(model);
  const index = E.buildIndex(SK.BUILTIN);

  console.log('Suche mit Tippfehlern');
  const typoCases = [
    ['stromausfal was tun', 'strom-01'],
    ['wie mach ich wasser trinkbahr', 'wasser-02'],
    ['apoklobse überleben was lernen', 'lang-04'],
    ['survivling feuer machen ohne feuerzeug', 'feuer-02'],
    ['jodtabletten wann nehmen', 'abc-02'],
    ['generator in garage', 'licht-02'],
  ];
  for (const [q, id] of typoCases) {
    const hits = E.search(index, q, { categories: cats, limit: 3 });
    check(hits.slice(0, 2).some((h) => h.ex.id === id), `"${q}" findet ${id} (gefunden: ${hits[0].ex.id}, ${hits[0].score.toFixed(2)})`);
  }

  console.log('\nPrüfung ohne Training');
  const before = runBench(model, { index });
  console.log('  Ergebnis: ' + (before.score * 100).toFixed(1) + ' %', JSON.stringify(Object.fromEntries(Object.entries(before.per).map(([k, v]) => [k, +(v.s / v.n).toFixed(2)]))));
  before.fails.forEach((f) => console.log('    - ' + f));

  console.log('\nTraining des neuronalen Netzes');
  const t0 = Date.now();
  const out = await E.train(SK.BUILTIN, cats, { epochs: 30, dim: 2048 }, {
    onEpoch: (s) => { if (s.epoch % 10 === 0 || s.epoch === 1) console.log(`  Epoche ${s.epoch}: Verlust ${s.loss.toFixed(3)}, Genauigkeit ${(s.acc * 100).toFixed(1)} %, Prüfung ${(s.valAcc * 100).toFixed(1)} %`); },
    onLog: (t) => console.log('  ' + t),
  });
  console.log('  Dauer: ' + (Date.now() - t0) + ' ms');
  check(out.history[0].loss > out.history[out.history.length - 1].loss, 'Verlust sinkt beim Training');
  check(out.summary.valAcc > 0.5, 'Themen-Genauigkeit auf neuen Formulierungen über 50 % (' + (out.summary.valAcc * 100).toFixed(1) + ' %)');

  // Speichern und Laden
  const ser = E.serialize(out.model);
  const json = JSON.stringify(ser);
  const back = E.deserialize(JSON.parse(json));
  const p1 = E.predict(out.model, 'Wie mache ich Wasser sauber?');
  const p2 = E.predict(back, 'Wie mache ich Wasser sauber?');
  check(p1.top === p2.top, 'Gespeichertes Modell sagt dasselbe vorher (' + p1.top + ', ' + (json.length / 1024).toFixed(0) + ' KB)');

  console.log('\nThemen-Erkennung');
  const cls = back;
  const offs = ['Wer hat gestern das Spiel gewonnen?', 'Schreib mir einen Rap über Autos', 'Was ist die Hauptstadt von Spanien?', 'Wie viel kostet eine PlayStation?'];
  for (const q of offs) {
    const r = E.answer(model, q, { index, classifier: cls });
    check(r.offTopic, `"${q}" wird als fremdes Thema erkannt`);
  }
  const ons = ['Wie lange hält Wasser in Kanistern?', 'Was mache ich wenn mein Kind bei Stromausfall Angst hat?', 'Wie überlebe ich eine Nacht im Wald?'];
  for (const q of ons) {
    const r = E.answer(model, q, { index, classifier: cls });
    check(!r.offTopic, `"${q}" wird beantwortet (${r.sources[0] && r.sources[0].id})`);
  }
  const em = E.answer(model, 'Mein Vater ist bewusstlos und atmet nicht', { index, classifier: cls });
  check(em.emergency && em.text.indexOf('112') >= 0, 'Notfall wird erkannt und nennt 112');

  console.log('\nPrüfung nach Training');
  const after = runBench(model, { index, classifier: cls });
  console.log('  Ergebnis: ' + (after.score * 100).toFixed(1) + ' %', JSON.stringify(Object.fromEntries(Object.entries(after.per).map(([k, v]) => [k, +(v.s / v.n).toFixed(2)]))));
  after.fails.forEach((f) => console.log('    - ' + f));
  check(after.score >= 0.85, 'Allrounder erreicht mindestens 85 % in der Prüfung');

  // Nur-Blackout-Modell lehnt Wildnis-Fragen ab
  console.log('\nSpezialisiertes Modell');
  const bm = { name: 'Blackout-Profi', modes: ['blackout'], categories: [], style: 'normal', strict: true };
  const bcats = E.modelCategories(bm);
  const bout = await E.train(SK.BUILTIN, bcats, { epochs: 30 }, {});
  const r1 = E.answer(bm, 'Wie viel Wasser brauche ich im Notfall?', { index, classifier: bout.model });
  check(!r1.offTopic && r1.sources[0].c === 'wasser', 'Blackout-Profi beantwortet Wasserfrage');
  const r2 = E.answer(bm, 'Wie finde ich den Polarstern?', { index, classifier: bout.model });
  console.log('    Polarstern beim Blackout-Profi -> ' + r2.kind + ' ' + (r2.sources[0] ? r2.sources[0].id : ''));

  // Bewertungsfunktion
  console.log('\nBewertung');
  const item = SK.BENCHMARK.find((b) => b.id === 'p-b02');
  check(E.scoreAnswer(item, 'Nein, niemals! Kohlenmonoxid (CO) ist tödlich.').score === 1, 'Volle Punkte für richtige Antwort');
  check(E.scoreAnswer(item, 'Ja klar, mach das ruhig, das ist gemütlich.').score < 0.5, 'Wenig Punkte für falsche Antwort');
  const decl = SK.BENCHMARK.find((b) => b.id === 'p-x03');
  check(E.scoreAnswer(decl, 'Die Hauptstadt ist Canberra.').score === 0, 'Abgrenzung: echte Antwort zählt als Fehler');
  check(E.scoreAnswer(decl, 'Darauf bin ich nicht spezialisiert. Ich helfe bei Blackout und Survival.').score === 1, 'Abgrenzung: Ablehnung zählt als richtig');

  console.log(failures ? `\n${failures} Fehler` : '\nAlle Tests bestanden');
  process.exit(failures ? 1 : 0);
})();
