"use client";
import { WEAPONS, weaponSchema } from "../packages/content/weapons";
import { CraftingPanel } from "./crafting-panel";
import { WorldMap } from "./world-map";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { FirstPlayHint, GatherNotice, CompanionNotice } from "./game-hints";
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
import { downloadRecovery, parseRecovery, rememberSession } from "./recovery";
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
        aria-label="Meadow game. Move with WASD or arrow keys. Point to face. Space waves. Hold Click or J to attack. Hold K to charge. F or right mouse blocks. H uses a skill. 1 through 5 selects a weapon. V runs. Shift rolls and cancels attack recovery. E gathers or feeds nearby Moss Slimes. C toggles companion follow/stay. R recalls. Q dissolves nearby vines. Escape pauses and releases keyboard focus."
      />
      <div className="game-vignette" aria-hidden="true" />
      {session && (
        <div className="combat-kit" aria-label="Combat loadout">
          <span>{WEAPONS[status?.weapon ?? "blade"].name}</span>
          <button
            disabled={
              !status ||
              status.paused ||
              !!status.skillRemaining ||
              status.health === 0
            }
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => {
              host.current?.dispatchEvent(new Event("combat-skill"));
              host.current?.focus();
            }}
            aria-label={`Use ${WEAPONS[status?.weapon ?? "blade"].skill}`}
          >
            <kbd>{status?.controller ? "RB" : "H"}</kbd>{" "}
            {WEAPONS[status?.weapon ?? "blade"].skill}{" "}
            {status?.skillRemaining
              ? `${Math.ceil(status.skillRemaining)}s`
              : ""}
          </button>
          <small>
            {status?.parrying
              ? "PARRY!"
              : status?.blocking
                ? "Blocking"
                : status?.charge !== undefined
                  ? `Charging ${Math.round(status.charge * 100)}%`
                  : `${status?.controller ? "RT" : "K"} charge · ${status?.controller ? "LT" : "F / RMB"} block`}
          </small>
          {status?.friendlyFire && (
            <small className="friendly-fire-cue">Friendly fire ON</small>
          )}
        </div>
      )}

      <div className="location-hud">
        <h1>{status?.forest ? "Forest Clearing" : "The Meadow"}</h1>
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
                          stone: "◆",
                          "stone-axe": "⚒",
                        }[slot.item]
                      }
                    </span>
                    <small>{itemDefinition(slot.item).displayName}</small>
                    <b>{slot.quantity}</b>
                  </>
                )}
              </div>
            ))}
          </div>
          <CraftingPanel
            progress={status.progress}
            benches={status.benches ?? []}
            position={{ x: status.x, y: status.y }}
            connected={
              status.connection === "Connected" && status.workReady !== false
            }
            onCommand={(action, target) =>
              host.current?.dispatchEvent(
                new CustomEvent("craft-item", { detail: { action, target } }),
              )
            }
          />
          <p className="inventory-footnote">
            Starter tools · {status?.controller ? "X" : "Click / J"} to swing
            your blade
          </p>
          <p className="inventory-shortcut">
            {status?.controller ? (
              <>
                <kbd>B</kbd> Close
              </>
            ) : (
              <>
                <kbd>I</kbd> or <kbd>esc</kbd> Close
              </>
            )}
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
        <kbd>{status?.controller ? "Y" : "I"}</kbd>
      </button>
      {!status?.paused && status?.nearGate && !status.gate?.open && (
        <div className="interaction-hint vine-prompt" role="status">
          {status.gate?.channel ? (
            "Moss is dissolving the vines…"
          ) : status.companion ? (
            <>
              <kbd>{status?.controller ? "A" : "Q"}</kbd> Dissolve Vines
              <small>
                Bring Moss close · Follow mode · Stay nearby for 1 second
              </small>
            </>
          ) : (
            <>
              A Moss companion can clear these vines
              <small>Feed a Moss Slime three Sweet Berries near camp</small>
            </>
          )}
        </div>
      )}
      {!status?.paused && status?.forest && status.gate?.open && (
        <div className="forest-complete" role="status">
          <span>DISCOVERY</span>
          <strong>A path made together.</strong>
          <p>
            You reached the Forest clearing.
            <br />
            The adventure slice ends here. Explore or return to camp.
          </p>
        </div>
      )}
      {!status?.paused && !status?.nearGate && status?.mossTarget && (
        <div className="interaction-hint moss-prompt">
          <kbd>{status?.controller ? "A" : "E"}</kbd> Feed Sweet Berry ·{" "}
          {status.mossTarget.feeds}/3
          <small>
            Feed three times · Progress resets 1 minute after the last feed
          </small>
        </div>
      )}
      {!status?.paused &&
        !status?.mossTarget &&
        !status?.nearGate &&
        (status?.target || status?.gathering) && (
          <div className="interaction-hint">
            <kbd>{status?.controller ? "A" : "E"}</kbd>{" "}
            {status.gathering
              ? "Gathering…"
              : status.target === "tree"
                ? "Chop tree"
                : status.target === "loose-stone"
                  ? "Collect stone"
                  : "Pick berries"}
          </div>
        )}
      {status?.health !== undefined && (
        <div className="combat-hud" aria-label="Player health">
          <div className="health-caption">
            <span>{status.health === 0 ? "Recovering…" : username}</span>
            <span>{status.health} / 100</span>
          </div>
          <meter min={0} max={100} value={status.health} aria-label="Health" />
          {status.health === 0 && (
            <small role="status">Returning to camp · Items retained</small>
          )}
        </div>
      )}
      {status?.companion && (
        <div className="companion-hud" aria-label="Your companion">
          <strong>Moss Slime</strong>
          <span>
            {status.companion.mode === "stay"
              ? "Staying"
              : status.companion.mode === "recovering"
                ? "Recovering"
                : "Following"}
          </span>
          <div>
            {(
              [
                status.companion.mode === "stay" ? "follow" : "stay",
                "recall",
              ] as const
            ).map((action) => (
              <button
                key={action}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => {
                  host.current?.focus();
                  host.current?.dispatchEvent(
                    new CustomEvent("companion-command", { detail: action }),
                  );
                }}
              >
                {action === "follow"
                  ? "Follow [C]"
                  : action === "stay"
                    ? "Stay [C]"
                    : "Recall [R]"}
              </button>
            ))}
          </div>
        </div>
      )}
      <WorldMap
        onExplore={() => host.current?.focus()}
        seed={activeSeed}
        selfId={session?.playerId}
        position={{ x: status?.x ?? 64.5, y: status?.y ?? 64.5 }}
        roster={status?.roster ?? []}
        connected={status?.connection === "Connected"}
        onTeleport={(id) => {
          host.current?.dispatchEvent(
            new CustomEvent("teleport-player", { detail: id }),
          );
          host.current?.focus();
        }}
      />
      {status?.running && <span className="running-cue">Running</span>}
      <CompanionNotice receipt={status?.companionReceipt} />
      <GatherNotice progress={status?.progress} />
      <FirstPlayHint
        controller={!!status?.controller}
        combat={!!session}
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
        {session && (
          <details className="controls-reference">
            <summary>Weapons and world rules</summary>
            <p>
              Choose a training loadout. All five classes are available; skills
              use cooldowns.
            </p>
            <div className="weapon-choices">
              {weaponSchema.options.map((weapon, i) => (
                <button
                  key={weapon}
                  aria-pressed={status?.weapon === weapon}
                  onClick={() =>
                    host.current?.dispatchEvent(
                      new CustomEvent("combat-equip", { detail: weapon }),
                    )
                  }
                  title={WEAPONS[weapon].description}
                >
                  {i + 1} · {WEAPONS[weapon].name}
                  <small>{WEAPONS[weapon].skill}</small>
                </button>
              ))}
            </div>
            <label className="world-rule">
              <input
                type="checkbox"
                checked={!!status?.friendlyFire}
                disabled={!status?.canManageWorld}
                onChange={(e) =>
                  host.current?.dispatchEvent(
                    new CustomEvent("friendly-fire", {
                      detail: e.target.checked,
                    }),
                  )
                }
              />{" "}
              Friendly fire — players can damage each other
            </label>
            <small>
              {status?.canManageWorld
                ? "Applies to everyone in this world and is saved."
                : "Only the world creator can change this setting."}
            </small>
            <p>
              Hold K to charge, release to strike. Hold F or right mouse to
              block. A frontal hit during the first instant of a fresh block
              parries and reflects damage; a late block takes chip damage. H
              uses your class skill. 1–5 changes class.
            </p>
          </details>
        )}
        {session && (
          <details className="controls-reference">
            <summary>Your first adventure</summary>
            <p>
              Gather Sweet Berries near camp and chop a tree with E. Try your
              blade and dodge against the wild Slime on the north trail.
            </p>
            <p>
              Feed a Moss Slime three berries near camp. Bring your new
              companion north, past the wild Slime, to the tangled vines. Press
              Q with Moss nearby to open the Forest for everyone.
            </p>
            <p>
              Combat is optional for opening the passage. The Forest clearing is
              the end of this temporary adventure slice.
            </p>
          </details>
        )}
        <details className="controls-reference">
          <summary>
            Xbox controller {status?.controller ? "· Connected" : "· Controls"}
          </summary>
          <p>
            Connect by USB or Bluetooth, then press a controller button. Center
            both sticks before playing.
          </p>
          <dl>
            <dt>Move / aim</dt>
            <dd>Left stick / right stick</dd>
            <dt>Attack / roll</dt>
            <dd>Hold X / B</dd>
            <dt>Interact / run</dt>
            <dd>A / hold LB</dd>
            <dt>Satchel / map / menu</dt>
            <dd>Y / View / Menu</dd>
            <dt>Companion / recall</dt>
            <dd>D-pad left / press right stick</dd>
            <dt>Charge / block / skill</dt>
            <dd>Hold RT and release / LT / RB</dd>
            <dt>Change class / follow / recall</dt>
            <dd>D-pad down / left / right</dd>
            <dt>Dissolve vines / wave</dt>
            <dd>A near vines / D-pad up</dd>
            <dt>Menus</dt>
            <dd>D-pad or left stick to navigate · A select · B back</dd>
          </dl>
          <p>
            Movement uses eight directions at the same speed as keyboard play.
            Entering your name and editing text still use a keyboard.
          </p>
        </details>
        <details className="controls-reference">
          <summary>Keyboard and mouse</summary>
          <dl>
            <dt>Move</dt>
            <dd>WASD / arrow keys</dd>
            <dt>Run</dt>
            <dd>Hold V while moving</dd>
            <dt>Charge / block / skill</dt>
            <dd>Hold K then release / hold F or right mouse / H</dd>
            <dt>Weapon class</dt>
            <dd>1–5</dd>
            <dt>Blade</dt>
            <dd>Hold Click / J · third hit knocks back and interrupts</dd>
            <dt>Dodge</dt>
            <dd>Shift + direction · cancels attack recovery</dd>
            <dt>Feed nearby Moss</dt>
            <dd>E · Sweet Berries</dd>
            <dt>Companion</dt>
            <dd>C follow/stay · R recall</dd>
            <dt>Dissolve Vines</dt>
            <dd>Q · Bring Moss to the north passage</dd>
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
        {session && (
          <p className="fine-print">
            A wild Slime lurks along the north trail. Watch its amber slam
            circle, dodge out, then counterattack. Defeat it with three blade
            hits.
          </p>
        )}
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
              Share this private link with up to seven friends.{" "}
              {session.durable
                ? "Your group can return to this saved world. Keep your recovery key."
                : "This temporary session can recover for 30 minutes after everyone leaves."}
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
        {session?.durable && (
          <button
            className="quiet-button"
            onClick={() => downloadRecovery(session)}
          >
            Download recovery key
          </button>
        )}
        <p className="menu-footnote">
          Original 3D placeholder models.{" "}
          {session?.durable
            ? "Progress is saved to this world. Keep a recovery key to return from another browser. Anyone with your key can use your character."
            : "This is a temporary session; progress is not permanently saved."}
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
    setResuming(!!session?.durable);
    setInvited(false);
    setSession(undefined);
    try {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {}
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
              {resuming && (
                <button
                  type="button"
                  className="quiet-button entry-note"
                  onClick={() => {
                    try {
                      localStorage.removeItem(SESSION_STORAGE_KEY);
                      sessionStorage.removeItem(SESSION_STORAGE_KEY);
                    } catch {}
                    setResuming(false);
                    setDraftName("");
                    setNameError("");
                  }}
                >
                  Forget this browser’s key · start a new world
                </button>
              )}
              <details className="entry-recovery">
                <summary>Restore a saved world</summary>
                <label className="entry-note">
                  Choose your recovery key
                  <input
                    type="file"
                    aria-label="Restore recovery key"
                    accept="application/json,.json"
                    disabled={joining}
                    onChange={async (e) => {
                      const file = e.currentTarget.files?.[0];
                      if (!file) return;
                      try {
                        if (file.size > 4096)
                          throw Error("Choose an Astraworld recovery file.");
                        const restored = parseRecovery(await file.text());
                        rememberSession(restored);
                        setDraftName(restored.name);
                        setCharacter(characterId(restored.character));
                        setResuming(true);
                        setNameError("");
                        const url = new URL(location.href);
                        url.searchParams.delete("invite");
                        url.searchParams.delete("solo");
                        history.replaceState(null, "", url);
                        setInvited(false);
                      } catch (error) {
                        setNameError(
                          error instanceof Error
                            ? error.message
                            : "Could not restore this key.",
                        );
                      }
                    }}
                  />
                </label>
              </details>
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
              3D ART STUDY <i>·</i> PRIVATE WORLDS
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
