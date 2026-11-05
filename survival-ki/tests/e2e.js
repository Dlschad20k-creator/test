/*
 * Browser-Test des Survival-KI Studios (Playwright).
 * Voraussetzungen:
 *   python3 -m http.server 8090           (im Repo-Ordner)
 *   node survival-ki/tests/mock_servers.js  (Ollama :11434, OpenAI :8099)
 *   optional: python survival-ki/trainer/survival_trainer.py serve  (für den Test mit dem lokalen Trainer, LOCAL=1)
 * Start: node survival-ki/tests/e2e.js
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://localhost:8090/survival-ki/';
const SHOTS = process.env.SHOTS || '';
let failures = 0;
function check(cond, msg) { console.log((cond ? '  ok   ' : '  FAIL ') + msg); if (!cond) failures++; }

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_CONNECTION_REFUSED|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload({ waitUntil: 'networkidle' });
  const go = async (v) => { await page.evaluate((v) => { location.hash = v; }, v); await page.waitForTimeout(300); };
  const view = (v) => page.locator('#view-' + v);
  async function shot(name) { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png') }); }

  console.log('1. Browser-Training');
  await go('training');
  await view('training').getByRole('tab', { name: 'Im Browser' }).click();
  await view('training').getByRole('button', { name: 'Training starten' }).click();
  await view('training').getByText('Ergebnis', { exact: true }).waitFor({ timeout: 90000 });
  const resultText = await view('training').locator('.stats').last().innerText();
  check(/Prüfung/i.test(resultText) && /→/.test(resultText), 'Ergebnis mit Prüfung vorher → nachher: ' + resultText.replace(/\s+/g, ' ').slice(0, 120));
  check(await view('training').locator('.chart svg').count() >= 2, 'Verlust- und Genauigkeits-Diagramm gezeichnet');
  await shot('e2e-training');
  await go('modelle');
  check(await view('modelle').locator('.model-card.active .pill-ok', { hasText: 'Trainiert' }).count() === 1, 'Aktives Modell ist als „Trainiert“ markiert');

  console.log('2. Chat mit der Offline-KI');
  await go('chat');
  async function ask(q) {
    await view('chat').waitFor({ state: 'visible' });
    await page.waitForTimeout(400);
    const before = await view('chat').locator('.msg.bot').count();
    await page.fill('#c-input', q);
    await page.keyboard.press('Enter');
    await page.waitForFunction((n) => { const b = document.querySelectorAll('#view-chat .msg.bot'); return b.length > n && !b[b.length - 1].querySelector('.typing'); }, before, { timeout: 60000 });
    return view('chat').locator('.msg.bot').last();
  }
  let bot = await ask('Wie lange hält Essen in der Gefriertruhe ohne Strom?');
  check(/48 Stunden/.test(await bot.innerText()), 'Antwort nennt 48 Stunden');
  check(await bot.locator('.src button').count() >= 1, 'Quellen aus den Trainingsdaten werden angezeigt');
  bot = await ask('Wer hat gestern das Fußballspiel gewonnen?');
  check(/nicht spezialisiert/.test(await bot.innerText()), 'Fremdes Thema wird abgelehnt');
  bot = await ask('Mein Vater ist bewusstlos und atmet nicht');
  check(await bot.locator('.sos').count() === 1, 'Notfall-Hinweis 112 erscheint');
  await shot('e2e-chat');

  console.log('3. Prüfung');
  await go('pruefung');
  await view('pruefung').getByRole('button', { name: 'Prüfung starten' }).click();
  await view('pruefung').getByText('Ergebnis von', { exact: false }).waitFor({ timeout: 30000 });
  const score = await view('pruefung').locator('.score-big').innerText();
  check(parseFloat(score.replace(',', '.')) >= 85, 'Offline-KI besteht die Prüfung mit ' + score);
  await shot('e2e-pruefung');

  console.log('4. Assistent: neue KI');
  await go('modelle');
  await view('modelle').getByRole('button', { name: 'Neue KI erstellen' }).click();
  await page.fill('#w-name', 'Bunker-Bot');
  await page.locator('dialog').getByRole('button', { name: 'Weiter', exact: true }).click();
  await page.locator('dialog .choice', { hasText: 'Apokalypse' }).click(); // Apokalypse abwählen
  await page.locator('dialog').getByRole('button', { name: 'Weiter', exact: true }).click();
  await page.locator('dialog').getByRole('button', { name: 'Weiter', exact: true }).click();
  await page.locator('dialog .choice', { hasText: 'Kurz & klar' }).click();
  await page.locator('dialog').getByRole('button', { name: 'Weiter', exact: true }).click();
  const prompt = await page.inputValue('#f-prompt');
  check(/Bunker-Bot/.test(prompt) && /Blackout/.test(prompt) && !/Apokalypse-Szenarien/.test(prompt), 'Systemprompt passt zu Name und Modi');
  await page.locator('dialog').getByRole('button', { name: 'KI erstellen', exact: true }).click();
  await page.locator('dialog', { hasText: 'ist bereit' }).getByRole('button', { name: 'Schließen' }).click();
  check(await view('modelle').locator('.model-card', { hasText: 'Bunker-Bot' }).count() === 1, 'Neue KI „Bunker-Bot“ erscheint und ist aktiv');

  console.log('5. Trainingsdaten');
  await go('daten');
  await view('daten').getByRole('button', { name: 'Neues Beispiel' }).click();
  await page.fill('#x-q', 'Wie lange hält ein Notvorrat an Honig?');
  await page.fill('#x-a', 'Honig hält praktisch unbegrenzt:\n- **Gut verschlossen** und kühl lagern.\n- Kristallisiert er, im warmen Wasserbad verflüssigen.');
  await page.selectOption('#x-c', 'vorrat');
  await page.locator('dialog').getByRole('button', { name: 'Speichern' }).click();
  await page.fill('#d-search', 'Honig hält');
  await page.waitForTimeout(400);
  check(await view('daten').getByText('Wie lange hält ein Notvorrat an Honig?').count() === 1, 'Eigenes Beispiel gespeichert und gefunden');
  await page.fill('#d-search', '');
  await view('daten').getByRole('button', { name: 'Importieren' }).click();
  await page.fill('#imp-paste', 'frage;antwort\nWie viele Kerzen brauche ich?;"Für 10 Tage etwa 20 Teelichter oder 5 Stumpenkerzen, besser aber LED-Lampen."\nWas mache ich mit Tiefkühlpizza im Blackout?;"Zuerst essen, solange sie noch kalt ist, zum Beispiel auf dem Gaskocher im Topf mit Deckel."');
  await page.locator('dialog').getByText('2 Beispiele gefunden').waitFor({ timeout: 5000 });
  await page.locator('dialog').getByRole('button', { name: 'Hinzufügen' }).click();
  check((await page.locator('#nav-links').innerText()).includes('125'), 'Import: 2 Beispiele hinzugefügt (125 insgesamt)');
  await view('daten').getByRole('button', { name: 'Exportieren' }).click();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('dialog').getByRole('button', { name: 'Herunterladen' }).click()]);
  const jsonl = fs.readFileSync(await dl.path(), 'utf8').trim().split('\n');
  check(jsonl.length > 50 && JSON.parse(jsonl[0]).messages.length === 3, 'Export als OpenAI-JSONL: ' + jsonl.length + ' Gespräche (' + dl.suggestedFilename() + ')');
  await view('daten').getByRole('button', { name: 'Qualitäts-Check' }).click();
  check(await page.locator('dialog').getByText('Qualitäts-Check').count() === 1, 'Qualitäts-Check öffnet sich');
  await page.locator('dialog .dialog-x').click();

  console.log('6. Ollama verbinden (nachgebaut)');
  await go('modelle');
  await view('modelle').getByRole('button', { name: 'Vorhandenes Modell verbinden' }).click();
  await page.locator('dialog').getByText('llama3.2:3b').waitFor({ timeout: 8000 });
  await page.locator('dialog .run', { hasText: 'llama3.2:3b' }).getByRole('button', { name: 'Hinzufügen' }).click();
  await page.locator('dialog .dialog-x').click();
  const card = view('modelle').locator('.model-card', { hasText: 'llama3.2' });
  check(await card.count() === 1, 'Ollama-Modell llama3.2:3b als eigene KI hinzugefügt');
  await card.getByRole('button', { name: 'Chatten' }).click();
  bot = await ask('Was mache ich bei Stromausfall?');
  check(/mit Wissen aus den Trainingsdaten/.test(await bot.innerText()), 'Chat mit Ollama-Modell, Trainingswissen wird mitgeschickt (RAG)');

  console.log('7. Ollama-Sofortmodell');
  await go('training');
  await view('training').getByRole('tab', { name: 'Ollama-Sofortmodell' }).click();
  await page.waitForTimeout(300);
  await view('training').getByRole('button', { name: 'In Ollama erstellen' }).click();
  await view('training').getByText('ist in Ollama bereit').waitFor({ timeout: 10000 });
  await view('training').getByRole('button', { name: /Als Gehirn/ }).click();
  await page.waitForTimeout(300);
  bot = await ask('Wie viel Wasser brauche ich?');
  check(/Mock-Antwort/.test(await bot.innerText()), 'Selbst erstelltes Ollama-Modell antwortet im Chat');

  console.log('8. OpenAI (nachgebaut)');
  await go('einstellungen');
  await page.fill('#s-oa-base', 'http://127.0.0.1:8099/v1');
  await page.fill('#s-oa-key', 'sk-test');
  await page.locator('#s-oa-key').blur();
  await view('einstellungen').locator('section', { hasText: 'Cloud-API' }).getByRole('button', { name: 'Verbindung testen' }).click();
  await view('einstellungen').getByText('Verbunden: 2 Modelle verfügbar').waitFor({ timeout: 5000 });
  check(true, 'OpenAI-Verbindung getestet');
  await go('modelle');
  await view('modelle').getByRole('button', { name: 'Vorhandenes Modell verbinden' }).click();
  await page.locator('dialog').getByRole('tab', { name: 'OpenAI-kompatibel' }).click();
  await page.locator('dialog').getByRole('button', { name: 'Modelle laden' }).click();
  await page.locator('dialog .run', { hasText: 'gpt-4.1-mini' }).getByRole('button', { name: 'Hinzufügen' }).click();
  await page.locator('dialog .dialog-x').click();
  await view('modelle').locator('.model-card', { hasText: 'gpt-4.1-mini' }).getByRole('button', { name: 'Chatten' }).click();
  bot = await ask('Was gehört in den Notvorrat?');
  check(/Mock-Antwort/.test(await bot.innerText()), 'Chat über OpenAI-kompatible API mit Streaming');
  await go('training');
  await view('training').getByRole('tab', { name: 'OpenAI' }).click();
  await page.waitForTimeout(300);
  await view('training').getByRole('button', { name: 'Hochladen und Training starten' }).click();
  await page.waitForFunction(() => [...document.querySelectorAll('#view-modelle, #nav-links')].length && JSON.parse(localStorage.getItem('ski.state.v1') || '{}').models.some((m) => /\(OpenAI\)/.test(m.name)), null, { timeout: 15000 });
  check(true, 'OpenAI-Fine-Tuning: Job angelegt, Status abgefragt, neues Modell „… (OpenAI)“ eingetragen');
  await page.waitForTimeout(500);
  check(await view('training').locator('#oa-jobs .chart svg').count() >= 1, 'Verlust-Kurve aus den OpenAI-Ereignissen');
  await shot('e2e-openai');

  console.log('9. Google Colab');
  await view('training').getByRole('tab', { name: 'Google Colab' }).click();
  await page.waitForTimeout(300);
  const [nbDl] = await Promise.all([page.waitForEvent('download'), view('training').getByRole('button', { name: 'Notebook herunterladen' }).click()]);
  const nb = JSON.parse(fs.readFileSync(await nbDl.path(), 'utf8'));
  check(nb.nbformat === 4 && nb.cells.length >= 10 && /unsloth/.test(JSON.stringify(nb)), 'Colab-Notebook heruntergeladen: ' + nbDl.suggestedFilename());
  await shot('e2e-colab');

  console.log('10. Mit KI erweitern');
  await go('daten');
  await view('daten').getByRole('button', { name: 'Mit KI erweitern' }).click();
  await page.locator('dialog').getByRole('button', { name: 'Beispiele schreiben lassen' }).click();
  await page.locator('dialog').getByText('Wie lange hält eine Taschenlampe').waitFor({ timeout: 10000 });
  await page.locator('dialog').getByRole('button', { name: 'Ausgewählte hinzufügen' }).click();
  check((await page.locator('#nav-links').innerText()).includes('127'), 'Zwei KI-Beispiele übernommen (127 insgesamt)');

  console.log('11. Sicherung');
  await go('einstellungen');
  const [bk] = await Promise.all([page.waitForEvent('download'), view('einstellungen').getByRole('button', { name: 'Sicherung herunterladen' }).click()]);
  const backup = JSON.parse(fs.readFileSync(await bk.path(), 'utf8'));
  check(backup.app === 'survival-ki-studio' && backup.state.models.length >= 7 && !JSON.stringify(backup).includes('sk-test'), 'Sicherung enthält Modelle, aber keinen API-Schlüssel');

  if (process.env.LOCAL) {
    console.log('12. Lokaler Trainer (echt, CPU)');
    await go('modelle');
    await view('modelle').locator('.model-card', { hasText: 'Blackout-Profi' }).getByRole('button', { name: 'Trainieren' }).click();
    await view('training').getByRole('tab', { name: 'Eigener PC' }).click();
    await view('training').getByRole('button', { name: 'Verbinden' }).click();
    await view('training').getByText('verbunden', { exact: true }).waitFor({ timeout: 10000 });
    await view('training').locator('.base', { hasText: 'SmolLM2' }).click();
    await page.selectOption('#ft-epochs', '1');
    await page.locator('#view-training details.inset summary').click();
    await page.locator('#ft-augment').uncheck();
    await page.locator('#ft-offTopic').uncheck();
    await view('training').getByRole('button', { name: 'Training starten' }).click();
    await view('training').getByText('Training fertig', { exact: true }).waitFor({ timeout: 600000 });
    check(true, 'Lokales LoRA-Training über die Webseite abgeschlossen');
    check(await view('training').locator('.chart svg').count() >= 1, 'Live-Verlustkurve vom lokalen Trainer');
    await shot('e2e-local');
    await view('training').getByRole('button', { name: 'Direkt im Trainer testen' }).click();
    bot = await ask('Wie viel Wasser brauche ich pro Tag?');
    check((await bot.innerText()).length > 20, 'Antwort vom frisch trainierten Modell: ' + (await bot.locator('.md').innerText()).slice(0, 80).replace(/\n/g, ' '));
  }

  check(errors.length === 0, 'Keine JavaScript-Fehler' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
  console.log(failures ? `\n${failures} Fehler` : '\nAlle Browser-Tests bestanden');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
