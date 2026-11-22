import { ambientMusic } from './ambientMusic';

export type VoiceEngine = 'device' | 'google' | 'azure';

export interface VoiceSettings {
  voiceEnabled: boolean;
  sfxEnabled: boolean;
  confettiEnabled: boolean;
  engine: VoiceEngine;
  rate: number;
  deviceVoiceUri: string;
  azureKey: string;
  azureRegion: string;
  azureGender: 'female' | 'male';
}

const STORAGE_KEY = 'khmerStudioVoiceSettings_v1';

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  voiceEnabled: true,
  sfxEnabled: true,
  confettiEnabled: true,
  engine: 'device',
  rate: 1,
  deviceVoiceUri: 'auto',
  azureKey: '',
  azureRegion: 'southeastasia',
  azureGender: 'female',
};

export function loadVoiceSettings(): VoiceSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_VOICE_SETTINGS;
    return { ...DEFAULT_VOICE_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_VOICE_SETTINGS;
  }
}

export function saveVoiceSettings(settings: VoiceSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore storage quota errors
  }
}

// ===== Web Audio API Synthesized Sound Effects =====
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!audioCtx) audioCtx = new AC();
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function playTone(
  freq: number,
  startOffset: number,
  duration: number,
  type: OscillatorType = 'sine',
  volume = 0.16,
) {
  const ctx = getAudioContext();
  if (!ctx) return;
  const t0 = ctx.currentTime + startOffset;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.04);
}

export function playSfx(
  kind: 'success' | 'error' | 'click' | 'victory' | 'meow' | 'purr' | 'crunch' | 'tick',
  enabled: boolean,
) {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  if (kind === 'click') {
    playTone(580, 0, 0.07, 'sine', 0.08);
    return;
  }
  if (kind === 'tick') {
    playTone(740, 0, 0.04, 'triangle', 0.09);
    return;
  }
  if (kind === 'success') {
    playTone(523.25, 0, 0.28, 'sine', 0.14);
    playTone(659.25, 0.09, 0.28, 'sine', 0.14);
    playTone(783.99, 0.18, 0.35, 'sine', 0.14);
    playTone(1046.5, 0.27, 0.55, 'sine', 0.11);
    return;
  }
  if (kind === 'victory') {
    playTone(523.25, 0, 0.25, 'triangle', 0.14);
    playTone(659.25, 0.1, 0.25, 'triangle', 0.14);
    playTone(783.99, 0.2, 0.25, 'triangle', 0.14);
    playTone(1046.5, 0.32, 0.45, 'sine', 0.16);
    playTone(1318.5, 0.48, 0.7, 'sine', 0.14);
    return;
  }
  if (kind === 'error') {
    playTone(230, 0, 0.2, 'triangle', 0.14);
    playTone(175, 0.11, 0.28, 'triangle', 0.14);
    return;
  }
  if (kind === 'crunch') {
    playTone(320, 0, 0.08, 'square', 0.08);
    playTone(460, 0.1, 0.08, 'square', 0.08);
    playTone(620, 0.22, 0.22, 'sine', 0.13);
    return;
  }
  if (kind === 'purr') {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(115, t);
    lfo.frequency.setValueAtTime(24, t);
    lfoGain.gain.setValueAtTime(18, t);
    lfo.connect(lfoGain).connect(osc.frequency);
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.exponentialRampToValueAtTime(0.14, t + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.85);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    lfo.start(t);
    osc.stop(t + 0.9);
    lfo.stop(t + 0.9);
    return;
  }
  if (kind === 'meow') {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(520, t);
    osc.frequency.exponentialRampToValueAtTime(940, t + 0.18);
    osc.frequency.exponentialRampToValueAtTime(430, t + 0.58);
    filter.type = 'bandpass';
    filter.Q.value = 3;
    filter.frequency.setValueAtTime(920, t);
    filter.frequency.exponentialRampToValueAtTime(2150, t + 0.2);
    filter.frequency.exponentialRampToValueAtTime(900, t + 0.58);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.28, t + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.62);
    osc.connect(filter).connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.66);
  }
}

