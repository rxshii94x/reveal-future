// Minimal Ambient Synthesizer using Web Audio API for a cinematic, luxurious Dune/Interstellar-like exhibition atmosphere.
class AmbientSynth {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private oscillators: OscillatorNode[] = [];
  private filter: BiquadFilterNode | null = null;
  private filterLfo: OscillatorNode | null = null;
  private lfoGain: GainNode | null = null;
  private initialized = false;

  constructor() {}

  public init() {
    if (this.initialized) return;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime); // Start fully silent

      // Create a high-quality Biquad Filter to make it a deep warm drone
      this.filter = this.ctx.createBiquadFilter();
      this.filter.type = "lowpass";
      this.filter.Q.setValueAtTime(4, this.ctx.currentTime);
      this.filter.frequency.setValueAtTime(140, this.ctx.currentTime);

      // Create a slow low-frequency oscillator to sweep the filter frequency (wind/space effect)
      this.filterLfo = this.ctx.createOscillator();
      this.filterLfo.type = "sine";
      this.filterLfo.frequency.setValueAtTime(0.04, this.ctx.currentTime); // sweeps once every 25 seconds

      this.lfoGain = this.ctx.createGain();
      this.lfoGain.gain.setValueAtTime(60, this.ctx.currentTime); // modulate up/down by 60Hz

      // Connect LFO to filter frequency
      this.filterLfo.connect(this.lfoGain);
      this.lfoGain.connect(this.filter.frequency);

      // Deep minor atmospheric chord (C1: 32.7Hz, C2: 65.4Hz, G2: 98.0Hz, Eb3: 155.6Hz, Bb3: 233.1Hz)
      const frequencies = [32.70, 65.41, 98.00, 155.56, 233.08];
      const types: OscillatorType[] = ["sawtooth", "triangle", "sine", "triangle", "sine"];
      const gains = [0.15, 0.35, 0.40, 0.20, 0.15];

      frequencies.forEach((freq, idx) => {
        if (!this.ctx || !this.filter) return;
        const osc = this.ctx.createOscillator();
        const oscGain = this.ctx.createGain();

        osc.type = types[idx];
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        
        // Add extremely subtle vibrato to make it feel natural
        const vibrato = this.ctx.createOscillator();
        const vibratoGain = this.ctx.createGain();
        vibrato.frequency.setValueAtTime(0.2 + Math.random() * 0.1, this.ctx.currentTime);
        vibratoGain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        
        vibrato.connect(vibratoGain);
        vibratoGain.connect(osc.frequency);
        vibrato.start();

        // Connect everything
        oscGain.gain.setValueAtTime(gains[idx], this.ctx.currentTime);
        osc.connect(oscGain);
        oscGain.connect(this.filter);

        osc.start();
        this.oscillators.push(osc);
        this.oscillators.push(vibrato); // keep references to stop
      });

      // Filter feeds into master gain, which feeds to speakers
      this.filter.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      _startOscillatingFilterSweep(this.filterLfo);

      this.initialized = true;
    } catch (e) {
      console.warn("Web Audio API is not supported or blocked in this context", e);
    }
  }

  public async start() {
    this.init();
    if (!this.ctx || !this.masterGain) return;

    if (this.ctx.state === "suspended") {
      await this.ctx.resume();
    }

    // Smooth elegant ramp-up (2.5 seconds) to avoid audio sudden pops
    const now = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
    this.masterGain.gain.linearRampToValueAtTime(0.35, now + 2.5); // Target volume 35%
  }

  public stop() {
    if (!this.ctx || !this.masterGain) return;
    
    const now = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
    // Smooth ramp-down (1.5 seconds)
    this.masterGain.gain.linearRampToValueAtTime(0, now + 1.5);
  }

  public setVolume(vol: number) {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    this.masterGain.gain.linearRampToValueAtTime(vol, now + 0.5);
  }

  public playChime() {
    if (!this.ctx || !this.initialized || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const fundamental = 528.0; // Transformative frequency
    const partials = [
      { ratio: 1.0, gain: 0.22, decay: 4.8 },
      { ratio: 2.0, gain: 0.12, decay: 3.5 },
      { ratio: 2.76, gain: 0.08, decay: 2.8 },
      { ratio: 3.0, gain: 0.06, decay: 2.2 },
      { ratio: 4.0, gain: 0.04, decay: 1.6 },
      { ratio: 5.4, gain: 0.02, decay: 1.2 },
      { ratio: 6.8, gain: 0.01, decay: 0.8 }
    ];

    partials.forEach((part) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(fundamental * part.ratio, now);

      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(part.gain, now + 0.004);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + part.decay);

      osc.connect(gainNode);
      gainNode.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + part.decay + 0.5);
    });
  }
}

function _startOscillatingFilterSweep(lfo: OscillatorNode | null) {
  if (lfo) {
    try {
      lfo.start();
    } catch (e) {
      // already started
    }
  }
}

export const ambientSynth = new AmbientSynth();
