import { BadgeCheck, Building2, Camera, Coins, Globe2, Map as MapIcon, Mic, PenLine, Scale, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Bot } from "./Bot";
import { Phone } from "./Frames";
import { Shot as Screenshot, type ScreenKey } from "./Screens";

const DEMO_VIDEO_URL = "/video/anywhere-demo.mp4";
const REPO_URL = "https://github.com/pradeepmisal/SpotAgents-Anywhere";
const APP_URL = "https://spotagents-anywhere.vercel.app";

/** Fades its children in the first time they scroll into view. */
function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const watch = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        setSeen(true);
        watch.disconnect();
      }
    }, { rootMargin: "0px 0px -8% 0px" });
    watch.observe(box.current!);
    return () => watch.disconnect();
  }, []);

  return <div ref={box} className={`reveal ${seen ? "seen" : ""} ${className}`}>{children}</div>;
}

function Section({ id, tone, label, title, intro, compact = false, children }: { id: string; tone: "white" | "grey"; label: string; title: string; intro: string; compact?: boolean; children: ReactNode }) {
  return (
    <section id={id} className={`tone-${tone} overflow-hidden px-4 sm:px-6 ${compact ? "py-16 lg:py-10" : "py-24 sm:py-36"}`}>
      <div className="mx-auto max-w-6xl">
        <Reveal className={`mx-auto text-center ${compact ? "max-w-4xl" : "max-w-3xl"}`}>
          <p className={`text-secondary ${compact ? "text-[15px]" : "text-[17px] sm:text-[19px]"}`}>{label}</p>
          <h2 className={`mt-1 leading-[1.07] tracking-[-0.022em] text-balance ${compact ? "text-[34px] sm:text-[44px]" : "text-[40px] sm:text-[64px]"}`}>{title}</h2>
          <p className={`mx-auto text-secondary text-pretty ${compact ? "mt-2 max-w-3xl text-[17px] leading-[1.4]" : "mt-5 max-w-2xl text-[19px] leading-[1.45] sm:text-[21px]"}`}>{intro}</p>
        </Reveal>
        <Reveal className={compact ? "mt-8 lg:mt-6" : "mt-14 sm:mt-20"}>{children}</Reveal>
      </div>
    </section>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-20 bg-white/75 backdrop-blur-2xl backdrop-saturate-150">
      <nav className="mx-auto flex h-12 max-w-6xl items-center justify-between px-4 sm:px-6">
        <a href="#top" className="flex items-center gap-2 text-[15px]">
          <img src="/brand/spotagents-logo.png" alt="SpotAgents" className="h-8 w-auto" />
          <span className="hidden text-accent sm:inline">Anywhere</span>
        </a>
        <div className="flex items-center gap-5 text-[13px] text-ink/70">
          <a href="#demo" className="hidden transition-colors hover:text-ink md:block">Demo</a>
          <a href="#how" className="hidden transition-colors hover:text-ink md:block">How it works</a>
          <a href="#built" className="hidden transition-colors hover:text-ink md:block">Built on</a>
          <a href="#screens" className="hidden transition-colors hover:text-ink md:block">Screens</a>
          <a href="#business" className="hidden transition-colors hover:text-ink md:block">Business</a>
          <a href={APP_URL} className="pressable rounded-full bg-accent px-3 py-1 text-white">Try the app</a>
        </div>
      </nav>
    </header>
  );
}

function Hero() {
  return (
    <section id="top" className="tone-white overflow-hidden px-4 pt-16 text-center sm:px-6 sm:pt-24">
      <Reveal>
        <div className="mx-auto mb-6 flex flex-col items-center justify-center gap-1">
          <img src="/brand/spotagents-logo.png" alt="SpotAgents" className="h-14 w-auto sm:h-[72px]" />
          <span className="text-[22px] tracking-tight text-accent sm:text-[28px]">Anywhere</span>
        </div>
        <h1 className="mx-auto max-w-4xl text-[44px] leading-[1.04] tracking-[-0.03em] text-balance sm:text-[88px]">Every place has an expert.</h1>
        <p className="mx-auto mt-6 max-w-2xl text-[19px] leading-[1.4] text-secondary text-pretty sm:text-[24px]">
          A marketplace of expert AI agents placed at real spots, anywhere on Earth. Meet them on a map or through your camera, talk by voice, and the expert who made them earns.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a href={APP_URL} className="pressable flex h-12 items-center rounded-full bg-accent px-6 text-[17px] text-white">Try the app</a>
          <a href={REPO_URL} className="pressable flex h-12 items-center rounded-full bg-fill px-6 text-[17px] text-ink">GitHub</a>
        </div>
      </Reveal>
      <Reveal className="relative mx-auto mt-16 flex h-[560px] max-w-5xl items-start justify-center sm:h-[600px]">
        <div className="absolute right-1/2 top-16 mr-28 hidden -rotate-6 lg:block">
          <Phone shot><Screenshot name="studio" /></Phone>
        </div>
        <div className="absolute left-1/2 top-16 ml-28 hidden rotate-6 lg:block">
          <Phone shot><Screenshot name="talk" /></Phone>
        </div>
        <div className="relative z-10">
          <Phone width={252} shot background="#fff"><Screenshot name="explore" /></Phone>
        </div>
      </Reveal>
    </section>
  );
}

