import type { NearbyAgent } from "./types";

// ?mock=1 fixtures: the five Shaniwar Wada guides (names match src/visit/route.ts).
// 0.1 NEAR = 10^23 yoctoNEAR, kept as a decimal string (no floats).
const PAID = "100000000000000000000000";
const g = (n: number, name: string, emoji: string, color: string, avatar: string, greeting: string, price: string | null, d: number): NearbyAgent => ({
  id: `mock-${n}`, name, emoji, color, avatar, voice: null, greeting, radius_m: 25, price_yocto: price,
  creator_account: price ? "sweetfrog-creator.testnet" : null, is_mine: false, distance_m: d,
});

export const MOCK_AGENTS: NearbyAgent[] = [
  g(1, "Delhi Darwaza Guide", "🚪", "#c8782a", "knight", "Welcome to Delhi Darwaza, the great northern gate.", null, 60),
  g(2, "Nagarkhana Guide", "🥁", "#a4452c", "knight", "Hello from the Nagarkhana, the drum house above the gate.", null, 80),
  g(3, "Courtyard Guide", "🏛️", "#d9a441", "mage", "Welcome to the central courtyard.", PAID, 120),
  g(4, "Ganesh Mahal Guide", "🪔", "#8a3b2e", "mage", "You are at the ruins of the Ganesh Mahal.", PAID, 160),
  g(5, "Hazari Karanje Guide", "⛲", "#2f7f79", "mage", "This is the Hazari Karanje, the lotus fountain.", PAID, 180),
];
