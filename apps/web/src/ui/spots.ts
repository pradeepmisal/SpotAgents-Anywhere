import type { NearbyAgent } from "../types";
import { stopForAgent } from "../visit/route";

const base = () => import.meta.env.BASE_URL;
/** Static crop of the 3D guide's face (public/avatars/guide-face.jpg). */
export const faceSrc = () => `${base()}avatars/guide-face.jpg`;
export const spotImage = (a: NearbyAgent) => `${base()}visit/${stopForAgent(a)?.image ?? "01-approach.jpg"}`;
export const stopImage = (file: string) => `${base()}visit/${file}`;
/** "Delhi Darwaza Guide" -> "Delhi Darwaza". */
export const spotName = (a: { name: string }) => a.name.replace(/ Guide$/, "");

const SUGGEST: Record<string, string[]> = {
  "delhi-darwaza": ["Why was it built?", "Key historical events", "Tell me a lesser-known story"],
  nagarkhana: ["What was the drum house for?", "Key historical events", "Tell me a lesser-known story"],
  courtyard: ["What stood here?", "Key historical events", "Tell me a lesser-known story"],
  "ganesh-mahal": ["What happened to it?", "Key historical events", "Tell me a lesser-known story"],
  "hazari-karanje": ["How did the fountain work?", "Key historical events", "Tell me a lesser-known story"],
};
export function suggestionsFor(a: NearbyAgent): string[] {
  const id = stopForAgent(a)?.id;
  return (id && SUGGEST[id]) || ["Why was it built?", "Key historical events", "Tell me a lesser-known story"];
}
