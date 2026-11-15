import { ArrowUpRight, CheckCircle2, Landmark, LoaderCircle, Lock, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Bot } from "./Bot";
import { Phone } from "./Frames";
import { Activity, Bubble, PrivateBadge } from "./Screens";

const explorer = "https://testnet.nearblocks.io/txns/";
const startTx = "CXju2kvrhnp8BBptofgxyL3mjbak6D9KzZrKByR7ZWUx";
const releaseTx = "7Puq6qtsBYhgrYkMubecYiB5sghaJ9eXGZsYsB6pg4uX";
const short = (h: string) => `${h.slice(0, 6)}…${h.slice(-4)}`;

// The escrow exchange, in order. `at` is how far the session has got.
const wire = [
  ["start_session", "Tourist taps Start session and signs in Meteor"],
  ["0.1 NEAR held", "spot_pay keeps it in escrow, nobody can spend it"],
  ["release", "Tourist taps End & pay guide and signs"],
  ["0.095 + 0.005", "95% to the guide's creator, 5% to the platform"],
] as const;

type Stage = "idle" | "starting" | "held" | "releasing" | "settled";
const near = (n: number) => n.toFixed(3);

function Account({ who, sub, amount, icon, tone }: { who: string; sub: string; amount: number; icon: React.ReactNode; tone?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-1.5 text-center">
      {icon}
      <p className="text-[13px] text-secondary">{who}</p>
      <p className={`text-[20px] tabular-nums tracking-tight transition-colors ${tone ? "text-accent" : ""}`}>{near(amount)}</p>
      <p className="-mt-1.5 text-[11px] text-secondary">{sub}</p>
    </div>
  );
}

