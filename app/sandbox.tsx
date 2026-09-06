"use client";
import { useEffect, useRef, useState } from "react";
import { normalizeSeed } from "../packages/world";
import type { SandboxReport } from "./renderer";

function Meadow({ seed }: { seed: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<SandboxReport | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false,
      dispose: (() => void) | undefined;
    import("./renderer")
      .then(({ mountMeadow }) => {
        if (!cancelled && host.current)
          dispose = mountMeadow(host.current, seed, setStatus, setError);
      })
      .catch(() => {
        if (!cancelled)
          setError("The renderer could not load. Please reload the page.");
      });
    return () => {
      cancelled = true;
      dispose?.();
    };
  }, [seed]);
  return (
    <>
      <div
        ref={host}
        className="playfield"
        tabIndex={0}
        role="application"
        aria-label="Meadow game. Move with WASD or arrow keys. Escape releases keyboard focus."
      />
      <div className="scene-heading">
        <span className="eyebrow">THE FIRST FOOTSTEPS</span>
        <h1>The Meadow</h1>
        <p>A little wilderness. A place to begin.</p>
      </div>
      <div className="compass" aria-hidden="true">
        <span>N</span>
        <b>↑</b>
        <i>W · E</i>
      </div>
      {(!status || status.paused || error) && (
        <div className="pause-message" role="status">
          {error
            ? `Unable to open Meadow: ${error}`
            : !status
              ? "Opening the Meadow…"
              : "Paused · Click the meadow or Tab into it to explore"}
        </div>
      )}
      <div className="scene-bottom">
        <span>
          <i className={status && !status.paused ? "live-dot" : "idle-dot"} />
          {status && !status.paused ? "Exploring" : "Paused"}
        </span>
        <span className="coordinates">
          {status
            ? `${status.x.toFixed(1)} E / ${status.y.toFixed(1)} S`
            : "64.5 E / 64.5 S"}
        </span>
        <span>MEADOW / 128 × 128</span>
      </div>
    </>
  );
}
export default function Sandbox() {
  const [seed, setSeed] = useState("meadow-001"),
    [draft, setDraft] = useState("meadow-001");
  const [mounted, setMounted] = useState(true),
    [revision, setRevision] = useState(0);
  return (
    <main>
      <header>
        <a className="wordmark" href="/" aria-label="Astraworld home">
          <span className="brand-mark">✳</span> astraworld
        </a>
        <span className="chapter">
          FIELD NOTES <span>/</span> 000
        </span>
        <span className="prototype">M0 · LOCAL SANDBOX</span>
      </header>
      <section className="game-shell" aria-label="Engine sandbox">
        {mounted ? (
          <Meadow key={`${seed}:${revision}`} seed={seed} />
        ) : (
          <div className="rest-screen">
            <span className="eyebrow">A MOMENT BETWEEN WALKS</span>
            <h1>The Meadow awaits.</h1>
            <p>Enter again to return to the starting clearing.</p>
            <button onClick={() => setMounted(true)}>Enter meadow ↗</button>
          </div>
        )}
        <span className="art-label">PLACEHOLDER ART · NOT FINAL VISUALS</span>
      </section>
      <section className="field-desk" aria-label="Controls and world seed">
        <div className="invitation">
          <span className="eyebrow">01 / EXPLORE</span>
          <h2>Take the long way.</h2>
          <p>
            Follow the sandy trails or wander between the trees.
            <br />
            Trees, stones, and the edge of the world are solid.
          </p>
        </div>
        <div className="controls">
          <span className="eyebrow">YOUR FIRST STEPS</span>
          <p>
            <kbd>W</kbd>
            <kbd>A</kbd>
            <kbd>S</kbd>
            <kbd>D</kbd>
            <span>or arrow keys to move</span>
          </p>
          <p>
            <kbd>esc</kbd>
            <span>Pause & release focus</span>
          </p>
          <button className="text-button" onClick={() => setMounted((v) => !v)}>
            {mounted ? "Leave meadow" : "Enter meadow"} ↗
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const s = normalizeSeed(draft);
            setDraft(s);
            setSeed(s);
            setRevision((r) => r + 1);
            setMounted(true);
          }}
        >
          <label className="eyebrow" htmlFor="seed">
            A REPEATABLE LITTLE WORLD
          </label>
          <div className="seed-row">
            <input
              id="seed"
              value={draft}
              maxLength={64}
              onChange={(e) => setDraft(e.target.value)}
              spellCheck={false}
              aria-label="World seed"
            />
            <button type="submit" aria-label="Regenerate Meadow with this seed">
              ↻
            </button>
          </div>
          <p>Same seed, same landscape. Regenerate to restart.</p>
        </form>
      </section>
      <footer>
        <span>AN ASTRAWORLD EXPERIMENT</span>
        <span>Just a walk for now. No progress is saved.</span>
        <span>MEADOW STUDY — 001</span>
      </footer>
    </main>
  );
}
