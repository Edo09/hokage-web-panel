import { encodeWav, fadeOut, lengthProblem, normalizePeak, trimSilence } from '@/lib/soundFile';

/**
 * Turns the coach's upload into the app's sound, in the browser: decoded
 * (any format the browser reads: MP3, WAV, M4A, OGG…), mixed to one channel
 * at the app's rate, trimmed of its silence, checked against the moment's
 * length limit, levelled with the built-in sounds and written as WAV. A rule
 * it breaks comes back as a SoundRuleError, in words for the coach.
 */

/** The app's format: mono 16-bit at this rate. */
const APP_RATE = 44100;
/** About as loud as the built-in sounds' loudest. */
const PEAK = 0.85;
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
/** A file this long can't be a sound for a moment, whatever its silence. */
const MAX_DECODE_S = 60;

export class SoundRuleError extends Error {}

export interface PreparedSound {
  wav: Blob;
  /** Its length, silence trimmed. */
  seconds: number;
  /** To listen to it before it is saved. */
  url: string;
  /** The file the coach chose. */
  name: string;
}

export async function prepareSound(file: File, maxSeconds: number): Promise<PreparedSound> {
  if (file.size > MAX_UPLOAD_BYTES) throw new SoundRuleError('El archivo pesa más de 5 MB.');

  const ctx = new AudioContext();
  let decoded: AudioBuffer;
  try {
    decoded = await ctx.decodeAudioData(await file.arrayBuffer());
  } catch {
    throw new SoundRuleError('No se pudo leer ese archivo como audio. Sube un MP3, WAV, M4A u OGG.');
  } finally {
    void ctx.close();
  }
  if (decoded.duration > MAX_DECODE_S) {
    throw new SoundRuleError(lengthProblem(decoded.duration, maxSeconds) ?? 'Es demasiado largo.');
  }

  // One channel at the app's rate: the browser mixes and resamples.
  const offline = new OfflineAudioContext(1, Math.max(1, Math.ceil(decoded.duration * APP_RATE)), APP_RATE);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();
  const rendered = await offline.startRendering();

  const samples = Float32Array.from(trimSilence(rendered.getChannelData(0), APP_RATE));
  const seconds = samples.length / APP_RATE;
  const problem = lengthProblem(seconds, maxSeconds);
  if (problem) throw new SoundRuleError(problem);

  normalizePeak(samples, PEAK);
  fadeOut(samples, APP_RATE, 0.012);
  const wav = new Blob([encodeWav(samples, APP_RATE)], { type: 'audio/wav' });
  return { wav, seconds, url: URL.createObjectURL(wav), name: file.name };
}
