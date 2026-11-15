import type { Units } from "../anywhere/types";

/** The minimum an agent needs for chat: works for AgentSummary and AgentDetail. */
export interface ChatAgent {
  id: string;
  name: string;
  greeting: string;
  price_units: Units;
  price_usd: number;
}
