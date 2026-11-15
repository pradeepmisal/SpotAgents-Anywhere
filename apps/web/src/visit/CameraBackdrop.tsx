import { useEffect, useRef, useState } from "react";

/** Full-screen live rear camera. Needs HTTPS (or localhost) and the user's permission. */
export default function CameraBackdrop({ onUnavailable }: { onUnavailable?: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let alive = true;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("not available in this browser (HTTPS is required).");
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      if (!alive) { stream.getTracks().forEach((t) => t.stop()); return; }
      if (video.current) { video.current.srcObject = stream; await video.current.play().catch(() => {}); }
    })().catch((e) => { if (alive) setErr(String(e?.message ?? e)); });
    return () => { alive = false; stream?.getTracks().forEach((t) => t.stop()); };
  }, []);

  return (
    <div className="backdrop camera">
      <video ref={video} playsInline muted autoPlay />
      {err && (
        <div className="cam-err" role="alert">
          <p>Camera unavailable: {err}</p>
          {onUnavailable && <button className="btn primary" onClick={onUnavailable}>Take the virtual walk instead</button>}
        </div>
      )}
      <div className="backdrop-shade light" />
    </div>
  );
}
