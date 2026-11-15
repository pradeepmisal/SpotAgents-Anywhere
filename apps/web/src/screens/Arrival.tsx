import { ArrowRight, MapPin, X } from "lucide-react";
import type { NearbyAgent } from "../types";
import { faceSrc, spotImage, spotName } from "../ui/spots";

export default function Arrival({ agent, onMeet, onClose }: { agent: NearbyAgent; onMeet: () => void; onClose: () => void }) {
  return (
    <div className="full arrival" role="dialog" aria-label={`You've arrived at ${spotName(agent)}`}>
      <div className="arr-photo" style={{ backgroundImage: `url(${spotImage(agent)})` }}>
        <div className="arr-top">
          <span />
          <button className="icon-btn onphoto" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>
        <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
      </div>
      <div className="arr-sheet">
        <span className="pinmark"><MapPin size={26} /></span>
        <p className="sub">You've arrived at</p>
        <h1>{spotName(agent)}</h1>
        <div className="arr-guide">
          <img src={faceSrc()} alt="" />
          <span><small>Your guide is here</small><strong>{agent.name}</strong></span>
        </div>
        <button className="btn primary block" onClick={onMeet}>Meet the guide <ArrowRight size={18} /></button>
      </div>
    </div>
  );
}
