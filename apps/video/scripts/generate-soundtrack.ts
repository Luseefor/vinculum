import * as fs from "fs";
import * as path from "path";

// Audio configuration
const SAMPLE_RATE = 44100;
const DURATION_SEC = 50.5;
const TOTAL_SAMPLES = Math.floor(SAMPLE_RATE * DURATION_SEC);

const leftBuffer = new Float32Array(TOTAL_SAMPLES);
const rightBuffer = new Float32Array(TOTAL_SAMPLES);

// Musical pitches in Hz
const NOTE_D1 = 36.71;
const NOTE_A1 = 55.0;
const NOTE_D2 = 73.42;
const NOTE_F2 = 87.31;
const NOTE_G2 = 98.0;
const NOTE_A2 = 110.0;
const NOTE_Bb2 = 116.54;
const NOTE_C3 = 130.81;
const NOTE_D3 = 146.83;
const NOTE_E3 = 164.81;
const NOTE_F3 = 174.61;
const NOTE_G3 = 196.0;
const NOTE_A3 = 220.0;
const NOTE_Bb3 = 233.08;
const NOTE_C4 = 261.63;
const NOTE_D4 = 293.66;
const NOTE_E4 = 329.63;
const NOTE_F4 = 349.23;
const NOTE_Fsharp4 = 369.99;
const NOTE_G4 = 392.0;
const NOTE_A4 = 440.0;
const NOTE_C5 = 523.25;
const NOTE_D5 = 587.33;
const NOTE_E5 = 659.25;

// Helper: Synthesize an evolving warm sine/triangle oscillator with stereo detune
function addPad(
  startTime: number,
  duration: number,
  freq: number,
  amplitude: number,
  pan: number = 0
) {
  const startSample = Math.floor(startTime * SAMPLE_RATE);
  const endSample = Math.min(
    TOTAL_SAMPLES,
    startSample + Math.floor(duration * SAMPLE_RATE)
  );
  const fadeLen = Math.floor(SAMPLE_RATE * 0.8); // 800ms fade in/out

  for (let i = startSample; i < endSample; i++) {
    const t = (i - startSample) / SAMPLE_RATE;
    const progress = (i - startSample) / (endSample - startSample);

    // Envelope: smooth Hann-like attack and decay
    let env = 1.0;
    if (i - startSample < fadeLen) {
      env = 0.5 * (1 - Math.cos((Math.PI * (i - startSample)) / fadeLen));
    } else if (endSample - i < fadeLen) {
      env = 0.5 * (1 - Math.cos((Math.PI * (endSample - i)) / fadeLen));
    }

    // Detuned warm tones with gentle harmonic overtone
    const osc1 = Math.sin(2 * Math.PI * freq * t);
    const osc2 = Math.sin(2 * Math.PI * (freq * 1.002) * t);
    const oscHarmonic = 0.25 * Math.sin(2 * Math.PI * (freq * 2) * t);
    const sampleVal = (osc1 * 0.45 + osc2 * 0.45 + oscHarmonic) * amplitude * env;

    const leftGain = Math.cos(((pan + 1) * Math.PI) / 4);
    const rightGain = Math.sin(((pan + 1) * Math.PI) / 4);

    leftBuffer[i] += sampleVal * leftGain;
    rightBuffer[i] += sampleVal * rightGain;
  }
}

// Helper: Pluck / arpeggio tone with ping-pong delay
function addPluck(
  startTime: number,
  freq: number,
  amplitude: number,
  pan: number = 0
) {
  const startSample = Math.floor(startTime * SAMPLE_RATE);
  const decaySamples = Math.floor(SAMPLE_RATE * 1.8);
  const endSample = Math.min(TOTAL_SAMPLES, startSample + decaySamples);

  for (let i = startSample; i < endSample; i++) {
    const t = (i - startSample) / SAMPLE_RATE;
    const env = Math.exp(-t * 4.5); // Fast exponential decay
    const val = (Math.sin(2 * Math.PI * freq * t) + 0.3 * Math.sin(2 * Math.PI * freq * 2 * t)) * amplitude * env;

    const leftGain = Math.cos(((pan + 1) * Math.PI) / 4);
    const rightGain = Math.sin(((pan + 1) * Math.PI) / 4);

    if (i < TOTAL_SAMPLES) {
      leftBuffer[i] += val * leftGain;
      rightBuffer[i] += val * rightGain;
    }

    // Ping-pong delay echo at +250ms
    const delaySample = i + Math.floor(SAMPLE_RATE * 0.25);
    if (delaySample < TOTAL_SAMPLES) {
      leftBuffer[delaySample] += val * rightGain * 0.35;
      rightBuffer[delaySample] += val * leftGain * 0.35;
    }

    // 2nd delay echo at +500ms
    const delay2 = i + Math.floor(SAMPLE_RATE * 0.5);
    if (delay2 < TOTAL_SAMPLES) {
      leftBuffer[delay2] += val * leftGain * 0.18;
      rightBuffer[delay2] += val * rightGain * 0.18;
    }
  }
}

