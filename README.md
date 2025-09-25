# Tonify

Tonify is a lightweight Mandarin tone training tool that runs entirely in your browser. It lets you paste Chinese text (lyrics, poems, or dialogue), view the text in different pinyin formats, and practice applying the correct tones directly on syllables.  

The idea is simple: most learners struggle with tones because they only *hear* them passively. Tonify forces you to actively engage—click a syllable, assign a tone mark, and check yourself against the correct answer. Over time, you stop being “tone-deaf” and start recognizing the melody of Mandarin.

---

## Features

- **Multiple views**  
  Switch between Hanzi, toneless pinyin, pinyin with tone marks, pinyin with numbers, or an interactive trainer mode.

- **Trainer mode**  
  Each syllable is clickable. Choose a tone (¯ ˊ ˇ ˋ ·) and apply it to the syllable itself. Immediate feedback tells you whether you were right.

- **Score tracking**  
  See your accuracy as you go, line by line.

- **Text-to-speech (optional)**  
  - On the web (GitHub Pages): uses the browser’s built-in Chinese voice if available.  
  - Locally: integrates with [Piper](https://github.com/rhasspy/piper) for high-quality offline speech synthesis.

- **Works offline**  
  No server roundtrips needed for the training logic. Your text never leaves your device.

---

## Getting Started

### Online (GitHub Pages)

Visit:  
[https://elementare.github.io/tonify/](https://elementare.github.io/tonify/)

Paste some Chinese text, select a mode, and start practicing. If your browser has a Chinese voice installed, the “Speak” buttons will read lines aloud.

### Local installation (Linux/Windows)

If you want offline TTS with Piper:

```bash
git clone https://github.com/elementare/tonify.git
cd tonify
```

On Linux:

```bash
bash scripts/install_linux.sh
```

On Windows (PowerShell):

```powershell
.\scripts\install_windows.ps1
```

Then:

```bash
# start the local bridge
systemctl --user start piper-bridge.service   # Linux only

# serve the frontend
cd web
python3 -m http.server 5173
```

Open `http://localhost:5173` in your browser. The app will now use Piper when you press “Speak.”

---

## Why this project?

Mandarin tones are notoriously hard for learners. Listening alone often isn’t enough—you need deliberate practice that connects the sound, the visual pinyin form, and your own guesses. Tonify creates a focused environment for exactly that.

---

## Roadmap

- Support for exporting practice sessions (e.g. Anki cards).  
- Extended TTS voice selection.  
- Mobile-friendly UI improvements.  

Contributions are welcome.

---

## License

MIT. See [LICENSE](LICENSE).
