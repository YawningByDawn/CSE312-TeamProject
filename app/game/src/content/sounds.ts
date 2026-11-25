/**
 * What audio plays for each event kind and each film (#124, #125): names of assets/audio/manifest.json. A number
 * picks `up` or `down` by its move (against the event's `was` when it has one); null is silent: the HUD shows it.
 */
import type { SoundTables } from '../types';

export const SOUNDS: SoundTables = {
  cues: {
    dawn: 'dawnBell', shiftStart: 'liftRide', shiftEnd: 'liftRide', dusk: 'duskBell', night: null,
    weather: { by: 'weather', names: { storm: 'thunderFar' } },
    strike: { by: 'grade', names: { dull: 'crystalCommon', clear: 'crystalUncommon', bright: 'crystalUncommon', blazing: 'crystalRare', royal: 'crystalRare', impossible: 'crystalLegendary' } },
    pocket: 'pocket', cart: 'cartRoll', tribute: 'tribute', offer: 'offeringSet', tithe: 'tribute', seep: 'tribute',
    count: { by: 'forgiven', names: { true: 'tallyTick', false: 'tallyShort' } },
    search: 'search', exposed: 'exposed',
    whisper: { by: 'ok', names: { true: 'whisper', false: 'convertFail' } }, turned: 'convert', lost: 'death', gone: null,
    routine: { by: 'routine', names: { pray: 'routinePray', offer: 'routineOffer', lieLow: 'routineLieLow', delve: 'apSpend', skim: 'apSpend', preach: 'apSpend', standWatch: 'apSpend' } },
    moved: { by: 'ok', names: { true: 'moveOk', false: 'moveFail' } },
    deal: 'cardDeal', took: 'cardPick', discarded: 'cardSkip',
    play: { by: 'cardKind', names: { miracle: 'cardPlayMiracle', evil: 'cardPlayEvil' } },
    eat: 'eatCrystal', set: 'socket', unset: 'uiBack', enchant: 'enchant', curse: 'curse', facet: 'cut', recombine: 'recombine',
    item: { by: 'how', names: { made: 'forgeJewel', given: 'giveItem', takenBack: 'uiBack' } },
    devour: 'devour',
    hold: { by: 'hold', names: { up: 'holdGain', down: 'holdLoss' } },
    suspicion: { by: 'level', names: { up: 'suspicionUp' } },
    threat: { by: 'how', names: { announced: 'thresholdAlarm', landed: 'lockdown', answered: 'uiBack' } },
    building: { by: 'yours', names: { true: 'facilityGained', false: 'holdLoss' } },
    ichor: { by: 'delta', names: { up: 'gorge', down: 'ichorLoss' } },
    hunger: null, malice: null, nether: null, xp: null,
    starve: 'ravenous', lashOut: 'maliceOutburst', rank: 'levelUp', deepOpen: 'discover', found: 'discover', vaultOpen: 'reveal',
    stage: 'stageUp', story: 'eventOpen', end: { by: 'won', names: { true: 'victory', false: 'defeat' } },
  },
  films: {
    opening: [],
    watershed: [{ at: 0, sfx: 'reveal' }, { at: 1.8, sfx: 'stageUp' }, { at: 5, sfx: 'liftRide' }, { at: 14.5, stinger: 'watershedBloom' }],
    ending: [{ at: 0, sfx: 'reveal' }, { at: 2, stinger: 'shadeTop' }, { at: 10.5, sfx: 'liftRide' }, { at: 22.5, stinger: 'cityAnswer' }, { at: 28.4, sfx: 'reveal' }],
    take: [{ at: 0, stinger: 'bestFind' }],
  },
};
