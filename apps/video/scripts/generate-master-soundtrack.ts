import * as fs from "fs";
import * as path from "path";

// Audio configuration: 44.1 kHz, 16-bit stereo PCM
const SAMPLE_RATE = 44100;
const DURATION_SEC = 34.0;
const TOTAL_SAMPLES = Math.floor(SAMPLE_RATE * DURATION_SEC);

const leftBuffer = new Float32Array(TOTAL_SAMPLES);
const rightBuffer = new Float32Array(TOTAL_SAMPLES);

// Musical pitches in Hz (Pythagorean / Equal Temperament)
const NOTE_D1 = 36.71;
const NOTE_SUB_40 = 40.0;
const NOTE_A1 = 55.0;
const NOTE_D2 = 73.42;
const NOTE_A2 = 110.0;
const NOTE_D3 = 146.83;
const NOTE_Fsharp3 = 185.0;
const NOTE_G3 = 196.0;
const NOTE_A3 = 220.0;
const NOTE_D4 = 293.66;
const NOTE_E4 = 329.63;
const NOTE_Fsharp4 = 369.99;
const NOTE_G4 = 392.0;
const NOTE_A4 = 440.0;
const NOTE_D5 = 587.33;

/**
 * Stem 1: Tactile Mechanical Foley
 * Generates crisp mechanical scissor/Cherry switch clicks and haptic ticks.
 */
function addTactileClick(timeSec: number, amplitude: number = 0.35, pan: number = 0.0) {
  const startSample = Math.floor(timeSec * SAMPLE_RATE);
  // Impulse duration: ~15ms with high-frequency resonant click (2.8 kHz - 4.5 kHz)
  const durationSamples = Math.floor(SAMPLE_RATE * 0.018);
  const endSample = Math.min(TOTAL_SAMPLES, startSample + durationSamples);

  for (let i = startSample; i < endSample; i++) {
    const t = (i - startSample) / SAMPLE_RATE;
    const progress = t / 0.018;
    // Exponential decay transient
    const env = Math.exp(-progress * 18.0);
    // Combined dual-resonant body (click at 3.2 kHz + body thud at 220 Hz)
    const wave =
      0.65 * Math.sin(2 * Math.PI * 3200 * t) +
      0.25 * Math.sin(2 * Math.PI * 4500 * t) +
      0.35 * Math.sin(2 * Math.PI * 220 * t);
    const sample = wave * env * amplitude;

    leftBuffer[i] += sample * (0.5 - pan * 0.5);
    rightBuffer[i] += sample * (0.5 + pan * 0.5);
  }
}

/**
 * Rotary detent micro-tick (for slider scrubs)
 * 2ms discrete impulse spike at 3.5 kHz
 */
function addDetentTick(timeSec: number, amplitude: number = 0.18, pan: number = 0.1) {
  const startSample = Math.floor(timeSec * SAMPLE_RATE);
  const durationSamples = Math.floor(SAMPLE_RATE * 0.004);
  const endSample = Math.min(TOTAL_SAMPLES, startSample + durationSamples);

  for (let i = startSample; i < endSample; i++) {
    const t = (i - startSample) / SAMPLE_RATE;
    const progress = t / 0.004;
    const env = Math.exp(-progress * 25.0);
    const sample = Math.sin(2 * Math.PI * 3500 * t) * env * amplitude;

    leftBuffer[i] += sample * (0.5 - pan * 0.5);
    rightBuffer[i] += sample * (0.5 + pan * 0.5);
  }
}

/**
 * Stem 2: Sub-Bass Structural Mass (Apple Pro style)
 * Clean 40Hz sinusoidal pressure pulse with gentle 2nd/3rd harmonics (no pitch drop).
 */
function addSubBassMass(
  timeSec: number,
  durationSec: number,
  amplitude: number = 0.45,
  freq: number = NOTE_SUB_40
) {
  const startSample = Math.floor(timeSec * SAMPLE_RATE);
  const durationSamples = Math.floor(durationSec * SAMPLE_RATE);
  const endSample = Math.min(TOTAL_SAMPLES, startSample + durationSamples);

  for (let i = startSample; i < endSample; i++) {
    const t = (i - startSample) / SAMPLE_RATE;
    const progress = t / durationSec;
    // Bell curve / smooth window
    const env = Math.sin(Math.PI * progress);
    const wave =
      0.80 * Math.sin(2 * Math.PI * freq * t) +
      0.20 * Math.sin(2 * Math.PI * freq * 3 * t); // 3rd harmonic for definition
    const sample = wave * env * amplitude;

    leftBuffer[i] += sample * 0.5;
    rightBuffer[i] += sample * 0.5;
  }
}

