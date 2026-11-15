import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { AgentSummary } from "./types";
import type { LatLng } from "./geo";
import { initials } from "./parts";

// OSM standard tiles, toned down with CSS (.map .leaflet-tile-pane). CARTO raster tiles now need an API key.
const TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTR = "&copy; OpenStreetMap contributors";

interface Props {
  agents?: AgentSummary[];
  center: LatLng;
  /** Zoom used when the centre changes. */
  zoom?: number;
  /** Show the visitor dot at `center`. */
  showYou?: boolean;
  onOpen?: (a: AgentSummary) => void;
  /** Studio mode: tap the map to move the pin. */
  pin?: LatLng | null;
  onPin?: (p: LatLng) => void;
  label: string;
}

/** Leaflet map: agent markers (coloured initials), the visitor dot, or a draggable studio pin. */
export default function AxMap({ agents = [], center, zoom = 12, showYou = true, onOpen, pin, onPin, label }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const openRef = useRef(onOpen); openRef.current = onOpen;
  const pinRef = useRef(onPin); pinRef.current = onPin;

  useEffect(() => {
    const m = L.map(el.current!, { zoomControl: false, attributionControl: true, scrollWheelZoom: false, worldCopyJump: true }).setView([center.lat, center.lng], zoom);
    L.tileLayer(TILES, { attribution: ATTR, maxZoom: 19 }).addTo(m);
    m.attributionControl.setPrefix(false);
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    m.on("click", (e: L.LeafletMouseEvent) => pinRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng }));
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(el.current!);
    return () => { ro.disconnect(); m.remove(); map.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { map.current?.setView([center.lat, center.lng], zoom, { animate: true }); }, [center.lat, center.lng, zoom]);

  useEffect(() => {
    const g = layer.current;
    if (!g) return;
    g.clearLayers();
    if (showYou) {
      L.circle([center.lat, center.lng], { radius: 150, color: "#1F8A4C", weight: 1, fillColor: "#1F8A4C", fillOpacity: 0.14, interactive: false }).addTo(g);
      L.marker([center.lat, center.lng], { icon: L.divIcon({ className: "pin-wrap", html: '<div class="you-dot"></div>', iconSize: [16, 16], iconAnchor: [8, 8] }), interactive: false, keyboard: false }).addTo(g);
    }
    for (const a of agents) {
      const icon = L.divIcon({ className: "pin-wrap", html: `<div class="pin" style="background:${a.color || "#1f8a4c"}">${initials(a.name)}</div>`, iconSize: [38, 38], iconAnchor: [19, 19] });
      L.marker([a.lat, a.lng], { icon, title: a.name, alt: a.name }).on("click", () => openRef.current?.(a)).addTo(g);
    }
    if (pin) {
      L.circle([pin.lat, pin.lng], { radius: 60, color: "#1F8A4C", weight: 1, fillColor: "#1F8A4C", fillOpacity: 0.18, interactive: false }).addTo(g);
      L.marker([pin.lat, pin.lng], { icon: L.divIcon({ className: "pin-wrap", html: '<div class="pin studio">+</div>', iconSize: [38, 38], iconAnchor: [19, 19] }), interactive: false }).addTo(g);
    }
  }, [agents, center.lat, center.lng, showYou, pin]);

  return <div className="map" ref={el} role="application" aria-label={label} />;
}
