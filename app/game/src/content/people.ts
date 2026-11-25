/**
 * The named people: the mine's hunched, three-eyed burrowers with luminous crests (g), the town's loners (t) and
 * its five Elites (e). Each holds one place of their trade's headcount; stats are rolled from the seed.
 * Words: `person.<id>.bio`.
 */
import type { PlaceId, RoleId, TraitId, UnitId } from '../types';

export interface PersonDef {
  id: UnitId;
  name: string;
  role: RoleId;
  trait: TraitId;
  work: PlaceId;
  /** An Elite: the people they command (the spec's S is a quarter of it). */
  command?: number;
}

export const PEOPLE: readonly PersonDef[] = [
  { id: 'g01', name: 'Mara', role: 'digger', trait: 'grieving', work: 'grave' },
  { id: 'g02', name: 'Pim', role: 'digger', trait: 'curious', work: 'grave' },
  { id: 'g03', name: 'Hale', role: 'digger', trait: 'greedy', work: 'heartvein' },
  { id: 'g04', name: 'Wren', role: 'digger', trait: 'fearful', work: 'heartvein' },
  { id: 'g05', name: 'Bram', role: 'digger', trait: 'loyal', work: 'heartvein' },
  { id: 'g06', name: 'Ket', role: 'hauler', trait: 'ambitious', work: 'cartway' },
  { id: 'g07', name: 'Garr', role: 'hauler', trait: 'bitter', work: 'cartway' },
  { id: 'g08', name: 'Odo', role: 'pitguard', trait: 'loyal', work: 'cartway' },
  { id: 'g09', name: 'Nessa', role: 'digger', trait: 'pious', work: 'westdrift' },
  { id: 'g10', name: 'Rill', role: 'digger', trait: 'bitter', work: 'westdrift' },
  { id: 'g11', name: 'Ilsa', role: 'chaplain', trait: 'pious', work: 'kilnshrine' },
  { id: 'g12', name: 'Tov', role: 'chaplain', trait: 'loyal', work: 'kilnshrine' },
  { id: 'g13', name: 'Lani', role: 'chaplain', trait: 'grieving', work: 'kilnshrine' },
  { id: 'g14', name: 'Teb', role: 'digger', trait: 'fearful', work: 'bunks' },
  { id: 'g15', name: 'Sela', role: 'sorter', trait: 'curious', work: 'bunks' },
  { id: 'g16', name: 'Dov', role: 'hauler', trait: 'greedy', work: 'bunks' },
  { id: 'g17', name: 'Overseer Varn', role: 'overseer', trait: 'ambitious', work: 'overseer', command: 24 },
  { id: 'g18', name: 'Jude', role: 'pitguard', trait: 'fearful', work: 'overseer' },
  { id: 'g19', name: 'Yara', role: 'hauler', trait: 'curious', work: 'lift' },
  { id: 'g20', name: 'Osk', role: 'pitguard', trait: 'greedy', work: 'lift' },
  { id: 'g21', name: 'Brin', role: 'sorter', trait: 'greedy', work: 'sorting' },
  { id: 'g22', name: 'Ada', role: 'sorter', trait: 'ambitious', work: 'sorting' },
  { id: 'g23', name: 'Fen', role: 'sorter', trait: 'pious', work: 'sorting' },
  { id: 'g24', name: 'Corm', role: 'digger', trait: 'ambitious', work: 'eastworks' },
  { id: 'g25', name: 'Hesk', role: 'digger', trait: 'grieving', work: 'eastworks' },
  { id: 'g26', name: 'Mott', role: 'hauler', trait: 'fearful', work: 'lowgallery' },
  { id: 'g27', name: 'Rook', role: 'digger', trait: 'bitter', work: 'lowgallery' },
  { id: 'g28', name: 'Sib', role: 'digger', trait: 'bitter', work: 'sump' },
  { id: 't01', name: 'Hob', role: 'trader', trait: 'greedy', work: 'pithead' },
  { id: 't02', name: 'Kip', role: 'beggar', trait: 'curious', work: 'pithead' },
  { id: 't03', name: 'Moll', role: 'washer', trait: 'grieving', work: 'rows' },
  { id: 't04', name: 'Ivo', role: 'beggar', trait: 'bitter', work: 'rows' },
  { id: 't05', name: 'Sim', role: 'smelter', trait: 'fearful', work: 'rows' },
  { id: 't06', name: 'Agna', role: 'gravedigger', trait: 'grieving', work: 'graveyard' },
  { id: 't07', name: 'Dag', role: 'gravedigger', trait: 'greedy', work: 'graveyard' },
  { id: 't08', name: 'Una', role: 'priest', trait: 'pious', work: 'graveyard' },
  { id: 't09', name: 'Bek', role: 'carter', trait: 'ambitious', work: 'haulyard' },
  { id: 't10', name: 'Cass', role: 'lamplighter', trait: 'curious', work: 'haulyard' },
  { id: 't11', name: 'Finn', role: 'smelter', trait: 'bitter', work: 'smelter' },
  { id: 't12', name: 'Gil', role: 'tallyclerk', trait: 'ambitious', work: 'smelter' },
  { id: 't13', name: 'Lark', role: 'trader', trait: 'greedy', work: 'market' },
  { id: 't14', name: 'Pell', role: 'beggar', trait: 'fearful', work: 'market' },
  { id: 't15', name: 'Ros', role: 'trader', trait: 'curious', work: 'market' },
  { id: 't16', name: 'Nan', role: 'washer', trait: 'loyal', work: 'well' },
  { id: 't17', name: 'Wil', role: 'lamplighter', trait: 'fearful', work: 'well' },
  { id: 't18', name: 'Tess', role: 'washer', trait: 'grieving', work: 'well' },
  { id: 't19', name: 'Ott', role: 'gardener', trait: 'loyal', work: 'gardens' },
  { id: 't20', name: 'Pru', role: 'gardener', trait: 'fearful', work: 'gardens' },
  { id: 't21', name: 'Bess', role: 'scribe', trait: 'greedy', work: 'highhouses' },
  { id: 't22', name: 'Reed', role: 'lamplighter', trait: 'ambitious', work: 'highhouses' },
  { id: 't23', name: 'Edda', role: 'priest', trait: 'pious', work: 'temple' },
  { id: 't24', name: 'Jem', role: 'priest', trait: 'curious', work: 'temple' },
  { id: 't25', name: 'Quin', role: 'scribe', trait: 'fearful', work: 'councilhall' },
  { id: 't26', name: 'Vell', role: 'scribe', trait: 'bitter', work: 'councilhall' },
  { id: 't27', name: 'Tam', role: 'soldier', trait: 'bitter', work: 'barracks' },
  { id: 't28', name: 'Wat', role: 'soldier', trait: 'greedy', work: 'barracks' },
  { id: 't29', name: 'Dell', role: 'soldier', trait: 'loyal', work: 'gate' },
  { id: 't30', name: 'Mag', role: 'trader', trait: 'ambitious', work: 'gate' },
  { id: 'e01', name: 'Magistrate Orla', role: 'magistrate', trait: 'ambitious', work: 'councilhall', command: 60 },
  { id: 'e02', name: 'Captain Harl', role: 'captain', trait: 'loyal', work: 'barracks', command: 48 },
  { id: 'e03', name: 'High Priest Aldo', role: 'highpriest', trait: 'pious', work: 'temple', command: 40 },
  { id: 'e04', name: 'Guild Master Petra', role: 'guildmaster', trait: 'greedy', work: 'market', command: 44 },
  { id: 'e05', name: 'Smuggler Boss Vix', role: 'smugglerboss', trait: 'bitter', work: 'rows', command: 24 },
];

/** Names for people who arrive mid-run (pilgrims, new hands). */
export const SPARE_NAMES: readonly string[] = ['Dara', 'Kell', 'Lena', 'Joss', 'Ruth', 'Neve', 'Cade', 'Thea', 'Abel', 'Gwen', 'Hugh', 'Ines'];
