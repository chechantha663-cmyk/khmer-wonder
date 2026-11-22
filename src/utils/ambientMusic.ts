export interface AmbientThemeProfile {
  themeId: string;
  labelKm: string;
  moodLabelKm: string;
  scaleHz: number[];
  droneHz: [number, number];
  tempoMs: number;
  padType: OscillatorType;
  melodyType: OscillatorType;
  filterCutoff: number;
  natureKind: 'breeze' | 'forest' | 'river' | 'sunset' | 'night' | 'courtyard';
  motif: number[]; // indices into scaleHz, -1 = gentle rest
}

export const AMBIENT_PROFILES: Record<string, AmbientThemeProfile> = {
  'angkor-amber': {
    themeId: 'angkor-amber',
    labelKm: 'អង្គរពន្លឺមាស',
    moodLabelKm: 'គង និងរនាតពេលព្រឹក',
    // D major pentatonic
    scaleHz: [293.66, 329.63, 369.99, 440.0, 493.88, 587.33, 659.25],
    droneHz: [146.83, 220.0],
    tempoMs: 920,
    padType: 'sine',
    melodyType: 'triangle',
    filterCutoff: 950,
    natureKind: 'breeze',
    motif: [0, 2, 3, -1, 5, 4, 3, -1, 2, 3, 4, -1, 3, 2, 0, -1],
  },
  'emerald-forest': {
    themeId: 'emerald-forest',
    labelKm: 'ព្រៃបុរាណបៃតង',
    moodLabelKm: 'ខ្លុយព្រៃ និងខ្យល់ស្លឹកឈើ',
    // G major pentatonic
    scaleHz: [392.0, 440.0, 493.88, 587.33, 659.25, 783.99, 880.0],
    droneHz: [196.0, 293.66],
    tempoMs: 840,
    padType: 'triangle',
    melodyType: 'sine',
    filterCutoff: 1200,
    natureKind: 'forest',
    motif: [0, 1, 2, 4, -1, 3, 2, 1, 2, -1, 5, 4, 3, 2, 0, -1],
  },
  'mekong-azure': {
    themeId: 'mekong-azure',
    labelKm: 'ដងទន្លេមេគង្គ',
    moodLabelKm: 'ទឹកហូរ និងពិណស្រទន់',
    // C major pentatonic
    scaleHz: [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33],
    droneHz: [130.81, 196.0],
    tempoMs: 780,
    padType: 'sine',
    melodyType: 'sine',
    filterCutoff: 1050,
    natureKind: 'river',
    motif: [0, 2, 3, 5, 4, 3, -1, 2, 3, 4, 5, 6, 5, 3, 2, -1],
  },
  'sunset-meadow': {
    themeId: 'sunset-meadow',
    labelKm: 'វាលស្រែថ្ងៃលិច',
    moodLabelKm: 'វាលស្រែមាស និងខ្សែទ្រស្រទន់',
    // F major pentatonic
    scaleHz: [220.0, 261.63, 293.66, 349.23, 392.0, 440.0, 523.25],
    droneHz: [174.61, 261.63],
    tempoMs: 960,
    padType: 'sawtooth',
    melodyType: 'triangle',
    filterCutoff: 780,
    natureKind: 'sunset',
    motif: [3, 4, 5, -1, 6, 5, 4, 3, 2, -1, 3, 5, 4, 2, 1, -1],
  },
  'starry-night': {
    themeId: 'starry-night',
    labelKm: 'រាត្រីភូមិខ្មែរ',
    moodLabelKm: 'ភ្លេងបំពេរាត្រីអំពិលអំពែក',
    // A minor pentatonic
    scaleHz: [220.0, 261.63, 293.66, 329.63, 392.0, 440.0, 523.25],
    droneHz: [110.0, 164.81],
    tempoMs: 1050,
    padType: 'sine',
    melodyType: 'sine',
    filterCutoff: 720,
    natureKind: 'night',
    motif: [0, -1, 3, 4, 5, -1, 4, 3, 1, -1, 2, 3, 4, 2, 0, -1],
  },
  'golden-courtyard': {
    themeId: 'golden-courtyard',
    labelKm: 'ខ្លោងទ្វារផ្កាចំប៉ា',
    moodLabelKm: 'ជួងខ្យល់ និងរនាតផ្កាចំប៉ា',
    // E major pentatonic
    scaleHz: [329.63, 369.99, 415.3, 493.88, 554.37, 659.25, 739.99],
    droneHz: [164.81, 246.94],
    tempoMs: 880,
    padType: 'triangle',
    melodyType: 'sine',
    filterCutoff: 1120,
    natureKind: 'courtyard',
    motif: [0, 2, 3, -1, 4, 5, 3, -1, 2, 4, 3, 1, 2, -1, 0, -1],
  },
};

