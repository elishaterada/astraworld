"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { FirstPlayHint, GatherNotice } from "./game-hints";
import { normalizeSeed } from "../packages/world";
import { itemDefinition } from "../packages/content";
import { validateUsername } from "./profile";
import { CharacterSelector } from "./character-selector";
import {
  CHARACTERS,
  characterId,
  type CharacterId,
} from "../packages/characters";
import {
  MAX_PLAYERS,
  SESSION_STORAGE_KEY,
} from "../packages/protocol/capacity";
import { joinMeadow, savedSession } from "./network";
import type { Session } from "../packages/protocol";
import type { SandboxReport } from "./renderer";

function Meadow({
  seed,
  username,
  character,
  onLeave,
  onFullscreen,
  fullscreen,
  session,
}: {
  seed: string;
  username: string;
  character: CharacterId;
  onLeave: () => void;
  onFullscreen: () => void;
  fullscreen: boolean;
  session?: Session;
}) {
  const host = useRef<HTMLDivElement>(null),
    menu = useRef<HTMLDialogElement>(null),
    inventory = useRef<HTMLDialogElement>(null);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [status, setStatus] = useState<SandboxReport | null>(null),
    [error, setError] = useState("");
  const [copyNote, setCopyNote] = useState("");
  const [draft, setDraft] = useState(seed),
    [activeSeed, setActiveSeed] = useState(seed),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let cancelled = false,
      dispose: (() => void) | undefined;
    setStatus(null);
    setError("");
    import("./renderer")
      .then(({ mountMeadow }) => {
        if (!cancelled && host.current)
          dispose = mountMeadow(
            host.current,
            activeSeed,
            setStatus,
            setError,
            username,
            session,
            character,
          );
      })
      .catch(() => {
        if (!cancelled)
          setError(
            "The Meadow could not load. Check your connection and try again.",
          );
      });
    return () => {
      cancelled = true;
      dispose?.();
    };
  }, [activeSeed, revision, username, session, character]);
  const openInventory = () => {
    if (!status?.progress) return;
    inventory.current?.showModal();
    setInventoryOpen(true);
  };
  const closeInventory = () => inventory.current?.close();
  const resume = () => {
    menu.current?.close();
    host.current?.focus();
  };
  function regenerate(e: FormEvent) {
    e.preventDefault();
    const next = normalizeSeed(draft);
    setDraft(next);
    setActiveSeed(next);
    setRevision((r) => r + 1);
    menu.current?.close();
  }
  return (
    <section
      className="game-view"
      aria-label="Engine sandbox"
      onKeyDownCapture={(e) => {
        if (
          (e.target as HTMLElement).matches("input, textarea") ||
          menu.current?.open
        )
          return;
        if (e.code === "KeyI" && !e.repeat) {
          e.preventDefault();
          e.stopPropagation();
          if (inventory.current?.open) closeInventory();
          else openInventory();
        } else if (e.code === "Escape" && !inventory.current?.open) {
          e.preventDefault();
          e.stopPropagation();
          menu.current?.showModal();
        }
      }}
    >
      <div
        ref={host}
        className="playfield"
        tabIndex={0}
        role="application"
        aria-label="Meadow game. Move with WASD or arrow keys. Point to face. Space waves. E gathers the highlighted resource. Escape pauses and releases keyboard focus."
      />
      <div className="game-vignette" aria-hidden="true" />
      <div className="location-hud">
        <h1>The Meadow</h1>
        <span
          className="party-count"
          aria-label={`${status?.players ?? 1} players`}
        >
          {session ? `${status?.players ?? 1}/${MAX_PLAYERS}` : "Solo"}
        </span>
      </div>
      <div className="game-actions">
        <button
          onClick={onFullscreen}
          aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          title={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        >
          ⛶
        </button>
        <button
          onClick={() => menu.current?.showModal()}
          aria-label="Open menu"
        >
          <span aria-hidden="true">☰</span> Menu
        </button>
      </div>
      <div className="player-name" aria-label={`Player ${username}`}>
        <span style={{ color: CHARACTERS[character].color }}>
          {CHARACTERS[character].mark}
        </span>{" "}
        {username}
        <span className="name-diamond" />
      </div>
      {(!status || (status.paused && !inventoryOpen) || error) && (
        <div className="pause-layer">
          <div className="pause-panel" role="status">
            <span className="overline">
              {error
                ? "A LITTLE SETBACK"
                : !status
                  ? "JUST A MOMENT"
                  : "TAKE A BREATH"}
            </span>
            <h2>
              {error
                ? "The path is closed."
                : !status
                  ? "Finding your clearing…"
                  : "The Meadow can wait."}
            </h2>
            <p>
              {error ||
                (!status
                  ? "Preparing the landscape for your first steps."
                  : "Click below to continue your wander.")}
            </p>
            {status && !error && (
              <button className="gold-button" onClick={resume}>
                Return to the Meadow <span aria-hidden="true">→</span>
              </button>
            )}
            {error && (
              <button
                className="gold-button"
                onClick={() => setRevision((r) => r + 1)}
              >
                Try again
              </button>
            )}
          </div>
        </div>
      )}
      {status?.progress && (
        <dialog
          ref={inventory}
          className="gather-hud"
          aria-label="Inventory"
          onClose={() => {
            setInventoryOpen(false);
            host.current?.focus();
          }}
        >
          <button
            className="inventory-close"
            onClick={closeInventory}
            aria-label="Close inventory"
          >
            ×
          </button>
          <div className="inventory-heading">
            <h2>Satchel</h2>
            <span>{status.progress.inventory.filter(Boolean).length} / 12</span>
          </div>
          <div className="inventory-slots">
            {status.progress.inventory.map((slot, i) => (
              <div
                className={`inventory-slot ${slot?.item ?? "empty"}`}
                key={i}
                title={
                  slot ? itemDefinition(slot.item).displayName : "Empty slot"
                }
                aria-label={
                  slot
                    ? `${itemDefinition(slot.item).displayName}: ${slot.quantity}`
                    : "Empty slot"
                }
              >
                {slot && (
                  <>
                    <span className="item-symbol" aria-hidden="true">
                      {
                        {
                          "sweet-berry": "●",
                          wood: "▰",
                          hatchet: "⚒",
                          "starter-blade": "†",
                        }[slot.item]
                      }
                    </span>
                    <small>
                      {slot.item === "sweet-berry"
                        ? "Berries"
                        : slot.item === "wood"
                          ? "Wood"
                          : slot.item === "hatchet"
                            ? "Hatchet"
                            : "Blade"}
                    </small>
                    <b>{slot.quantity}</b>
                  </>
                )}
              </div>
            ))}
          </div>
          <p className="inventory-footnote">
            Starter tools · Blade use comes later
          </p>
          <p className="inventory-shortcut">
            <kbd>I</kbd> or <kbd>esc</kbd> Close
          </p>
        </dialog>
      )}
      <button
        className="satchel-toggle"
        aria-label="Open inventory"
        aria-haspopup="dialog"
        aria-expanded={inventoryOpen}
        aria-keyshortcuts="I"
        onClick={openInventory}
        disabled={!status?.progress}
      >
        <svg
          viewBox="0 0 24 24"
          width="22"
          height="22"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          aria-hidden="true"
        >
          <path d="M8 6V4h8v2M5 8h14v12H5zM5 8l2-2h10l2 2M5 11h14M10 10v4h4v-4" />
        </svg>
        <kbd>I</kbd>
      </button>
      {!status?.paused && (status?.target || status?.gathering) && (
        <div className="interaction-hint">
          <kbd>E</kbd>{" "}
          {status.gathering
            ? "Gathering…"
            : status.target === "tree"
              ? "Chop tree"
              : "Pick berries"}
        </div>
      )}
      <GatherNotice progress={status?.progress} />
      <FirstPlayHint
        active={!!status && !status.paused}
        onDismiss={() => host.current?.focus()}
      />
      {session && status?.connection !== "Connected" && (
        <div className="connection-notice" role="status">
          {status?.connection ?? "Connecting…"}
        </div>
      )}
      <dialog
        ref={menu}
        className="meadow-menu"
        onClose={() => host.current?.focus()}
      >
        <button className="close-menu" onClick={resume} aria-label="Close menu">
          ×
        </button>
        <span className="overline">YOUR LITTLE CORNER OF THE WORLD</span>
        <h2>A moment in the Meadow.</h2>
        <p className="menu-player">
          Wandering as <strong>{username}</strong> ·{" "}
          {CHARACTERS[character].label}
        </p>
        <details className="controls-reference">
          <summary>Controls</summary>
          <dl>
            <dt>Move</dt>
            <dd>WASD / arrow keys</dd>
            <dt>Gather</dt>
            <dd>E</dd>
            <dt>Satchel</dt>
            <dd>I</dd>
            <dt>Face</dt>
            <dd>Mouse</dd>
            <dt>Wave</dt>
            <dd>Space</dd>
            <dt>Pause / close</dt>
            <dd>Escape</dd>
          </dl>
        </details>
        {session ? (
          <div className="invite-panel">
            <label htmlFor="invite-link">Invite a friend</label>
            <input
              id="invite-link"
              readOnly
              value={
                typeof location === "undefined"
                  ? ""
                  : `${location.origin}/?invite=${session.invite}`
              }
              onFocus={(e) => e.target.select()}
            />
            <button
              className="copy-invite"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    `${location.origin}/?invite=${session.invite}`,
                  );
                  setCopyNote("Link copied. Send it to your friend.");
                } catch {
                  const field = document.getElementById(
                    "invite-link",
                  ) as HTMLInputElement | null;
                  field?.focus();
                  field?.select();
                  setCopyNote("Select and copy the link above to share it.");
                }
              }}
            >
              Copy invite link
            </button>
            <p className="fine-print" role="status">
              {copyNote}
            </p>
            <p className="fine-print">
              Share this private link with up to seven friends. This session can
              recover for 30 minutes after everyone leaves.
            </p>
            <p role="status">
              {`${status?.connection ?? "Connecting…"} · ${status?.players ?? 1}/${MAX_PLAYERS} adventurers nearby`}
            </p>
          </div>
        ) : (
          <form onSubmit={regenerate}>
            <label htmlFor="seed">World seed</label>
            <div className="seed-row">
              <input
                id="seed"
                aria-label="World seed"
                value={draft}
                maxLength={64}
                onChange={(e) => setDraft(e.target.value)}
                spellCheck={false}
              />
              <button
                type="submit"
                aria-label="Regenerate Meadow with this seed"
              >
                ↻
              </button>
            </div>
            <p className="fine-print">
              Same seed, same landscape. Regenerating returns you to the
              clearing.
            </p>
          </form>
        )}
        <button className="gold-button" onClick={resume}>
          Keep exploring <span aria-hidden="true">→</span>
        </button>
        <button className="quiet-button" onClick={onLeave}>
          Leave meadow
        </button>
        <p className="menu-footnote">
          Original 3D placeholder models. Session recovery is temporary; there
          is no permanent saving.
        </p>
      </dialog>
    </section>
  );
}

