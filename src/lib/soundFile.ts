/**
 * The sums that make the coach's own sound fit for the app (see
 * src/lib/appSounds.ts): trim its silence, check its length, level it, end it
 * cleanly, and write it as the app's WAV. No browser APIs here, so they can
 * be tested on their own; src/lib/prepareSound.ts runs them on an upload.
 */

/** Above this a sample counts as sound (about −46 dB). */
const SILENCE = 0.005;
/** Kept on each side of the sound, so its attack and its tail aren't cut. */
const MARGIN_S = 0.01;
/** Shorter than this is a click, not a sound. */
const MIN_SECONDS = 0.1;
/** Over the limit by less than this still passes: a rounding, not a rule. */
const GRACE_S = 0.05;

/** The part of `samples` from the first sound to the last, with a margin. */
export function trimSilence(samples: Float32Array, rate: number): Float32Array {
  let first = -1;
  for (let i = 0; i < samples.length; i++) {
    if (Math.abs(samples[i]) > SILENCE) {
      first = i;
      break;
    }
  }
  if (first < 0) return samples.subarray(0, 0);
  let last = first;
  for (let i = samples.length - 1; i > first; i--) {
    if (Math.abs(samples[i]) > SILENCE) {
      last = i;
      break;
    }
  }
  const margin = Math.round(MARGIN_S * rate);
  return samples.subarray(Math.max(0, first - margin), Math.min(samples.length, last + 1 + margin));
}

const seconds = (s: number) => s.toLocaleString('es', { maximumFractionDigits: 1 });

/** What is wrong with a sound of `length` seconds (silence trimmed) where
    `max` is the limit, in words for the coach; null when it fits. */
export function lengthProblem(length: number, max: number): string | null {
  if (length <= 0) return 'No se oye nada: el archivo está en silencio.';
  if (length < MIN_SECONDS) return 'Es demasiado corto: dura menos de una décima de segundo.';
  if (length > max + GRACE_S) {
    return `Dura ${seconds(length)} s y aquí el máximo es ${seconds(max)} s, sin contar el silencio del principio y del final.`;
  }
  return null;
}

/** Scales `samples` in place so their loudest point is `peak`. */
export function normalizePeak(samples: Float32Array, peak: number): void {
  let top = 0;
  for (const x of samples) top = Math.max(top, Math.abs(x));
  if (top === 0) return;
  const gain = peak / top;
  for (let i = 0; i < samples.length; i++) samples[i] *= gain;
}

/** Fades the last `seconds` to silence in place, so it never ends in a click. */
export function fadeOut(samples: Float32Array, rate: number, seconds: number): void {
  const n = Math.min(samples.length, Math.round(seconds * rate));
  for (let i = 0; i < n; i++) samples[samples.length - 1 - i] *= i / n;
}

/** A mono 16-bit PCM WAV of `samples` (−1…1) at `rate`: the app's format. */
export function encodeWav(samples: Float32Array, rate: number): Uint8Array<ArrayBuffer> {
  const dataBytes = samples.length * 2;
  const bytes = new Uint8Array(44 + dataBytes);
  const view = new DataView(bytes.buffer);
  const text = (at: number, s: string) => {
    for (let i = 0; i < s.length; i++) bytes[at + i] = s.charCodeAt(i);
  };
  text(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true); // bytes per second
  view.setUint16(32, 2, true); // bytes per sample
  view.setUint16(34, 16, true); // bits per sample
  text(36, 'data');
  view.setUint32(40, dataBytes, true);
  for (let i = 0; i < samples.length; i++) {
    const x = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, Math.round(x * 32767), true);
  }
  return bytes;
}
