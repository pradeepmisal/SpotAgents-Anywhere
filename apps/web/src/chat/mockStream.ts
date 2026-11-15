import type { ChatAgent } from "./agent";

export const MOCK_LABEL = "Mock reply (?mock=1), not from the AI";

/** Set of agent ids unlocked in mock mode (by the mock tour-agent payment). */
export const mockUnlocked = new Set<string>();

/** Mock SSE-equivalent used only with ?mock=1: first turn free, later turns need an unlock (like ax-chat). */
export async function* mockStream(agent: ChatAgent, userText: string, turn: number): AsyncGenerator<string> {
  const premium = mockUnlocked.has(agent.id);
  if (turn > 1 && !premium) {
    throw Object.assign(new Error("payment_required"), { status: 402 });
  }
  yield JSON.stringify({ premium });
  const text = `[mock] ${agent.name} here. You said: "${userText}". This is a sample reply. It has two sentences.`;
  for (const w of text.split(/(?<=\s)/)) {
    await new Promise((r) => setTimeout(r, 40));
    yield JSON.stringify({ text: w });
  }
}