// Helper: Cinematic Sub-Bass Impact Boom
function addBoom(startTime: number, amplitude: number = 0.5) {
  const startSample = Math.floor(startTime * SAMPLE_RATE);
  const duration = Math.floor(SAMPLE_RATE * 2.5);
  const endSample = Math.min(TOTAL_SAMPLES, startSample + duration);

  for (let i = startSample; i < endSample; i++) {
    const t = (i - startSample) / SAMPLE_RATE;
    // Pitch drops from 95Hz down to 35Hz
    const currentFreq = 35 + 60 * Math.exp(-t * 6);
    const env = Math.exp(-t * 2.2);
    const val = Math.sin(2 * Math.PI * currentFreq * t) * amplitude * env;

    leftBuffer[i] += val * 0.8;
    rightBuffer[i] += val * 0.8;
  }
}

// Helper: Shimmering Transition Swoosh / Riser
function addRiser(startTime: number, duration: number, amplitude: number = 0.25) {
  const startSample = Math.floor(startTime * SAMPLE_RATE);
  const len = Math.floor(duration * SAMPLE_RATE);
  const endSample = Math.min(TOTAL_SAMPLES, startSample + len);

  for (let i = startSample; i < endSample; i++) {
    const progress = (i - startSample) / len;
    const t = (i - startSample) / SAMPLE_RATE;
    // Ascending pitch sweep
    const freq = 300 + 1200 * Math.pow(progress, 2.5);
    const noise = (Math.random() * 2 - 1) * 0.15;
    const tone = Math.sin(2 * Math.PI * freq * t) * 0.35;
    const env = Math.pow(progress, 2) * amplitude;

    // Pan moves from left to right
    const pan = -1 + 2 * progress;
    const leftGain = Math.cos(((pan + 1) * Math.PI) / 4);
    const rightGain = Math.sin(((pan + 1) * Math.PI) / 4);

    leftBuffer[i] += (tone + noise) * env * leftGain;
    rightBuffer[i] += (tone + noise) * env * rightGain;
  }
}

// -------------------------------------------------------------
// COMPOSING THE FULL 50-SECOND TRACK
// -------------------------------------------------------------
console.log("Composing cinematic math soundtrack...");

// Continuous Sub Bass Foundation
addPad(0, 50, NOTE_D1, 0.35, 0);
addPad(0, 50, NOTE_A1, 0.25, 0);

// Scene 1: The Genesis (0.0s - 6.67s)
// Chord: Dm9 (D3, F3, A3, C4, E4)
addBoom(0.2, 0.45);
addPad(0.0, 7.5, NOTE_D2, 0.35, -0.2);
addPad(0.2, 7.3, NOTE_F3, 0.25, -0.3);
addPad(0.3, 7.2, NOTE_A3, 0.25, 0.3);
addPad(0.4, 7.1, NOTE_C4, 0.2, 0.1);
addPad(0.5, 7.0, NOTE_E4, 0.18, 0.4);

// Subtle twinkling arpeggios
const s1Arp = [NOTE_D4, NOTE_F4, NOTE_A4, NOTE_C5, NOTE_A4, NOTE_F4];
for (let i = 0; i < 14; i++) {
  addPluck(0.8 + i * 0.42, s1Arp[i % s1Arp.length], 0.18, (i % 2 === 0 ? -0.4 : 0.4));
}
addRiser(5.2, 1.5, 0.3);

// Scene 2: Brand Intro (6.67s - 14.0s)
// Chord: F Major 7 / Dm (F2, C3, F3, A3, E4)
addBoom(6.7, 0.55); // Grand impact when Vinculum logo & UI appear
addPad(6.6, 8.0, NOTE_F2, 0.35, -0.1);
addPad(6.8, 7.8, NOTE_C3, 0.28, 0.2);
addPad(7.0, 7.6, NOTE_F3, 0.25, -0.3);
addPad(7.2, 7.4, NOTE_A3, 0.25, 0.3);
addPad(7.4, 7.2, NOTE_E4, 0.22, 0.0);

