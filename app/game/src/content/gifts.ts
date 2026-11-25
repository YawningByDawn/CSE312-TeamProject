/**
 * A building's gift (`useGift`, docs/town.md §3): `ap` action and its `nether`, then it rests `rest` nights.
 * rumour: one power's heat falls by `cool`; the tavern's regulars cost `regularsCost` of the Nether to turn.
 * debt: one who owes resists `resist` more; the Council's heat rises `council`.
 * food: laid up to `days` days ahead in a town area; poisoned, those there not yours are sick `sick` days, `deaths` of
 *   them dies and the town's heat rises `public`; blessed, yours there gain `devotion`.
 * records: `seals` seal falls from the writ; the Council's heat rises `council`.
 * guards: nobody is searched tomorrow, and the watch leaves the area's colour alone.
 * hearth (a home's, standing, not used): in the town a household more than half yours adds `hold` to its area each dawn.
 * road (standing, content's PLACES `boon`): each link of the crystals' road of yours adds `tithe` rolls to the day's tithe.
 * lesson (standing): with the school yours, every household with a child there is in reach.
 */
export const GIFTS = {
  ap: 1,
  rumour: { nether: 4, rest: 1, cool: 6, regularsCost: 0.5 },
  debt: { nether: 4, rest: 1, resist: -25, council: 1 },
  food: { nether: 6, rest: 2, days: 3, sick: 2, deaths: 1, public: 6, devotion: 8 },
  records: { nether: 8, rest: 3, seals: 1, council: 3 },
  guards: { nether: 6, rest: 2 },
  hearth: { hold: 1.5 },
  road: { tithe: 1 },
} as const;
