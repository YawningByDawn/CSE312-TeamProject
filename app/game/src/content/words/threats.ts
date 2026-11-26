/** The opposition's moves (threats.ts): a name, what happens when it lands, the answers, and the help lines. */
export const THREAT_WORDS: Readonly<Record<string, string>> = {
  'threat.inspection.name': 'The Inspection',
  'threat.inspection.lands': 'the inspector walks the galleries and takes what he finds on yours',
  'threat.crackdown.name': 'The Crackdown',
  'threat.crackdown.lands': 'the overseer turns every gallery where yours work or sleep inside out',
  'threat.lockdown.name': 'Lockdown',
  'threat.lockdown.lands': 'the lift gate slams: nobody goes up, the garrison comes down, and your strongholds are raided one each dawn',
  'threat.vigil.name': 'Vigils',
  'threat.vigil.lands': 'priests hold vigil through the night: every soul resists you a little harder',
  'threat.inquisitor.name': 'The Inquisitor',
  'threat.inquisitor.lands': 'the Inquisitor walks among yours and sings: the exposed lose faith',
  'threat.purge.name': 'The Naming',
  'threat.purge.lands': 'the High Priest gives one of yours to the fire',
  'threat.crusade.name': 'The Crusade',
  'threat.crusade.lands': 'the Flame’s fires burn wherever your faithful gather, for {days} days',
  'threat.bolted.name': 'Bolted Doors',
  'threat.bolted.lands': 'doors are bolted and ears stopped up: every whisper is harder now',
  'threat.mob.name': 'The Mob',
  'threat.mob.lands': 'a mob hunts for anyone praying to the wrong wall',
  'threat.riot.name': 'Riot',
  'threat.riot.lands': 'the streets riot, and the mob beats whoever of yours it finds',

  'answer.hide.name': 'lying low',
  'answer.cool.name': 'cooling the track',
  'answer.agent.name': 'turning the one sent to do it',

  'rule.crusade': 'When the Temple is Kindling it calls a crusade. It reaches the mine in {days} days and burns wherever your faithful gather, unless lying low or a cooler Temple stops it.',
};
