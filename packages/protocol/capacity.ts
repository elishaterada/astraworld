/** Shared active-room capacity. Protocol-1 compatibility stays at two members. */
export const MAX_PLAYERS = 8;
// Older protocol-2 clients reject snapshots with more than two actors.
export const CAPACITY_REVISION = "p8";
export const SESSION_STORAGE_KEY = `meadow-session-v2-${CAPACITY_REVISION}`;
