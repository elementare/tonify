const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

const hanRegex = /\p{Script=Han}/u;
const isHanChar = ch => hanRegex.test(ch);

// config
const REMOTE_TTS = "https://SEU_DOMINIO_AQUI/tts";
const LOCAL_TTS = "http://127.0.0.1:8089/tts";

// speech flow selection
async function voicesReady() {
  return new Promise(resolve => {
    const s = window.speechSynthesis;
    if (!s) return resolve([]);
    let v = s.getVoices();
    if (v && v.length) return resolve(v);
    const on = () => { v = s.getVoices(); if (v && v.length) { s.removeEventListener('voiceschanged', on); resolve(v); } };
    s.addEventListener('voiceschanged', on);
    setTimeout(() => resolve(s.getVoices() || []), 1500);
  });
}

async function pickChineseVoice() {
  const voices = await voicesReady();
  const zh = voices.find(v => /zh|cmn|Chinese/i.test(v.lang));
  $('#voiceInfo').textContent = zh ? `Browser voice ${zh.name} ${zh.lang}` : 'No browser zh voice';
  return zh || null;
}

async function speakSmart(text) {
  const s = window.speechSynthesis;
  // try browser zh voice
  if (s) {
    const zh = await pickChineseVoice();
    if (zh) {
      const u = new SpeechSynthesisUtterance(text);
      u.voice = zh;
      u.lang = zh.lang || 'zh-CN';
      s.cancel();
      s.speak(u);
      $('#speakMode').textContent = 'web voice';
      return;
    }
  }
  // try local bridge
  try {
    const r = await fetch(`${LOCAL_TTS}?text=${encodeURIComponent(text)}`);
    if (r.ok && r.headers.get('Content-Type')?.includes('audio')) {
      const blob = await r.blob();
      await playBlob(blob);
      $('#speakMode').textContent = 'piper local';
      return;
    }
  } catch {}
  // server hosted
  const r2 = await fetch(`${REMOTE_TTS}?text=${encodeURIComponent(text)}`);
  if (!r2.ok) throw new Error('remote tts error ' + r2.status);
  const blob2 = await r2.blob();
  await playBlob(blob2);
  $('#speakMode').textContent = 'piper remote';
}

async function playBlob(blob) {
  const url = URL.createObjectURL(blob);
  if (!playBlob._a) {
    playBlob._a = new Audio();
    playBlob._a.addEventListener('ended', () => URL.revokeObjectURL(playBlob._a.src));
  } else {
    try { URL.revokeObjectURL(playBlob._a.src); } catch {}
  }
  playBlob._a.src = url;
  await playBlob._a.play();
}

function stopSpeak() {
  const s = window.speechSynthesis;
  if (s) s.cancel();
  if (playBlob._a) { try { playBlob._a.pause(); } catch {} }
}

// tone machinery
const toneMarks = {
  a: ['a','ā','á','ǎ','à'],
  e: ['e','ē','é','ě','è'],
  i: ['i','ī','í','ǐ','ì'],
  o: ['o','ō','ó','ǒ','ò'],
  u: ['u','ū','ú','ǔ','ù'],
  ü: ['ü','ǖ','ǘ','ǚ','ǜ']
};
function normalizeUmlaut(syl){ return syl.replace(/u:|v/gi,'ü'); }
function applyToneToSyllable(baseSyl, toneNum){
  const t = String(toneNum);
  if (!baseSyl) return baseSyl;
  if (t === '5' || t === '0' || t === '') return baseSyl;

  let syl = normalizeUmlaut(baseSyl.toLowerCase());
  const vowels = ['a','e','o','i','u','ü'];
  const markChar = (s, ch) => {
    const idx = s.indexOf(ch);
    if (idx === -1) return s;
    const mark = toneMarks[ch][Number(t)];
    return s.slice(0,idx) + mark + s.slice(idx+1);
  };
  if (syl.includes('a')) return markChar(syl, 'a');
  if (syl.includes('e')) return markChar(syl, 'e');
  if (syl.includes('ou')) return markChar(syl, 'o');
  if (syl.includes('iu')) return markChar(syl, 'u');
  if (syl.includes('ui')) return markChar(syl, 'i');
  for (let i = syl.length-1; i >= 0; i--) { const ch = syl[i]; if (vowels.includes(ch)) return markChar(syl, ch); }
  return syl;
}
function toneNumForChar(ch) {
  const pyNum = window.pinyinPro.pinyin(ch,{toneType:'num',type:'string',multiple:false,nonZh:'consecutive'})||'';
  const m = pyNum.match(/([a-züÜvV:]+)([1-5])$/i);
  return m ? m[2] : '5';
}
function toRubyLine(text, toneMode) {
  const frag = document.createDocumentFragment();
  for (const ch of text) {
    if (isHanChar(ch)) {
      const py = window.pinyinPro.pinyin(ch,{toneType:toneMode,type:'string',multiple:false,nonZh:'consecutive'})||'';
      const ruby = document.createElement('ruby');
      ruby.textContent = ch;
      if (toneMode) { const rt = document.createElement('rt'); rt.textContent = py; ruby.appendChild(rt); }
      frag.appendChild(ruby);
    } else { frag.appendChild(document.createTextNode(ch)); }
  }
  const div = document.createElement('div'); div.className = 'line'; div.appendChild(frag); return div;
}
function renderTrainer(raw) {
  const out = $('#out'); out.innerHTML = '';
  const lines = raw.split('\n');
  for (const line of lines) {
    if (line.trim() === '') { out.appendChild(document.createElement('br')); continue; }
    const div = document.createElement('div'); div.className = 'line';
    for (const ch of line) {
      if (isHanChar(ch)) {
        const ruby = document.createElement('ruby'); ruby.textContent = ch;
        const rt = document.createElement('rt');
        const pyToneless = window.pinyinPro.pinyin(ch,{toneType:'none',type:'string',multiple:false,nonZh:'consecutive'})||'';
        const toneAns = toneNumForChar(ch);
        const sy = document.createElement('span'); sy.className = 'sy'; sy.tabIndex = 0;
        sy.textContent = pyToneless; sy.dataset.base = pyToneless; sy.dataset.ans = toneAns;
        sy.addEventListener('click', () => assignToneToSpan(sy, state.currentTone));
        sy.addEventListener('focus', () => state.focusedSpan = sy);
        rt.appendChild(sy); ruby.appendChild(rt); div.appendChild(ruby);
      } else { div.appendChild(document.createTextNode(ch)); }
    }
    out.appendChild(div);
  }
}

