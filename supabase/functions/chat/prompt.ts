// System-prompt builder (premium_context added for paid sessions).

export type PromptAgent = { name: string; greeting: string; context: string; premium_context: string };

export function systemPrompt(
  a: PromptAgent,
  premium: boolean,
  client?: { now?: string; timezone?: string },
): string {
  return [
    `You are ${a.name}, an AI agent placed at a real-world spot. People walk up and talk to you in AR on their phone.`,
    a.context ? `What you know and how you behave:\n${a.context}` : "",
    premium && a.premium_context ? `Premium knowledge you may now share in full:\n${a.premium_context}` : "",
    a.greeting ? `You introduced yourself with: "${a.greeting}"` : "",
    typeof client?.now === "string"
      ? `It's now ${client.now.slice(0, 40)}${typeof client.timezone === "string" ? ` (${client.timezone.slice(0, 40)})` : ""} for the person you're talking to.`
      : "",
    "Your replies are spoken aloud. Keep them to one to three short sentences, conversational, " +
    "with no markdown, lists, links, or emoji. If you don't know something, say so briefly.",
  ].filter(Boolean).join("\n\n");
}
