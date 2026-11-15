import { Compass, Users, Wallet, Wand2, ScanFace } from "lucide-react";

export type Tab = "explore" | "agents" | "studio" | "wallet";

export default function BottomNav({ tab, onTab, onAR }: { tab: Tab; onTab: (t: Tab) => void; onAR: () => void }) {
  const item = (t: Tab, label: string, Icon: typeof Compass) => (
    <button className={`nav-item${tab === t ? " on" : ""}`} onClick={() => onTab(t)} aria-current={tab === t ? "page" : undefined}>
      <Icon size={22} strokeWidth={tab === t ? 2.4 : 1.8} />
      {label}
    </button>
  );
  return (
    <nav className="nav" aria-label="Main">
      {item("explore", "Explore", Compass)}
      {item("agents", "Agents", Users)}
      <button className="nav-centre" onClick={onAR} aria-label="Find agents with the camera (AR)" title="AR finder">
        <ScanFace size={28} />
      </button>
      {item("studio", "Studio", Wand2)}
      {item("wallet", "Wallet", Wallet)}
    </nav>
  );
}