function Demo() {
  return (
    <Section id="demo" compact tone="white" label="Demo" title="See it in action." intro="Asha, a historian, leaves Mira at Delhi Darwaza. Arjun, travelling, finds her, asks a question, and his tour agent pays.">
      <div className="mx-auto aspect-video max-w-4xl overflow-hidden rounded-[28px] bg-[var(--tile)]">
        <video className="size-full bg-black object-contain" src={DEMO_VIDEO_URL} poster="/video/poster.jpg" controls playsInline preload="metadata" title="SpotAgents Anywhere demo" />
      </div>
    </Section>
  );
}

function Card({ icon, title, detail, children }: { icon: ReactNode; title: string; detail?: string; children?: ReactNode }) {
  return (
    <div className="rounded-[28px] bg-[var(--tile)] p-7 text-left">
      <div className="flex size-11 items-center justify-center rounded-full bg-accent/10 text-accent">{icon}</div>
      <h3 className="mt-4 text-[21px] tracking-tight">{title}</h3>
      {detail && <p className="mt-1.5 text-[15px] leading-[1.45] text-secondary">{detail}</p>}
      {children}
    </div>
  );
}

function Problem() {
  return (
    <Section id="problem" tone="grey" label="Problem → Opportunity" title="The stories are there. The experts can't be." intro="Every place has someone who knows its story: a historian, a licensed guide, the family that has run the corner shop for fifty years.">
      <div className="grid gap-4 md:grid-cols-2">
        <Card icon={<Globe2 size={22} aria-hidden />} title="The problem" detail="Experts can't stand at every gate for every visitor, and their knowledge earns them nothing when they aren't there. Visitors walk past those stories with a two-line sign for company." />
        <Card icon={<Sparkles size={22} aria-hidden />} title="The opportunity" detail="Let the expert leave an agent at the exact spot they know best. Visitors meet it there, on any phone, and the expert earns from every session without travelling." />
      </div>
    </Section>
  );
}

const steps = [
  { icon: <PenLine size={22} aria-hidden />, title: "1 · Create", detail: "In the Studio, Asha drops a pin at Delhi Darwaza, writes what only she knows and sets a price. SERV Reasoning compiles her notes into Mira: a schema-validated agent with persona, facts, stories and suggested questions." },
  { icon: <ShieldCheck size={22} aria-hidden />, title: "2 · Review", detail: "Reppo scores every new agent as a quality gate. Accepted agents are listed; a rejection sends Reppo's critique back to SERV, which rebuilds the agent and resubmits it." },
  { icon: <Camera size={22} aria-hidden />, title: "3 · Meet", detail: "Arjun finds Mira on the world map, by city, or by pointing his camera (AR finder). A 3D guide answers by voice with live captions. The first question is free." },
  { icon: <Wallet size={22} aria-hidden />, title: "4 · Pay", detail: "For a premium session, Arjun's tour agent pays through Kite x402, inside his budget and a per-purchase cap. Anything over the cap is refused before signing." },
];

function How() {
  return (
    <Section id="how" tone="white" label="How it works" title="Create. Review. Meet. Pay." intro="One expert, one agent, one visitor: Asha builds Mira, Reppo checks her, Arjun meets her at the gate.">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s) => <Card key={s.title} {...s} />)}
      </div>
      <div className="mt-10 flex items-center justify-center gap-4">
        <Bot shape="circle" size={48} mood="speaking" />
        <div className="flex h-10 items-center gap-1" aria-hidden>
          {[0, 0.15, 0.3, 0.1, 0.25].map((d, i) => (
            <span key={i} className="loop-wave h-full w-1 rounded-full bg-accent" style={{ animationDelay: `${d}s` }} />
          ))}
        </div>
      </div>
    </Section>
  );
}

const sponsors = [
  { logo: "/logos/serv-wordmark.svg", name: "SERV Reasoning by OpenServ", detail: "Compiles expert notes into a validated agent, rebuilds agents from Reppo critiques, and powers every visitor conversation." },
  { logo: "/logos/reppo.png", name: "Reppo", detail: "Scores each new agent before it is listed. A rejection means a rebuild: the critique goes back to SERV for a new version." },
  { logo: "/logos/kite.svg", name: "Kite", detail: "The visitor's tour agent pays via x402 within a budget and per-purchase cap. Runs on Kite testnet: no real money moves." },
];

