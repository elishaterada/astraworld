"use client";
import {
  WORKBENCH_PLOTS,
  WORKBENCH_COST,
  STONE_AXE_RECIPE,
} from "../packages/content/crafting";
import type { Progress } from "../packages/content";
export function CraftingPanel({
  progress,
  benches,
  position,
  connected,
  onCommand,
}: {
  progress: Progress;
  benches: { id: string }[];
  position: { x: number; y: number };
  connected: boolean;
  onCommand: (action: "craft" | "place", target: string) => void;
}) {
  const count = (item: string) =>
    progress.inventory.reduce(
      (n, s) => n + (s?.item === item ? s.quantity : 0),
      0,
    );
  const plot = WORKBENCH_PLOTS.find(
    (p) =>
      !benches.some((b) => b.id === p.id) &&
      Math.hypot(p.x - position.x, p.y - position.y) <= 2,
  );
  const result = progress.receipt;
  return (
    <section className="crafting-panel" aria-label="Crafting">
      <h3>Make something useful</h3>
      <div>
        <span>
          <strong>Stone Axe</strong>
          <small>
            3 wood · 2 stone
            <br />
            Gather 5 wood per tree instead of 3. Used automatically.
          </small>
        </span>
        <button
          disabled={!connected || count("wood") < 3 || count("stone") < 2}
          onClick={() => onCommand("craft", STONE_AXE_RECIPE.id)}
        >
          Craft axe
        </button>
      </div>
      <div>
        <span>
          <strong>Workbench</strong>
          <small>
            {WORKBENCH_COST} wood · shared camp station
            <br />
            {plot
              ? "Camp plot in reach"
              : benches.length === 2
                ? "Both camp plots are occupied"
                : "Stand beside a marked plot north or south of the campfire."}
          </small>
        </span>
        <button
          disabled={!connected || !plot || count("wood") < WORKBENCH_COST}
          onClick={() => plot && onCommand("place", plot.id)}
        >
          Place workbench
        </button>
      </div>
      {result?.action && (
        <p role="status">
          {
            {
              crafted: "Stone Axe ready — automatically equipped for trees.",
              placed: "Workbench ready for your group.",
              ingredients: "Not enough materials.",
              full: "Make room in your satchel.",
              occupied: "Move everyone off the marked plot.",
              range: "Move closer to a camp plot.",
              cooldown: "Wait a moment, then try again.",
              busy: "Finish your action first.",
              dead: "Wait until you recover.",
              blocked: "That plot is blocked.",
              missing: "Recipe unavailable.",
              gathered: "",
              depleted: "Already gathered.",
              tool: "Tool required.",
            }[result.result]
          }
        </p>
      )}
      <small>
        Collect loose stones on the east trail with E. Place a workbench to make
        the camp your own.
      </small>
    </section>
  );
}
