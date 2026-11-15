import { AudioLines, Hand, Lock, MapPin, Mic, Scale, ShoppingBag, Store } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Architecture } from "./Architecture";
import { Bot } from "./Bot";
import { Phone } from "./Frames";
import { Payments } from "./Payments";
import { NearbyScreen, Shot as Screenshot, type ScreenKey } from "./Screens";

/** Drop the YouTube-nocookie embed URL here, e.g. "https://www.youtube-nocookie.com/embed/VIDEO_ID?rel=0". Empty shows the placeholder. */
const DEMO_VIDEO_URL = "/video/spotagents-demo.mp4";
/** Public GitHub repository. Placeholder until the repo is made public. */
const REPO_URL = "https://github.com/pradeepmisal/Spot-Agents";

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
        </a>
        <div className="flex items-center gap-6 text-[13px] text-ink/70">
          <a href="#demo" className="hidden transition-colors hover:text-ink sm:block">Demo</a>
          <a href="#journey" className="hidden transition-colors hover:text-ink sm:block">Journey</a>
          <a href="#phone" className="hidden transition-colors hover:text-ink sm:block">On your phone</a>
          <a href="#pay" className="hidden transition-colors hover:text-ink sm:block">Payments</a>
          <a href="#built" className="hidden transition-colors hover:text-ink sm:block">How it's built</a>
          <a href={REPO_URL} className="pressable rounded-full bg-accent px-3 py-1 text-white">GitHub</a>
        </div>
      </nav>
    </header>
  );
}

function Hero() {
  return (
    <section id="top" className="tone-white overflow-hidden px-4 pt-16 text-center sm:px-6 sm:pt-24">
      <Reveal>
        <div className="mx-auto mb-6 flex items-center justify-center gap-3">
          <img src="/brand/spotagents-logo.png" alt="SpotAgents" className="h-14 w-auto sm:h-[72px]" />
        </div>
        <h1 className="mx-auto max-w-4xl text-[52px] leading-[1.04] tracking-[-0.03em] text-balance sm:text-[96px]">Every monument has a guide.</h1>
        <p className="mx-auto mt-6 max-w-2xl text-[21px] leading-[1.4] text-secondary text-pretty sm:text-[24px]">
          AI guides at real places. Walk up, talk to one, and the local expert who made it is paid in NEAR.
        </p>
        <div className="mt-8 flex justify-center">
          <a href="#demo" className="pressable flex h-12 items-center gap-1.5 rounded-full bg-accent px-6 text-[17px] text-white">
            See it in action
          </a>
        </div>
      </Reveal>
      <Reveal className="relative mx-auto mt-16 flex h-[560px] max-w-5xl items-start justify-center sm:h-[600px]">
        <div className="absolute right-1/2 top-16 mr-28 hidden -rotate-6 lg:block">
          <Phone shot><Screenshot name="explore" /></Phone>
        </div>
        <div className="absolute left-1/2 top-16 ml-28 hidden rotate-6 lg:block">
          <Phone shot><Screenshot name="talk" /></Phone>
        </div>
        <div className="relative z-10">
          <Phone width={300} tab="Nearby" background="#fff"><NearbyScreen /></Phone>
        </div>
      </Reveal>
    </section>
  );
}

function Demo() {
  return (
    <Section id="demo" compact tone="white" label="Demo" title="See it in action." intro="Walk up to Delhi Darwaza, ask a question, and pay the guide's creator on NEAR.">
      <div className="mx-auto aspect-video max-w-4xl overflow-hidden rounded-[28px] bg-[var(--tile)]">
        {DEMO_VIDEO_URL.endsWith(".mp4") ? (
          <video
            className="size-full bg-black object-contain"
            src={DEMO_VIDEO_URL}
            poster="/video/poster.jpg"
            controls
            playsInline
            preload="metadata"
            title="SpotAgents demo"
          />
        ) : DEMO_VIDEO_URL ? (
          <iframe
            className="size-full"
            src={DEMO_VIDEO_URL}
            title="SpotAgents demo"
            loading="lazy"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-4 text-center">
            <div className="relative flex size-20 items-center justify-center">
              <span className="loop-pulse absolute size-20 rounded-full border border-accent/40" />
              <Bot shape="circle" size={64} mood="awake" />
            </div>
            <p className="text-[21px] tracking-tight">Demo video coming soon</p>
            <p className="max-w-sm px-6 text-[15px] leading-[1.45] text-secondary">A short walk through Shaniwar Wada: arrive, ask, and settle on chain.</p>
          </div>
        )}
      </div>
    </Section>
  );
}

