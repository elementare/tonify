#!/usr/bin/env bash
set -euo pipefail

# Cross-distro installer for the Tonify local Piper bridge.
# It creates a venv, installs Python deps, ensures a Mandarin model is present,
# writes a systemd user unit, and starts the bridge on localhost:8089.

# Detect repo paths
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRV_DIR="$REPO_DIR/server"
VENV_DIR="${HOME}/.local/share/tonify-tts/venv"
SYSTEMD_DIR="${HOME}/.config/systemd/user"
UNIT_TEMPLATE="$REPO_DIR/deploy/systemd/piper-bridge.service.template"
UNIT_TARGET="${SYSTEMD_DIR}/piper-bridge.service"

# Defaults
ALLOW_ORIGIN_DEFAULT="http://localhost:5173"
MODEL_DIR="${HOME}/.local/share/piper-voices/zh_CN"
MODEL_ONNX="${MODEL_DIR}/zh_CN-huayan-medium.onnx"
MODEL_JSON="${MODEL_ONNX}.json"
ENV_FILE="${SRV_DIR}/.env"

echo "[1/8] Checking basic tools"
need() { command -v "$1" >/dev/null 2>&1 || { echo "Missing $1. Install it and re-run."; exit 1; }; }
need python3
need curl

# Optional but useful tools
if ! command -v jq >/dev/null 2>&1; then
  echo "jq not found. I will continue, but it is useful for debugging sample_rate."
fi

echo "[2/8] Creating Python venv at ${VENV_DIR}"
python3 -m venv "${VENV_DIR}"
"${VENV_DIR}/bin/pip" install --upgrade pip
"${VENV_DIR}/bin/pip" install -r "${SRV_DIR}/requirements.txt"

echo "[3/8] Writing .env"
cp -f "${SRV_DIR}/.env.example" "${ENV_FILE}" || true
sed -i "s|%USER_HOME%|${HOME}|g" "${ENV_FILE}"
grep -q '^ALLOW_ORIGIN=' "${ENV_FILE}" || echo "ALLOW_ORIGIN=${ALLOW_ORIGIN_DEFAULT}" >> "${ENV_FILE}"

# Piper binary guidance by distro
echo "[4/8] Checking for Piper binary"
if ! command -v piper-tts >/dev/null 2>&1 && ! command -v piper >/dev/null 2>&1; then
  echo
  echo "Piper not found on PATH."
  echo "Install Piper according to your distro, then re-run this script if needed:"
  echo "  Arch:    yay -S piper-tts-bin"
  echo "  Debian:  build from source or download a prebuilt release, put the binary in ~/.local/bin and add it to PATH"
  echo "  Ubuntu:  same as Debian"
  echo "  Fedora:  build from source or use a prebuilt release"
  echo
  echo "I will proceed. The service will fail to synthesize until Piper is installed."
else
  # If only 'piper' exists, set that in .env
  if command -v piper >/dev/null 2>&1 && ! command -v piper-tts >/dev/null 2>&1; then
    sed -i "s|^PIPER_BIN=.*$|PIPER_BIN=piper|g" "${ENV_FILE}"
    echo "Detected 'piper'. Using PIPER_BIN=piper."
  else
    sed -i "s|^PIPER_BIN=.*$|PIPER_BIN=piper-tts|g" "${ENV_FILE}"
    echo "Detected 'piper-tts'."
  fi
fi

echo "[5/8] Ensuring a Mandarin model exists"
mkdir -p "${MODEL_DIR}"
if [[ ! -f "${MODEL_ONNX}" || ! -f "${MODEL_JSON}" ]]; then
  echo "Downloading zh_CN huayan medium model"
  curl -L -o "${MODEL_ONNX}" "https://huggingface.co/csukuangfj/vits-piper-zh_CN-huayan-medium/resolve/main/zh_CN-huayan-medium.onnx?download=true"
  curl -L -o "${MODEL_JSON}" "https://huggingface.co/csukuangfj/vits-piper-zh_CN-huayan-medium/resolve/main/zh_CN-huayan-medium.onnx.json?download=true"
fi
if grep -q '^PIPER_MODEL=' "${ENV_FILE}"; then
  sed -i "s|^PIPER_MODEL=.*$|PIPER_MODEL=${MODEL_ONNX}|g" "${ENV_FILE}"
else
  echo "PIPER_MODEL=${MODEL_ONNX}" >> "${ENV_FILE}"
fi

echo "[6/8] Writing systemd user unit"
mkdir -p "${SYSTEMD_DIR}"
UNIT_CONTENT="$(cat "${UNIT_TEMPLATE}")"
UNIT_CONTENT="${UNIT_CONTENT//__WORKDIR__/${SRV_DIR}}"
UNIT_CONTENT="${UNIT_CONTENT//__VENV__/${VENV_DIR}}"
echo "${UNIT_CONTENT}" > "${UNIT_TARGET}"

echo "[7/8] Enabling service"
systemctl --user daemon-reload
systemctl --user enable --now piper-bridge.service || true

echo "[8/8] Health check"
sleep 0.7
if curl -sf 'http://127.0.0.1:8089/health' >/dev/null; then
  echo "OK. Local Piper bridge is up."
else
  echo "Warning. Bridge did not respond. Check logs:"
  echo "  journalctl --user -u piper-bridge -f"
fi

echo
echo "Local TTS endpoint: http://127.0.0.1:8089/tts?text=你好世界"
echo "Edit config: ${ENV_FILE}"