/**
 * Stem 3: Pythagorean Acoustic Tine / Rhodes Harmonic Strike
 * Pure crystalline bell harmonic that decays smoothly into negative space.
 */
function addHarmonicTine(
  timeSec: number,
  freq: number,
  amplitude: number = 0.30,
  durationSec: number = 2.5,
  pan: number = 0.0
) {
  const startSample = Math.floor(timeSec * SAMPLE_RATE);
  const durationSamples = Math.floor(durationSec * SAMPLE_RATE);
  const endSample = Math.min(TOTAL_SAMPLES, startSample + durationSamples);

  for (let i = startSample; i < endSample; i++) {
    const t = (i - startSample) / SAMPLE_RATE;
    const progress = t / durationSec;
    const env = Math.exp(-progress * 3.8); // Natural exponential chime decay
    const wave =
      0.70 * Math.sin(2 * Math.PI * freq * t) +
      0.25 * Math.sin(2 * Math.PI * freq * 2 * t) +
      0.10 * Math.sin(2 * Math.PI * freq * 3 * t);
    const sample = wave * env * amplitude;

    leftBuffer[i] += sample * (0.5 - pan * 0.5);
    rightBuffer[i] += sample * (0.5 + pan * 0.5);
  }
}

/**
 * Build the 34.00s 4-Stem Discrete Acoustic Architecture
 */
function composeSoundtrack() {
  console.log("Composing 34.00s 4-Stem Acoustic Score...");

  // --- ACT I: THE AXIOM (0.00s - 4.00s) ---
  // 0.00s - 0.60s: Stem 4 (Negative Silence)
  // 0.60s: Faint 40Hz atmospheric bed pulse establishing spatial scale
  addSubBassMass(0.60, 2.80, 0.22, 40.0);
  addHarmonicTine(1.00, NOTE_D3, 0.15, 2.2, -0.1);

  // 2.40s: Coordinate axes pre-ignition trackpad click
  addTactileClick(2.40, 0.28, 0.0);
  addSubBassMass(2.45, 1.20, 0.25, 42.0);

  // --- ACT II: DIRECT INSCRIPTION & GYROID EMERGENCE (4.00s - 11.50s) ---
  // 4.00s: Enter formula input row
  // 4.20s, 4.65s, 5.10s: Three crisp mechanical keystrokes ('=', '0', Enter)
  addTactileClick(4.20, 0.38, -0.15);
  addTactileClick(4.65, 0.38, 0.05);
  addTactileClick(5.10, 0.42, 0.0); // Enter key commit

  // 5.25s: Syntax confirmation chime (emerald verification)
  addHarmonicTine(5.25, NOTE_A4, 0.22, 1.2, 0.15);

  // 6.50s: Gyroid minimal surface emergence (Marching Tetrahedra)
  addSubBassMass(6.50, 2.50, 0.48, 40.0);
  addHarmonicTine(6.50, NOTE_D3, 0.32, 2.4, -0.1);
  addHarmonicTine(6.52, NOTE_A3, 0.25, 2.2, 0.1);

  // 9.10s - 11.20s: Parameter slider a scrub (0.00 -> 0.80) with ratcheted detent ticks
  addTactileClick(9.10, 0.30, 0.2); // Grab slider
  for (let t = 9.15; t <= 11.0; t += 0.075) {
    addDetentTick(t, 0.14, 0.2);
  }
  addTactileClick(11.05, 0.32, 0.2); // Release slider
  addHarmonicTine(11.05, NOTE_Fsharp4, 0.24, 1.4, 0.2);

  // --- ACT III: THE ANALYTICAL PROBE & VECTOR FLOW (11.50s - 19.50s) ---
  // 11.50s: Cut to hyperbolic saddle surface
  addSubBassMass(11.50, 2.0, 0.35, 40.0);

  // 12.80s: Armed Pick probe snaps flush to curvature
  addTactileClick(12.80, 0.45, -0.05); // High-precision snap click
  addHarmonicTine(12.82, NOTE_Fsharp4, 0.28, 1.8, 0.0);
  addHarmonicTine(12.85, NOTE_D4, 0.22, 1.8, -0.1);

  // 14.80s: Transition to volumetric 3D vector field
  addSubBassMass(14.80, 1.80, 0.36, 40.0);
  addTactileClick(15.20, 0.35, 0.1); // "Enable Streamlines" toggle click
  addHarmonicTine(15.22, NOTE_G3, 0.26, 1.6, 0.1);

  // 17.00s: RK4 streamline curves burst outward
  addSubBassMass(17.00, 2.30, 0.42, 40.0);
  addHarmonicTine(17.00, NOTE_D4, 0.28, 2.2, -0.1);
  addHarmonicTine(17.05, NOTE_A4, 0.24, 2.0, 0.1);

  // --- ACT IV: SPATIAL SYNTHESIS & ORTHOGRAPHIC STUDIO (19.50s - 26.50s) ---
  // 19.50s: 3D linear transform matrix deformation
  addSubBassMass(19.50, 2.0, 0.38, 40.0);
  addTactileClick(20.00, 0.36, 0.0); // Matrix commit
  addHarmonicTine(20.02, NOTE_A3, 0.30, 2.0, 0.0); // Amber eigendirection chime
  addHarmonicTine(20.05, NOTE_E4, 0.20, 1.8, 0.15);

  // 22.00s: User clicks "Layout -> Quad" (Scissor-tested viewports)
  addTactileClick(22.00, 0.42, -0.1); // Camera shutter click
  addTactileClick(22.03, 0.30, 0.1);  // Mechanical dual shutter
  addSubBassMass(22.05, 1.80, 0.35, 42.0);

  // 24.50s: Direct manipulation handle drag in Top (XY) pane
  addTactileClick(24.50, 0.30, 0.0);
  for (let t = 24.55; t <= 25.80; t += 0.09) {
    addDetentTick(t, 0.12, -0.15);
  }
  addTactileClick(25.85, 0.35, -0.15); // Release handle
  addHarmonicTine(25.88, NOTE_D4, 0.24, 1.5, -0.1);

  // --- ACT V: MONOGRAPH CLOSE & PLANNED SILENCE (26.50s - 34.00s) ---
  // 26.50s: Camera pulls back to full 4K workspace shell
  addSubBassMass(26.50, 2.80, 0.40, 40.0);
  addHarmonicTine(26.50, NOTE_D2, 0.35, 3.2, 0.0); // Resolving fundamental

  // 29.50s: Monolith wordmark VINCULUM illuminates
  addTactileClick(29.50, 0.32, 0.0); // Single decisive mechanical key release
  addHarmonicTine(29.52, NOTE_D3, 0.25, 1.0, 0.0);

  // 30.50s - 34.00s: EXACTLY 3.50 SECONDS OF TOTAL NEGATIVE SILENCE INTO COMPLETE BLACK
  // (Left and right buffers remain at exactly 0.00)
}

