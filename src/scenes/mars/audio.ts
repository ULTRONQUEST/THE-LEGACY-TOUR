export class MarsSoundscape {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private spaceOsc: OscillatorNode | null = null;
  private thrusterGain: GainNode | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private enabled = false;

  public isEnabled(): boolean {
    return this.enabled;
  }

  public toggle(): boolean {
    if (!this.ctx) {
      this.init();
    }
    this.enabled = !this.enabled;
    if (this.ctx && this.ctx.state === 'suspended' && this.enabled) {
      void this.ctx.resume();
    }
    if (this.masterGain && this.ctx) {
      const target = this.enabled ? 0.22 : 0.0;
      this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.25);
    }
    return this.enabled;
  }

  private init(): void {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    this.ctx = ctx;

    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    this.masterGain = master;

    // Deep space sub-harmonic drone
    const spaceOsc = ctx.createOscillator();
    spaceOsc.type = 'sine';
    spaceOsc.frequency.value = 54;
    const spaceGain = ctx.createGain();
    spaceGain.gain.value = 0.24;
    spaceOsc.connect(spaceGain);
    spaceGain.connect(master);
    spaceOsc.start();
    this.spaceOsc = spaceOsc;

    // Filtered noise generator for thruster rumble & Martian wind
    const bufferSize = ctx.sampleRate * 2;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = data[i];
      data[i] *= 3.2;
    }

    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = noiseBuffer;
    noiseSrc.loop = true;

    const thrusterFilter = ctx.createBiquadFilter();
    thrusterFilter.type = 'lowpass';
    thrusterFilter.frequency.value = 130;

    const thrusterGain = ctx.createGain();
    thrusterGain.gain.value = 0;

    noiseSrc.connect(thrusterFilter);
    thrusterFilter.connect(thrusterGain);
    thrusterGain.connect(master);

    // Bandpass wind whisper for surface shots
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 380;
    windFilter.Q.value = 2.4;

    const windGain = ctx.createGain();
    windGain.gain.value = 0;

    noiseSrc.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(master);

    noiseSrc.start();

    this.thrusterGain = thrusterGain;
    this.windGain = windGain;
    this.windFilter = windFilter;
  }

  public update(progress: number, accelIntensity: number, elapsed: number): void {
    if (!this.ctx || !this.enabled) return;

    const now = this.ctx.currentTime;
    const isSurface = progress > 3.45;
    const surfaceBlend = Math.min(1, Math.max(0, (progress - 3.45) / 0.7));

    if (this.thrusterGain) {
      const burnVol = progress < 1.0 ? 0.1 + accelIntensity * 0.42 : 0.04 * (1 - surfaceBlend);
      this.thrusterGain.gain.setTargetAtTime(burnVol, now, 0.12);
    }

    if (this.windGain && this.windFilter) {
      const gust = 0.08 + Math.sin(elapsed * 0.45) * 0.03 + Math.sin(elapsed * 1.13) * 0.02;
      this.windGain.gain.setTargetAtTime(isSurface ? surfaceBlend * gust * 1.9 : 0, now, 0.25);
      this.windFilter.frequency.setTargetAtTime(320 + Math.sin(elapsed * 0.35) * 95, now, 0.3);
    }

    if (this.spaceOsc) {
      this.spaceOsc.frequency.setTargetAtTime(52 + accelIntensity * 14, now, 0.2);
    }
  }

  public dispose(): void {
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}
