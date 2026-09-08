"use client";
import { meadowLandscape } from "./meadow-landscape";
import { useEffect, useRef, useState } from "react";
import { generateWorld, SIZE } from "../packages/world";
import type { RealtimeSnapshot } from "../packages/protocol/realtime";
import type { Position } from "../packages/simulation";
export function WorldMap({
  seed,
  selfId,
  position,
  roster,
  onTeleport,
  onExplore,
  connected,
}: {
  seed: string;
  selfId?: string;
  position: Position;
  roster: NonNullable<RealtimeSnapshot["roster"]>;
  onTeleport: (id: string) => void;
  onExplore: () => void;
  connected: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    [open, setOpen] = useState(false);
  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    const world = generateWorld(seed),
      landscape = meadowLandscape(world);
    for (const t of world.tiles) {
      ctx.fillStyle =
        t.terrain === "water"
          ? "#477f8c"
          : t.blocker === "tree"
            ? "#325840"
            : t.blocker === "rock"
              ? "#718079"
              : `#${landscape
                  .color(t.x + 0.5, t.y + 0.5)
                  .toString(16)
                  .padStart(6, "0")}`;
      ctx.fillRect(t.x, t.y, 1, 1);
    }
  }, [seed]);
  return (
    <aside className="world-map" aria-label="World map and players">
      <button
        className="map-toggle"
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
          onExplore();
        }}
        aria-label="Map and player list"
      >
        <span className="map-surface">
          <canvas
            ref={canvas}
            width={SIZE}
            height={SIZE}
            aria-label="Entire Meadow terrain"
          />
          <svg viewBox={`0 0 ${SIZE} ${SIZE}`} aria-label="Player locations">
            {roster
              .filter((p) => p.id !== selfId)
              .map((p) => (
                <circle
                  key={p.id}
                  cx={p.position.x}
                  cy={p.position.y}
                  r="2.2"
                  fill="#72deed"
                  stroke="#123632"
                  strokeWidth=".8"
                >
                  <title>{p.name}</title>
                </circle>
              ))}
            <circle
              cx={position.x}
              cy={position.y}
              r="2.5"
              fill="#fff1b7"
              stroke="#283d28"
              strokeWidth=".8"
            >
              <title>You</title>
            </circle>
          </svg>
          <span className="map-north">N</span>
        </span>
        <span className="map-caption">
          MEADOW{" "}
          <span>
            {roster.length || 1}/8 · {open ? "−" : "+"}
          </span>
        </span>
      </button>
      {open && (
        <div className="travel-list">
          <p>Friends in this world</p>
          {roster
            .filter((p) => p.id !== selfId)
            .map((p) => (
              <div key={p.id}>
                <span>
                  {p.name}
                  <small>
                    {Math.round(
                      Math.hypot(
                        position.x - p.position.x,
                        position.y - p.position.y,
                      ),
                    )}{" "}
                    tiles away
                  </small>
                </span>
                <button
                  disabled={!connected}
                  aria-label={`Teleport to ${p.name}`}
                  onClick={() => onTeleport(p.id)}
                >
                  Join
                </button>
              </div>
            ))}
          {roster.length <= 1 && <small>No friends online yet.</small>}
          <small>
            Gold: you · Blue: friends
            <br />
            Join teleports nearby. 3-second cooldown.
          </small>
        </div>
      )}
    </aside>
  );
}
