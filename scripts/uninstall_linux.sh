#!/usr/bin/env bash
set -euo pipefail

SYSTEMD_DIR="${HOME}/.config/systemd/user"
UNIT="${SYSTEMD_DIR}/piper-bridge.service"
VENV_DIR="${HOME}/.local/share/tonify-tts/venv"

systemctl --user disable --now piper-bridge.service || true
rm -f "${UNIT}"
systemctl --user daemon-reload || true

read -r -p "Remove the Python venv at ${VENV_DIR}? [y/N] " ans
if [[ "${ans}" == "y" || "${ans}" == "Y" ]]; then
  rm -rf "${VENV_DIR}"
  echo "Venv removed."
fi

echo "Uninstall complete."
