/*
 * Nachgebaute Server für die Browser-Tests:
 *  - Ollama auf Port 11434 (/api/version, /api/tags, /api/chat mit Streaming, /api/create)
 *  - OpenAI-kompatibel auf Port 8099 (/v1/models, /v1/chat/completions mit SSE, /v1/files, /v1/fine_tuning/jobs …)
 * Start: node tests/mock_servers.js
 */
const http = require('http');

const created = [];
function cors(req, res) {
  const o = req.headers.origin;
  if (o) res.setHeader('Access-Control-Allow-Origin', o);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}
function body(req) {
  return new Promise((resolve) => { let b = []; req.on('data', (c) => b.push(c)); req.on('end', () => resolve(Buffer.concat(b))); });
}
function answerFor(messages) {
  const last = messages.filter((m) => m.role === 'user').pop();
  const sys = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n');
  const q = (last && last.content) || '';
  if (/JSON/.test(q)) return '```json\n[{"frage": "Wie lange hält eine Taschenlampe mit neuen Batterien?", "antwort": "Das hängt von der Lampe ab:\\n- **LED-Lampen** halten oft 20 bis 100 Stunden.\\n- Ersatzbatterien bereithalten.", "varianten": ["Batterie Taschenlampe Laufzeit"]}, {"frage": "Wie lagere ich Kerzen richtig?", "antwort": "Kerzen kühl und trocken lagern:\\n- Nicht neben Heizungen.\\n- In einer Kiste mit Streichhölzern.", "varianten": []}]\n```';
  if (/Fußball|Hauptstadt|Gedicht|Aktie|Fortnite|Pizza/i.test(q)) return 'Darauf bin ich nicht spezialisiert. Ich helfe dir bei Blackout, Survival und Apokalypse.';
  const ctx = /Wissen aus deiner Trainingsdatenbank/.test(sys) ? ' (mit Wissen aus den Trainingsdaten)' : '';
  return 'Mock-Antwort' + ctx + ': Bei Stromausfall zuerst die **Sicherung** prüfen, dann Taschenlampe und Radio holen. 20 Liter Wasser pro Person für 10 Tage, 2 Liter pro Tag. Niemals Grill drinnen: Kohlenmonoxid ist tödlich. Notruf 112.';
}

/* ---------------- Ollama ---------------- */
http.createServer(async (req, res) => {
  cors(req, res);
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  const url = req.url.split('?')[0];
  if (url === '/api/version') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ version: '0.12.9-mock' })); }
  if (url === '/api/tags') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    const models = [{ name: 'llama3.2:3b', size: 2019393189, details: { family: 'llama', parameter_size: '3.2B', quantization_level: 'Q4_K_M' } },
      { name: 'qwen2.5:7b', size: 4683087332, details: { family: 'qwen2', parameter_size: '7.6B', quantization_level: 'Q4_K_M' } }]
      .concat(created.map((n) => ({ name: n + ':latest', size: 2019393189, details: { family: 'llama', parameter_size: '3.2B' } })));
    return res.end(JSON.stringify({ models }));
  }
  if (url === '/api/chat' && req.method === 'POST') {
    const j = JSON.parse((await body(req)).toString());
    const known = ['llama3.2:3b', 'qwen2.5:7b'].concat(created, created.map((n) => n + ':latest'));
    if (!known.includes(j.model)) { res.writeHead(404, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: `model "${j.model}" not found, try pulling it first` })); }
    res.writeHead(200, { 'Content-Type': 'application/x-ndjson' });
    const words = answerFor(j.messages).split(/(\s+)/);
    for (const w of words) { res.write(JSON.stringify({ model: j.model, message: { role: 'assistant', content: w }, done: false }) + '\n'); await new Promise((r) => setTimeout(r, 3)); }
    res.write(JSON.stringify({ model: j.model, message: { role: 'assistant', content: '' }, done: true, eval_count: words.length, total_duration: 1e9 }) + '\n');
    return res.end();
  }
  if (url === '/api/create' && req.method === 'POST') {
    const j = JSON.parse((await body(req)).toString());
    if (!j.model || !j.from || !j.system) { res.writeHead(400, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: 'model, from und system fehlen' })); }
    created.push(j.model);
    console.log('[ollama] create', j.model, 'from', j.from, 'messages', (j.messages || []).length, 'params', JSON.stringify(j.parameters));
    res.writeHead(200, { 'Content-Type': 'application/x-ndjson' });
    for (const s of ['reading model metadata', 'creating system layer', 'creating messages layer', 'writing manifest', 'success']) { res.write(JSON.stringify({ status: s }) + '\n'); await new Promise((r) => setTimeout(r, 20)); }
    return res.end();
  }
  res.writeHead(404); res.end();
}).listen(11434, '127.0.0.1', () => console.log('Mock-Ollama auf :11434'));

