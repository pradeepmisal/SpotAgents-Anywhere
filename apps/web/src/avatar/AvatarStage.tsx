import { useEffect, useRef } from "react";
import type { NearbyAgent } from "../types";
import { isNeuralPlaying, setNeuralSink } from "../chat/voice";
import { resumeNeuralAudio, type NeuralUtterance } from "../voice/neuralVoice";

export interface AvatarStageProps {
  agent: NearbyAgent;
  speaking: boolean;
  mood?: "neutral" | "happy" | "thinking";
  /** Increment to trigger a wave. */
  greet?: number;
  /** Sentence currently being spoken; drives lip-sync timing. Optional. */
  text?: string;
}

const AVATAR_URL = `${import.meta.env.BASE_URL}avatars/brunette.glb`;
const WORDS_PER_SECOND = 2.5; // speechSynthesis at rate 1 speaks roughly 2.4-2.8 words/s
const MOUTH_MAX = 0.55; // cap on mouth/viseme morph targets: ~55% of the model's default range
const MOUTH_TARGETS = /^(viseme_|jaw|mouth)/;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Head = any;

/**
 * Realistic guide avatar (TalkingHead, MIT; model brunette.glb from the TalkingHead repo, made at
 * Ready Player Me, CC BY-NC 4.0) on a transparent canvas that
 * fills its parent. The browser's speechSynthesis gives no audio buffer, so the mouth is driven
 * from the text: a silent AudioBuffer plus per-word timings feed TalkingHead's own English
 * word-to-viseme lip-sync. Idle breathing, blinking, gaze and talking-hand gestures are built in.
 */
