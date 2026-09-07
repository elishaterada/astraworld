/** Shared active-room capacity. Protocol-1 compatibility stays at two members. */
export const MAX_PLAYERS = 8;
// Isolate older clients/gateways with incompatible world geometry as well as actor schemas.
export const ROOM_REVISION = "p8-c4-m2";
export const SESSION_STORAGE_KEY = `meadow-session-v2-${ROOM_REVISION}`;
