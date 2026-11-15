import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";

type Node = { x: number; y: number; label: string; note: string };

const nodes = {
  phone: { x: 120, y: 190, label: "Phone web app", note: "Vite and React. Geofence, live camera, the TalkingHead 3D avatar with a Kokoro neural voice, and the chat. It never holds a model key." },
  wallet: { x: 120, y: 400, label: "NEAR Connect", note: "NEAR Connect with Meteor Wallet. The visitor signs start_session and release themselves, on testnet." },
  chat: { x: 440, y: 70, label: "chat", note: "Supabase Edge Function. One conversational turn: loads the guide, checks paid access, streams the reply back as it is written." },
  nearby: { x: 440, y: 190, label: "nearby_agents()", note: "A Postgres function. Returns guides within range of you, without exact coordinates or prompts." },
  pay: { x: 440, y: 310, label: "near-pay", note: "Supabase Edge Function. Quotes the price and verifies a session on chain by calling the contract's get_session view." },
  nearai: { x: 760, y: 70, label: "NEAR AI Cloud", note: "OpenAI-compatible inference. The model z-ai/glm-5.3-flash runs in a secure hardware enclave (TEE), so questions are not exposed to the operator." },
  contract: { x: 760, y: 400, label: "spot_pay", note: "The Rust escrow contract on NEAR testnet. start_session holds 0.1 NEAR, release pays 95% to the guide's creator and 5% to the platform." },
} satisfies Record<string, Node>;

type Id = keyof typeof nodes;
type Step = [from: Id, to: Id, text: string];

const flows: { name: string; steps: Step[] }[] = [
  {
    name: "Find a guide",
    steps: [
      ["phone", "nearby", "Your GPS enters a spot's radius"],
      ["nearby", "phone", "The guide comes back, with no exact coordinates"],
    ],
  },
  {
    name: "Ask a question",
    steps: [
      ["phone", "chat", "You speak or type a question"],
      ["chat", "nearai", "The guide's facts and your question go to the model"],
      ["nearai", "chat", "The enclave streams the answer back"],
      ["chat", "phone", "Captions appear and the guide speaks"],
    ],
  },
  {
    name: "Pay the guide",
    steps: [
      ["phone", "wallet", "Start session: you approve in Meteor"],
      ["wallet", "contract", "start_session holds 0.1 NEAR in escrow"],
      ["phone", "pay", "The app asks the backend to confirm"],
      ["pay", "contract", "near-pay reads get_session on chain"],
      ["pay", "phone", "Only now are deeper answers unlocked"],
      ["wallet", "contract", "End & pay guide: release sends 95% and 5%"],
    ],
  },
];

const columns: [number, string][] = [[120, "Device"], [440, "Supabase"], [760, "NEAR"]];
const w = 190;
const h = 60;

/** Where a line between two nodes meets the edge of each box. */
function edge(from: Node, to: Node) {
  const clip = (a: Node, b: Node) => {
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = Math.min(dx ? (w / 2 + 4) / Math.abs(dx) : 1, dy ? (h / 2 + 4) / Math.abs(dy) : 1);
    return [a.x + dx * t, a.y + dy * t];
  };
  const [x1, y1] = clip(from, to);
  const [x2, y2] = clip(to, from);
  return { x1, y1, x2, y2 };
}