function writeWavFile(outputPath: string) {
  const numChannels = 2;
  const bytesPerSample = 2; // 16-bit
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = SAMPLE_RATE * blockAlign;
  const dataSize = TOTAL_SAMPLES * blockAlign;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF Chunk
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);

  // fmt Chunk
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16); // subchunk1size (16 for PCM)
  buffer.writeUInt16LE(1, 20);  // audioFormat 1 = PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34); // bitsPerSample

  // data Chunk
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Soft peak limiter to guarantee zero clipping (target peak -1.0 dBTP = ~0.89)
  let maxPeak = 0;
  for (let i = 0; i < TOTAL_SAMPLES; i++) {
    maxPeak = Math.max(maxPeak, Math.abs(leftBuffer[i]), Math.abs(rightBuffer[i]));
  }
  const scale = maxPeak > 0.89 ? 0.89 / maxPeak : 1.0;
  console.log(`Peak scaling: ${scale.toFixed(4)} (raw peak: ${maxPeak.toFixed(4)})`);

  let offset = 44;
  for (let i = 0; i < TOTAL_SAMPLES; i++) {
    const leftSample = Math.max(-1, Math.min(1, leftBuffer[i] * scale));
    const rightSample = Math.max(-1, Math.min(1, rightBuffer[i] * scale));

    const leftInt16 = leftSample < 0 ? leftSample * 0x8000 : leftSample * 0x7fff;
    const rightInt16 = rightSample < 0 ? rightSample * 0x8000 : rightSample * 0x7fff;

    buffer.writeInt16LE(Math.floor(leftInt16), offset);
    buffer.writeInt16LE(Math.floor(rightInt16), offset + 2);
    offset += 4;
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, buffer);
  console.log(`Successfully generated master soundtrack: ${outputPath} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);
}

composeSoundtrack();
const outPath = path.resolve(__dirname, "../public/audio/master-soundtrack.wav");
writeWavFile(outPath);
