
import type { PlanType } from "../PlanType";

export type Account = { "type": "apiKey", } | { "type": "chatgpt", email: string | null, planType: PlanType, } | { "type": "amazonBedrock", usesCodexManagedCredentials: boolean, };
