/**
 * Traits: one quirk per person. Decides whisper fit and which miracles bite hardest.
 * Words: `trait.<id>.name`, `.line`, `.details` (words/people.ts).
 */
import type { TraitId } from '../types';

export interface TraitDef {
  /** Additive whisper-fit modifier to conversion odds, within ±0.15. */
  whisperFit: number;
  /** Contribution to base Resistance. */
  resistance: number;
}

export const TRAITS: Readonly<Record<TraitId, TraitDef>> = {
  greedy: { whisperFit: 0.1, resistance: 5 },
  pious: { whisperFit: -0.15, resistance: 25 },
  grieving: { whisperFit: 0.15, resistance: 0 },
  ambitious: { whisperFit: 0.05, resistance: 10 },
  fearful: { whisperFit: 0, resistance: 10 },
  curious: { whisperFit: 0.1, resistance: 5 },
  bitter: { whisperFit: 0.1, resistance: 0 },
  loyal: { whisperFit: -0.1, resistance: 15 },
};