function BuiltOn() {
  return (
    <Section id="built" tone="grey" label="Built on" title="Three sponsors, each doing real work." intro="Reasoning to build agents, a quality gate to trust them, and agentic payments to pay their creators.">
      <div className="grid gap-4 md:grid-cols-3">
        {sponsors.map((s) => (
          <div key={s.name} className="rounded-[28px] bg-[var(--tile)] p-7 text-left">
            <div className="flex h-12 items-center"><img src={s.logo} alt={s.name} className="max-h-10 max-w-[180px] object-contain" /></div>
            <h3 className="mt-4 text-[21px] tracking-tight">{s.name}</h3>
            <p className="mt-1.5 text-[15px] leading-[1.45] text-secondary">{s.detail}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Shot({ icon, title, detail, children }: { icon: ReactNode; title: string; detail: string; children: ReactNode }) {
  return (
    <figure className="w-[262px] shrink-0 snap-center">
      {children}
      <figcaption className="mt-5 px-1">
        <p className="flex items-center gap-1.5 text-[17px] tracking-tight">{icon} {title}</p>
        <p className="mt-1 text-[15px] leading-[1.45] text-secondary">{detail}</p>
      </figcaption>
    </figure>
  );
}

const tiles: { screen: ScreenKey; icon: ReactNode; title: string; detail: string }[] = [
  { screen: "explore", icon: <MapIcon size={15} aria-hidden />, title: "Explore", detail: "A world map and the nearest expert agents, each with its Reppo score." },
  { screen: "agent", icon: <BadgeCheck size={15} aria-hidden />, title: "Agent", detail: "SERV-compiled facts and stories, with the agent's quality score." },
  { screen: "talk", icon: <Mic size={15} aria-hidden />, title: "Talk", detail: "A 3D guide answers by voice with live captions. First question free." },
  { screen: "paywall", icon: <Wallet size={15} aria-hidden />, title: "Tour agent pays", detail: "A budget and a per-purchase cap, paid via Kite x402 on testnet." },
  { screen: "paid", icon: <Coins size={15} aria-hidden />, title: "Result", detail: "The payment result, honestly labelled." },
  { screen: "studio", icon: <PenLine size={15} aria-hidden />, title: "Studio", detail: "Pin, notes and price, compiled by SERV Reasoning." },
];

function Screens() {
  return (
    <Section id="screens" tone="white" label="Screens" title="On any phone, anywhere." intro="A mobile web app. Open it where you stand, or explore the world from home.">
      <div className="shelf -mx-4 flex snap-x snap-mandatory gap-6 overflow-x-auto px-4 pb-14 pt-2 sm:-mx-6 sm:px-6">
        {tiles.map((t) => (
          <Shot key={t.screen} icon={t.icon} title={t.title} detail={t.detail}>
            <Phone shot background="#fff"><Screenshot name={t.screen} /></Phone>
          </Shot>
        ))}
      </div>
    </Section>
  );
}

function Business() {
  return (
    <Section id="business" tone="grey" label="Business model" title="Experts earn without travelling." intro="Visitors need nothing but a phone. The platform earns when experts do.">
      <div className="grid gap-4 md:grid-cols-3">
        <Card icon={<Coins size={22} aria-hidden />} title="Session revenue">
          <div className="mt-4 space-y-3 text-[13px]">
            <div>
              <p className="mb-1 flex justify-between"><span>Creator</span><span className="tabular-nums">90%</span></p>
              <div className="h-2 overflow-hidden rounded-full bg-fill"><div className="loop-split h-full w-[90%] rounded-full bg-accent" /></div>
            </div>
            <div>
              <p className="mb-1 flex justify-between"><span>Platform fee</span><span className="tabular-nums">10%</span></p>
              <div className="h-2 overflow-hidden rounded-full bg-fill"><div className="loop-split h-full w-[10%] rounded-full bg-ink" /></div>
            </div>
          </div>
        </Card>
        <Card icon={<BadgeCheck size={22} aria-hidden />} title="Verified listings" detail="Museums, licensed guides and cities pay for a verified badge on their agents." />
        <Card icon={<Building2 size={22} aria-hidden />} title="City partnerships" detail="Cities and heritage sites seed and promote agents across their landmarks." />
      </div>
    </Section>
  );
}

export function App() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Demo />
        <Problem />
        <How />
        <BuiltOn />
        <Screens />
        <Business />
      </main>
      <footer className="mx-auto max-w-6xl space-y-2 px-4 py-8 text-[12px] leading-5 text-secondary sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex flex-wrap items-center gap-2 text-ink"><img src="/brand/spotagents-logo.png" alt="SpotAgents" className="h-6 w-auto" /> Anywhere · Built for SERV Hackathon 02 · Open track</p>
          <a href={REPO_URL} className="hover:text-ink">Open source on GitHub</a>
        </div>
        <p className="flex items-start gap-1.5"><Scale size={13} className="mt-1 shrink-0" aria-hidden /><span>
          Map © OpenStreetMap contributors. Avatar: CC BY-NC 4.0. Demo video: voiceover, music and footage credits are listed in the repository. Payments run on Kite testnet.
        </span></p>
      </footer>
    </>
  );
}
