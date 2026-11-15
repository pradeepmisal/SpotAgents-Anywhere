import { useState } from "react";
import { unlockSpeech } from "./chat/voice";
import BottomNav from "./ui/BottomNav";
import type { Tab } from "./ui/BottomNav";
import Logo from "./ui/Logo";
import { MOCK } from "./anywhere/api";
import { useAgents, useLocation } from "./anywhere/hooks";
import type { AgentDetail, AgentSummary } from "./anywhere/types";
import Explore from "./anywhere/screens/Explore";
import AgentPage from "./anywhere/screens/AgentPage";
import Studio from "./anywhere/screens/Studio";
import Talk from "./anywhere/screens/Talk";
import Wallet from "./anywhere/screens/Wallet";
import ARFinder from "./anywhere/screens/AR";
import "./styles.css";
import "./anywhere/anywhere.css";

type Overlay =
  | { kind: "agent"; id: string; initial?: AgentDetail | null }
  | { kind: "talk"; agent: AgentDetail }
  | { kind: "ar" }
  | null;

export default function App() {
  const [tab, setTab] = useState<Tab>("explore");
  const [overlay, setOverlay] = useState<Overlay>(null);
  const loc = useLocation();
  const [reload, setReload] = useState(0);
  const { agents, loading, error, retry } = useAgents(loc.place, reload);

  const open = (a: Pick<AgentSummary, "id">) => setOverlay({ kind: "agent", id: a.id });
  const close = () => { setOverlay(null); setReload((n) => n + 1); };

  return (
    <div className="app">
      {MOCK && <div className="mock-banner">Mock mode (?mock=1): sample data, no real AI or payments</div>}
      <main className="screen">
        {(tab === "explore" || tab === "agents") && (
          <>
            {tab === "explore" && <header className="topbar"><Logo onClick={() => setTab("explore")} /></header>}
            <Explore variant={tab === "explore" ? "explore" : "list"} loc={loc} agents={agents} loading={loading} error={error} onRetry={retry} onOpen={open} />
          </>
        )}
        {tab === "studio" && <Studio loc={loc} onOpenAgent={(a) => setOverlay({ kind: "agent", id: a.id, initial: a })} />}
        {tab === "wallet" && <Wallet />}
      </main>
      <BottomNav tab={tab} onTab={setTab} onAR={() => setOverlay({ kind: "ar" })} />

      {overlay?.kind === "agent" && (
        <div className="overlay">
          <AgentPage id={overlay.id} from={loc.place} initial={overlay.initial} onBack={close}
            onTalk={(a) => { unlockSpeech(); setOverlay({ kind: "talk", agent: a }); }} />
        </div>
      )}
      {overlay?.kind === "talk" && <Talk agent={overlay.agent} from={loc.place} onBack={() => setOverlay({ kind: "agent", id: overlay.agent.id })} />}
      {overlay?.kind === "ar" && <ARFinder agents={agents} from={loc.place} onClose={() => setOverlay(null)} onOpen={open} />}
    </div>
  );
}
