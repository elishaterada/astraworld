import type { ResourceNode } from "../world/resources";
/** Fixed baseline order encodes the entire overlay, so a lost snapshot needs no delta repair. */
export function encodeDepletion(nodes: ResourceNode[], depleted: string[]) {
  const gone = new Set(depleted),
    bytes = new Uint8Array(Math.ceil(nodes.length / 8));
  nodes.forEach((n, i) => {
    if (gone.has(n.id)) bytes[i >> 3] |= 1 << (i & 7);
  });
  return btoa(String.fromCharCode(...bytes));
}
export function decodeDepletion(
  nodes: ResourceNode[],
  encoded: string,
): string[] | null {
  let bytes: string;
  try {
    bytes = atob(encoded);
  } catch {
    return null;
  }
  if (bytes.length !== Math.ceil(nodes.length / 8)) return null;
  return nodes
    .filter((_, i) => bytes.charCodeAt(i >> 3) & (1 << (i & 7)))
    .map((n) => n.id);
}
