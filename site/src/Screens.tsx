import { Footprints, Lock, MapPin, ScanLine } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { Bot } from "./Bot";
import { focusedAgent, Radar, useHeadYaw, type Placed } from "./Radar";

/** The five guides around the visitor at Shaniwar Wada. */
export const spots: (Placed & { dist: string })[] = [
  { name: "Delhi Darwaza", role: "Main gate", azimuth: -120, dist: "12 m" },
  { name: "Nagarkhana", role: "Drum house", azimuth: -60, dist: "30 m" },
  { name: "Courtyard", role: "Inner grounds", azimuth: 0, dist: "48 m" },
  { name: "The Ruins", role: "Where the palace stood", azimuth: 60, dist: "65 m" },
  { name: "Hazari Karanje", role: "Lotus fountain", azimuth: 120, dist: "90 m" },
];
const stops = [-120, -60, 0, 60, 120, 0];

/** The real app screenshots. Drop the PNGs into public/screens/ — a missing file shows a neutral frame. */
export const SCREENS = {
  explore: "/screens/explore.png",
  arrival: "/screens/arrival.png",
  talk: "/screens/talk.png",
  session: "/screens/session.png",
  settled: "/screens/settled.png",
  wallet: "/screens/wallet.png",
} as const;
export type ScreenKey = keyof typeof SCREENS;

export function Title({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 pb-2 pt-1">
      <h4 className="text-[26px] tracking-tight">{children}</h4>
      {right}
    </div>
  );
}

export function Group({ children }: { children: ReactNode }) {
  return <div className="mx-3 divide-y divide-separator/50 rounded-card bg-card">{children}</div>;
}

export function Bubble({ from, children }: { from: "you" | "agent"; children: ReactNode }) {
  return from === "you" ? (
    <p className="ml-auto max-w-[82%] rounded-[17px] bg-accent px-3 py-2 text-[13px] leading-[18px] text-white">{children}</p>
  ) : (
    <p className="mr-auto max-w-[82%] rounded-[17px] bg-fill px-3 py-2 text-[13px] leading-[18px]">{children}</p>
  );
}

export function Activity({ children }: { children: ReactNode }) {
  return <p className="mx-auto w-fit rounded-full bg-[#f2f2f7] px-2.5 py-1 text-[11px] text-secondary">{children}</p>;
}

/** A real screenshot filling the phone. If the file is missing, a neutral frame stays. */
export function Shot({ name }: { name: ScreenKey }) {
  const [missing, setMissing] = useState(false);
  return (
    <div className="relative size-full bg-[#ececf0]">
      {missing ? (
        <div className="flex size-full flex-col items-center justify-center gap-2 px-6 text-center text-secondary">
          <MapPin size={22} aria-hidden />
          <p className="text-[12px] leading-4">Screenshot coming soon</p>
        </div>
      ) : (
        <img src={SCREENS[name]} alt={`SpotAgents ${name} screen`} className="size-full object-contain object-top" onError={() => setMissing(true)} />
      )}
    </div>
  );
}

function Row({ title, sub, end }: { title: string; sub: ReactNode; end?: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2">
      <Bot shape="circle" size={34} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] leading-[18px]">{title}</p>
        <p className="flex items-center gap-1 text-[12px] leading-4 text-secondary">{sub}</p>
      </div>
      <span className="flex items-center gap-1 text-[13px] text-secondary">{end}</span>
    </div>
  );
}

/** Nearby: the live radar. It follows the pointer, and sweeps between the five spots on its own. */
export function NearbyScreen() {
  const center = useRef<HTMLDivElement>(null);
  const yaw = useHeadYaw(center, stops);
  const focused = focusedAgent(spots, yaw);

  return (
    <div>
      <Title right={<ScanLine size={19} className="text-accent" />}>Nearby</Title>
      <div ref={center} className="flex justify-center">
        <Radar agents={spots} yaw={yaw} radius={92} size={40} />
      </div>
      <div className="mt-1 text-center" aria-live="polite">
        <p className="text-[15px]">{focused ? `${focused.name} guide is here` : "Walk toward a spot"}</p>
        <p className="mt-0.5 text-[11px] text-secondary">Shaniwar Wada · Pune</p>
      </div>
      <div className="mt-3">
        <Group>
          {spots.slice(0, 3).map((a, i) => (
            <Row key={a.name} title={a.name} sub={i === 0 ? "Free guide" : "Free first question"} end={<>{a.dist} <Footprints size={11} /></>} />
          ))}
        </Group>
      </div>
    </div>
  );
}

/** The escrow card used in the payments phone. */
export function PrivateBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#e8f5ed] px-2 py-0.5 text-[11px] text-accent">
      <Lock size={11} aria-hidden /> NEAR AI Cloud · TEE
    </span>
  );
}
