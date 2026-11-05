#!/usr/bin/env python3
"""Survival-KI Studio – lokaler Trainer

Trainiert ein Sprachmodell mit LoRA auf deinem eigenen Rechner (NVIDIA-Grafikkarte, Apple-Chip oder,
langsam, auf dem Prozessor) und zeigt den Fortschritt live im Survival-KI Studio.

  python survival_trainer.py check            prüft, ob alles installiert ist
  python survival_trainer.py serve            startet den Server für die Webseite (http://localhost:8765)
  python survival_trainer.py train job.json   trainiert direkt aus einer Datei (Trainingspaket)

Benötigt: Python 3.10+, torch, transformers, peft, accelerate, safetensors (für QLoRA zusätzlich bitsandbytes).
"""

import argparse
import json
import math
import os
import platform
import random
import re
import shutil
import subprocess
import sys
import threading
import time
import traceback
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

VERSION = "1.0"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT_ROOT = os.path.join(HERE, "ausgabe")
DEFAULT_PORT = 8765
# Webseiten, die den Trainer steuern dürfen (Schutz davor, dass fremde Seiten im Browser Trainings starten)
DEFAULT_ORIGINS = [
    "https://dlschad20k-creator.github.io",
    "null",  # Seite als Datei geöffnet (file://)
]
LOCAL_ORIGIN = re.compile(r"^https?://(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$")
MODEL_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*/[A-Za-z0-9][A-Za-z0-9._-]*$")

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

# Ollama-Vorlagen je Modellfamilie (für den GGUF-Import)
TEMPLATES = {
    "llama": 'TEMPLATE """{{ if .System }}<|start_header_id|>system<|end_header_id|>\n\n{{ .System }}<|eot_id|>{{ end }}{{ if .Prompt }}<|start_header_id|>user<|end_header_id|>\n\n{{ .Prompt }}<|eot_id|>{{ end }}<|start_header_id|>assistant<|end_header_id|>\n\n{{ .Response }}<|eot_id|>"""\nPARAMETER stop "<|start_header_id|>"\nPARAMETER stop "<|end_header_id|>"\nPARAMETER stop "<|eot_id|>"\n',
    "chatml": 'TEMPLATE """{{ if .System }}<|im_start|>system\n{{ .System }}<|im_end|>\n{{ end }}{{ if .Prompt }}<|im_start|>user\n{{ .Prompt }}<|im_end|>\n{{ end }}<|im_start|>assistant\n{{ .Response }}<|im_end|>\n"""\nPARAMETER stop "<|im_start|>"\nPARAMETER stop "<|im_end|>"\n',
    "gemma": 'TEMPLATE """<start_of_turn>user\n{{ if .System }}{{ .System }}\n\n{{ end }}{{ .Prompt }}<end_of_turn>\n<start_of_turn>model\n{{ .Response }}<end_of_turn>\n"""\nPARAMETER stop "<start_of_turn>"\nPARAMETER stop "<end_of_turn>"\n',
    "mistral": 'TEMPLATE """[INST] {{ if .System }}{{ .System }}\n\n{{ end }}{{ .Prompt }} [/INST]{{ .Response }}"""\nPARAMETER stop "[INST]"\nPARAMETER stop "[/INST]"\n',
}


def slug(text):
    s = re.sub(r"[^a-z0-9-]+", "-", str(text).lower()).strip("-")
    return (s or "survival-ki")[:40]


def versions():
    out = {"python": platform.python_version()}
    for name in ("torch", "transformers", "peft", "accelerate", "bitsandbytes"):
        try:
            mod = __import__(name)
            out[name] = getattr(mod, "__version__", "?")
        except Exception:
            out[name] = None
    return out


def device_info():
    info = {"device": "cpu", "gpu": None, "vram_gb": None, "bf16": False}
    try:
        import torch
        if torch.cuda.is_available():
            p = torch.cuda.get_device_properties(0)
            info.update(device="cuda", gpu=p.name, vram_gb=round(p.total_memory / 1024 ** 3, 1), bf16=bool(torch.cuda.is_bf16_supported()))
        elif getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
            info.update(device="mps", gpu="Apple " + platform.machine())
    except Exception:
        pass
    return info


