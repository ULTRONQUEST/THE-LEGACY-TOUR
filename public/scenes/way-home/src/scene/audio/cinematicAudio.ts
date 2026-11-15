// Procedural Emotional Orchestral Web Audio Score for "The Way Home"
// Generates warm strings, sub-cello drone, delicate felt piano, and subtle ion ambient hum.

export class CinematicScoreEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private padGain: GainNode | null = null;
  private droneGain: GainNode | null = null;
  private pianoGain: GainNode | null = null;
  private padFilter: BiquadFilterNode | null = null;
  private isMuted = false;
  private isRunning = false;
  private lastChordIndex = -1;
  private lastNoteStep = -1;
  private activePadOscs: Array<{ osc: OscillatorNode; gain: GainNode }> = [];

  // Emotional harmonic progression across the 7 shots (C minor -> Eb -> Ab -> Fm -> Eb -> Bb -> C major add9)
  private readonly chordProgression: Array<{ freqs: number[]; bass: number }> = [
    // Shot 1: Interstellar Farewell (C minor 9 - quiet, vast, poignant)
    { freqs: [130.81, 196.0, 233.08, 293.66, 311.13], bass: 65.41 },
    // Shot 2: Deep Space Journey (Ab maj7 - expansive, serene)
    { freqs: [103.83, 155.56, 196.0, 246.94, 311.13], bass: 51.91 },
    // Shot 3: Memories of Exploration (Eb maj7 -> Bb/D - nostalgic, noble)
    { freqs: [155.56, 233.08, 293.66, 349.23, 392.0], bass: 77.78 },
    // Shot 4: Earth Appears Again (F minor 9 -> Ab - emotional swell)
    { freqs: [174.61, 207.65, 261.63, 311.13, 392.0], bass: 87.31 },
    // Shot 5: Beauty of Our Home (Eb maj9 - luminous, soaring wonder)
    { freqs: [155.56, 196.0, 233.08, 293.66, 349.23], bass: 77.78 },
    // Shot 6: What Exploration Gave Us (Bb sus4 -> Bb - hopeful, dignified)
    { freqs: [116.54, 174.61, 233.08, 293.66, 349.23], bass: 58.27 },
    // Shot 7: Final Cosmic Reveal (C add9 - transcendent peace, awe)
    { freqs: [130.81, 196.0, 261.63, 293.66, 329.63], bass: 65.41 },
  ];

  // Delicate felt-piano arpeggio frequencies matching each chord
  private readonly pianoMotifs: number[][] = [
    [523.25, 622.25, 587.33, 392.0],
    [415.3, 523.25, 622.25, 783.99],
    [622.25, 587.33, 466.16, 392.0],
    [523.25, 622.25, 698.46, 783.99],
    [622.25, 783.99, 932.33, 698.46],
    [466.16, 587.33, 698.46, 783.99],
    [523.25, 659.25, 783.99, 587.33],
  ];

  public initAndStart(): boolean {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      this.isRunning = true;
      return true;
    }

    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return false;

      const ctx = new AudioCtx();
      this.ctx = ctx;

      const master = ctx.createGain();
      master.gain.value = this.isMuted ? 0 : 0.42;
      master.connect(ctx.destination);
      this.masterGain = master;

      // Warm lowpass filter for orchestral string sheen
      const padFilter = ctx.createBiquadFilter();
      padFilter.type = 'lowpass';
      padFilter.frequency.value = 950;
      padFilter.Q.value = 0.7;
      padFilter.connect(master);
      this.padFilter = padFilter;

      const padGain = ctx.createGain();
      padGain.gain.value = 0.28;
      padGain.connect(padFilter);
      this.padGain = padGain;

      const droneGain = ctx.createGain();
      droneGain.gain.value = 0.14;
      droneGain.connect(master);
      this.droneGain = droneGain;

      const pianoGain = ctx.createGain();
      pianoGain.gain.value = 0.24;
      pianoGain.connect(master);
      this.pianoGain = pianoGain;

      // Subtle deep-space sub-cello drone
      const droneOsc = ctx.createOscillator();
      droneOsc.type = 'sine';
      droneOsc.frequency.value = 65.41;
      droneOsc.connect(droneGain);
      droneOsc.start();

      // Gentle 2nd harmonic warmth
      const droneHarm = ctx.createOscillator();
      droneHarm.type = 'triangle';
      droneHarm.frequency.value = 130.81;
      const harmGain = ctx.createGain();
      harmGain.gain.value = 0.25;
      droneHarm.connect(harmGain);
      harmGain.connect(droneGain);
      droneHarm.start();

      this.activePadOscs.push({ osc: droneOsc, gain: droneGain });
      this.activePadOscs.push({ osc: droneHarm, gain: harmGain });

      this.isRunning = true;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      return true;
    } catch {
      return false;
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.42, this.ctx.currentTime, 0.25);
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public update(sceneTime: number, isPlaying: boolean) {
    if (!this.ctx || !this.isRunning || !this.masterGain) return;
    if (this.ctx.state === 'suspended' && isPlaying) {
      this.ctx.resume().catch(() => {});
    }

    const now = this.ctx.currentTime;
    if (!isPlaying) {
      this.masterGain.gain.setTargetAtTime(0, now, 0.25);
      return;
    }

    // Fade out gently in final 7 seconds of Shot 7
    const endFade = sceneTime > 154 ? Math.max(0, 1 - (sceneTime - 154) / 7.5) : 1;
    const targetMaster = (this.isMuted ? 0 : 0.42) * endFade;
    this.masterGain.gain.setTargetAtTime(targetMaster, now, 0.35);

    // Map sceneTime to chord index (0..6)
    let chordIdx = 0;
    if (sceneTime >= 136) chordIdx = 6;
    else if (sceneTime >= 112) chordIdx = 5;
    else if (sceneTime >= 88) chordIdx = 4;
    else if (sceneTime >= 68) chordIdx = 3;
    else if (sceneTime >= 42) chordIdx = 2;
    else if (sceneTime >= 22) chordIdx = 1;

    // Swell filter cutoff during Earth Reveal (Shot 4 & 5)
    if (this.padFilter) {
      const targetCutoff = chordIdx === 3 || chordIdx === 4 ? 1550 : chordIdx === 6 ? 780 : 1050;
      this.padFilter.frequency.setTargetAtTime(targetCutoff, now, 1.8);
    }

    // Trigger warm orchestral pad chord on shot transition
    if (chordIdx !== this.lastChordIndex) {
      this.lastChordIndex = chordIdx;
      this.triggerPadChord(this.chordProgression[chordIdx]);
    }

    // Trigger delicate sparse felt-piano motif every 3.4 seconds
    const noteStep = Math.floor(sceneTime / 3.4);
    if (noteStep !== this.lastNoteStep && sceneTime < 153) {
      this.lastNoteStep = noteStep;
      const motif = this.pianoMotifs[chordIdx];
      const freq = motif[noteStep % motif.length];
      this.triggerPianoNote(freq, chordIdx === 3 || chordIdx === 4 ? 0.22 : 0.15);
    }
  }

  private triggerPadChord(chord: { freqs: number[]; bass: number }) {
    if (!this.ctx || !this.padGain) return;
    const now = this.ctx.currentTime;

    // Shift drone bass smoothly
    if (this.activePadOscs[0]) {
      this.activePadOscs[0].osc.frequency.setTargetAtTime(chord.bass, now, 1.6);
    }
    if (this.activePadOscs[1]) {
      this.activePadOscs[1].osc.frequency.setTargetAtTime(chord.bass * 2, now, 1.6);
    }

    chord.freqs.forEach((f, idx) => {
      if (!this.ctx || !this.padGain) return;
      for (const detune of [-4.5, 4.5]) {
        const osc = this.ctx.createOscillator();
        osc.type = idx === 0 ? 'triangle' : 'sawtooth';
        osc.frequency.value = f;
        osc.detune.value = detune;

        const env = this.ctx.createGain();
        env.gain.setValueAtTime(0.0001, now);
        env.gain.linearRampToValueAtTime(idx === 0 ? 0.09 : 0.045, now + 3.2);
        env.gain.setValueAtTime(idx === 0 ? 0.09 : 0.045, now + 14.0);
        env.gain.exponentialRampToValueAtTime(0.0001, now + 22.0);

        osc.connect(env);
        env.connect(this.padGain);
        osc.start(now);
        osc.stop(now + 22.5);
      }
    });
  }

  private triggerPianoNote(freq: number, velocity: number) {
    if (!this.ctx || !this.pianoGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;

    const overtone = this.ctx.createOscillator();
    overtone.type = 'sine';
    overtone.frequency.value = freq * 2;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1600, now);
    filter.frequency.exponentialRampToValueAtTime(340, now + 3.2);

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(velocity, now + 0.035);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 4.4);

    const overGain = this.ctx.createGain();
    overGain.gain.value = 0.22;

    osc.connect(filter);
    overtone.connect(overGain);
    overGain.connect(filter);
    filter.connect(env);
    env.connect(this.pianoGain);

    osc.start(now);
    overtone.start(now);
    osc.stop(now + 4.6);
    overtone.stop(now + 4.6);
  }

  public dispose() {
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
    this.isRunning = false;
  }
}
