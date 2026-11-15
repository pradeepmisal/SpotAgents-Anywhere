import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { NearbyAgent } from "../types";
import { DEMO_CITY } from "../types";
import { stopForAgent } from "../visit/route";
import { faceSrc } from "../ui/spots";

interface Props {
  agents: NearbyAgent[];
  user: { lat: number; lng: number } | null;
  onOpen: (a: NearbyAgent) => void;
}

// CARTO Positron raster tiles (https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png, attribution
// "(c) OpenStreetMap contributors (c) CARTO") now answer every tile with an "API KEY REQUIRED" watermark
// (verified 2026-11-14), so we use the OSM standard tiles, toned down to a light look with CSS (.map .leaflet-tile-pane).
const TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTR = "&copy; OpenStreetMap contributors";

/** Interactive Leaflet map (light OSM tiles) with a round guide thumbnail per spot. */
export default function MapView({ agents, user, onOpen }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const openRef = useRef(onOpen);
  openRef.current = onOpen;
  const fitted = useRef(false);

  useEffect(() => {
    const m = L.map(el.current!, { zoomControl: false, attributionControl: true, scrollWheelZoom: false }).setView([DEMO_CITY.lat, DEMO_CITY.lng], 17);
    L.tileLayer(TILES, { attribution: ATTR, maxZoom: 19 }).addTo(m);
    m.attributionControl.setPrefix(false);
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(el.current!);
    return () => { ro.disconnect(); m.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    const m = map.current, g = layer.current;
    if (!m || !g) return;
    g.clearLayers();
    const pts: L.LatLngTuple[] = [];
    if (user) {
      pts.push([user.lat, user.lng]);
      L.circle([user.lat, user.lng], { radius: 28, color: "#1F8A4C", weight: 1, fillColor: "#1F8A4C", fillOpacity: 0.14 }).addTo(g);
      L.marker([user.lat, user.lng], { icon: L.divIcon({ className: "pin-wrap", html: '<div class="you-dot"></div>', iconSize: [16, 16], iconAnchor: [8, 8] }), interactive: false, keyboard: false }).addTo(g);
    }
    for (const a of agents) {
      const s = stopForAgent(a);
      if (!s) continue;
      pts.push([s.lat, s.lng]);
      const icon = L.divIcon({
        className: "pin-wrap",
        html: `<div class="pin" style="background-image:url(${faceSrc()})"></div>`,
        iconSize: [40, 40], iconAnchor: [20, 20],
      });
      L.marker([s.lat, s.lng], { icon, title: a.name, alt: a.name }).on("click", () => openRef.current(a)).addTo(g);
    }
    if (pts.length > (user ? 1 : 0) && !fitted.current) { m.fitBounds(L.latLngBounds(pts), { padding: [34, 34], maxZoom: 18 }); fitted.current = true; }
  }, [agents, user]);

  return <div className="map" ref={el} role="application" aria-label="Map of guides around Shaniwar Wada" />;
}
