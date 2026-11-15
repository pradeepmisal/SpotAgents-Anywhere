import type { NearbyAgent } from "../types";

export const MOCK_LABEL = "Mock reply (?mock=1), not from the AI";

/** Mock SSE-equivalent used only with ?mock=1. Yields word chunks after a premium event. */
export async function* mockStream(agent: NearbyAgent, userText: string, turn: number): AsyncGenerator<string> {
  if (agent.price_yocto !== null && turn > 1) {
    // mirrors the real function: a paid, locked agent answers only the first turn
    throw Object.assign(new Error("payment_required"), { status: 402 });
  }
  yield JSON.stringify({ premium: false });
  const text = `[mock] ${agent.name} here. You said: "${userText}". This is a sample reply. It has two sentences.`;
  for (const w of text.split(/(?<=\s)/)) {
    await new Promise((r) => setTimeout(r, 40));
    yield JSON.stringify({ text: w });
  }
}
