#!/usr/bin/env python3
import io, os, json, wave, subprocess
from flask import Flask, request, make_response, jsonify
from waitress import serve
from dotenv import load_dotenv

load_dotenv()
PORT = int(os.environ.get("PORT", "8089"))
ALLOW_ORIGIN = os.environ.get("ALLOW_ORIGIN", "http://localhost:5173")
PIPER_BIN = os.environ.get("PIPER_BIN", "piper-tts")
MODEL = os.environ.get("PIPER_MODEL", os.path.expanduser("~/.local/share/piper-voices/zh_CN/zh_CN-huayan-medium.onnx"))
MODEL_JSON = MODEL + ".json"

def detect_rate(default=22050):
  try:
    with open(MODEL_JSON, "r", encoding="utf-8") as f:
      j = json.load(f)
    return int(j.get("sample_rate", default))
  except Exception:
    return default

SAMPLE_RATE = detect_rate()

app = Flask(__name__)

@app.after_request
def add_cors(r):
  r.headers["Access-Control-Allow-Origin"] = ALLOW_ORIGIN
  r.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
  r.headers["Access-Control-Allow-Headers"] = "Content-Type"
  return r

@app.get("/health")
def health():
  return jsonify({"ok": os.path.exists(MODEL), "model": MODEL, "rate": SAMPLE_RATE, "bin": PIPER_BIN})

def pcm16_to_wav(pcm: bytes, rate: int) -> bytes:
  buf = io.BytesIO()
  with wave.open(buf, "wb") as wf:
    wf.setnchannels(1)
    wf.setsampwidth(2)
    wf.setframerate(rate)
    wf.writeframes(pcm)
  return buf.getvalue()

def run_piper(txt: str) -> bytes:
  cmd = [PIPER_BIN, "-q", "-m", MODEL, "-f", "-"]
  proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
  pcm, err = proc.communicate(input=txt.encode("utf-8"), timeout=30)
  if proc.returncode != 0:
    raise RuntimeError(f"piper failed {proc.returncode}: {err.decode('utf-8', 'ignore')}")
  return pcm

@app.route("/tts", methods=["GET","POST","OPTIONS"])
def tts():
  if request.method == "OPTIONS":
    return ("", 204)
  text = request.args.get("text") if request.method == "GET" else (request.get_json(silent=True) or {}).get("text")
  if not text or not text.strip():
    return make_response(jsonify({"error":"missing text"}), 400)
  pcm = run_piper(text.strip())
  wav = pcm16_to_wav(pcm, SAMPLE_RATE)
  resp = make_response(wav)
  resp.headers["Content-Type"] = "audio/wav"
  resp.headers["Cache-Control"] = "no-store"
  return resp

if __name__ == "__main__":
  serve(app, host="127.0.0.1", port=PORT)
