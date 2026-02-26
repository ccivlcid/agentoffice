/* ================================================================== */
/*  Constants                                                          */
/* ================================================================== */

export const MIN_OFFICE_W = 360;
export const CEO_ZONE_H = 110;
export const ROOMS_PER_ROW = 3;  // department rooms per horizontal grid row
export const HALLWAY_H = 32;
export const TARGET_CHAR_H = 52;
export const MINI_CHAR_H = 28;
export const CEO_SIZE = 44;
export const DESK_W = 48;
export const DESK_H = 26;
export const SLOT_W = 100;
export const SLOT_H = 120;
export const COLS_PER_ROW = 3;
export const ROOM_PAD = 16;
export const TILE = 20;
export const CEO_SPEED = 3.5;
export const DELIVERY_SPEED = 0.012;

export const BREAK_ROOM_H = 110;
export const BREAK_ROOM_GAP = 32;
export const MAX_VISIBLE_SUB_CLONES_PER_AGENT = 3;
export const SUB_CLONE_WAVE_SPEED = 0.04;
export const SUB_CLONE_MOVE_X_AMPLITUDE = 0.16;
export const SUB_CLONE_MOVE_Y_AMPLITUDE = 0.34;
export const SUB_CLONE_FLOAT_DRIFT = 0.08;
export const SUB_CLONE_FIREWORK_INTERVAL = 210;

// Break spots: positive x = offset from room left; negative x = offset from room right
// These are calibrated to match furniture positions drawn in buildScene
export const BREAK_SPOTS = [
  { x: 86,  y: 72, dir: 'D' },   // left sofa left side
  { x: 110, y: 72, dir: 'D' },   // left sofa center
  { x: 134, y: 72, dir: 'D' },   // left sofa right side
  { x: 30,  y: 58, dir: 'R' },   // coffee machine front
  { x: -112, y: 72, dir: 'D' },  // right sofa left side
  { x: -82,  y: 72, dir: 'D' },  // right sofa right side
  { x: -174, y: 56, dir: 'L' },  // high table left
  { x: -144, y: 56, dir: 'R' },  // high table right
];
