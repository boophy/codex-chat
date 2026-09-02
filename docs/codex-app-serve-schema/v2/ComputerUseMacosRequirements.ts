
import type { AllowDenyRequirement } from "./AllowDenyRequirement";

export type ComputerUseMacosRequirements = { bundleIds: { [key in string]?: AllowDenyRequirement } | null, };