export function moodToAmbientThemeId(mood: string): string {
  switch (mood) {
    case 'forest':
      return 'emerald-forest';
    case 'river':
      return 'mekong-azure';
    case 'sunset':
      return 'sunset-meadow';
    case 'night':
      return 'starry-night';
    case 'courtyard':
      return 'golden-courtyard';
    case 'angkor':
    default:
      return 'angkor-amber';
  }
}

interface ActiveLayer {
  layerGain: GainNode;
  stopNodes: () => void;
  timerId: number;
}

class AmbientMusicEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private duckGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private activeLayer: ActiveLayer | null = null;
  private currentThemeId = 'angkor-amber';
  private playing = false;
  private volume = 0.42;
  private ducked = false;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    if (!this.ctx) {
      this.ctx = new AC();
      this.masterGain = this.ctx.createGain();
      this.duckGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
      this.duckGain.gain.setValueAtTime(1, this.ctx.currentTime);
      this.duckGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
      this.noiseBuffer = this.createPinkNoiseBuffer(this.ctx);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private createPinkNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const length = ctx.sampleRate * 4; // 4 seconds seamless noise buffer
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let b3 = 0;
    let b4 = 0;
    let b5 = 0;
    let b6 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.05;
      b6 = white * 0.115926;
    }
    // Crossfade start/end samples so buffer loops without any click
    const fadeSamples = Math.min(2048, Math.floor(length / 8));
    for (let i = 0; i < fadeSamples; i++) {
      const t = i / fadeSamples;
      data[length - fadeSamples + i] =
        data[length - fadeSamples + i] * (1 - t) + data[i] * t;
    }
    return buffer;
  }

  private fadeOutAndDisposeLayer(layer: ActiveLayer, fadeSec = 0.95) {
    window.clearInterval(layer.timerId);
    const ctx = this.ctx;
    if (!ctx) {
      layer.stopNodes();
      return;
    }
    const now = ctx.currentTime;
    try {
      layer.layerGain.gain.cancelScheduledValues(now);
      layer.layerGain.gain.setValueAtTime(Math.max(0.0001, layer.layerGain.gain.value), now);
      layer.layerGain.gain.exponentialRampToValueAtTime(0.0001, now + fadeSec);
    } catch {
      // ignore
    }
    window.setTimeout(() => {
      layer.stopNodes();
      try {
        layer.layerGain.disconnect();
      } catch {
        // ignore
      }
    }, Math.ceil((fadeSec + 0.12) * 1000));
  }

  private startLayerForTheme(themeId: string): ActiveLayer | null {
    const ctx = this.ensureContext();
    if (!ctx || !this.duckGain) return null;

    const profile = AMBIENT_PROFILES[themeId] || AMBIENT_PROFILES['angkor-amber'];
    const now = ctx.currentTime;

    const layerGain = ctx.createGain();
    layerGain.gain.setValueAtTime(0.0001, now);
    layerGain.gain.exponentialRampToValueAtTime(1, now + 1.15);
    layerGain.connect(this.duckGain);

    // Warm low-pass bus for dreamy depth
    const padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.setValueAtTime(profile.filterCutoff, now);
    padFilter.Q.value = 0.9;
    padFilter.connect(layerGain);

    // Slow breathing LFO modulating the pad filter
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.11, now);
    lfoGain.gain.setValueAtTime(profile.filterCutoff * 0.28, now);
    lfo.connect(lfoGain).connect(padFilter.frequency);
    lfo.start(now);

    // 2 detuned warm drone oscillators for lush harmony
    const droneOscs: OscillatorNode[] = [];
    const droneGains: GainNode[] = [];
    profile.droneHz.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = profile.padType;
      osc.frequency.setValueAtTime(freq, now);
      osc.detune.setValueAtTime(idx === 0 ? -4 : 5, now);
      g.gain.setValueAtTime(profile.padType === 'sawtooth' ? 0.032 : 0.068, now);
      osc.connect(g).connect(padFilter);
      osc.start(now);
      droneOscs.push(osc);
      droneGains.push(g);
    });

    // Looping nature ambience bed (wind / river / night crickets)
    let noiseSource: AudioBufferSourceNode | null = null;
    let natureLfo: OscillatorNode | null = null;
    if (this.noiseBuffer) {
      noiseSource = ctx.createBufferSource();
      noiseSource.buffer = this.noiseBuffer;
      noiseSource.loop = true;

      const natureFilter = ctx.createBiquadFilter();
      const natureGain = ctx.createGain();

      if (profile.natureKind === 'river') {
        natureFilter.type = 'bandpass';
        natureFilter.frequency.setValueAtTime(520, now);
        natureFilter.Q.value = 0.7;
        natureGain.gain.setValueAtTime(0.16, now);
      } else if (profile.natureKind === 'forest') {
        natureFilter.type = 'bandpass';
        natureFilter.frequency.setValueAtTime(760, now);
        natureFilter.Q.value = 1.4;
        natureGain.gain.setValueAtTime(0.11, now);
      } else if (profile.natureKind === 'night') {
        natureFilter.type = 'bandpass';
        natureFilter.frequency.setValueAtTime(2800, now);
        natureFilter.Q.value = 5.5;
        natureGain.gain.setValueAtTime(0.032, now);
      } else {
        natureFilter.type = 'lowpass';
        natureFilter.frequency.setValueAtTime(420, now);
        natureFilter.Q.value = 0.8;
        natureGain.gain.setValueAtTime(0.1, now);
      }

      // Gentle undulating breeze LFO
      natureLfo = ctx.createOscillator();
      const natureLfoGain = ctx.createGain();
      natureLfo.type = 'sine';
      natureLfo.frequency.setValueAtTime(profile.natureKind === 'river' ? 0.16 : 0.09, now);
      natureLfoGain.gain.setValueAtTime(
        profile.natureKind === 'night' ? 0.014 : 0.04,
        now,
      );
      natureLfo.connect(natureLfoGain).connect(natureGain.gain);
      natureLfo.start(now);

      noiseSource.connect(natureFilter).connect(natureGain).connect(layerGain);
      noiseSource.start(now);
    }

    // Soft feedback delay for serene spatial echo on melody notes
    const delay = ctx.createDelay(1.0);
    delay.delayTime.setValueAtTime(0.36, now);
    const delayFeedback = ctx.createGain();
    delayFeedback.gain.setValueAtTime(0.32, now);
    const delayWet = ctx.createGain();
    delayWet.gain.setValueAtTime(0.28, now);
    const delayFilter = ctx.createBiquadFilter();
    delayFilter.type = 'lowpass';
    delayFilter.frequency.setValueAtTime(1400, now);

    delay.connect(delayFilter);
    delayFilter.connect(delayFeedback);
    delayFeedback.connect(delay);
    delayFilter.connect(delayWet);
    delayWet.connect(layerGain);

    // Graceful looping pentatonic melody scheduler
    let step = 0;
    let disposed = false;
    const playStep = () => {
      if (disposed || !this.ctx || this.ctx.state !== 'running') return;
      const t = this.ctx.currentTime + 0.03;
      const idx = profile.motif[step % profile.motif.length];
      step++;

      if (idx < 0) return;

      // Subtle human variation on repeat cycles
      const cycle = Math.floor(step / profile.motif.length);
      const octaveBoost = cycle % 2 === 1 && step % 5 === 0 ? 2 : 1;
      const freq = profile.scaleHz[idx % profile.scaleHz.length] * octaveBoost;

      const osc = this.ctx.createOscillator();
      const overtone = this.ctx.createOscillator();
      const noteGain = this.ctx.createGain();
      const overtoneGain = this.ctx.createGain();

      osc.type = profile.melodyType;
      osc.frequency.setValueAtTime(freq, t);

      // Gentle woody/chime harmonic overtone
      overtone.type = 'sine';
      overtone.frequency.setValueAtTime(freq * 2, t);
      overtoneGain.gain.setValueAtTime(0.022, t);

      const peak = 0.085 + Math.random() * 0.025;
      const decaySec = profile.natureKind === 'night' ? 1.8 : 1.45;
      noteGain.gain.setValueAtTime(0.0001, t);
      noteGain.gain.exponentialRampToValueAtTime(peak, t + 0.035);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, t + decaySec);

      osc.connect(noteGain);
      overtone.connect(overtoneGain).connect(noteGain);
      noteGain.connect(layerGain);
      noteGain.connect(delay);

      osc.start(t);
      overtone.start(t);
      osc.stop(t + decaySec + 0.05);
      overtone.stop(t + decaySec + 0.05);
    };

    // Play an immediate welcoming first note, then loop seamlessly
    const introTimerId = window.setTimeout(playStep, 180);
    const timerId = window.setInterval(playStep, profile.tempoMs);

    return {
      layerGain,
      timerId,
      stopNodes: () => {
        disposed = true;
        window.clearTimeout(introTimerId);
        try {
          lfo.stop();
        } catch {
          // ignore
        }
        try {
          natureLfo?.stop();
        } catch {
          // ignore
        }
        try {
          noiseSource?.stop();
        } catch {
          // ignore
        }
        droneOscs.forEach((o) => {
          try {
            o.stop();
          } catch {
            // ignore
          }
        });
        droneGains.forEach((g) => {
          try {
            g.disconnect();
          } catch {
            // ignore
          }
        });
        try {
          delay.disconnect();
          delayFeedback.disconnect();
          delayWet.disconnect();
          padFilter.disconnect();
        } catch {
          // ignore
        }
      },
    };
  }

  public start(themeId?: string) {
    if (themeId) this.currentThemeId = themeId;
    if (this.playing) {
      if (themeId) this.setTheme(themeId);
      return;
    }
    this.playing = true;
    this.activeLayer = this.startLayerForTheme(this.currentThemeId);
  }

  public stop() {
    this.playing = false;
    if (this.activeLayer) {
      this.fadeOutAndDisposeLayer(this.activeLayer, 0.5);
      this.activeLayer = null;
    }
  }

  public setTheme(themeId: string) {
    if (themeId === this.currentThemeId && this.activeLayer) return;
    this.currentThemeId = themeId;
    if (!this.playing) return;
    const prev = this.activeLayer;
    this.activeLayer = this.startLayerForTheme(themeId);
    if (prev) {
      this.fadeOutAndDisposeLayer(prev, 1.0);
    }
  }

  public setVolume(val: number) {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.ctx && this.masterGain) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setTargetAtTime(this.volume, now, 0.08);
    }
  }

  public setDucked(isDucked: boolean) {
    if (this.ducked === isDucked) return;
    this.ducked = isDucked;
    if (this.ctx && this.duckGain) {
      const now = this.ctx.currentTime;
      this.duckGain.gain.cancelScheduledValues(now);
      this.duckGain.gain.setTargetAtTime(isDucked ? 0.34 : 1, now, 0.18);
    }
  }

  public isPlaying(): boolean {
    return this.playing;
  }
}

export const ambientMusic = new AmbientMusicEngine();
