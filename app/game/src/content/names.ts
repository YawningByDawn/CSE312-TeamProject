/** Name parts and the words a generated name must not be (DECISIONS §13.3: plain, short, one name each; docs/theme.md §10). */

export const ON = ['B', 'D', 'G', 'H', 'K', 'L', 'M', 'N', 'P', 'R', 'S', 'T', 'V', 'W', 'J', 'F', 'Br', 'Gr', 'Tr', 'Dr', 'Kr', 'St', 'Sk', 'Th', 'Fl', 'Bl', 'Gw', 'Y'];
export const VO = ['a', 'e', 'i', 'o', 'u', 'a', 'e', 'o', 'ea', 'oa', 'ai'];
export const CO = ['n', 'm', 'l', 'r', 's', 'k', 't', 'd', 'g', 'sk', 'rn', 'll', 'ss', 'th', 'nd', 'rk', 'b', 'p', 'v', 'rt', 'lt'];
export const END = ['a', 'o', 'e', 'i', 'en', 'in', 'an', 'el', 'is', 'et', 'ard', 'ny', 'wyn', 'ra', 'la', 'na', 'ro', 'ta'];

/** Things a name must not be or contain (real words that read wrong, rude or modern). */
export const BAD = new Set([
  'Bum', 'Bog', 'Dud', 'Dull', 'Fat', 'Fak', 'Fuk', 'Gag', 'Hell', 'Kill', 'Nob', 'Pis', 'Poo', 'Rat', 'Sod', 'Suk',
  'Tit', 'Wank', 'Dik', 'Dick', 'Kok', 'Shit', 'Damn', 'Nig', 'Fag', 'Jew', 'Pud', 'Poop', 'Sex', 'Gin', 'Bin', 'Pen',
  'Ten', 'Den', 'Hen', 'Men', 'Wet', 'Pet', 'Bet', 'Set', 'Net', 'Get', 'Let', 'Met', 'Jet', 'Vet', 'Yet', 'Sin',
  'Tin', 'Win', 'Kin', 'Fin', 'Din', 'Pin', 'Bad', 'Mad', 'Sad', 'Dad', 'Lad', 'Pad', 'Had', 'Rad', 'Tad', 'Gas',
  'Bus', 'Bad', 'Dog', 'Log', 'Hog', 'Fog', 'Jog', 'Mud', 'Bud', 'Rug', 'Bug', 'Hug', 'Mug', 'Tug', 'Jug', 'Pug',
  'Ham', 'Jam', 'Ram', 'Dam', 'Yam', 'Sam', 'Tom', 'Tim', 'Kim', 'Jim', 'Ron', 'Don', 'Dan', 'Ban', 'Fan', 'Man',
  'Pan', 'Ran', 'Tan', 'Van', 'Can', 'Bot', 'Dot', 'Got', 'Hot', 'Lot', 'Not', 'Pot', 'Rot', 'Tot', 'Bit', 'Fit',
  'Hit', 'Kit', 'Lit', 'Pit', 'Sit', 'Wit', 'Bat', 'Cat', 'Hat', 'Mat', 'Pat', 'Sat', 'Vat', 'Tea', 'Sea', 'Pea',
  'Boa', 'Goa', 'Moan', 'Loan', 'Roan', 'Toad', 'Road', 'Load', 'Goad', 'Bead', 'Lead', 'Read', 'Mead', 'Dead',
  'Head', 'Kill', 'Bill', 'Will', 'Hill', 'Mill', 'Pill', 'Till', 'Fill', 'Gill', 'Sill', 'Mass', 'Lass', 'Bass',
  'Pass', 'Moss', 'Boss', 'Loss', 'Toss', 'Miss', 'Hiss', 'Kiss', 'Mess', 'Less', 'Bless', 'Dress', 'Press', 'Stain',
  'Train', 'Drain', 'Brain', 'Grain', 'Slain', 'Main', 'Pain', 'Rain', 'Gain', 'Vain', 'Wain', 'Bait', 'Wait',
  'Trait', 'Stink', 'Drink', 'Brink', 'Think', 'Thin', 'Skin', 'Grin', 'Twin', 'Spin', 'Stun', 'Stud', 'Stab',
  'Grub', 'Drub', 'Slab', 'Blob', 'Flab', 'Blub', 'Flub', 'Brat', 'Twat', 'Flat', 'Slut', 'Gut', 'Butt', 'Nut',
  'Rut', 'Hut', 'Cut', 'Jut', 'Put', 'Tut', 'Mutt', 'Kool', 'Bool', 'Fool', 'Tool', 'Pool', 'Cool', 'Wool', 'Drool',
  'Trump', 'Lamp', 'Damp', 'Camp', 'Ramp', 'Vamp', 'Tramp', 'Stamp', 'Hamp',
]);

/** Human-world words a generated name must not spell (docs/theme.md §10): the wickfolk have no noses, dogs or hats. */
export const WORLD_WORDS = new Set([
  'nose', 'hair', 'lips', 'beard', 'hell', 'rat', 'rats', 'hen', 'dog', 'cat', 'hat', 'hats', 'tea', 'wool', 'lord', 'sir', 'wine', 'ale',
  'pig', 'cow', 'boot', 'boots', 'coat', 'coats', 'book', 'books', 'silk', 'milk', 'beer', 'tree', 'bell', 'bells', 'bat', 'bats', 'owl',
  'mule', 'fish', 'crow', 'wolf', 'cake', 'bread', 'loaf', 'coin', 'coins', 'rope', 'wood', 'oak', 'pine', 'slate', 'saint', 'devil',
  'angel', 'church', 'sword', 'gun', 'knight', 'farm', 'grass', 'wheat', 'shoe', 'shoes', 'mice', 'mouse', 'horse', 'pony', 'goat',
  'sheep', 'sugar', 'apple', 'cheese', 'onion', 'tomb', 'paper', 'linen', 'cotton', 'penny', 'purse', 'money', 'silver', 'grave',
]);
