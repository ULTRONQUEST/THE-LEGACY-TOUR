export class DeepSpaceAudio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private droneGain: GainNode | null = null;
  private rumbleGain: GainNode | null = null;
  private rumbleFilter: BiquadFilterNode | null = null;
  private enabled = false;

  public toggle(): boolean {
    if (!this.ctx) {
      this.init();
    }
    this.enabled = !this.enabled;
    if (this.ctx && this.masterGain) {
      if (this.enabled && this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setTargetAtTime(this.enabled ? 0.22 : 0.0, now, 0.45);
    }
    return this.enabled;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  private init() {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    this.ctx = ctx;

    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    this.masterGain = master;

    // 1. Serene Interstellar Harmonic Pad (D2, A2, E3, F#3 very soft)
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.42;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 340;
    droneGain.connect(lp);
    lp.connect(master);
    this.droneGain = droneGain;

    const freqs = [73.42, 110.0, 146.83, 220.0];
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = idx === 0 ? 0.35 : 0.14;
      osc.connect(g);
      g.connect(droneGain);
      osc.start();
    });

    // 2. Subtle Filtered Propulsion Sub-Rumble (scales with speedFactor)
    const bufferSize = ctx.sampleRate * 2;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    const rumbleFilter = ctx.createBiquadFilter();
    rumbleFilter.type = 'lowpass';
    rumbleFilter.frequency.value = 95;
    this.rumbleFilter = rumbleFilter;

    const rumbleGain = ctx.createGain();
    rumbleGain.gain.value = 0.0;
    this.rumbleGain = rumbleGain;

    whiteNoise.connect(rumbleFilter);
    rumbleFilter.connect(rumbleGain);
    rumbleGain.connect(master);
    whiteNoise.start();
  }

  public update(speedFactor: number) {
    if (!this.ctx || !this.enabled || !this.rumbleGain || !this.rumbleFilter || !this.droneGain) {
      return;
    }
    const now = this.ctx.currentTime;
    const speed = Math.max(0, Math.min(1, speedFactor));
    this.rumbleGain.gain.setTargetAtTime(speed * 0.45, now, 0.25);
    this.rumbleFilter.frequency.setTargetAtTime(55 + speed * 110, now, 0.25);
    this.droneGain.gain.setTargetAtTime(0.32 + (1 - speed) * 0.28, now, 0.4);
  }

  public dispose() {
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}
