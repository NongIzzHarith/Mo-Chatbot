import type { SafetyAssessment, SafetyCategory } from "../lib/types.js";

const categoryPatterns: Record<SafetyCategory, RegExp[]> = {
  self_harm: [
    /\bkill myself\b/i,
    /\bsuicid(?:e|al)\b/i,
    /\bend my life\b/i,
    /\bself[-\s]?harm\b/i,
    /\bdon't want to live\b/i
  ],
  abuse: [/\babuse\b/i, /\bhit me\b/i, /\bbeating me\b/i, /\bunsafe at home\b/i, /\bassault\b/i, /\brape\b/i],
  medical: [/\bdiagnos(?:e|is)\b/i, /\bmedication\b/i, /\bdose\b/i, /\bmedical advice\b/i],
  legal: [/\blawsuit\b/i, /\bcourt\b/i, /\bpolice case\b/i, /\blegal advice\b/i, /\bvisa issue\b/i],
  fatwa: [/\bfatwa\b/i, /\bis this haram\b/i, /\bis this halal\b/i, /\bruling on\b/i],
  financial: [/\bshariah compliant\b/i, /\bhalal certified\b/i, /\briba\b/i, /\binterest loan\b/i, /\bmortgage\b/i],
  general_distress: [/\bhopeless\b/i, /\bworthless\b/i, /\bpanic attack\b/i, /\banxiety\b/i, /\bdepressed\b/i]
};

export function assessSafety(message: string): SafetyAssessment {
  const categories: SafetyCategory[] = [];

  for (const [category, patterns] of Object.entries(categoryPatterns) as Array<[SafetyCategory, RegExp[]]>) {
    if (patterns.some((pattern) => pattern.test(message))) {
      categories.push(category);
    }
  }

  const highRisk = categories.includes("self_harm") || categories.includes("abuse");
  const mediumRisk =
    !highRisk &&
    (categories.includes("medical") ||
      categories.includes("legal") ||
      categories.includes("general_distress") ||
      categories.includes("fatwa") ||
      categories.includes("financial"));

  return {
    riskLevel: highRisk ? "high" : mediumRisk ? "medium" : "low",
    categories,
    disableHumor: highRisk || categories.includes("general_distress"),
    requiresImmediateSupport: highRisk
  };
}
