/** Shared active-room capacity. Protocol-1 compatibility stays at two members. */
export const MAX_PLAYERS = 8;
// Isolate older clients/gateways whose strict schemas lack eight actors or Hazel.
export const ROOM_REVISION = "p8-c4";
export const SESSION_STORAGE_KEY = `meadow-session-v2-${ROOM_REVISION}`;