class Job:
    def __init__(self, spec):
        self.id = uuid.uuid4().hex[:12]
        self.spec = spec
        self.name = slug(spec.get("name") or "survival-ki")
        self.state = "wartet"
        self.step = 0
        self.total_steps = 0
        self.epoch = 0
        self.epochs = int(spec.get("config", {}).get("epochs", 3))
        self.loss = []
        self.logs = []
        self.started = time.time()
        self.finished = None
        self.error = None
        self.output_dir = None
        self.ollama_model = None
        self.eta = None
        self.stop = False
        self.lock = threading.Lock()
        self.model = None
        self.tokenizer = None
        self.device = "cpu"

    def log(self, msg):
        line = time.strftime("%H:%M:%S") + "  " + str(msg)
        with self.lock:
            self.logs.append(line)
        print(line, flush=True)

    def snapshot(self, since=0):
        with self.lock:
            return {
                "job": self.id, "name": self.name, "state": self.state, "step": self.step, "total_steps": self.total_steps,
                "epoch": self.epoch, "epochs": self.epochs, "loss": list(self.loss), "log": self.logs[since:], "log_total": len(self.logs),
                "eta": self.eta, "started": self.started, "finished": self.finished, "error": self.error,
                "output_dir": self.output_dir, "ollama_model": self.ollama_model, "device": self.device,
            }


def fix_roles(family, msgs):
    """Gemma und Mistral kennen keine System-Rolle: den Systemtext vor die erste Frage setzen."""
    if family in ("gemma", "mistral") and msgs and msgs[0]["role"] == "system":
        sys_text, rest = msgs[0]["content"], list(msgs[1:])
        if rest:
            rest[0] = {"role": rest[0]["role"], "content": sys_text + "\n\n" + rest[0]["content"]}
        return rest
    return msgs


def render(tok, family, msgs, add_generation_prompt=False):
    msgs = fix_roles(family, msgs)
    if getattr(tok, "chat_template", None):
        return tok.apply_chat_template(msgs, tokenize=False, add_generation_prompt=add_generation_prompt)
    # Basismodell ohne Chat-Vorlage: einfache eigene Vorlage
    parts = []
    for m in msgs:
        parts.append({"system": "### System:\n", "user": "### Frage:\n", "assistant": "### Antwort:\n"}[m["role"]] + m["content"] + "\n\n")
    text = "".join(parts)
    if add_generation_prompt:
        text += "### Antwort:\n"
    elif tok.eos_token:
        text += tok.eos_token
    return text


def encode(tok, family, msgs, max_len):
    """Text in Token umwandeln; gelernt wird nur die Antwort (Frage und Systemtext werden maskiert)."""
    full = render(tok, family, msgs)
    prompt = render(tok, family, msgs[:-1], add_generation_prompt=True)
    full_ids = tok(full, add_special_tokens=False)["input_ids"]
    prompt_ids = tok(prompt, add_special_tokens=False)["input_ids"]
    if full_ids[: len(prompt_ids)] == prompt_ids and len(full_ids) > len(prompt_ids):
        labels = [-100] * len(prompt_ids) + full_ids[len(prompt_ids):]
        masked = True
    else:
        labels = list(full_ids)
        masked = False
    return full_ids[:max_len], labels[:max_len], masked


def dtype_kwargs(dtype):
    """transformers ab 4.56 nennt den Parameter dtype, ältere Versionen torch_dtype."""
    import transformers
    major_minor = tuple(int(x) for x in re.findall(r"\d+", transformers.__version__)[:2])
    return {"dtype" if major_minor >= (4, 56) else "torch_dtype": dtype}


