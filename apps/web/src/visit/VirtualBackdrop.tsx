import { useEffect, useRef } from "react";
import { ROUTE } from "./route";

const base = () => `${import.meta.env.BASE_URL}visit/`;

/** Crossfading photo stack with a slow Ken Burns move per stop and optional tilt parallax. */
export default function VirtualBackdrop({ stop }: { stop: number }) {
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null || !wrap.current) return;
      const x = Math.max(-1, Math.min(1, e.gamma / 30));
      const y = Math.max(-1, Math.min(1, (e.beta - 45) / 30));
      wrap.current.style.setProperty("--px", `${(-x * 14).toFixed(1)}px`);
      wrap.current.style.setProperty("--py", `${(-y * 10).toFixed(1)}px`);
    };
    window.addEventListener("deviceorientation", onTilt);
    return () => window.removeEventListener("deviceorientation", onTilt);
  }, []);

  return (
    <div className="backdrop virtual" ref={wrap} aria-hidden="true">
      {ROUTE.map((s, i) => (
        <div key={s.id} className={`vb-layer${i === stop ? " on" : ""}`}>
          <img className={`vb-img kb${i % 4}`} src={`${base()}${s.image}`} alt="" decoding="async" loading={i <= 1 ? "eager" : "lazy"} />
        </div>
      ))}
      <div className="backdrop-shade" />
    </div>
  );
}
