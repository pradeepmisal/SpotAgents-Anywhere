import type { NearbyAgent } from "../types";

/**
 * The Shaniwar Wada route (ADR-010). Coordinates are APPROXIMATE positions at/inside the monument,
 * all within ~150 m of 18.5195, 73.8553. They are public landmark points, not surveyed.
 * Keep in sync with supabase/seed.sql (`agentName` must equal the seeded agent name).
 * Stop 0 is the street approach outside the gate and has no guide.
 */
export interface RouteStop {
  id: string;
  label: string;
  lat: number;
  lng: number;
  /** Photo in public/visit (credits in public/visit/CREDITS.json). */
  image: string;
  agentName: string | null;
}

export const ROUTE: RouteStop[] = [
  { id: "approach", label: "The street outside the gate", lat: 18.5207, lng: 73.8554, image: "01-approach.jpg", agentName: null },
  { id: "delhi-darwaza", label: "Delhi Darwaza", lat: 18.52, lng: 73.8553, image: "02-delhi-darwaza.jpg", agentName: "Delhi Darwaza Guide" },
  { id: "nagarkhana", label: "Nagarkhana", lat: 18.5197, lng: 73.8556, image: "03-nagarkhana.jpg", agentName: "Nagarkhana Guide" },
  { id: "courtyard", label: "Central courtyard", lat: 18.5193, lng: 73.8553, image: "04-courtyard.jpg", agentName: "Courtyard Guide" },
  { id: "ganesh-mahal", label: "Ganesh Mahal ruins", lat: 18.519, lng: 73.8551, image: "05-ruins.jpg", agentName: "Ganesh Mahal Guide" },
  { id: "hazari-karanje", label: "Hazari Karanje fountain", lat: 18.5192, lng: 73.8558, image: "06-fountain.jpg", agentName: "Hazari Karanje Guide" },
];

export const SPOT_COUNT = ROUTE.filter((s) => s.agentName).length;

export function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function stopForAgent(a: { name: string }): RouteStop | undefined {
  return ROUTE.find((s) => s.agentName === a.name);
}

/** Virtual mode: distance from the simulated position to each guide's route stop, computed locally. */
export function withLocalDistances(agents: NearbyAgent[], pos: { lat: number; lng: number }): NearbyAgent[] {
  return agents.map((a) => {
    const s = stopForAgent(a);
    return s ? { ...a, distance_m: Math.round(haversineM(pos, s)) } : a;
  });
}
