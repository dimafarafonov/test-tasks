// README "Thresholds config". All limits inclusive.
export interface Thresholds {
  ruleAmount: string;
  ruleTimeSeconds: string;
  fuzzySimilarity: string;
  fuzzyAmount: string;
  fuzzyTimeSeconds: string;
}

// Strings, not numbers: parsed by decimal.js, so no float error at the limit.
export const DEFAULT_THRESHOLDS: Readonly<Thresholds> = Object.freeze({
  ruleAmount: '0.02',
  ruleTimeSeconds: '2',
  fuzzySimilarity: '0.75',
  fuzzyAmount: '0.10',
  fuzzyTimeSeconds: '2',
});
