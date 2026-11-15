// Voice in (SpeechRecognition) and out (speechSynthesis, or the neural voice once loaded). Both are optional.
import { getNeuralAudioCtx, getNeuralStatus, resumeNeuralAudio, scheduleNeuralVoice, synthesize, type NeuralUtterance } from "../voice/neuralVoice";

type SRCtor = new () => {
  lang: string; interimResults: boolean; continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void; abort(): void;
};

function srCtor(): SRCtor | undefined {
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export const canListen = () => Boolean(srCtor());
export const canSpeak = () => "speechSynthesis" in window;

export interface Listener { stop(): void }

/** Start listening; onFinal gets the transcript once recognition ends. */
export function listen(onFinal: (text: string) => void, onError: (msg: string) => void): Listener | null {
  const Ctor = srCtor();
  if (!Ctor) { onError("Voice input is not supported in this browser."); return null; }
  const r = new Ctor();
  r.lang = navigator.language || "en-US";
  r.interimResults = false;
  r.continuous = false;
  let text = "";
  r.onresult = (e) => {
    text = Array.from(e.results).map((res) => res[0].transcript).join(" ").trim();
  };
  r.onerror = (e) => { if (e.error !== "aborted" && e.error !== "no-speech") onError(`Microphone error: ${e.error}`); };
  r.onend = () => { if (text) onFinal(text); };
  r.start();
  return { stop: () => r.stop() };
}

// Speaking state: count of queued/active utterances, exposed to React via useSpeaking().
let legacyPending = 0; // speechSynthesis utterances
let neuralPending = 0; // neural (HeadTTS) sentences queued or playing
const pendingTotal = () => legacyPending + neuralPending;
const speakingListeners = new Set<() => void>();
const emitSpeaking = () => speakingListeners.forEach((l) => l());
export function subscribeSpeaking(l: () => void) { speakingListeners.add(l); return () => { speakingListeners.delete(l); }; }
export function isSpeaking() { return pendingTotal() > 0; }

// The sentence being spoken right now (set on utterance start, cleared when the queue drains).
let current = "";
export function getSpokenSentence() { return pendingTotal() > 0 ? current : ""; }

// ---- Neural voice path (Kokoro af_heart via HeadTTS), used only once it reports "ready" ----
/** The avatar registers itself so it plays the audio and lip-syncs from the exact viseme timings. */
export interface NeuralSink { play(u: NeuralUtterance): Promise<void>; stop(): void }
let sink: NeuralSink | null = null;
export function setNeuralSink(s: NeuralSink | null) { sink = s; }
let neuralPlaying = false;
/** True while a neural sentence is playing: the avatar must not run its text-driven fallback lip-sync. */
export function isNeuralPlaying() { return neuralPlaying; }

interface NItem { sentence: string; p: Promise<NeuralUtterance | null> }
const nqueue: NItem[] = [];
let gen = 0;
let runningGen = -1;
let plainSrc: AudioBufferSourceNode | null = null;

const SYNTH_TIMEOUT_MS = 6000;
function synthOrNull(sentence: string): Promise<NeuralUtterance | null> {
  return new Promise((resolve) => {
    const t = window.setTimeout(() => resolve(null), SYNTH_TIMEOUT_MS);
    synthesize(sentence).then((u) => { clearTimeout(t); resolve(u); }, () => { clearTimeout(t); resolve(null); });
  });
}

function playPlain(u: NeuralUtterance): Promise<void> {
  const ctx = getNeuralAudioCtx();
  if (!ctx) return Promise.resolve();
  return new Promise((resolve) => {
    const src = ctx.createBufferSource();
    src.buffer = u.audio;
    src.connect(ctx.destination);
    src.onended = () => { if (plainSrc === src) plainSrc = null; resolve(); };
    plainSrc = src;
    src.start();
  });
}

async function runNeural() {
  if (runningGen === gen) return;
  const g = (runningGen = gen);
  while (g === gen && nqueue.length) {
    const it = nqueue[0];
    const u = await it.p; // pre-synthesised while the previous sentence played
    if (g !== gen) return;
    nqueue.shift();
    current = it.sentence.trim();
    if (u) {
      neuralPlaying = true;
      emitSpeaking();
      try { await (sink ? sink.play(u) : playPlain(u)); } catch (e) { console.warn(e); }
      if (g !== gen) return;
      neuralPlaying = false;
    } else {
      neuralPending -= 1; // hand this sentence to the browser voice (counted there)
      await legacySpeak(it.sentence, null);
      if (g !== gen) return;
      neuralPending += 1;
    }
    neuralPending = Math.max(0, neuralPending - 1);
    if (pendingTotal() === 0) current = "";
    emitSpeaking();
  }
  if (runningGen === g) runningGen = -1;
}

function pickVoice(hint: string | null): SpeechSynthesisVoice | undefined {
  if (!hint) return undefined;
  const h = hint.toLowerCase();
  return speechSynthesis.getVoices().find((v) => v.name.toLowerCase() === h || v.name.toLowerCase().includes(h));
}

/** Browser voice for one sentence; resolves when it has finished. */
function legacySpeak(sentence: string, voiceHint: string | null): Promise<void> {
  if (!canSpeak() || !sentence.trim()) return Promise.resolve();
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(sentence);
    const v = pickVoice(voiceHint);
    if (v) u.voice = v;
    let done = false;
    const finish = () => {
      if (done) return; done = true;
      legacyPending = Math.max(0, legacyPending - 1);
      if (pendingTotal() === 0) current = "";
      emitSpeaking();
      resolve();
    };
    u.onstart = () => { current = sentence.trim(); emitSpeaking(); };
    u.onend = finish;
    u.onerror = finish;
    legacyPending += 1;
    emitSpeaking();
    speechSynthesis.speak(u);
  });
}

