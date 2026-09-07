"use client";
import { useEffect, useRef } from "react";
import {
  CHARACTERS,
  CHARACTER_IDS,
  type CharacterId,
} from "../packages/characters";

function Portrait({ character }: { character: CharacterId }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let cancelled = false;
    void import("./three/portrait")
      .then(({ drawPortrait }) => {
        if (!cancelled && canvas.current)
          drawPortrait(canvas.current, character);
      })
      .catch(() => {
        if (canvas.current) canvas.current.dataset.unavailable = "true";
      });
    return () => {
      cancelled = true;
    };
  }, [character]);
  return <canvas ref={canvas} width={128} height={160} aria-hidden="true" />;
}
export function CharacterSelector({
  value,
  onChange,
  disabled,
}: {
  value: CharacterId;
  onChange: (value: CharacterId) => void;
  disabled: boolean;
}) {
  return (
    <fieldset className="character-selector" disabled={disabled}>
      <legend>Choose your look</legend>
      <div className="character-choices">
        {CHARACTER_IDS.map((id) => (
          <label key={id} className="character-choice">
            <input
              type="radio"
              name="character"
              value={id}
              aria-label={CHARACTERS[id].label}
              checked={value === id}
              onChange={() => onChange(id)}
            />
            <span className="character-card">
              <Portrait character={id} />
              <span className="character-check" aria-hidden="true">
                {value === id ? "✓" : ""}
              </span>
            </span>
          </label>
        ))}
      </div>
      <p className="character-help">
        Four adventurers · same abilities, your own look.
      </p>
    </fieldset>
  );
}