def load_model(job, base, cfg):
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer

    dev = device_info()
    job.device = dev["device"]
    method = cfg.get("method", "qlora")
    if dev["device"] == "cuda":
        dtype = torch.bfloat16 if dev["bf16"] else torch.float16
    else:
        dtype = torch.float32
    quant = None
    if method == "qlora":
        if dev["device"] != "cuda":
            job.log("QLoRA (4 Bit) braucht eine NVIDIA-Grafikkarte, nutze normales LoRA.")
            method = "lora"
        else:
            try:
                import bitsandbytes  # noqa: F401
                from transformers import BitsAndBytesConfig
                quant = BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type="nf4", bnb_4bit_compute_dtype=dtype, bnb_4bit_use_double_quant=True)
            except Exception:
                job.log("bitsandbytes fehlt, nutze normales LoRA (16 Bit). Installieren mit: pip install bitsandbytes")
                method = "lora"
    job.log(f"Gerät: {dev['device']}" + (f" ({dev['gpu']}, {dev['vram_gb']} GB)" if dev["gpu"] else "") + f", Methode: {method.upper()}")
    job.log(f"Lade {base} … (beim ersten Mal wird das Modell heruntergeladen)")
    tok = AutoTokenizer.from_pretrained(base)
    if tok.pad_token is None:
        tok.pad_token = tok.eos_token
    kwargs = dtype_kwargs(dtype)
    if quant is not None:
        kwargs["quantization_config"] = quant
        kwargs["device_map"] = {"": 0}
    model = AutoModelForCausalLM.from_pretrained(base, **kwargs)
    if quant is None:
        model.to(dev["device"])
    return model, tok, method, dtype, dev


