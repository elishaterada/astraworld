"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { normalizeSeed } from "../packages/world";
import { validateUsername } from "./profile";
import { CharacterSelector } from "./character-selector";
import {
  CHARACTERS,
  characterId,
  type CharacterId,
} from "../packages/characters";
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
    menu = useRef<HTMLDialogElement>(null);
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
    <section className="game-view" aria-label="Engine sandbox">
      <div
        ref={host}
        className="playfield"
        tabIndex={0}
        role="application"
        aria-label="Meadow game. Move with WASD or arrow keys. Escape pauses and releases keyboard focus."
      />
      <div className="game-vignette" aria-hidden="true" />
      <div className="location-hud">
        <span className="location-emblem" aria-hidden="true">
          ❧
        </span>
        <div>
          <span className="overline">ASTRAWORLD</span>
          <h1>The Meadow</h1>
          <span className="location-subtitle">Your journey begins</span>
        </div>
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
      {(!status || status.paused || error) && (
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
      <div className="walk-hint">
        <span className="key-group">
          <kbd>W</kbd>
          <kbd>A</kbd>
          <kbd>S</kbd>
          <kbd>D</kbd>
        </span>
        <span>or arrow keys to wander</span>
        <i />
        <kbd>esc</kbd>
        <span>pause</span>
      </div>
      <div
        className={session ? "world-note multiplayer-note" : "world-note"}
        role="status"
      >
        <span className="status-dot" />{" "}
        {session
          ? `${status?.connection ?? "Connecting…"} · ${status?.players ?? 1}/2 adventurers`
          : "SOLO MEADOW"}{" "}
        <span>·</span> ART STUDY
      </div>
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
              Share this private link with one friend. This session can recover
              for 30 minutes after everyone leaves.
            </p>
            <p role="status">
              {status?.connection ?? "Connecting…"} · {status?.players ?? 1}/2
              adventurers nearby
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
          An early art study. Session recovery is temporary; there is no
          permanent saving.
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
    sessionStorage.removeItem("meadow-session");
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
              <i /> THE MEADOW · ART STUDY
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
                    : "Start a Meadow, then invite one friend from the menu."}
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
              CONCEPT ART STUDY <i>·</i> NO PROGRESS SAVED
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
