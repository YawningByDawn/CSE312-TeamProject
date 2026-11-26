/** What the rules need to know about the mine beyond the world graph. */
export const STAGE = {
  /** The leader named in the crackdown. */
  crackdownLeader: 'g17',
  /** Skimmers allowed per area per day. */
  skimCap: 2,
  /** Areas a cave-in can hit. */
  caveInAreas: ['eastworks', 'westdrift', 'lowgallery', 'heartvein'],
} as const;
