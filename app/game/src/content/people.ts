/**
 * The named people: the mine's hunched, three-eyed burrowers with luminous crests. Each holds one place of their
 * trade's headcount; stats are rolled from the seed.
 * Words: `person.<id>.bio`.
 */
import type { PlaceId, RoleId, TraitId, UnitId } from '../types';

export interface PersonDef {
  id: UnitId;
  name: string;
  role: RoleId;
  trait: TraitId;
  work: PlaceId;
}

export const PEOPLE: readonly PersonDef[] = [
  { id: 'g01', name: 'Mara', role: 'digger', trait: 'grieving', work: 'grave' },
  { id: 'g02', name: 'Pim', role: 'digger', trait: 'curious', work: 'grave' },
  { id: 'g03', name: 'Hale', role: 'digger', trait: 'greedy', work: 'heartvein' },
  { id: 'g04', name: 'Wren', role: 'digger', trait: 'fearful', work: 'heartvein' },
  { id: 'g06', name: 'Ket', role: 'hauler', trait: 'ambitious', work: 'cartway' },
  { id: 'g07', name: 'Garr', role: 'hauler', trait: 'bitter', work: 'cartway' },
  { id: 'g11', name: 'Ilsa', role: 'chaplain', trait: 'pious', work: 'kilnshrine' },
  { id: 'g12', name: 'Tov', role: 'chaplain', trait: 'loyal', work: 'kilnshrine' },
  { id: 'g17', name: 'Overseer Varn', role: 'overseer', trait: 'ambitious', work: 'overseer' },
  { id: 'g18', name: 'Jude', role: 'pitguard', trait: 'fearful', work: 'overseer' },
  { id: 'g19', name: 'Yara', role: 'hauler', trait: 'curious', work: 'lift' },
  { id: 'g20', name: 'Osk', role: 'pitguard', trait: 'greedy', work: 'lift' },
  { id: 'g21', name: 'Brin', role: 'sorter', trait: 'greedy', work: 'sorting' },
  { id: 'g22', name: 'Ada', role: 'sorter', trait: 'ambitious', work: 'sorting' },
];
