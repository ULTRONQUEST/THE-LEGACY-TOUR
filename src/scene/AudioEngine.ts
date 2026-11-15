/**
 * Zero-dependency Web Audio API procedural soundscape for The Legacy Tour.
 * Synthesizes cryogenic pad venting, deep F-1 engine ignition rumble & crackle,
 * and serene deep-space harmonic ambience.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private rumbleFilter: BiquadFilterNode | null = null;
  private rumbleGain: GainNode | null = null;
  private crackleFilter: BiquadFilterNode | null = null;
  private crackleGain: GainNode | null = null;
  private spaceGain: GainNode | null = null;
  private enabled = false;

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (enabled && !this.ctx) {
      this.init();
    }
    if (this.ctx && this.masterGain) {
      if (enabled && this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      this.masterGain.gain.setTargetAtTime(enabled ? 0.42 : 0, this.ctx.currentTime, 0.2);
    }
  }

  private init(): void {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0;
    this.masterGain.connect(this.ctx.destination);

    // Generate 3-second noise buffer for rocket thrust & venting
    const bufferSize = this.ctx.sampleRate * 3;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.04 * white) / 1.04;
      data[i] = lastOut * 3.2;
    }

    // Sub-bass engine roar chain
    const rumbleSource = this.ctx.createBufferSource();
    rumbleSource.buffer = noiseBuffer;
    rumbleSource.loop = true;

    this.rumbleFilter = this.ctx.createBiquadFilter();
    this.rumbleFilter.type = 'lowpass';
    this.rumbleFilter.frequency.value = 110;

    this.rumbleGain = this.ctx.createGain();
    this.rumbleGain.gain.value = 0;

    rumbleSource.connect(this.rumbleFilter);
    this.rumbleFilter.connect(this.rumbleGain);
    this.rumbleGain.connect(this.masterGain);
    rumbleSource.start();

    // High-frequency supersonic exhaust crackle / pad vent
    const crackleSource = this.ctx.createBufferSource();
    crackleSource.buffer = noiseBuffer;
    crackleSource.loop = true;

    this.crackleFilter = this.ctx.createBiquadFilter();
    this.crackleFilter.type = 'bandpass';
    this.crackleFilter.frequency.value = 850;
    this.crackleFilter.Q.value = 0.7;

    this.crackleGain = this.ctx.createGain();
    this.crackleGain.gain.value = 0;

    crackleSource.connect(this.crackleFilter);
    this.crackleFilter.connect(this.crackleGain);
    this.crackleGain.connect(this.masterGain);
    crackleSource.start();

    // Serene deep-space harmonic pad (2 detuned warm sine oscillators)
    this.spaceGain = this.ctx.createGain();
    this.spaceGain.gain.value = 0;
    const spaceFilter = this.ctx.createBiquadFilter();
    spaceFilter.type = 'lowpass';
    spaceFilter.frequency.value = 320;
    this.spaceGain.connect(spaceFilter);
    spaceFilter.connect(this.masterGain);

    const freqs = [65.41, 98.0, 130.81]; // C2, G2, C3 fifth chord
    for (const f of freqs) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      const g = this.ctx.createGain();
      g.gain.value = 0.16;
      osc.connect(g);
      g.connect(this.spaceGain);
      osc.start();
    }
  }

  public update(thrustLevel: number, ventLevel: number, spaceLevel: number): void {
    if (!this.enabled || !this.ctx || !this.rumbleGain || !this.crackleGain || !this.spaceGain) {
      return;
    }
    const now = this.ctx.currentTime;
    const rLevel = Math.min(0.85, thrustLevel * 0.85);
    const cLevel = Math.min(0.45, thrustLevel * 0.35 + ventLevel * 0.08);
    const sLevel = Math.min(0.45, spaceLevel * 0.42);

    this.rumbleGain.gain.setTargetAtTime(rLevel, now, 0.08);
    if (this.rumbleFilter) {
      this.rumbleFilter.frequency.setTargetAtTime(75 + thrustLevel * 180, now, 0.1);
    }
    this.crackleGain.gain.setTargetAtTime(cLevel, now, 0.08);
    this.spaceGain.gain.setTargetAtTime(sLevel, now, 0.25);
  }

  public dispose(): void {
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}