/** The whole session, played out: start it, then end it and watch the split. */
export function Payments() {
  const [stage, setStage] = useState<Stage>("idle");
  const [at, setAt] = useState(-1);
  const [run, setRun] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  const start = () => { setAt(-1); setStage("starting"); setRun((r) => r + 1); };
  const end = () => { setStage("releasing"); };

  // Plays the first session once the section is on screen.
  useEffect(() => {
    const seen = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        start();
        seen.disconnect();
      }
    }, { threshold: 0.3 });
    seen.observe(box.current!);
    return () => seen.disconnect();
  }, []);

  useEffect(() => {
    if (stage === "starting") {
      setAt(0);
      const t = [setTimeout(() => setAt(1), 800), setTimeout(() => setStage("held"), 1600)];
      return () => t.forEach(clearTimeout);
    }
    if (stage === "held") {
      const t = setTimeout(end, 2600); // the demo ends the session on its own; click to do it sooner
      return () => clearTimeout(t);
    }
    if (stage === "releasing") {
      setAt(2);
      const t = [setTimeout(() => setAt(3), 800), setTimeout(() => setStage("settled"), 1600)];
      return () => t.forEach(clearTimeout);
    }
  }, [stage, run]);

  const held = stage === "held" || stage === "releasing";
  const settled = stage === "settled";
  const tourist = held || settled ? 0.9 : 1;
  const escrow = held ? 0.1 : 0;
  const busy = stage === "starting" || stage === "releasing";

  return (
    <div ref={box} className="grid items-center justify-items-center gap-6 lg:grid-cols-[auto_1fr] lg:justify-items-stretch">
      <Phone width={236} background="#fff">
        <div className="flex h-full flex-col">
          <div className="flex flex-col items-center gap-1.5 pb-2">
            <Bot shape="circle" size={56} mood={held || settled ? "speaking" : "awake"} />
            <span className="text-[12px] text-secondary">Delhi Darwaza Guide</span>
            <PrivateBadge />
          </div>
          <div className="flex flex-1 flex-col justify-end gap-2 overflow-hidden px-3 pb-4">
            <Bubble from="you">Why are there spikes on the gate?</Bubble>
            <Bubble from="agent">They were meant to stop elephants from ramming it.</Bubble>
            <div key={run} className="rise rounded-card bg-[#f2f2f7] p-3">
              <p className="text-[15px]">Guided session</p>
              <p className="text-[12px]" style={{ color: settled ? "#1F8A4C" : "#6c6c70" }}>
                {stage === "idle" ? "0.1 NEAR, held until you finish" : stage === "starting" ? "Waiting for wallet…" : stage === "releasing" ? "Releasing…" : held ? "Held in escrow · deeper answers on" : "Settled · guide paid"}
              </p>
              {busy && (
                <p className="mt-2 flex items-center gap-1.5 text-[11px] text-secondary">
                  <LoaderCircle size={13} className="spinner" /> {stage === "starting" ? "Signing start_session…" : "Signing release…"}
                </p>
              )}
              {settled && (
                <a href={`${explorer}${releaseTx}`} className="mt-2 flex items-center gap-1 text-[11px]">
                  <CheckCircle2 size={14} fill="#1F8A4C" color="#fff" /> View on NearBlocks <ArrowUpRight size={11} />
                </a>
              )}
              {(stage === "idle" || settled) && (
                <button type="button" onClick={start} className="pressable mt-2.5 flex h-10 w-full cursor-pointer items-center justify-center rounded-full bg-accent text-[13px] text-white">
                  Start session
                </button>
              )}
              {stage === "held" && (
                <button type="button" onClick={end} className="pressable mt-2.5 flex h-10 w-full cursor-pointer items-center justify-center rounded-full bg-accent text-[13px] text-white">
                  End &amp; pay guide
                </button>
              )}
            </div>
            {settled && <Activity>0.095 NEAR to the creator</Activity>}
          </div>
        </div>
      </Phone>

      <div className="grid w-full min-w-0 gap-3 md:grid-cols-2">
        <div className="rounded-[28px] bg-[var(--tile)] p-5 md:col-span-2">
          <div className="grid grid-cols-[auto_1fr_auto_1fr_auto] items-center gap-3 sm:gap-4">
            <Account who="Tourist" sub="NEAR" amount={tourist} icon={<span className="flex size-11 items-center justify-center rounded-full bg-accent text-white"><User size={20} /></span>} />
            <div className="relative h-px bg-separator">
              <span
                className="absolute -top-3.5 flex size-7 items-center justify-center rounded-full bg-accent text-[10px] text-white"
                style={{ left: held || settled ? "calc(100% - 28px)" : "0", opacity: stage === "starting" ? 1 : 0, transition: "left 1200ms var(--ease-spring), opacity 200ms" }}
              >
                Ⓝ
              </span>
            </div>
            <Account who="spot_pay escrow" sub="held" amount={escrow} tone={held} icon={<span className="flex size-11 items-center justify-center rounded-full bg-ink text-white"><Lock size={19} /></span>} />
            <div className="relative h-px bg-separator">
              <span
                className="absolute -top-3.5 flex size-7 items-center justify-center rounded-full bg-accent text-[10px] text-white"
                style={{ left: settled ? "calc(100% - 28px)" : "0", opacity: stage === "releasing" ? 1 : 0, transition: "left 1200ms var(--ease-spring), opacity 200ms" }}
              >
                Ⓝ
              </span>
            </div>
            <div className="flex gap-3">
              <Account who="Creator 95%" sub="NEAR" amount={settled ? 0.095 : 0} tone={settled} icon={<Bot shape="circle" size={44} mood={settled ? "awake" : "idle"} />} />
              <Account who="Platform 5%" sub="NEAR" amount={settled ? 0.005 : 0} tone={settled} icon={<span className="flex size-11 items-center justify-center rounded-full bg-fill text-ink"><Landmark size={19} /></span>} />
            </div>
          </div>
          <ol className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {wire.map(([code, what], i) => (
              <li key={code} className={`rounded-2xl p-3 transition-colors duration-300 ${at >= i ? "bg-accent text-white" : "bg-white text-secondary"}`}>
                <p className="break-words font-mono text-[11px] leading-4">{code}</p>
                <p className={`mt-1 text-[12px] leading-4 ${at >= i ? "text-white/80" : ""}`}>{what}</p>
              </li>
            ))}
          </ol>
        </div>

        <div className="rounded-[28px] bg-[var(--tile)] p-5">
          <p className="text-[13px] text-secondary">Real testnet transactions</p>
          <div className="mt-2 divide-y divide-separator/50">
            {[["start_session", startTx], ["release", releaseTx]].map(([n, h]) => (
              <a key={h} href={`${explorer}${h}`} className="flex items-center justify-between gap-2 py-2 text-[15px] hover:text-accent">
                <span>{n}</span>
                <span className="flex items-center gap-1 font-mono text-[12px] text-secondary">{short(h)} <ArrowUpRight size={12} /></span>
              </a>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] bg-[var(--tile)] p-5">
          <p className="text-[13px] text-secondary">If you forget</p>
          <p className="mt-1 text-[15px] leading-[1.45]">Anyone can release the session after 30 minutes. The guide's creator is still paid.</p>
          <p className="mt-2 text-[13px] leading-5 text-secondary">Paid answers unlock only after the backend reads the session from the contract. Testnet only.</p>
        </div>
      </div>
    </div>
  );
}