// app state
const state = { currentTone: '1', focusedSpan: null };
function setCurrentTone(t){ state.currentTone = String(t); $$('.tone-btn').forEach(b => b.classList.toggle('active', b.dataset.tone === state.currentTone)); }
function assignToneToSpan(sy, toneNum){ if (!sy||!toneNum) return; const base = sy.dataset.base || sy.textContent; const toned = applyToneToSyllable(base, toneNum); sy.textContent = toned; sy.dataset.userNum = String(toneNum); sy.classList.add('user-set'); sy.classList.remove('ok','bad'); }
function selectNext(prev=false){ const spans=$$('.sy'); if(!spans.length) return; let idx=spans.indexOf(state.focusedSpan); if(idx===-1) idx=0; else idx=prev?Math.max(0,idx-1):Math.min(spans.length-1,idx+1); spans[idx].focus(); }
function checkTones(){ const spans=$$('.sy'); if(!spans.length){ $('#score').textContent='—'; return; } let correct=0,total=0; spans.forEach(sy=>{ const ans=sy.dataset.ans, usr=sy.dataset.userNum; if(!ans) return; total+=1; sy.classList.remove('ok','bad'); if(usr&&usr===ans){ sy.classList.add('ok'); correct+=1; } else { sy.classList.add('bad'); } }); const pct=total?Math.round(100*correct/total):0; $('#score').textContent=`${correct}/${total} (${pct}%)`; }
function resetGuesses(){ $('#score').textContent='—'; $$('.sy').forEach(sy=>{ sy.textContent=sy.dataset.base||sy.textContent; delete sy.dataset.userNum; sy.classList.remove('ok','bad','user-set'); }); }
function getSelectionFromTextarea(){ const ta=$('#lyrics'); const s=ta.selectionStart,e=ta.selectionEnd; if(s===e) return ''; return ta.value.substring(s,e); }
function practiceSelection(){ const sel=getSelectionFromTextarea(); if(!sel.trim()){ alert('Select some Chinese text first'); return; } $('#lyrics').value=sel; document.querySelector('input[name="mode"][value="trainer"]').checked=true; renderView(); }
async function speakSelection(){ const sel=getSelectionFromTextarea().trim(); const txt=sel||$('#lyrics').value.trim(); if(!txt){ alert('Nothing to speak'); return; } await speakSmart(txt); }
async function speakCurrentLine(){ const out=$('#out'); const sel=window.getSelection(); let node=sel&&sel.anchorNode?sel.anchorNode:null; while(node&&node.parentElement&&!node.classList?.contains?.('line')) node=node.parentElement; const lineEl=node&&node.classList?.contains('line')?node:out.querySelector('.line'); if(!lineEl){ status('No line'); return; } const text=lineEl.textContent.replace(/\s+/g,' ').trim(); if(text) await speakSmart(text); else status('Empty line'); }
function status(msg){ $('#status').textContent = msg || ''; }
function renderView(){ const raw=$('#lyrics').value.replaceAll('\r\n','\n'); const out=$('#out'); out.innerHTML=''; const mode=document.querySelector('input[name="mode"]:checked').value; if(mode!=='trainer'){ const toneMode = mode==='hanzi' ? '' : (mode==='none' ? 'none' : mode); const lines=raw.split('\n'); for(const line of lines){ if(line.trim()===''){ out.appendChild(document.createElement('br')); continue; } out.appendChild(toRubyLine(line,toneMode)); } return; } renderTrainer(raw); }

$('#render').addEventListener('click', renderView);
$$('input[name="mode"]').forEach(r => r.addEventListener('change', renderView));
$('#copyHtml').addEventListener('click', () => { const html=$('#out').innerHTML; navigator.clipboard.writeText(html).then(()=>{ const btn=$('#copyHtml'); const old=btn.textContent; btn.textContent='Copied'; setTimeout(()=>btn.textContent=old,900); }); });
$('#demo').addEventListener('click', () => { const sample=['告白气球','你的眼睛 在说我愿意','我多喜欢你 你会知道','把你写进诗的每一句','你是我最最最想要的美好'].join('\n'); $('#lyrics').value=sample; renderView(); });
$('#check').addEventListener('click', checkTones);
$('#resetChoices').addEventListener('click', resetGuesses);
$('#useSelection').addEventListener('click', practiceSelection);
$('#speakSelection').addEventListener('click', speakSelection);
$('#speakLine').addEventListener('click', speakCurrentLine);
$('#stopSpeak').addEventListener('click', stopSpeak);
$$('.tone-btn').forEach(b => b.addEventListener('click', () => setCurrentTone(b.dataset.tone)));
setCurrentTone('1');
pickChineseVoice(); renderView();
