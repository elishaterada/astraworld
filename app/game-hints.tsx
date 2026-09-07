"use client";
import { useEffect, useRef, useState } from "react";
import type { Progress } from "../packages/content";
const HINT_KEY = "meadow-controls-seen-v1";
export function FirstPlayHint({
  active,
  onDismiss,
}: {
  active: boolean;
  onDismiss: () => void;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    try {
      setVisible(localStorage.getItem(HINT_KEY) !== "1");
    } catch {
      setVisible(true);
    }
  }, []);
  function dismiss() {
    setVisible(false);
    onDismiss();
    try {
      localStorage.setItem(HINT_KEY, "1");
    } catch {
      /* Storage may be disabled. */
    }
  }
  useEffect(() => {
    if (!active || !visible) return;
    const timer = setTimeout(() => {
      setVisible(false);
      try {
        localStorage.setItem(HINT_KEY, "1");
      } catch {
        /* Session-only hint. */
      }
    }, 10000);
    return () => clearTimeout(timer);
  }, [active, visible]);
  return visible ? (
    <div className="first-play-hint" role="status">
      <span>
        <kbd>WASD</kbd> Move <kbd>E</kbd> Gather <kbd>I</kbd> Satchel
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