// ===== Text-to-Speech (Device / Google / Azure) =====
const AZURE_VOICES: Record<string, [string, string]> = {
  'km-KH': ['km-KH-SreymomNeural', 'km-KH-PisethNeural'],
  'en-US': ['en-US-AnaNeural', 'en-US-GuyNeural'],
  'fr-FR': ['fr-FR-DeniseNeural', 'fr-FR-HenriNeural'],
  'es-ES': ['es-ES-ElviraNeural', 'es-ES-AlvaroNeural'],
  'th-TH': ['th-TH-PremwadeeNeural', 'th-TH-NiwatNeural'],
  'vi-VN': ['vi-VN-HoaiMyNeural', 'vi-VN-NamMinhNeural'],
  'zh-CN': ['zh-CN-XiaoxiaoNeural', 'zh-CN-YunxiNeural'],
  'ja-JP': ['ja-JP-NanamiNeural', 'ja-JP-KeitaNeural'],
  'ko-KR': ['ko-KR-SunHiNeural', 'ko-KR-InJoonNeural'],
};

let activeAudio: HTMLAudioElement | null = null;
let speechToken = 0;

function stopActiveAudio() {
  if (activeAudio) {
    try {
      activeAudio.pause();
    } catch {
      // ignore
    }
    activeAudio.onended = null;
    activeAudio.onerror = null;
    activeAudio.onplaying = null;
    activeAudio = null;
  }
}

