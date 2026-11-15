import { useEffect, useMemo, useRef, useState } from "react";
import { DEMO_CITY } from "./types";
import type { NearbyAgent, Quote } from "./types";
import { useNearby } from "./nearby/useNearby";
import Experience from "./visit/Experience";
import { ROUTE, haversineM, stopForAgent, withLocalDistances } from "./visit/route";
import { useRealPosition } from "./visit/useRealPosition";
import { useVirtualWalk } from "./visit/useVirtualWalk";
import { unlockSpeech } from "./chat/voice";
import { Paywall, toPaymentRequired, useAccountId } from "./near";
import { useHistory } from "./near/session";
import type { LocalEntry } from "./near/session";
import BottomNav from "./ui/BottomNav";
import type { Tab } from "./ui/BottomNav";
import Logo from "./ui/Logo";
import { faceSrc, spotImage, spotName } from "./ui/spots";
import Explore from "./screens/Explore";
import Agents from "./screens/Agents";
import WalletScreen from "./screens/WalletScreen";
import Profile from "./screens/Profile";
import Settle from "./screens/Settle";
import "./styles.css";

type Mode = "virtual" | "real";

const params = new URLSearchParams(window.location.search);
const useMock = params.get("mock") === "1";
/** ?mock=1&preview=paywall|settle renders those screens with sample data, for design review only. */
const preview = useMock ? params.get("preview") : null;

const PREVIEW_QUOTE: Quote = {
  quote_id: "preview", contract_id: "preview.testnet", agent_id: "mock-3", creator_account: "sweetfrog-creator.testnet",
  amount_yocto: "100000000000000000000000", fee_bps: 500, expires_at: new Date(Date.now() + 600000).toISOString(),
};
const PREVIEW_ENTRY: LocalEntry = {
  quote_id: "preview", agent_id: "mock-3", agent_name: "Courtyard Guide", kind: "session", status: "released",
  amount_yocto: "100000000000000000000000", account_id: "demo.testnet", release_tx: "8f3dA1c9Zk2m4QpR7sT0vXyW1bN5cE6hJ", at: Date.now(),
};

function useGeoGranted(): boolean {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    let live = true;
    navigator.permissions?.query({ name: "geolocation" }).then((p) => {
      if (!live) return;
      setOk(p.state === "granted");
      p.onchange = () => setOk(p.state === "granted");
    }).catch(() => {});
    return () => { live = false; };
  }, []);
  return ok;
}

export default function App() {
  const [tab, setTab] = useState<Tab>("explore");
  const [mode, setMode] = useState<Mode | null>(null); // null = tabs
  const [initial, setInitial] = useState<NearbyAgent | null>(null);
  const [reload, setReload] = useState(0);
  const [settle, setSettle] = useState<LocalEntry | null>(preview === "settle" ? PREVIEW_ENTRY : null);
  const account = useAccountId();
  const granted = useGeoGranted();

  const walk = useVirtualWalk(mode === "virtual");
  // Home map only uses a device position when the user already granted permission; it is kept in memory.
  const real = useRealPosition(mode === "real" || (mode === null && granted));

  // Virtual and home: list guides around the (public) entrance, then use local distances.
  // Real: query around the device position (in memory only, never stored).
  const lat = mode === "real" ? real.pos?.lat ?? null : DEMO_CITY.lat;
  const lng = mode === "real" ? real.pos?.lng ?? null : DEMO_CITY.lng;
  const nearby = useNearby(lat, lng, useMock, reload);

  const agents = useMemo(() => {
    if (mode === "virtual") return withLocalDistances(nearby.agents, walk.pos);
    if (mode === null) {
      const gate = ROUTE[1];
      const idx = (a: NearbyAgent) => { const s = stopForAgent(a); return s ? ROUTE.indexOf(s) : 99; };
      return withLocalDistances(nearby.agents, gate).sort((a, b) => idx(a) - idx(b));
    }
    return nearby.agents;
  }, [nearby.agents, mode, walk.pos]);

  // Settle screen: shown when a guided session this app instance saw as active becomes released.
  const history = useHistory();
  const seen = useRef(new Map(history.map((h) => [h.quote_id, h.status])));
  useEffect(() => {
    for (const h of history) {
      if (seen.current.get(h.quote_id) === "active" && h.status === "released") setSettle(h);
      seen.current.set(h.quote_id, h.status);
    }
  }, [history]);

  const start = (m: Mode, a: NearbyAgent | null = null) => {
    unlockSpeech(); // speechSynthesis needs a user gesture before it may speak
    setInitial(a);
    const s = a && m === "virtual" ? stopForAgent(a) : undefined;
    if (s) walk.goTo(ROUTE.indexOf(s));
    setMode(m);
  };
  const exit = () => { setMode(null); setInitial(null); walk.reset(); };
  const retry = () => setReload((n) => n + 1);

  // Explore map: real position only when it is near the monument; otherwise a labelled demo position.
  const nearMonument = real.pos && haversineM(real.pos, DEMO_CITY) < 3000 ? real.pos : null;
  const user = nearMonument ?? { lat: ROUTE[0].lat, lng: ROUTE[0].lng };
  const userLabel = nearMonument ? "Live location" : "Demo location · outside the gate";

  const previewAgent = nearby.agents.find((a) => a.id === "mock-3") ?? null;

  return (
    <div className="app">
      {mode ? (
        <Experience
          key={mode}
          mode={mode}
          agents={agents}
          loading={nearby.loading}
          error={nearby.error}
          gps={real.state}
          walk={walk}
          mock={useMock}
          initial={initial}
          onExit={exit}
          onSwitchVirtual={() => start("virtual")}
          onSwitchReal={() => start("real")}
        />
      ) : (
        <>
          <main className="screen">
            {tab === "explore" && (
              <>
                <header className="topbar">
                  <Logo onClick={() => setTab("explore")} />
                  <button className="acct-pill" onClick={() => setTab("wallet")} aria-label="Open wallet">
                    <span className={`dot${account ? "" : " off"}`} />
                    <span>{account ?? "Connect wallet"}</span>
                  </button>
                </header>
                <Explore agents={agents} loading={nearby.loading} error={nearby.error} onRetry={retry}
                  onOpen={(a) => start("virtual", a)} onVirtual={() => start("virtual")} user={user} userLabel={userLabel} />
              </>
            )}
            {tab === "agents" && <Agents agents={agents} loading={nearby.loading} error={nearby.error} onRetry={retry} onOpen={(a) => start("virtual", a)} />}
            {tab === "wallet" && <WalletScreen />}
            {tab === "profile" && <Profile />}
          </main>
          <BottomNav tab={tab} onTab={setTab} onHere={() => start("real")} />
        </>
      )}

      {preview === "paywall" && previewAgent && (
        <Paywall required={toPaymentRequired(previewAgent)} agentName={previewAgent.name} image={spotImage(previewAgent)}
          face={faceSrc()} spot={spotName(previewAgent)} quoteOverride={PREVIEW_QUOTE} onUnlocked={() => {}} onClose={() => {}} />
      )}
      {settle && <Settle entry={settle} onDone={() => { setSettle(null); exit(); setTab("explore"); }} />}
    </div>
  );
}
