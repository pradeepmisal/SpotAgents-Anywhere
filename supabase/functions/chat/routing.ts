// Which NEAR AI model an agent's turn runs on, and the request body for it.

export const NEARAI_URL = "https://cloud-api.near.ai/v1/chat/completions";
export const DEFAULT_MODEL = "z-ai/glm-5.3-flash";
export const MAX_TOKENS = 300;

/** agents.model if set, else the NEARAI_MODEL secret, else the built-in default. */
export function modelFor(agent: { model: string | null }, envModel: string | undefined): string {
  return agent.model || envModel || DEFAULT_MODEL;
}

/**
 * Request body. `reasoning_effort: "low"` keeps glm-5.3-flash's thinking to ~0 tokens
 * (verified in T13); `enable_thinking: false` is NOT used, it leaks reasoning into content.
 */
export function completionBody(model: string, messages: unknown[]): Record<string, unknown> {
  return { model, stream: true, max_tokens: MAX_TOKENS, reasoning_effort: "low", messages };
}