export default function Sandbox() {
  const shell = useRef<HTMLElement>(null);
  const [session, setSession] = useState<Session>();
  const [joining, setJoining] = useState(false);
  const [character, setCharacter] = useState<CharacterId>("fern");
  const [resuming, setResuming] = useState(false);
  const [invited, setInvited] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setInvited(params.has("invite"));
    const saved =
      !params.has("invite") && params.get("solo") !== "1"
        ? savedSession()
        : undefined;
    if (saved) {
      setDraftName(saved.name);
      setCharacter(characterId(saved.character));
      setResuming(true);
    }
  }, []);
  const [draftName, setDraftName] = useState(""),
    [username, setUsername] = useState(""),
    [playing, setPlaying] = useState(false),
    [nameError, setNameError] = useState("");
  const [fullscreen, setFullscreen] = useState(false),
    [fullscreenNote, setFullscreenNote] = useState("");
  useEffect(() => {
    const changed = () =>
      setFullscreen(document.fullscreenElement === shell.current);
    document.addEventListener("fullscreenchange", changed);
    return () => document.removeEventListener("fullscreenchange", changed);
  }, []);
  useEffect(() => {
    if (!fullscreenNote) return;
    const timer = setTimeout(() => setFullscreenNote(""), 5000);
    return () => clearTimeout(timer);
  }, [fullscreenNote]);
  function requestFullscreen() {
    const node = shell.current;
    if (!node?.requestFullscreen || !document.fullscreenEnabled) {
      setFullscreenNote(
        "Playing in your browser window. Fullscreen is unavailable here.",
      );
      return;
    }
    void node
      .requestFullscreen()
      .then(() => setFullscreenNote(""))
      .catch(() =>
        setFullscreenNote(
          "Playing in your browser window. Use ⛶ to try fullscreen again.",
        ),
      );
  }
  async function enter(e: FormEvent) {
    e.preventDefault();
    const result = validateUsername(draftName);
    if (result.error) {
      setNameError(result.error);
      return;
    }
    setNameError("");
    setUsername(result.name);
    setDraftName(result.name);
    // The request stays inside the submit gesture so browser activation is still valid.
    requestFullscreen();
    if (new URLSearchParams(location.search).get("solo") === "1") {
      setPlaying(true);
      return;
    }
    setJoining(true);
    try {
      const joined = await joinMeadow(
        result.name,
        new URLSearchParams(location.search).get("invite") ?? undefined,
        character,
      );
      setSession(joined);
      setUsername(joined.name);
      setCharacter(characterId(joined.character));
      setPlaying(true);
      // Strip the invitation from the address after joining to avoid accidental re-joins on reload.
      const url = new URL(location.href);
      url.searchParams.delete("invite");
      history.replaceState(null, "", url);
    } catch (error) {
      setNameError(
        error instanceof Error ? error.message : "Could not join the Meadow.",
      );
    } finally {
      setJoining(false);
    }
  }
  function leave() {
    setPlaying(false);
    setResuming(false);
    setInvited(false);
    setSession(undefined);
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    setFullscreenNote("");
    if (document.fullscreenElement)
      void document.exitFullscreen().catch(() => {});
  }
  function toggleFullscreen() {
    if (document.fullscreenElement)
      void document.exitFullscreen().catch(() => {});
    else requestFullscreen();
  }
  return (
    <main
      ref={shell}
      className={playing ? "world-shell is-playing" : "world-shell"}
    >
      {playing ? (
        <Meadow
          seed={session?.seed ?? "meadow-001"}
          session={session}
          username={username}
          character={character}
          onLeave={leave}
          onFullscreen={toggleFullscreen}
          fullscreen={fullscreen}
        />
      ) : (
        <section className="entry-screen" aria-label="Welcome to Astraworld">
          <div className="entry-shade" aria-hidden="true" />
          <header className="entry-header">
            <a href="/" className="small-brand">
              <span aria-hidden="true">✦</span> ASTRAWORLD
            </a>
            <span className="study-tag">
              <i /> THE MEADOW · 3D ART STUDY
            </span>
          </header>
          <div className="entry-content">
            <span className="overline welcome-line">
              SMALL BEGINNINGS. A WILDER TOMORROW.
            </span>
            <h1>
              Astraworld
              <span className="title-leaf" aria-hidden="true">
                ❧
              </span>
            </h1>
            <p className="entry-description">
              Every adventure starts
              <br />
              with a little curiosity.
            </p>
            <div className="ornament" aria-hidden="true">
              <span />✧<span />
            </div>
            <form className="entry-form" onSubmit={enter} noValidate>
              <label htmlFor="username">What should we call you?</label>
              <p className="field-help" id="name-help">
                {resuming
                  ? "Welcome back. Your name and look are saved for this session."
                  : invited
                    ? "You’re joining a friend’s Meadow. Choose a name and look."
                    : "Start a Meadow, then invite up to seven friends from the menu."}
              </p>
              <div className="name-field">
                <span aria-hidden="true">✧</span>
                <input
                  id="username"
                  name="username"
                  readOnly={resuming}
                  disabled={joining}
                  autoComplete="nickname"
                  placeholder="Your adventurer name"
                  maxLength={20}
                  value={draftName}
                  onChange={(e) => {
                    setDraftName(e.target.value);
                    if (nameError) setNameError("");
                  }}
                  aria-describedby={
                    nameError ? "name-help name-error" : "name-help"
                  }
                  aria-invalid={!!nameError}
                />
              </div>
              <CharacterSelector
                value={character}
                onChange={setCharacter}
                disabled={joining || resuming}
              />
              {nameError && (
                <p id="name-error" role="alert" className="form-error">
                  {nameError}
                </p>
              )}
              <button
                className="gold-button enter-button"
                type="submit"
                disabled={joining}
              >
                {joining
                  ? "Opening the Meadow…"
                  : resuming
                    ? "Resume Meadow"
                    : "Enter Meadow"}{" "}
                <span aria-hidden="true">→</span>
              </button>
              <p className="entry-note">
                A little wilderness, better with a friend.
              </p>
            </form>
          </div>
          <div className="meadow-caption">
            <span className="caption-rule" />
            <span className="overline">THE MEADOW</span>
            <p>Your journey begins here.</p>
          </div>
          <footer className="entry-footer">
            <span>
              PLAY IN YOUR BROWSER <i>·</i> KEYBOARD REQUIRED
            </span>
            <span>
              3D ART STUDY <i>·</i> NO PROGRESS SAVED
            </span>
          </footer>
        </section>
      )}
      {playing && fullscreenNote && (
        <p className="fullscreen-note" role="status">
          {fullscreenNote}
          <button
            aria-label="Dismiss fullscreen notice"
            onClick={() => setFullscreenNote("")}
          >
            ×
          </button>
        </p>
      )}
    </main>
  );
}
