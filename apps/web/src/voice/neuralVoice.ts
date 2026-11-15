// Neural voice: Kokoro-82M (voice af_heart) via HeadTTS, running in the browser (WebGPU, else WASM).
// Loads in the background; until status is "ready" callers keep using speechSynthesis.
import { useSyncExternalStore } from "react";

export type NeuralStatus = "idle" | "loading" | "ready" | "failed";

/** Shape accepted by TalkingHead.speakAudio (HeadTTS audio message data). */
export interface NeuralUtterance {
  audio: AudioBuffer;
  words: string[]; wtimes: number[]; wdurations: number[];
  visemes: string[]; vtimes: number[]; vdurations: number[];
}

const HEADTTS_VERSION = "1.3.0"; // pinned; must match package.json
const CDN = `https://cdn.jsdelivr.net/npm/@met4citizen/headtts@${HEADTTS_VERSION}`;
const VOICE = "af_heart";
const MAX_FIRST_MS = 3000; // steady-state first synthesis slower than this => not usable on this device

/** Test override: ?voicemax=60000 relaxes the safety switch. */
function maxFirstMs() { const v = Number(new URLSearchParams(location.search).get("voicemax")); return v > 0 ? v : MAX_FIRST_MS; }

let status: NeuralStatus = "idle";
let backend: "webgpu" | "wasm" | "unknown" = "unknown";
let reason = "";
const timings: { warmupMs?: number; firstMs?: number; loadMs?: number } = {};
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
function setStatus(s: NeuralStatus) { status = s; snapshot = `${s}`; emit(); }
let snapshot = "idle";

export const getNeuralStatus = () => status;
export const neuralInfo = () => ({ status, backend, reason, ...timings });
export function subscribeNeural(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }
/** React hook for a small status label in the UI. */
export function useNeuralVoiceStatus(): { status: NeuralStatus; label: string } {
  const s = useSyncExternalStore(subscribeNeural, () => snapshot) as NeuralStatus;
  const label = s === "ready" ? "Natural voice ready" : s === "loading" ? "Loading natural voice…" : "";
  return { status: s, label };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TTS = any;
let tts: TTS = null;
let ctx: AudioContext | null = null;

function audioCtx(): AudioContext | null {
  if (!ctx) {
    try { ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)(); }
    catch { return null; }
  }
  return ctx;
}
/** Call from a user gesture. */
export function resumeNeuralAudio() { try { void audioCtx()?.resume(); } catch { /* ignore */ } }
export const getNeuralAudioCtx = () => audioCtx();

function disabled() {
  try {
    if (new URLSearchParams(location.search).get("voice") === "0") return true;
    const c = (navigator as unknown as { connection?: { saveData?: boolean } }).connection;
    return Boolean(c?.saveData);
  } catch { return false; }
}

function fail(why: string) {
  reason = why;
  console.warn("[neural voice] failed:", why);
  setStatus("failed");
  try { tts?.clear?.(); } catch { /* ignore */ }
  tts = null;
}

/** Start loading now (idempotent). Never throws; never blocks the caller. */
export function startNeuralVoice(): void {
  if (status !== "idle" || disabled()) return;
  setStatus("loading");
  void load();
}

let scheduled = false;
/** Start loading once the app is idle (or after the first interaction, whichever comes first). */
export function scheduleNeuralVoice(): void {
  if (scheduled || status !== "idle") return;
  scheduled = true;
  const go = () => { window.removeEventListener("pointerdown", go); startNeuralVoice(); };
  window.addEventListener("pointerdown", go, { once: true });
  const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback;
  if (ric) ric(go, { timeout: 6000 }); else window.setTimeout(go, 3000);
}

async function load() {
  const t0 = performance.now();
  try {
    const { HeadTTS } = await import("@met4citizen/headtts");
    let gpu = false;
    try { gpu = Boolean(await (navigator as unknown as { gpu?: { requestAdapter(): Promise<unknown> } }).gpu?.requestAdapter()); } catch { /* none */ }
    backend = gpu ? "webgpu" : "wasm";
    tts = new HeadTTS({
      endpoints: ["webgpu", "wasm"],
      audioCtx: audioCtx(),
      workerModule: `${CDN}/modules/worker-tts.mjs`,
      dictionaryURL: `${CDN}/dictionaries/`,
      dtypeWebgpu: "q8", // model_quantized.onnx ~92 MB (default fp32 is 325 MB)
      dtypeWasm: "q8",
      voices: [VOICE],
      languages: ["en-us"],
      defaultVoice: VOICE,
      splitSentences: false,
    });
    await tts.connect();
    await tts.setup({ voice: VOICE, language: "en-us", speed: 1, audioEncoding: "wav" });
    timings.loadMs = Math.round(performance.now() - t0);
    // Warm-up (shader compile etc.), then time a steady-state synthesis for the safety switch.
    let t = performance.now();
    await synthRaw("Hello there.");
    timings.warmupMs = Math.round(performance.now() - t);
    t = performance.now();
    await synthRaw("Welcome, let me show you around this place.");
    timings.firstMs = Math.round(performance.now() - t);
    console.info("[neural voice]", neuralInfo());
    if (timings.firstMs > maxFirstMs()) return fail(`too slow (${timings.firstMs} ms on ${backend})`);
    setStatus("ready");
  } catch (e) {
    fail(e instanceof Error ? e.message : String(e));
  }
}

async function synthRaw(text: string): Promise<NeuralUtterance> {
  const msgs = await tts.synthesize({ input: text });
  const parts = (msgs as { type: string; data: NeuralUtterance }[]).filter((m) => m.type === "audio").map((m) => m.data);
  if (!parts.length) throw new Error("no audio");
  if (parts.length === 1) return parts[0];
  // Several chunks (long sentence): concatenate audio and shift timings.
  const ac = audioCtx()!;
  const sr = parts[0].audio.sampleRate;
  const total = parts.reduce((n, p) => n + p.audio.length, 0);
  const buf = ac.createBuffer(1, total, sr);
  const out: NeuralUtterance = { audio: buf, words: [], wtimes: [], wdurations: [], visemes: [], vtimes: [], vdurations: [] };
  let off = 0;
  for (const p of parts) {
    buf.getChannelData(0).set(p.audio.getChannelData(0), off);
    const ms = (off / sr) * 1000;
    out.words.push(...p.words); out.visemes.push(...p.visemes);
    out.wtimes.push(...p.wtimes.map((x) => x + ms)); out.wdurations.push(...p.wdurations);
    out.vtimes.push(...p.vtimes.map((x) => x + ms)); out.vdurations.push(...p.vdurations);
    off += p.audio.length;
  }
  return out;
}

let chain: Promise<unknown> = Promise.resolve();
/** Synthesize one sentence (queued; one at a time). Rejects if the voice is unavailable. */
export function synthesize(sentence: string): Promise<NeuralUtterance> {
  if (status !== "ready" || !tts) return Promise.reject(new Error("neural voice not ready"));
  const p = chain.then(() => synthRaw(sentence));
  chain = p.catch(() => undefined);
  return p;
}