export function stopSpeech() {
  speechToken++;
  stopActiveAudio();
  ambientMusic.setDucked(false);
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function chunkText(text: string): string[] {
  const parts = text.replace(/\s+/g, ' ').match(/[^.!?។៕,，。！？\n]+[.!?។៕,，。！？]*/g) || [text];
  const out: string[] = [];
  let cur = '';
  for (const p of parts) {
    if ((cur + p).length > 155) {
      if (cur.trim()) out.push(cur.trim());
      cur = p;
    } else {
      cur += p;
    }
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

export interface SpeakOptions {
  lang?: string;
  pitch?: number;
  onStart?: () => void;
  onEnd?: () => void;
  onStatus?: (msg: string) => void;
}

function speakDevice(
  text: string,
  lang: string,
  settings: VoiceSettings,
  opts: SpeakOptions,
) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    opts.onStatus?.('កម្មវិធីរុករកនេះមិនគាំទ្រការអានសម្លេងទេ។');
    opts.onEnd?.();
    return;
  }
  const synth = window.speechSynthesis;
  const utter = new SpeechSynthesisUtterance(text);
  const voices = synth.getVoices();
  let chosen: SpeechSynthesisVoice | undefined;

  if (settings.deviceVoiceUri && settings.deviceVoiceUri !== 'auto') {
    chosen = voices.find((v) => v.voiceURI === settings.deviceVoiceUri);
  }
  if (!chosen) {
    chosen = voices.find((v) => v.lang.toLowerCase().startsWith(lang.slice(0, 2).toLowerCase()));
  }

  if (chosen) {
    utter.voice = chosen;
    utter.lang = chosen.lang;
  } else {
    utter.lang = lang;
  }
  utter.rate = settings.rate || 1;
  utter.pitch = opts.pitch ?? 1;
  utter.onstart = () => opts.onStart?.();
  utter.onend = () => opts.onEnd?.();
  utter.onerror = () => opts.onEnd?.();
  synth.cancel();
  synth.speak(utter);
}

export function speakText(
  rawText: string,
  settings: VoiceSettings,
  opts: SpeakOptions = {},
) {
  if (!settings.voiceEnabled) {
    opts.onEnd?.();
    return;
  }
  const text = rawText.replace(/[«»]/g, '').trim();
  if (!text) {
    opts.onEnd?.();
    return;
  }
  const lang = opts.lang || 'km-KH';
  const myToken = ++speechToken;
  stopActiveAudio();

  const wrappedOpts: SpeakOptions = {
    ...opts,
    onStart: () => {
      ambientMusic.setDucked(true);
      opts.onStart?.();
    },
    onEnd: () => {
      if (myToken === speechToken) {
        ambientMusic.setDucked(false);
      }
      opts.onEnd?.();
    },
  };

  const fallback = (reason?: string) => {
    if (reason) wrappedOpts.onStatus?.(reason);
    speakDevice(text, lang, settings, wrappedOpts);
  };

  if (settings.engine === 'azure' && settings.azureKey.trim()) {
    const fullLang =
      AZURE_VOICES[lang]
        ? lang
        : Object.keys(AZURE_VOICES).find((k) => k.slice(0, 2) === lang.slice(0, 2).toLowerCase()) || 'en-US';
    const voice = AZURE_VOICES[fullLang][settings.azureGender === 'male' ? 1 : 0];
    const pitchPct = Math.max(-40, Math.min(60, Math.round(((opts.pitch ?? 1) - 1) * 60)));
    const ratePct = Math.round(((settings.rate || 1) - 1) * 100);
    const region = (settings.azureRegion.trim() || 'southeastasia').toLowerCase();
    const ssml = `<speak version='1.0' xml:lang='${fullLang}'><voice xml:lang='${fullLang}' name='${voice}'><prosody pitch='${pitchPct >= 0 ? '+' : ''}${pitchPct}%' rate='${ratePct >= 0 ? '+' : ''}${ratePct}%'>${escapeXml(text)}</prosody></voice></speak>`;

    fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': settings.azureKey.trim(),
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
      },
      body: ssml,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Azure ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        if (myToken !== speechToken) return;
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        let started = false;
        audio.onplaying = () => {
          if (!started) {
            started = true;
            wrappedOpts.onStart?.();
          }
        };
        audio.onended = () => {
          URL.revokeObjectURL(url);
          if (myToken === speechToken) wrappedOpts.onEnd?.();
        };
        audio.onerror = () => {
          URL.revokeObjectURL(url);
          if (myToken !== speechToken) return;
          if (!started) fallback('ភ្ជាប់ Azure មិនបាន — ប្រើសម្លេងឧបករណ៍ជំនួស');
          else wrappedOpts.onEnd?.();
        };
        activeAudio = audio;
        audio.play().catch(() => {
          if (myToken === speechToken && !started) fallback();
        });
      })
      .catch(() => {
        if (myToken === speechToken) fallback('ពិនិត្យ Azure Key/Region — ប្រើសម្លេងឧបករណ៍ជំនួស');
      });
    return;
  }

  if (settings.engine === 'google') {
    const tl = /^zh/i.test(lang) ? 'zh-CN' : lang.split('-')[0].toLowerCase();
    const chunks = chunkText(text);
    const pitch = opts.pitch ?? 1;
    const playRate = Math.min(1.6, Math.max(0.75, (1 + (pitch - 1) * 0.4) * (settings.rate || 1)));
    let idx = 0;
    let startedAny = false;

    const nextChunk = () => {
      if (myToken !== speechToken) return;
      if (idx >= chunks.length) {
        wrappedOpts.onEnd?.();
        return;
      }
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(tl)}&q=${encodeURIComponent(chunks[idx++])}`;
      const audio = new Audio();
      audio.setAttribute('referrerpolicy', 'no-referrer');
      audio.src = url;
      audio.playbackRate = playRate;
      audio.onplaying = () => {
        if (!startedAny) {
          startedAny = true;
          wrappedOpts.onStart?.();
        }
      };
      audio.onended = nextChunk;
      audio.onerror = () => {
        if (myToken !== speechToken) return;
        if (!startedAny) fallback('សេវាអនឡាញមិនឆ្លើយតប — ប្រើសម្លេងឧបករណ៍ជំនួស');
        else wrappedOpts.onEnd?.();
      };
      activeAudio = audio;
      audio.play().catch(() => {
        if (myToken === speechToken && !startedAny) fallback();
      });
    };
    nextChunk();
    return;
  }

  speakDevice(text, lang, settings, wrappedOpts);
}

export function getFirstGrapheme(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  const IntlAny = Intl as unknown as {
    Segmenter?: new (
      locale?: string,
      options?: { granularity: 'grapheme' },
    ) => { segment: (s: string) => Iterable<{ segment: string }> };
  };
  if (typeof Intl !== 'undefined' && IntlAny.Segmenter) {
    const iter = new IntlAny.Segmenter(undefined, { granularity: 'grapheme' }).segment(trimmed);
    const first = Array.from(iter)[0]?.segment;
    if (first) return first.toUpperCase();
  }
  return trimmed.charAt(0).toUpperCase();
}
