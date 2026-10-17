// All balance numbers live here. Distances are in tiles, times in seconds.
export const TILE = 20;
export const COLS = 18;
export const ROWS = 26;
export const RIVER = { top: 12, bottom: 14 };
export const BRIDGES = [{ x: 4, half: 1.5 }, { x: 14, half: 1.5 }];

export const MATCH = {
  regular: 180,
  overtime: 60,
  sudden: 60,
  elixirMax: 10,
  elixirStart: 5,
  elixirPerSec: 1 / 2.8,
  fastMult: 2, // overtime + sudden death
  tick: 1 / 30,
};

export const TOWER = {
  princess: { hp: 1400, dmg: 80, as: 0.8, range: 7.5, radius: 1.1, proj: 12 },
  king: { hp: 2400, dmg: 100, as: 1.0, range: 7, radius: 1.5, proj: 12 },
};
// Positions are for the top (enemy) side; the bottom side is mirrored.
export const TOWER_POS = {
  princess: [{ x: 4, y: 5.5 }, { x: 14, y: 5.5 }],
  king: { x: 9, y: 1.8 },
};

const unit = (o) => ({
  targets: 'ground', aggro: 5.5, deploy: 1.0, air: false, building: false,
  proj: 0, splash: 0, life: 0, range: 0.5, radius: 0.5, ...o,
});

export const CARDS = {
  knight: {
    id: 'knight', name: 'Knight', cost: 3, type: 'troop', count: 1,
    unit: unit({ hp: 600, dmg: 75, as: 1.2, speed: 1.4, range: 0.5, radius: 0.55, color: '#c9a36b', icon: 'K' }),
  },
  archers: {
    id: 'archers', name: 'Archers', cost: 3, type: 'troop', count: 2,
    unit: unit({ hp: 125, dmg: 33, as: 0.9, speed: 1.4, range: 5, radius: 0.4, targets: 'both', proj: 10, color: '#e879a8', icon: 'A' }),
  },
  giant: {
    id: 'giant', name: 'Giant', cost: 5, type: 'troop', count: 1,
    unit: unit({ hp: 2000, dmg: 120, as: 1.5, speed: 1.0, range: 0.5, radius: 0.8, targets: 'buildings', color: '#d98a3d', icon: 'G' }),
  },
  goblins: {
    id: 'goblins', name: 'Goblins', cost: 2, type: 'troop', count: 3,
    unit: unit({ hp: 80, dmg: 50, as: 1.1, speed: 2.4, range: 0.4, radius: 0.35, color: '#6fbf4a', icon: 'g' }),
  },
  musketeer: {
    id: 'musketeer', name: 'Musketeer', cost: 4, type: 'troop', count: 1,
    unit: unit({ hp: 340, dmg: 100, as: 1.0, speed: 1.4, range: 6, radius: 0.45, targets: 'both', proj: 12, color: '#8b7bd8', icon: 'M' }),
  },
  dragon: {
    id: 'dragon', name: 'Baby Dragon', cost: 4, type: 'troop', count: 1,
    unit: unit({ hp: 800, dmg: 100, as: 1.6, speed: 1.8, range: 3.5, radius: 0.65, targets: 'both', air: true, proj: 7, splash: 1.5, color: '#4fd1c5', icon: 'D' }),
  },
  fireball: {
    id: 'fireball', name: 'Fireball', cost: 4, type: 'spell',
    spell: { radius: 2.5, dmg: 325, towerDmg: 100, delay: 0.4 }, color: '#ff7a1a', icon: 'F',
  },
  cannon: {
    id: 'cannon', name: 'Cannon', cost: 3, type: 'building', count: 1,
    unit: unit({ hp: 420, dmg: 60, as: 0.8, speed: 0, range: 5.5, radius: 0.7, building: true, proj: 14, life: 30, color: '#9aa4b2', icon: 'C' }),
  },
};
export const CARD_IDS = Object.keys(CARDS);