function Stage({ title, detail, children }: { title: string; detail: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[28px] bg-[var(--tile)]">
      <div className="flex h-52 items-center justify-center">{children}</div>
      <div className="px-6 pb-7">
        <h3 className="text-[21px] tracking-tight">{title}</h3>
        <p className="mt-1.5 text-[15px] leading-[1.45] text-secondary">{detail}</p>
      </div>
    </div>
  );
}

function Journey() {
  return (
    <Section
      id="journey"
      tone="white"
      label="The journey"
      title="Walk up. Ask. Settle."
      intro="From the gate to the payout, five small steps. No account to create, no card to enter. A NEAR wallet is only needed if you want a deeper session."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stage title="Walk up" detail="Enter a spot's radius and its guide appears.">
          <div className="relative size-36">
            <span className="loop-pulse absolute inset-2 rounded-full border border-accent/50" />
            <span className="absolute inset-4 rounded-full border border-dashed border-ink/20" />
            <div className="loop-appear absolute left-1/2 top-3 -ml-5"><Bot shape="circle" size={40} mood="awake" /></div>
            <div className="loop-walk absolute left-1/2 top-1/2 -ml-2.5 mt-3 flex size-5 items-center justify-center rounded-full bg-accent shadow">
              <MapPin size={12} className="text-white" aria-hidden />
            </div>
          </div>
        </Stage>
        <Stage title="Meet the guide" detail="It waves and greets you aloud, right where you stand.">
          <div className="loop-nod"><Bot shape="squircle" size={76} mood="awake" /></div>
          <Hand className="loop-hand ml-3 text-accent" size={30} aria-hidden />
        </Stage>
        <Stage title="Ask anything" detail="Talk or type. Answers come as voice and live captions, from NEAR AI Cloud in a TEE.">
          <Bot shape="capsule" size={70} mood="speaking" />
          <div className="ml-4 flex h-12 items-center gap-1" aria-hidden>
            {[0, 0.15, 0.3, 0.1, 0.25].map((d, i) => (
              <span key={i} className="loop-wave h-full w-1 rounded-full bg-accent" style={{ animationDelay: `${d}s` }} />
            ))}
          </div>
        </Stage>
        <Stage title="Go deeper" detail="0.1 NEAR is held in escrow for a guided session. Nobody can spend it meanwhile.">
          <div className="relative flex h-28 w-28 items-end justify-center">
            <div className="loop-coin absolute top-0 flex size-10 items-center justify-center rounded-full bg-accent text-[15px] text-white">Ⓝ</div>
            <div className="flex h-14 w-24 items-center justify-center rounded-2xl bg-ink text-white"><Lock size={22} aria-hidden /></div>
          </div>
        </Stage>
        <Stage title="Settle" detail="End the session: 95% goes to the guide's creator, 5% to the platform.">
          <div className="w-40 space-y-3 text-[12px]">
            <div>
              <p className="mb-1 flex justify-between"><span>Creator</span><span className="tabular-nums">0.095</span></p>
              <div className="h-2 overflow-hidden rounded-full bg-fill"><div className="loop-split h-full w-[95%] rounded-full bg-accent" /></div>
            </div>
            <div>
              <p className="mb-1 flex justify-between"><span>Platform</span><span className="tabular-nums">0.005</span></p>
              <div className="h-2 overflow-hidden rounded-full bg-fill"><div className="loop-split h-full w-[5%] rounded-full bg-ink" /></div>
            </div>
          </div>
        </Stage>
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
  { screen: "explore", icon: <MapPin size={15} aria-hidden />, title: "Placed at real spots", detail: "Each guide belongs to one place: a gate, a courtyard, a fountain. Find them on the map." },
  { screen: "arrival", icon: <AudioLines size={15} aria-hidden />, title: "Found by walking", detail: "A geofence around the spot brings the guide up when you arrive. No scanning, no QR code." },
  { screen: "talk", icon: <Mic size={15} aria-hidden />, title: "Talk naturally", detail: "Hold to talk or type. The guide answers in a neural voice with live captions." },
  { screen: "session", icon: <Lock size={15} aria-hidden />, title: "Private by design", detail: "Guides run on NEAR AI Cloud inside a secure enclave (TEE), so your questions are not exposed." },
];

function PhoneSection() {
  return (
    <Section
      id="phone"
      tone="grey"
      label="SpotAgents on your phone"
      title="A guide in your pocket, at the exact spot."
      intro="SpotAgents is a mobile web app. Open it where you stand, or take the virtual visit from anywhere."
    >
      <div className="shelf -mx-4 flex snap-x snap-mandatory gap-6 overflow-x-auto px-4 pb-14 pt-2 sm:-mx-6 sm:px-6 xl:justify-between xl:overflow-visible">
        {tiles.map((t) => (
          <Shot key={t.screen} icon={t.icon} title={t.title} detail={t.detail}>
            <Phone shot background="#fff"><Screenshot name={t.screen} /></Phone>
          </Shot>
        ))}
      </div>
    </Section>
  );
}

function NextMarket() {
  return (
    <section className="tone-grey overflow-hidden px-4 py-16 sm:px-6">
      <Reveal className="mx-auto flex max-w-4xl flex-col items-center gap-6 rounded-[28px] bg-[var(--tile)] p-8 text-center sm:flex-row sm:text-left">
        <div className="relative flex h-24 w-32 shrink-0 items-end justify-center">
          <Store size={92} strokeWidth={1.25} className="text-ink/80" aria-hidden />
          <div className="absolute bottom-1 left-1/2 -ml-4"><Bot shape="circle" size={34} mood="awake" /></div>
        </div>
        <div>
          <p className="text-[13px] text-secondary">Next market · not built yet</p>
          <h3 className="mt-0.5 flex items-center justify-center gap-2 text-[24px] tracking-tight sm:justify-start"><ShoppingBag size={20} aria-hidden /> Shops and street vendors</h3>
          <p className="mt-1.5 text-[15px] leading-[1.45] text-secondary">The same contract could let a chai stall put its own agent at the counter. It is the next market we want to try, and nothing here exists yet.</p>
        </div>
      </Reveal>
    </section>
  );
}

export function App() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Demo />
        <Journey />
        <PhoneSection />
        <Section
          id="pay"
          compact
          tone="white"
          label="Pay the expert"
          title="Held in escrow. Split on chain."
          intro="A guided session is a NEAR escrow. Start it, ask away, and end it to pay the guide's creator. Tap Start session, then End & pay guide."
        >
          <Payments />
        </Section>
        <NextMarket />
        <Section
          id="built"
          compact
          tone="white"
          label="How it's built"
          title="Follow a request through the system."
          intro="A phone web app, a thin Supabase backend, private inference on NEAR AI Cloud and an escrow contract on NEAR. Pick a journey, or click any box."
        >
          <Architecture />
        </Section>
      </main>
      <footer className="mx-auto max-w-6xl space-y-2 px-4 py-8 text-[12px] leading-5 text-secondary sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-ink"><img src="/brand/spotagents-logo.png" alt="SpotAgents" className="h-6 w-auto" /> · Built at NEAR HACKATHON 2026 · Testnet only</p>
          <a href={REPO_URL} className="hover:text-ink">Open source on GitHub</a>
        </div>
        <p className="flex items-start gap-1.5"><Scale size={13} className="mt-1 shrink-0" aria-hidden /><span>
          Photos of Shaniwar Wada: Wikimedia Commons (CC BY-SA / CC0). Avatar: CC BY-NC 4.0. Map © OpenStreetMap.
        </span></p>
      </footer>
    </>
  );
}
