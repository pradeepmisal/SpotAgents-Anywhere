import { Compass, Users, Wallet, User, ScanFace } from "lucide-react";

export type Tab = "explore" | "agents" | "wallet" | "profile";

export default function BottomNav({ tab, onTab, onHere }: { tab: Tab; onTab: (t: Tab) => void; onHere: () => void }) {
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
      <button className="nav-centre" onClick={onHere} aria-label="I'm here: live camera" title="I'm here">
        <ScanFace size={28} />
      </button>
      {item("wallet", "Wallet", Wallet)}
      {item("profile", "Profile", User)}
    </nav>
  );
}