const s2Arp = [NOTE_F4, NOTE_A4, NOTE_C5, NOTE_E5, NOTE_D5, NOTE_A4];
for (let i = 0; i < 16; i++) {
  addPluck(7.2 + i * 0.4, s2Arp[i % s2Arp.length], 0.22, (i % 2 === 0 ? 0.45 : -0.45));
}
addRiser(12.5, 1.5, 0.35);

// Scene 3: Unified Canvas (14.0s - 21.67s)
// Chord: G sus2 / D (G2, D3, A3, D4, G4)
addBoom(14.0, 0.4);
addPad(14.0, 8.2, NOTE_G2, 0.35, -0.2);
addPad(14.1, 8.1, NOTE_D3, 0.3, 0.2);
addPad(14.3, 7.9, NOTE_A3, 0.28, -0.3);
addPad(14.5, 7.7, NOTE_D4, 0.25, 0.3);
addPad(14.7, 7.5, NOTE_G4, 0.2, 0.0);

const s3Arp = [NOTE_D4, NOTE_G4, NOTE_A4, NOTE_D5, NOTE_E5, NOTE_A4];
for (let i = 0; i < 18; i++) {
  addPluck(14.4 + i * 0.38, s3Arp[i % s3Arp.length], 0.25, (i % 2 === 0 ? -0.5 : 0.5));
}
addRiser(20.0, 1.7, 0.35);

// Scene 4: Complex Surfaces & Manifolds (21.67s - 29.33s)
// Chord: Bb Major 7 add9 (Bb2, F3, Bb3, D4, A4)
addBoom(21.7, 0.45);
addPad(21.7, 8.2, NOTE_Bb2, 0.35, 0.1);
addPad(21.8, 8.1, NOTE_F3, 0.3, -0.2);
addPad(22.0, 7.9, NOTE_Bb3, 0.28, 0.3);
addPad(22.2, 7.7, NOTE_D4, 0.26, -0.3);
addPad(22.4, 7.5, NOTE_A4, 0.22, 0.2);

const s4Arp = [NOTE_Bb3, NOTE_D4, NOTE_F4, NOTE_A4, NOTE_D5, NOTE_F4];
for (let i = 0; i < 18; i++) {
  addPluck(22.0 + i * 0.38, s4Arp[i % s4Arp.length], 0.24, (i % 2 === 0 ? 0.4 : -0.4));
}
// Wireframe click accent at ~25.3s (frame 760)
addPluck(25.33, NOTE_E5, 0.35, 0.2);
addRiser(27.8, 1.6, 0.4);

// Scene 5: High Performance Engine (Rust/WASM) (29.33s - 36.67s)
// Driving, energetic pulse! Chord: C add9 -> D5 (C3, G3, D4, E4, G4)
addBoom(29.33, 0.55);
addPad(29.33, 7.8, NOTE_C3, 0.38, -0.2);
addPad(29.5, 7.6, NOTE_G3, 0.32, 0.2);
addPad(29.7, 7.4, NOTE_D4, 0.3, -0.3);
addPad(29.9, 7.2, NOTE_G4, 0.26, 0.3);

// Faster rhythmic electronic sequence for computational speed
const s5Arp = [NOTE_D4, NOTE_E4, NOTE_G4, NOTE_A4, NOTE_C5, NOTE_D5];
for (let i = 0; i < 26; i++) {
  addPluck(29.5 + i * 0.26, s5Arp[i % s5Arp.length], 0.28, (i % 2 === 0 ? -0.6 : 0.6));
}
addRiser(35.0, 1.7, 0.45);

// Scene 6: Seamless Sharing & Workflow (36.67s - 43.33s)
// Chord: A sus4 -> F Major 7 (A2, E3, A3, C4, G4)
addBoom(36.67, 0.45);
addPad(36.67, 7.2, NOTE_A2, 0.32, -0.1);
addPad(36.8, 7.0, NOTE_E3, 0.28, 0.2);
addPad(37.0, 6.8, NOTE_A3, 0.26, -0.2);
addPad(37.2, 6.6, NOTE_C4, 0.24, 0.3);
addPad(37.4, 6.4, NOTE_G4, 0.22, -0.3);

