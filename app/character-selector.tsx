"use client";
import { useEffect, useRef } from "react";
import {
  CHARACTERS,
  CHARACTER_IDS,
  type CharacterId,
} from "../packages/characters";
import atlas from "../public/art/meadow-atlas.json";

function Portrait({ character }: { character: CharacterId }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      const context = canvas.current?.getContext("2d");
      if (cancelled || !context) return;
      const frame = atlas.frames[8];
      context.clearRect(0, 0, 116, 199);
      context.drawImage(
        image,
        frame.x,
        frame.y,
        frame.width,
        frame.height,
        0,
        0,
        116,
        199,
      );
      // Match Pixi's per-channel sprite tint, including transparent edges.
      const pixels = context.getImageData(0, 0, 116, 199);
      const tint = CHARACTERS[character].tint;
      for (let i = 0; i < pixels.data.length; i += 4) {
        pixels.data[i] *= ((tint >> 16) & 255) / 255;
        pixels.data[i + 1] *= ((tint >> 8) & 255) / 255;
        pixels.data[i + 2] *= (tint & 255) / 255;
      }
      context.putImageData(pixels, 0, 0);
    };
    image.src = "/art/meadow-atlas-v2.png";
    return () => {
      cancelled = true;
    };
  }, [character]);
  return <canvas ref={canvas} width={116} height={199} aria-hidden="true" />;
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
              checked={value === id}
              onChange={() => onChange(id)}
            />
            <span className="character-card">
              <Portrait character={id} />
              <span style={{ color: CHARACTERS[id].color }}>
                <span aria-hidden="true">{CHARACTERS[id].mark} </span>
                {CHARACTERS[id].label}
              </span>
              <span className="character-check" aria-hidden="true">
                {value === id ? "✓" : ""}
              </span>
            </span>
          </label>
        ))}
      </div>
      <p className="character-help">
        Placeholder colorways · same abilities, your own look.
      </p>
    </fieldset>
  );
}