/** Pick a journey and watch it run, or click anything to read about it. */
export function Architecture() {
  const [flow, setFlow] = useState(0);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [picked, setPicked] = useState<Id | null>(null);
  const { steps } = flows[flow];

  useEffect(() => {
    if (!playing || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setStep((s) => (s + 1) % steps.length), 2000);
    return () => clearInterval(t);
  }, [playing, steps]);

  const [from, to] = steps[step];
  const inFlow = new Set(steps.flatMap(([a, b]) => [a, b]));
  const line = edge(nodes[from], nodes[to]);
  const info = nodes[picked ?? to];

  return (
    <div className="rounded-[28px] bg-[var(--tile)] p-4 sm:p-6">
      <div className="flex flex-wrap gap-2" role="tablist">
        {flows.map((f, i) => (
          <button
            key={f.name}
            type="button"
            role="tab"
            aria-selected={i === flow}
            onClick={() => { setFlow(i); setStep(0); setPlaying(true); setPicked(null); }}
            className={`pressable h-9 cursor-pointer rounded-full px-4 text-[14px] ${i === flow ? "bg-accent text-white" : "bg-fill"}`}
          >
            {f.name}
          </button>
        ))}
      </div>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-[1.65fr_1fr]">
      <div className="flex items-center justify-center gap-2 rounded-2xl bg-[#f5f5f7] p-4 text-[15px] md:hidden">
        <span className="rounded-xl bg-accent px-3 py-2 text-white">{nodes[from].label}</span>
        <ArrowRight size={18} aria-hidden />
        <span className="rounded-xl bg-accent px-3 py-2 text-white">{nodes[to].label}</span>
      </div>
      <div className="hidden md:block">
        <svg viewBox="0 0 900 470" className="w-full" role="group" aria-label={`Diagram: ${flows[flow].name}`}>
          <defs>
            <marker id="tip" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10z" fill="#1F8A4C" />
            </marker>
          </defs>
          {columns.map(([x, name]) => (
            <text key={name} x={x} y="16" textAnchor="middle" fontSize="17" fill="#6e6e73">{name}</text>
          ))}
          {steps.map(([a, b], i) => {
            const l = edge(nodes[a], nodes[b]);
            return <line key={i} {...l} stroke="#c6c6c8" strokeWidth="1.5" strokeDasharray="4 5" />;
          })}
          <line {...line} stroke="#1F8A4C" strokeWidth="2.5" markerEnd="url(#tip)" />
          <circle key={`${flow}-${step}`} r="6" fill="#1F8A4C">
            <animateMotion dur="0.9s" fill="freeze" path={`M${line.x1} ${line.y1} L${line.x2} ${line.y2}`} />
          </circle>
          {(Object.entries(nodes) as [Id, Node][]).map(([id, n]) => {
            const live = id === from || id === to;
            return (
              <g
                key={id}
                role="button"
                tabIndex={0}
                aria-label={n.label}
                onClick={() => { setPicked(id); setPlaying(false); }}
                onKeyDown={(e) => { if (e.key === "Enter") { setPicked(id); setPlaying(false); } }}
                className="cursor-pointer outline-none"
                style={{ opacity: inFlow.has(id) ? 1 : 0.3, transition: "opacity 300ms" }}
              >
                <rect
                  x={n.x - w / 2}
                  y={n.y - h / 2}
                  width={w}
                  height={h}
                  rx="14"
                  fill={live ? "#1F8A4C" : "#f5f5f7"}
                  stroke={picked === id ? "#1F8A4C" : "none"}
                  strokeWidth="3"
                  style={{ transition: "fill 200ms" }}
                />
                <text x={n.x} y={n.y + 7} textAnchor="middle" fontSize="19" fill={live ? "#fff" : "#000"} style={{ transition: "fill 200ms" }}>{n.label}</text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="min-w-0 space-y-3">
        <ol className="space-y-0.5">
          {steps.map(([, , text], i) => (
            <li key={text + i}>
              <button
                type="button"
                onClick={() => { setStep(i); setPlaying(false); setPicked(null); }}
                className={`flex w-full cursor-pointer gap-2.5 rounded-lg px-2 py-1.5 text-left text-[14px] leading-5 transition-colors ${i === step ? "bg-[#f5f5f7] text-ink" : "text-secondary"}`}
              >
                <span className="tabular-nums">{i + 1}</span>
                {text}
              </button>
            </li>
          ))}
        </ol>
        <div className="rounded-2xl bg-[#f5f5f7] p-4">
          <p className="text-[17px]">{info.label}</p>
          <p className="mt-1 text-[14px] leading-5 text-secondary">{info.note}</p>
        </div>
      </div>
      </div>
    </div>
  );
}
