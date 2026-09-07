"use client";
import { useEffect, useRef, useState } from "react";
import type { Progress } from "../packages/content";
const HINT_KEY = "meadow-controls-seen-v1";
export function FirstPlayHint({
  active,
  onDismiss,
  combat = false,
}: {
  active: boolean;
  combat?: boolean;
  onDismiss: () => void;
}) {
  const hintKey = combat ? "meadow-combat-controls-seen-v1" : HINT_KEY;
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    try {
      setVisible(localStorage.getItem(hintKey) !== "1");
    } catch {
      setVisible(true);
    }
  }, [hintKey]);
  function dismiss() {
    setVisible(false);
    onDismiss();
    try {
      localStorage.setItem(hintKey, "1");
    } catch {
      /* Storage may be disabled. */
    }
  }
  useEffect(() => {
    if (!active || !visible) return;
    const timer = setTimeout(() => {
      setVisible(false);
      try {
        localStorage.setItem(hintKey, "1");
      } catch {
        /* Session-only hint. */
      }
    }, 10000);
    return () => clearTimeout(timer);
  }, [active, visible, hintKey]);
  return visible ? (
    <div className="first-play-hint" role="status">
      <span>
        {combat ? (
          <>
            <kbd>Click / J</kbd> Blade <kbd>Shift</kbd> Dodge · Slime on the
            north trail
          </>
        ) : (
          <>
            <kbd>WASD</kbd> Move <kbd>E</kbd> Gather <kbd>I</kbd> Satchel
          </>
        )}
      </span>
      <button
        onClick={dismiss}
        onPointerDown={(e) => e.preventDefault()}
        aria-label="Dismiss controls hint"
      >
        Got it
      </button>
    </div>
  ) : null;
}
export function GatherNotice({ progress }: { progress?: Progress }) {
  const previous = useRef<Progress | undefined>(undefined);
  const [message, setMessage] = useState("");
  const seq = progress?.receipt?.seq;
  const ready = !!progress;
  useEffect(() => {
    if (!progress) {
      previous.current = undefined;
      setMessage("");
      return;
    }
    const prior = previous.current;
    previous.current = progress;
    if (!prior || !progress.receipt || prior.receipt?.seq === seq) return;
    const result = progress.receipt.result;
    if (result === "gathered") {
      const gained = (["wood", "sweet-berry"] as const)
        .map((item) => ({
          item,
          amount:
            progress.inventory.reduce(
              (n, s) => n + (s?.item === item ? s.quantity : 0),
              0,
            ) -
            prior.inventory.reduce(
              (n, s) => n + (s?.item === item ? s.quantity : 0),
              0,
            ),
        }))
        .find((s) => s.amount > 0);
      setMessage(
        gained
          ? `+${gained.amount} ${gained.item === "wood" ? "Wood" : "Sweet Berries"}`
          : "Items added to satchel",
      );
    } else
      setMessage(
        {
          dead: "Recovering — items are safe",
          busy: "Finish your action first",
          depleted: "Already gathered",
          range: "Move closer",
          blocked: "Path blocked",
          tool: "Hatchet required",
          cooldown: "Wait a moment",
          full: "Satchel full",
          missing: "Resource unavailable",
        }[result],
      );
    const timer = setTimeout(() => setMessage(""), 3000);
    return () => clearTimeout(timer);
    // Inventory is read only when its committed command sequence changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seq, ready]);
  return (
    <div className="gather-notice" role="status" aria-live="polite">
      {message}
    </div>
  );
}

const COMPANION_MESSAGES: Record<string, string> = {
  teleported: "Joined your friend.",
  channeling: "Moss is dissolving the vines…",
  opened: "The Forest path is open for everyone",
  "already-open": "The Forest path is already open",
  cancelled: "Dissolve interrupted — stay close and try again",
  fed: "Sweet Berry shared",
  tamed: "Moss Slime befriended!",
  following: "Moss is following",
  staying: "Moss will stay here",
  recovering: "Finding a safe way back",
  claimed: "Another adventurer is feeding this Slime",
  owned: "Already befriended",
  "already-companion": "You already have a companion",
  food: "Gather Sweet Berries first",
  range: "Move closer to Moss",
  blocked: "Path blocked",
  dead: "Recover before feeding",
  busy: "Finish your action first",
  cooldown: "Give Moss a moment",
  missing: "Moss is unavailable",
  forbidden: "Only Moss’s owner can give commands",
};
export function CompanionNotice({
  receipt,
}: {
  receipt?: import("../packages/protocol/taming").CompanionReceipt;
}) {
  const [message, setMessage] = useState("");
  const previous = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!receipt) {
      previous.current = undefined;
      return;
    }
    const key = `${receipt.seq}:${receipt.result}`;
    if (previous.current === key) return;
    previous.current = key;
    const travel: Record<string, string> = {
      teleported: "Joined your friend.",
      cooldown: "Teleport is cooling down — wait 3 seconds.",
      missing: "That player is no longer available.",
      blocked: "No safe route to that player yet.",
      busy: "Finish combat before teleporting.",
      dead: "Both players must be alive to teleport.",
    };
    setMessage(
      receipt.action === "teleport"
        ? travel[receipt.result]
        : COMPANION_MESSAGES[receipt.result],
    );
    const timer = setTimeout(() => setMessage(""), 3500);
    return () => clearTimeout(timer);
  }, [receipt?.seq, receipt?.result, receipt?.action]);
  return (
    <div className="companion-notice" role="status">
      {message}
    </div>
  );
}
