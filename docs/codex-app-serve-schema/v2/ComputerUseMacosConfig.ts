
import type { AllowDenyRequirement } from "./AllowDenyRequirement";

export type ComputerUseMacosConfig = { bundle_ids: { [key in string]?: AllowDenyRequirement } | null, };
