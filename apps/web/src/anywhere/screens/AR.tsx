import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Compass } from "lucide-react";
import type { AgentSummary } from "../types";
import { bearingDeg, formatDistance, haversineM } from "../geo";
import type { LatLng } from "../geo";
import { Face } from "../parts";

interface Props { agents: AgentSummary[]; from: LatLng; onClose: () => void; onOpen: (a: AgentSummary) => void }

const FOV = 70; // horizontal degrees across the screen
type DOE = DeviceOrientationEvent & { webkitCompassHeading?: number };

/** Camera background with agent markers placed by GPS bearing against the compass heading. A list is always available as fallback. */
export default function ARFinder({ agents, from, onClose, onOpen }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const [cam, setCam] = useState<"wait" | "ok" | "off">("wait");
  const [heading, setHeading] = useState<number | null>(null);
  const [needPerm, setNeedPerm] = useState(false);
  const [pos, setPos] = useState<LatLng>(from);

  useEffect(() => {
    let stream: MediaStream | undefined;
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then((s) => { stream = s; if (video.current) { video.current.srcObject = s; void video.current.play().catch(() => {}); } setCam("ok"); })
      .catch(() => setCam("off"));
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, []);

  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    const id = navigator.geolocation.watchPosition((p) => setPos({ lat: p.coords.latitude, lng: p.coords.longitude }), () => {}, { enableHighAccuracy: true });
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  const listen = () => {
    const on = (e: Event) => {
      const o = e as DOE;
      if (typeof o.webkitCompassHeading === "number") setHeading(o.webkitCompassHeading);
      else if (o.alpha != null) setHeading((360 - o.alpha) % 360);
    };
    window.addEventListener("deviceorientationabsolute", on as EventListener, true);
    window.addEventListener("deviceorientation", on as EventListener, true);
  };
  useEffect(() => {
    const D = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
    if (typeof D.requestPermission === "function") setNeedPerm(true); // iOS: needs a tap
    else listen();
  }, []);
  const askPerm = () => {
    const D = DeviceOrientationEvent as unknown as { requestPermission: () => Promise<string> };
    D.requestPermission().then((r) => { if (r === "granted") { listen(); setNeedPerm(false); } }).catch(() => {});
  };

  const near = agents.map((a) => ({ a, d: haversineM(pos, a), b: bearingDeg(pos, a) })).sort((x, y) => x.d - y.d);
  const visible = heading == null ? [] : near.slice(0, 12).map((n) => {
    const diff = ((n.b - heading + 540) % 360) - 180;
    return { ...n, x: 50 + (diff / FOV) * 100, show: Math.abs(diff) < FOV / 2 };
  }).filter((n) => n.show);

  return (
    <div className="experience ar">
      <div className="backdrop">{cam === "ok" && <video ref={video} playsInline muted autoPlay />}{cam !== "ok" && <div className="ar-nocam" />}</div>
      <div className="exp-bar">
        <button className="icon-btn onphoto" onClick={onClose} aria-label="Close AR finder"><ArrowLeft size={20} /></button>
        <span className="badge sim"><Compass size={12} /> {heading == null ? "Compass not available" : `Facing ${Math.round(heading)}°`}</span>
      </div>
      {visible.map((n) => (
        <button key={n.a.id} className="ar-marker" style={{ left: `${n.x}%`, top: `${30 + Math.min(n.d / 20000, 1) * 20}%` }} onClick={() => onOpen(n.a)}>
          <Face a={n.a} size={44} />
          <strong>{n.a.name}</strong>
          <small>{formatDistance(n.d)}</small>
        </button>
      ))}
      {needPerm && <button className="btn primary ar-perm" onClick={askPerm}>Enable compass</button>}
      {cam === "off" && <p className="ar-msg">Camera unavailable. Use the list below.</p>}
      <div className="ar-list">
        <h3>Nearest agents</h3>
        {near.slice(0, 5).map((n) => (
          <button key={n.a.id} className="arow" onClick={() => onOpen(n.a)}>
            <Face a={n.a} size={40} />
            <span className="arow-b"><strong>{n.a.name}</strong><small>{n.a.place_name || n.a.city} · bearing {Math.round(n.b)}°</small></span>
            <span className="arow-r"><small>{formatDistance(n.d)}</small></span>
          </button>
        ))}
      </div>
    </div>
  );
}
