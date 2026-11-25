/** The blessings and the set stones, summed: every rule number a blessing, a stone's line, field or odd effect, or a set power moves. */
import { BLESSING } from '../content/blessings';
import { EFFECT } from '../content/crystals';
import { fieldTotal, lineTotal, oddCount, setPower } from './crystals';
import type { GameState } from '../types';

const N = BLESSING;
export const blessed = (s: Readonly<GameState>, b: string): boolean => s.god.blessings.includes(b);

export function bonus(s: Readonly<GameState>, k: Bonus): number {
  switch (k) {
    case 'nether': return lineTotal(s, 'nether');
    case 'hungerSlow': return lineTotal(s, 'hungerSlow') + (blessed(s, 'patientHunger') ? N.hungerSlow : 0) + (setPower(s, 'hunger') ? 2 : 0);
    case 'maliceSlow': return lineTotal(s, 'maliceSlow') + (setPower(s, 'malice') ? 2 : 0);
    case 'whisperOdds': return lineTotal(s, 'whisperOdds') / 100 + (blessed(s, 'sweetVoice') ? N.conversion : 0) + (setPower(s, 'faith') ? 0.05 : 0);
    case 'strikeLuck': return lineTotal(s, 'strikeLuck') + (blessed(s, 'luckyVein') ? N.strikeLuck : 0) + (setPower(s, 'stone') ? 10 : 0);
    case 'strikeRate': return lineTotal(s, 'strikeRate') / 100 + (blessed(s, 'deepPockets') ? N.strikeRate : 0);
    case 'miraclePower': return lineTotal(s, 'miraclePower') / 100 + (setPower(s, 'flame') ? 0.2 : 0);
    case 'calm': return Math.min(0.8, lineTotal(s, 'calm') / 100 + (blessed(s, 'quietRot') ? N.calm : 0) + (setPower(s, 'fear') ? 0.1 : 0));
    case 'ichorMax': return Math.floor(lineTotal(s, 'ichor')) + (blessed(s, 'oldScars') ? N.ichorMax : 0) + (blessed(s, 'stoneSkin') ? N.stoneSkinIchor : 0) + (setPower(s, 'blood') ? 2 : 0);
    case 'devotion': return lineTotal(s, 'devotion') + (setPower(s, 'faith') ? 1 : 0);
    case 'stain': return lineTotal(s, 'stain') / 100;
    case 'ap': return Math.floor(lineTotal(s, 'actionPoint')) + (blessed(s, 'restless') ? N.ap : 0);
    case 'sockets': return blessed(s, 'lingeringThrone') ? N.sockets : 0;
    case 'dealMiracles': return oddCount(s, 'prophet') + (blessed(s, 'thirdHand') ? N.draws : 0) + Math.floor(fieldTotal(s, 'miracleDraw'));
    case 'dealEvils': return oddCount(s, 'spite') + Math.floor(fieldTotal(s, 'evilDraw'));
    case 'hand': return blessed(s, 'thirdHand') ? N.draws : 0;
    case 'blessingChoices': return oddCount(s, 'secondSight') + Math.floor(fieldTotal(s, 'blessingChoices'));
    case 'rerolls': return oddCount(s, 'loaded') + (blessed(s, 'secondChance') ? N.rerolls : 0) + Math.floor(fieldTotal(s, 'rerolls'));
    case 'freeWhispers': return oddCount(s, 'murmur') + Math.floor(fieldTotal(s, 'freeWhispers')) + (setPower(s, 'echo') ? 1 : 0);
    case 'searchMult': return (blessed(s, 'pickpocket') ? N.searchMult : 1) * Math.max(0.2, 1 - fieldTotal(s, 'searchCut') / 100) * (setPower(s, 'shadow') ? 0.75 : 1);
    case 'tributeOdds': return fieldTotal(s, 'tributeOdds') / 100;
    case 'eatNether': return oddCount(s, 'glutton') * EFFECT.gluttonNetherPerValue + (blessed(s, 'appetite') ? N.eatNether : 0) + fieldTotal(s, 'eatNether');
    case 'maliceMult': return blessed(s, 'cruelDelight') ? N.maliceMult : 1;
    case 'tolerance': return oddCount(s, 'heavyHeart') * EFFECT.heavyHeartTolerance + fieldTotal(s, 'tolerance');
    case 'seep': return (blessed(s, 'graveRobber') ? N.seepExtra : 0) + Math.floor(fieldTotal(s, 'seep'));
    case 'offerExtra': return oddCount(s, 'tithe') + Math.floor(fieldTotal(s, 'offerExtra'));
  }
}
export type Bonus =
  | 'nether' | 'hungerSlow' | 'maliceSlow' | 'whisperOdds' | 'strikeLuck' | 'strikeRate' | 'miraclePower' | 'calm' | 'ichorMax'
  | 'devotion' | 'stain' | 'ap' | 'sockets' | 'dealMiracles' | 'dealEvils' | 'hand' | 'blessingChoices' | 'rerolls'
  | 'freeWhispers' | 'searchMult' | 'tributeOdds' | 'eatNether' | 'maliceMult' | 'tolerance' | 'seep' | 'offerExtra';