/* ---------------- OpenAI ---------------- */
const jobs = {};
http.createServer(async (req, res) => {
  cors(req, res);
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  const url = req.url.split('?')[0];
  const auth = req.headers.authorization || '';
  if (auth !== 'Bearer sk-test') { res.writeHead(401, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: { message: 'Incorrect API key provided' } })); }
  const json = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
  if (url === '/v1/models') return json(200, { data: [{ id: 'gpt-4.1-mini', owned_by: 'openai' }, { id: 'gpt-4o-mini', owned_by: 'openai' }] });
  if (url === '/v1/chat/completions' && req.method === 'POST') {
    const j = JSON.parse((await body(req)).toString());
    if (j.model === 'no-temp' && j.temperature !== undefined) return json(400, { error: { message: "Unsupported value: 'temperature' does not support 0.3 with this model." } });
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    for (const w of answerFor(j.messages).split(/(\s+)/)) res.write('data: ' + JSON.stringify({ choices: [{ delta: { content: w } }] }) + '\n\n');
    res.write('data: [DONE]\n\n');
    return res.end();
  }
  if (url === '/v1/files' && req.method === 'POST') {
    const raw = (await body(req)).toString();
    const lines = raw.split('\n').filter((l) => l.startsWith('{"messages"'));
    console.log('[openai] file upload, Zeilen:', lines.length, 'purpose fine-tune:', raw.includes('fine-tune'));
    return json(200, { id: 'file-abc123', purpose: 'fine-tune', bytes: raw.length });
  }
  if (url === '/v1/fine_tuning/jobs' && req.method === 'POST') {
    const j = JSON.parse((await body(req)).toString());
    console.log('[openai] job', JSON.stringify({ model: j.model, file: j.training_file, suffix: j.suffix, method: j.method }));
    const id = 'ftjob-' + Object.keys(jobs).length;
    jobs[id] = { id, status: 'validating_files', model: j.model, polls: 0, suffix: j.suffix };
    return json(200, jobs[id]);
  }
  const m = /^\/v1\/fine_tuning\/jobs\/([^/]+)(\/events|\/cancel)?$/.exec(url);
  if (m && jobs[m[1]]) {
    const job = jobs[m[1]];
    if (m[2] === '/cancel') { job.status = 'cancelled'; return json(200, job); }
    if (m[2] === '/events') {
      const data = [];
      for (let s = 1; s <= 10; s++) data.push({ id: 'ev' + s, created_at: 1700000000 + s, level: 'info', type: 'metrics', message: `Step ${s}/10: training loss=${(2.5 - s * 0.18).toFixed(2)}`, data: { step: s, train_loss: 2.5 - s * 0.18 } });
      data.push({ id: 'ev-done', created_at: 1700000100, level: 'info', type: 'message', message: 'The job has successfully completed' });
      return json(200, { data: data.reverse(), has_more: false });
    }
    job.polls++;
    job.status = 'succeeded';
    job.fine_tuned_model = `ft:${job.model}:mock::${job.suffix || 'x'}`;
    job.trained_tokens = 123456;
    return json(200, job);
  }
  json(404, { error: { message: 'not found' } });
}).listen(8099, '127.0.0.1', () => console.log('Mock-OpenAI auf :8099'));