// Chime-like glass plucks
const s6Arp = [NOTE_C4, NOTE_E4, NOTE_G4, NOTE_C5, NOTE_E5];
for (let i = 0; i < 16; i++) {
  addPluck(37.0 + i * 0.38, s6Arp[i % s6Arp.length], 0.22, (i % 2 === 0 ? 0.35 : -0.35));
}
addRiser(41.6, 1.8, 0.5);

// Scene 7: Grand Outro & Final Resolution (43.33s - 50.0s)
// Grand D Major Chord with open luminous fifths & octave bloom
addBoom(43.33, 0.65); // Final grand impact
addPad(43.33, 7.0, NOTE_D2, 0.45, 0.0);
addPad(43.5, 6.8, NOTE_A2, 0.38, -0.2);
addPad(43.7, 6.6, NOTE_D3, 0.35, 0.2);
addPad(43.9, 6.4, NOTE_Fsharp4, 0.32, -0.3);
addPad(44.1, 6.2, NOTE_A4, 0.3, 0.3);
addPad(44.3, 6.0, NOTE_D5, 0.25, 0.0);

// Grand cascading arpeggios that shimmer and fade into infinity
const s7Arp = [NOTE_D4, NOTE_Fsharp4, NOTE_A4, NOTE_D5, NOTE_E5, NOTE_A4, NOTE_Fsharp4, NOTE_D4];
for (let i = 0; i < 14; i++) {
  addPluck(43.8 + i * 0.35, s7Arp[i % s7Arp.length], 0.24 * Math.exp(-i * 0.12), (i % 2 === 0 ? -0.4 : 0.4));
}

// Master Output Normalization & Limiter
let maxPeak = 0;
for (let i = 0; i < TOTAL_SAMPLES; i++) {
  maxPeak = Math.max(maxPeak, Math.abs(leftBuffer[i]), Math.abs(rightBuffer[i]));
}

console.log(`Peak audio signal before normalization: ${maxPeak.toFixed(3)}`);
const targetPeak = 0.92;
const gain = targetPeak / Math.max(maxPeak, 0.001);

// Final master fadeout on last 1.5 seconds
const fadeoutStart = Math.floor(48.5 * SAMPLE_RATE);

const int16Data = new Int16Array(TOTAL_SAMPLES * 2);
for (let i = 0; i < TOTAL_SAMPLES; i++) {
  let masterEnv = 1.0;
  if (i > fadeoutStart) {
    const fadePos = (i - fadeoutStart) / (TOTAL_SAMPLES - fadeoutStart);
    masterEnv = 0.5 * (1 + Math.cos(Math.PI * fadePos));
  }

  const leftVal = Math.max(-1, Math.min(1, leftBuffer[i] * gain * masterEnv));
  const rightVal = Math.max(-1, Math.min(1, rightBuffer[i] * gain * masterEnv));

  int16Data[i * 2] = Math.round(leftVal * 32767);
  int16Data[i * 2 + 1] = Math.round(rightVal * 32767);
}

// Create 44-byte WAV header
const numChannels = 2;
const bitsPerSample = 16;
const byteRate = SAMPLE_RATE * numChannels * (bitsPerSample / 8);
const blockAlign = numChannels * (bitsPerSample / 8);
const dataSize = int16Data.byteLength;
const header = Buffer.alloc(44);

header.write("RIFF", 0);
header.writeUInt32LE(36 + dataSize, 4);
header.write("WAVE", 8);
header.write("fmt ", 12);
header.writeUInt32LE(16, 16); // Subchunk1Size
header.writeUInt16LE(1, 20); // AudioFormat PCM
header.writeUInt16LE(numChannels, 22);
header.writeUInt32LE(SAMPLE_RATE, 24);
header.writeUInt32LE(byteRate, 28);
header.writeUInt16LE(blockAlign, 32);
header.writeUInt16LE(bitsPerSample, 34);
header.write("data", 36);
header.writeUInt32LE(dataSize, 40);

const finalWavBuffer = Buffer.concat([header, Buffer.from(int16Data.buffer)]);
const outWavPath = path.resolve(__dirname, "../public/audio/soundtrack.wav");

fs.writeFileSync(outWavPath, finalWavBuffer);
console.log(`Saved soundtrack WAV (${(finalWavBuffer.byteLength / (1024 * 1024)).toFixed(2)} MB) to: ${outWavPath}`);