export default function AvatarStage(props: AvatarStageProps) {
  const { speaking, mood = "neutral", greet = 0, text } = props;
  const box = useRef<HTMLDivElement>(null);
  const head = useRef<Head>(null);
  const ready = useRef(false);
  const latest = useRef({ speaking, mood, greet, text });
  latest.current = { speaking, mood, greet, text };
  const handledGreet = useRef(0);
  const thinkTimer = useRef<number | undefined>(undefined);

  // Create / dispose the 3D head.
  useEffect(() => {
    let dead = false;
    const node = box.current!;
    const unlock = () => { head.current?.audioCtx?.resume?.(); resumeNeuralAudio(); };
    window.addEventListener("pointerdown", unlock);

    (async () => {
      const [{ TalkingHead }, { LipsyncEn }] = await Promise.all([
        import("@met4citizen/talkinghead"),
        import("@met4citizen/talkinghead/modules/lipsync-en.mjs"),
      ]);
      if (dead) return;
      const dpr = window.devicePixelRatio || 1;
      const h: Head = new TalkingHead(node, {
        lipsyncModules: [], // we register the English module ourselves (bundler-safe)
        lipsyncLang: "en",
        cameraView: "upper",
        cameraRotateEnable: false,
        cameraZoomEnable: false,
        cameraPanEnable: false,
        modelPixelRatio: Math.min(2, dpr) / dpr, // cap effective pixel ratio at 2
        modelFPS: 30,
        avatarMood: "neutral",
        avatarIdleEyeContact: 0.4,
        avatarIdleHeadMove: 0.6,
        avatarSpeakingEyeContact: 0.7,
        avatarSpeakingHeadMove: 0.6,
        lightAmbientIntensity: 2,
      });
      h.lipsync = { en: new LipsyncEn() };
      head.current = h;
      try {
        await h.showAvatar({ url: AVATAR_URL, body: "F", lipsyncLang: "en", avatarMood: "neutral" });
      } catch (e) {
        console.error("Avatar failed to load", e);
        return;
      }
      if (dead) return;
      try {
        // narrower mouth: clamp every viseme / jaw / mouth morph target
        Object.entries(h.mtAvatar as Record<string, { max: number }>).forEach(([k, m]) => {
          if (MOUTH_TARGETS.test(k)) m.max = MOUTH_MAX;
        });
        h.setView("upper", { cameraDistance: -1.5, cameraY: 0 });
        h.setPoseFromTemplate(h.poseTemplates.side, 0); // relaxed stance, weight on one leg
      } catch (e) { console.warn(e); }
      ready.current = true;
      // Neural voice: this avatar plays the audio itself, so lips follow the exact viseme timings.
      setNeuralSink({
        play: (u) => playNeural(u),
        stop: () => { try { head.current?.stopSpeaking(); } catch { /* gone */ } finishNeural.current?.(); },
      });
      applyMood();
      applyGreet();
      applySpeaking();
    })();

    return () => {
      dead = true;
      ready.current = false;
      setNeuralSink(null);
      finishNeural.current?.();
      window.removeEventListener("pointerdown", unlock);
      window.clearInterval(thinkTimer.current);
      try { head.current?.dispose(); } catch { /* already gone */ }
      head.current = null;
      node.replaceChildren();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyMood() {
    const h = head.current;
    window.clearInterval(thinkTimer.current);
    if (!ready.current || !h) return;
    const m = latest.current.mood;
    try {
      h.setMood(m === "happy" ? "happy" : "neutral");
      if (m === "thinking") {
        const think = () => { if (!latest.current.speaking) h.playGesture("🤔", 3); };
        think();
        thinkTimer.current = window.setInterval(think, 4500);
      } else if (m === "happy") {
        h.playGesture("😊", 3);
      }
    } catch (e) { console.warn(e); }
  }

  function applyGreet() {
    const h = head.current;
    if (!ready.current || !h) return;
    const g = latest.current.greet;
    if (g && g !== handledGreet.current) {
      handledGreet.current = g;
      try { h.playGesture("👋", 2.5); h.lookAtCamera(1500); } catch (e) { console.warn(e); }
    }
  }

  /** Small nod, used at the start of each answer. */
  function nod() {
    const h = head.current;
    if (!h) return;
    try {
      h.setValue("headRotateX", 0.14, 220);
      window.setTimeout(() => { try { head.current?.setValue("headRotateX", null, 450); } catch { /* gone */ } }, 380);
    } catch (e) { console.warn(e); }
  }

  const wasSpeaking = useRef(false);
  const finishNeural = useRef<(() => void) | null>(null);

  /** Play one HeadTTS utterance (audio + Oculus visemes) with TalkingHead; resolves when it has been spoken. */
  function playNeural(u: NeuralUtterance): Promise<void> {
    const h = head.current;
    if (!ready.current || !h) return Promise.resolve();
    finishNeural.current?.();
    return new Promise<void>((resolve) => {
      let done = false;
      const fin = () => { if (done) return; done = true; window.clearTimeout(guard); finishNeural.current = null; resolve(); };
      finishNeural.current = fin;
      const guard = window.setTimeout(fin, u.audio.duration * 1000 + 2500); // never hang the queue
      try {
        h.stopSpeaking();
        if (!wasSpeaking.current) { wasSpeaking.current = true; nod(); }
        h.speakAudio(u, { lipsyncLang: "en" });
        h.speakWithHands(0, 0.7);
        h.speakMarker(fin);
      } catch (e) { console.warn(e); fin(); }
    });
  }

  /** Lip-sync one sentence once; the mouth then closes by itself until the next sentence. */
  function applySpeaking() {
    const h = head.current;
    if (!ready.current || !h) return;
    const raw = (latest.current.text || "").trim();
    if (latest.current.speaking && isNeuralPlaying()) return; // neural audio drives the mouth; don't interrupt it
    try {
      h.stopSpeaking(); // closes the mouth between sentences and when speaking=false
      if (!latest.current.speaking || !raw) {
        wasSpeaking.current = false;
        h.lookAtCamera(800);
        return;
      }
      if (!wasSpeaking.current) { wasSpeaking.current = true; nod(); }
      const words = raw.split(/\s+/);
      const totalChars = words.reduce((n, w) => n + w.length + 1, 0);
      const totalMs = (words.length / WORDS_PER_SECOND) * 1000; // word timing ~ speechSynthesis pace
      let t = 0;
      const wtimes: number[] = [];
      const wdurations: number[] = [];
      for (const w of words) {
        const d = ((w.length + 1) / totalChars) * totalMs;
        wtimes.push(t);
        wdurations.push(d * 0.85);
        t += d;
      }
      const ctx: AudioContext = h.audioCtx;
      const sr = ctx.sampleRate;
      const audio = ctx.createBuffer(1, Math.max(1, Math.round((sr * t) / 1000)), sr); // silence
      h.speakAudio({ words, wtimes, wdurations, audio }, { lipsyncLang: "en" });
      h.speakWithHands(0, 0.7);
    } catch (e) { console.warn(e); }
  }

  useEffect(applyMood, [mood]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(applyGreet, [greet]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(applySpeaking, [speaking, text]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={box}
      aria-label={`${props.agent.name} avatar`}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", background: "transparent", touchAction: "none" }}
    />
  );
}