export function speak(sentence: string, voiceHint: string | null) {
  if (!sentence.trim()) return;
  // Neural only when ready and no browser-voice sentence is still queued (keeps order, no overlap).
  if (getNeuralStatus() === "ready" && legacyPending === 0) {
    nqueue.push({ sentence, p: synthOrNull(sentence) });
    neuralPending += 1;
    emitSpeaking();
    void runNeural();
    return;
  }
  void legacySpeak(sentence, voiceHint);
}

/** Call from a user gesture: lets later speechSynthesis calls (e.g. the arrival greeting) and the neural AudioContext play. */
export function unlockSpeech() {
  resumeNeuralAudio();
  scheduleNeuralVoice();
  if (!canSpeak()) return;
  const u = new SpeechSynthesisUtterance(" ");
  u.volume = 0;
  speechSynthesis.speak(u);
}

export function stopSpeaking() {
  gen += 1;
  nqueue.length = 0;
  neuralPending = 0;
  neuralPlaying = false;
  try { sink?.stop(); } catch { /* ignore */ }
  try { plainSrc?.stop(); } catch { /* ignore */ }
  plainSrc = null;
  if (canSpeak()) speechSynthesis.cancel();
  current = "";
  if (legacyPending !== 0) legacyPending = 0;
  emitSpeaking();
}

scheduleNeuralVoice(); // start loading the natural voice in the background once idle

/** Feed streamed text; calls speak() for each completed sentence. flush() speaks the remainder. */
export function sentenceSpeaker(voiceHint: string | null) {
  let buf = "";
  return {
    push(chunk: string) {
      buf += chunk;
      let m: RegExpExecArray | null;
      // only treat as complete when followed by whitespace, so "3.5" is not split mid-stream
      while ((m = /^([\s\S]*?[.!?]+)\s+/.exec(buf))) {
        speak(m[1], voiceHint);
        buf = buf.slice(m[0].length);
      }
    },
    flush() { speak(buf, voiceHint); buf = ""; },
  };
}