def run_training(job):
    import torch

    spec = job.spec
    cfg = spec.get("config", {})
    base = spec["base_model"]
    family = spec.get("family", "chatml")
    data = spec["dataset"]
    epochs = max(1, int(cfg.get("epochs", 3)))
    lr = float(cfg.get("learning_rate", 2e-4))
    bs = max(1, int(cfg.get("batch_size", 2)))
    accum = max(1, int(cfg.get("grad_accum", 4)))
    max_len = int(cfg.get("max_seq_length", 1024))
    warmup = int(cfg.get("warmup_steps", 5))
    seed = int(cfg.get("seed", 3407))
    random.seed(seed)
    torch.manual_seed(seed)

    try:
        job.state = "laden"
        model, tok, method, dtype, dev = load_model(job, base, cfg)
        job.model, job.tokenizer = model, tok
        if method in ("lora", "qlora"):
            from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
            if method == "qlora":
                model = prepare_model_for_kbit_training(model, use_gradient_checkpointing=True)
            elif dev["device"] == "cuda":
                model.gradient_checkpointing_enable()
                model.enable_input_require_grads()
            lora = LoraConfig(r=int(cfg.get("lora_r", 16)), lora_alpha=int(cfg.get("lora_alpha", 16)), lora_dropout=float(cfg.get("lora_dropout", 0.0)),
                              target_modules="all-linear", bias="none", task_type="CAUSAL_LM")
            model = get_peft_model(model, lora)
        job.model = model
        trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
        total = sum(p.numel() for p in model.parameters())
        job.log(f"Trainierbare Parameter: {trainable:,} von {total:,} ({100 * trainable / max(total, 1):.2f} %)".replace(",", "."))

        # Daten vorbereiten
        encoded, masked_all = [], True
        for conv in data:
            msgs = conv.get("messages") if isinstance(conv, dict) else conv
            if not msgs or msgs[-1]["role"] != "assistant":
                continue
            ids, labels, masked = encode(tok, family, msgs, max_len)
            masked_all = masked_all and masked
            if any(x != -100 for x in labels):
                encoded.append((ids, labels))
        if not encoded:
            raise RuntimeError("Keine gültigen Trainingsgespräche gefunden.")
        avg = sum(len(e[0]) for e in encoded) / len(encoded)
        job.log(f"Daten: {len(encoded)} Gespräche, im Schnitt {avg:.0f} Token" + ("" if masked_all else " (bei manchen wird auch die Frage mitgelernt)"))

        steps_per_epoch = math.ceil(len(encoded) / (bs * accum))
        job.total_steps = steps_per_epoch * epochs
        params = [p for p in model.parameters() if p.requires_grad]
        opt = torch.optim.AdamW(params, lr=lr, weight_decay=0.0)

        def lr_lambda(step):
            if step < warmup:
                return (step + 1) / max(1, warmup)
            return max(0.0, (job.total_steps - step) / max(1, job.total_steps - warmup))

        sched = torch.optim.lr_scheduler.LambdaLR(opt, lr_lambda)
        use_amp = dev["device"] == "cuda"
        scaler = None
        if use_amp and dtype == torch.float16 and method != "qlora":
            scaler = torch.amp.GradScaler("cuda") if hasattr(torch, "amp") and hasattr(torch.amp, "GradScaler") else torch.cuda.amp.GradScaler()
        device = next(model.parameters()).device
        pad_id = tok.pad_token_id if tok.pad_token_id is not None else 0

        job.state = "training"
        job.log(f"Training startet: {epochs} Epochen, {job.total_steps} Schritte (Batch {bs} × {accum}), Lernrate {lr}")
        model.train()
        t_start = time.time()
        step = 0
        for epoch in range(1, epochs + 1):
            job.epoch = epoch
            order = list(range(len(encoded)))
            random.shuffle(order)
            micro = [order[i:i + bs] for i in range(0, len(order), bs)]
            acc_loss, acc_n = 0.0, 0
            for mi, idxs in enumerate(micro):
                if job.stop:
                    raise KeyboardInterrupt()
                batch = [encoded[i] for i in idxs]
                L = max(len(b[0]) for b in batch)
                input_ids = torch.full((len(batch), L), pad_id, dtype=torch.long)
                labels = torch.full((len(batch), L), -100, dtype=torch.long)
                attn = torch.zeros((len(batch), L), dtype=torch.long)
                for r, (ids, lab) in enumerate(batch):
                    input_ids[r, :len(ids)] = torch.tensor(ids)
                    labels[r, :len(lab)] = torch.tensor(lab)
                    attn[r, :len(ids)] = 1
                input_ids, labels, attn = input_ids.to(device), labels.to(device), attn.to(device)
                with torch.autocast(device_type="cuda", dtype=dtype, enabled=use_amp):
                    out = model(input_ids=input_ids, attention_mask=attn, labels=labels)
                    loss = out.loss / accum
                if scaler:
                    scaler.scale(loss).backward()
                else:
                    loss.backward()
                acc_loss += float(out.loss.detach())
                acc_n += 1
                last_micro = mi == len(micro) - 1
                if acc_n == accum or last_micro:
                    if scaler:
                        scaler.unscale_(opt)
                    torch.nn.utils.clip_grad_norm_(params, 1.0)
                    if scaler:
                        scaler.step(opt)
                        scaler.update()
                    else:
                        opt.step()
                    sched.step()
                    opt.zero_grad(set_to_none=True)
                    step += 1
                    value = acc_loss / acc_n
                    elapsed = time.time() - t_start
                    with job.lock:
                        job.step = step
                        job.loss.append([step, round(value, 4)])
                        job.eta = round(elapsed / step * (job.total_steps - step), 1)
                    if step == 1 or step % max(1, job.total_steps // 20) == 0 or step == job.total_steps:
                        job.log(f"Epoche {epoch}/{epochs} · Schritt {step}/{job.total_steps} · Verlust {value:.4f}")
                    acc_loss, acc_n = 0.0, 0

        job.log(f"Training fertig in {time.time() - t_start:.0f} s")
        save_outputs(job, model, tok, method, dtype, family, cfg)
        job.state = "fertig"
    except KeyboardInterrupt:
        job.state = "abgebrochen"
        job.log("Training abgebrochen.")
    except Exception as e:  # Fehler verständlich melden
        job.state = "fehler"
        job.error = str(e)
        job.log("FEHLER: " + str(e))
        job.log(traceback.format_exc())
        if "out of memory" in str(e).lower():
            job.log("Tipp: Kleineres Modell, Batch-Größe 1 oder kürzere maximale Länge wählen.")
    finally:
        job.finished = time.time()
        job.eta = 0


def save_outputs(job, model, tok, method, dtype, family, cfg):
    import torch

    job.state = "speichern"
    out = os.path.join(OUT_ROOT, job.name)
    os.makedirs(out, exist_ok=True)
    job.output_dir = out
    merged_dir = os.path.join(out, "merged")
    spec = job.spec
    if method in ("lora", "qlora"):
        adapter_dir = os.path.join(out, "adapter")
        model.save_pretrained(adapter_dir)
        tok.save_pretrained(adapter_dir)
        job.log("LoRA-Adapter gespeichert: " + adapter_dir)
        if cfg.get("merge", True):
            job.log("Füge Adapter und Basismodell zusammen …")
            if method == "qlora":
                from peft import PeftModel
                from transformers import AutoModelForCausalLM
                job.log("Lade das Basismodell dafür noch einmal in 16 Bit (braucht etwas Arbeitsspeicher) …")
                base = AutoModelForCausalLM.from_pretrained(spec["base_model"], **dtype_kwargs(torch.float16))
                merged = PeftModel.from_pretrained(base, adapter_dir).merge_and_unload()
            else:
                merged = model.merge_and_unload()
            merged.save_pretrained(merged_dir, safe_serialization=True)
            tok.save_pretrained(merged_dir)
            job.model = merged
            job.log("Komplettes Modell gespeichert: " + merged_dir)
    else:
        model.save_pretrained(merged_dir, safe_serialization=True)
        tok.save_pretrained(merged_dir)
        job.log("Modell gespeichert: " + merged_dir)
    job.model.eval()

    system = spec.get("system", "").replace('"""', "'''")
    temperature = cfg.get("temperature", 0.3)
    params = f"PARAMETER temperature {temperature}\nPARAMETER num_ctx 4096\n"
    source = "./merged"
    gguf = convert_gguf(job, merged_dir, out) if os.path.isdir(merged_dir) else None
    if gguf:
        source = "./" + os.path.basename(gguf)
    modelfile = f"FROM {source}\n" + (TEMPLATES.get(family, "") if gguf else "") + f'SYSTEM """{system}"""\n' + params
    with open(os.path.join(out, "Modelfile"), "w", encoding="utf-8") as f:
        f.write(modelfile)
    with open(os.path.join(out, "LIESMICH.txt"), "w", encoding="utf-8") as f:
        f.write(f"Modell: {job.name}\nBasis: {spec['base_model']}\n\nIn Ollama erstellen (in diesem Ordner):\n  ollama create {job.name} -f Modelfile\n  ollama run {job.name}\n")
    if cfg.get("ollama", True) and os.path.isdir(merged_dir):
        create_ollama(job, out)


def convert_gguf(job, merged_dir, out):
    """Optional: mit llama.cpp in GGUF umwandeln (Umgebungsvariable LLAMA_CPP_DIR zeigt auf llama.cpp)."""
    cpp = os.environ.get("LLAMA_CPP_DIR")
    if not cpp:
        return None
    script = os.path.join(cpp, "convert_hf_to_gguf.py")
    if not os.path.isfile(script):
        job.log("LLAMA_CPP_DIR gesetzt, aber convert_hf_to_gguf.py fehlt dort.")
        return None
    target = os.path.join(out, job.name + ".q8_0.gguf")
    job.log("Wandle in GGUF um (llama.cpp) …")
    res = subprocess.run([sys.executable, script, merged_dir, "--outfile", target, "--outtype", "q8_0"], capture_output=True, text=True)
    if res.returncode != 0 or not os.path.isfile(target):
        job.log("GGUF-Umwandlung fehlgeschlagen: " + (res.stderr or res.stdout)[-600:])
        return None
    job.log("GGUF gespeichert: " + target)
    return target


def create_ollama(job, out):
    exe = shutil.which("ollama")
    if not exe:
        job.log(f"Ollama nicht gefunden. Später selbst erstellen: cd \"{out}\" und dann  ollama create {job.name} -f Modelfile")
        return
    job.state = "ollama"
    job.log(f"Erstelle Ollama-Modell „{job.name}“ …")
    try:
        res = subprocess.run([exe, "create", job.name, "-f", "Modelfile"], cwd=out, capture_output=True, text=True, timeout=3600)
        tail = (res.stdout + res.stderr).strip().splitlines()[-4:]
        for line in tail:
            job.log("ollama: " + line)
        if res.returncode == 0:
            job.ollama_model = job.name
            job.log(f"Fertig! Starten mit:  ollama run {job.name}")
        else:
            job.log("Ollama konnte das Modell nicht importieren. Mit dem Colab-Notebook (GGUF) klappt es immer; testen kannst du es hier trotzdem im Chat.")
    except Exception as e:
        job.log("Ollama-Fehler: " + str(e))


def generate(job, messages, max_new_tokens=400, temperature=0.3):
    import torch

    tok, model = job.tokenizer, job.model
    if tok is None or model is None:
        raise RuntimeError("Kein trainiertes Modell im Speicher.")
    family = job.spec.get("family", "chatml")
    prompt = render(tok, family, [m for m in messages if m.get("role") in ("system", "user", "assistant")], add_generation_prompt=True)
    enc = tok(prompt, return_tensors="pt", add_special_tokens=False)
    device = next(model.parameters()).device
    enc = {k: v.to(device) for k, v in enc.items()}
    model.eval()
    with torch.no_grad():
        out = model.generate(**enc, max_new_tokens=int(max_new_tokens), do_sample=temperature > 0, temperature=max(float(temperature), 0.01),
                             top_p=0.9, pad_token_id=tok.pad_token_id)
    return tok.decode(out[0][enc["input_ids"].shape[1]:], skip_special_tokens=True).strip()


def validate_spec(spec):
    if not isinstance(spec, dict):
        raise ValueError("Ungültiger Auftrag.")
    base = str(spec.get("base_model", ""))
    if not (MODEL_ID.match(base) or os.path.isdir(base)):
        raise ValueError("Basismodell muss eine Hugging-Face-ID sein, z. B. Qwen/Qwen2.5-0.5B-Instruct")
    data = spec.get("dataset")
    if not isinstance(data, list) or not data:
        raise ValueError("Keine Trainingsdaten im Auftrag.")
    if len(data) > 50000:
        raise ValueError("Zu viele Trainingsgespräche (höchstens 50.000).")
    spec["name"] = slug(spec.get("name") or "survival-ki")
    return spec


# ---------------------------------------------------------------- Server
STATE = {"job": None, "jobs": {}}
ALLOWED = list(DEFAULT_ORIGINS)


class Handler(BaseHTTPRequestHandler):
    server_version = "SurvivalTrainer/" + VERSION

    def log_message(self, fmt, *args):  # leiser
        pass

    def origin_ok(self):
        origin = self.headers.get("Origin")
        return origin is None or origin in ALLOWED or bool(LOCAL_ORIGIN.match(origin))

    def cors(self):
        origin = self.headers.get("Origin")
        if origin and self.origin_ok():
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Private-Network", "true")

    def send_json(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_json(self):
        n = int(self.headers.get("Content-Length") or 0)
        if n > 200 * 1024 * 1024:
            raise ValueError("Anfrage zu groß.")
        return json.loads(self.rfile.read(n).decode("utf-8") or "{}")

    def do_OPTIONS(self):
        self.send_response(204 if self.origin_ok() else 403)
        self.cors()
        self.end_headers()

    def do_GET(self):
        if not self.origin_ok():
            return self.send_json(403, {"error": "Diese Webseite darf den Trainer nicht steuern. Starte ihn mit --allow-origin " + str(self.headers.get("Origin"))})
        url = urlparse(self.path)
        if url.path in ("/", "/index.html"):
            body = ("<!doctype html><meta charset=utf-8><title>Survival-KI Trainer</title>"
                    "<body style='font-family:system-ui;max-width:40em;margin:3em auto;padding:0 1em'>"
                    "<h1>Survival-KI Trainer läuft</h1><p>Öffne das Survival-KI Studio und verbinde dich unter "
                    "<b>Training → Lokaler Trainer</b> mit dieser Adresse.</p></body>").encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            return self.wfile.write(body)
        if url.path == "/api/info":
            job = STATE["job"]
            busy = bool(job and job.state in ("wartet", "laden", "training", "speichern", "ollama"))
            return self.send_json(200, {"ok": True, "version": VERSION, **device_info(), "versions": versions(), "ollama": bool(shutil.which("ollama")),
                                        "busy": busy, "job": job.id if job else None, "llama_cpp": bool(os.environ.get("LLAMA_CPP_DIR")), "output": OUT_ROOT})
        if url.path == "/api/status":
            q = parse_qs(url.query)
            job = STATE["jobs"].get((q.get("job") or [""])[0]) or STATE["job"]
            if not job:
                return self.send_json(404, {"error": "Kein Training gefunden."})
            return self.send_json(200, job.snapshot(int((q.get("since") or ["0"])[0] or 0)))
        return self.send_json(404, {"error": "Unbekannte Adresse."})

    def do_POST(self):
        if not self.origin_ok():
            return self.send_json(403, {"error": "Diese Webseite darf den Trainer nicht steuern."})
        url = urlparse(self.path)
        try:
            body = self.read_json()
        except Exception as e:
            return self.send_json(400, {"error": "Ungültige Daten: " + str(e)})
        if url.path == "/api/train":
            job = STATE["job"]
            if job and job.state in ("wartet", "laden", "training", "speichern", "ollama"):
                return self.send_json(409, {"error": "Es läuft schon ein Training."})
            try:
                spec = validate_spec(body)
                versions_ok = versions()
                missing = [k for k in ("torch", "transformers", "peft") if not versions_ok.get(k)]
                if missing:
                    raise ValueError("Es fehlen Python-Pakete: " + ", ".join(missing) + ". Installieren mit: pip install " + " ".join(missing))
            except ValueError as e:
                return self.send_json(400, {"error": str(e)})
            job = Job(spec)
            if STATE["job"] is not None:
                STATE["job"].model = None  # Speicher freigeben
            STATE["job"] = job
            STATE["jobs"][job.id] = job
            job.log(f"Neuer Auftrag „{job.name}“ mit {len(spec['dataset'])} Gesprächen")
            threading.Thread(target=run_training, args=(job,), daemon=True).start()
            return self.send_json(200, {"job": job.id, "name": job.name})
        if url.path == "/api/stop":
            job = STATE["jobs"].get(body.get("job")) or STATE["job"]
            if job:
                job.stop = True
            return self.send_json(200, {"ok": True})
        if url.path == "/api/chat":
            job = STATE["jobs"].get(body.get("job")) or STATE["job"]
            if not job or job.model is None:
                return self.send_json(409, {"error": "Noch kein fertig trainiertes Modell im Trainer. Starte zuerst ein Training."})
            if job.state not in ("fertig", "ollama"):
                return self.send_json(409, {"error": "Das Modell wird noch trainiert. Warte, bis das Training fertig ist."})
            try:
                text = generate(job, body.get("messages") or [], body.get("max_new_tokens", 400), body.get("temperature", 0.3))
            except Exception as e:
                return self.send_json(500, {"error": str(e)})
            return self.send_json(200, {"text": text})
        return self.send_json(404, {"error": "Unbekannte Adresse."})


def cmd_serve(args):
    ALLOWED.extend(args.allow_origin or [])
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f"Survival-KI Trainer {VERSION} läuft auf http://{args.host}:{args.port}")
    print("Erlaubte Webseiten: localhost, " + ", ".join(ALLOWED))
    print("Im Survival-KI Studio: Training → Lokaler Trainer → Verbinden. Beenden mit Strg+C.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nBeendet.")


def cmd_train(args):
    with open(args.job, encoding="utf-8") as f:
        spec = validate_spec(json.load(f))
    if args.base:
        spec["base_model"] = args.base
    job = Job(spec)
    run_training(job)
    print(f"\nErgebnis: {job.state}" + (f" – {job.output_dir}" if job.output_dir else ""))
    return 0 if job.state == "fertig" else 1


def cmd_check(_args):
    v = versions()
    d = device_info()
    print("Survival-KI Trainer", VERSION)
    for k, val in v.items():
        print(f"  {k:13} {val or 'FEHLT'}")
    print(f"  Gerät         {d['device']}" + (f" ({d['gpu']}, {d['vram_gb']} GB)" if d["gpu"] else ""))
    print(f"  Ollama        {'gefunden' if shutil.which('ollama') else 'nicht gefunden'}")
    missing = [k for k in ("torch", "transformers", "peft") if not v.get(k)]
    if missing:
        print("\nBitte installieren: pip install " + " ".join(missing + ["accelerate", "safetensors"]))
        return 1
    print("\nAlles bereit.")
    return 0


def main():
    p = argparse.ArgumentParser(description="Survival-KI Studio – lokaler Trainer")
    sub = p.add_subparsers(dest="cmd")
    s = sub.add_parser("serve", help="Server für die Webseite starten")
    s.add_argument("--host", default="127.0.0.1")
    s.add_argument("--port", type=int, default=DEFAULT_PORT)
    s.add_argument("--allow-origin", action="append", help="weitere Webseite erlauben, z. B. https://meinname.github.io")
    t = sub.add_parser("train", help="Training aus einer job.json starten")
    t.add_argument("job")
    t.add_argument("--base", help="anderes Basismodell (Hugging-Face-ID)")
    sub.add_parser("check", help="Installation prüfen")
    args = p.parse_args()
    if args.cmd == "serve":
        return cmd_serve(args)
    if args.cmd == "train":
        return cmd_train(args)
    if args.cmd == "check":
        return cmd_check(args)
    p.print_help()
    return 0


if __name__ == "__main__":
    sys.exit(main() or 0)
