/** Xbox layout through the browser's W3C standard mapping. No gameplay outcomes. */
export type PadSample = Pick<
  Gamepad,
  "id" | "index" | "mapping" | "connected" | "axes" | "buttons"
>;
export const PAD_DEADZONE = 0.24;
const neutral = () => ({
  x: 0,
  y: 0,
  facing: undefined as number | undefined,
  attack: false,
  charge: false,
  block: false,
  run: false,
});
export function decodePad(pad: PadSample | undefined | null) {
  const buttons = Array.from(
    { length: 17 },
    (_, i) => !!pad?.buttons[i]?.pressed || (pad?.buttons[i]?.value ?? 0) > 0.5,
  );
  if (!pad?.connected || pad.mapping !== "standard")
    return {
      ...neutral(),
      buttons: buttons.map(() => false),
      connected: false,
    };
  const stick = (offset: number) => {
    const x = pad.axes[offset] ?? 0,
      y = pad.axes[offset + 1] ?? 0;
    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      Math.hypot(x, y) < PAD_DEADZONE
    )
      return undefined;
    return (Math.round(Math.atan2(y, x) / (Math.PI / 4)) + 8) % 8;
  };
  const move = stick(0),
    aim = stick(2);
  return {
    connected: true,
    buttons,
    x: move === undefined ? 0 : Math.round(Math.cos((move * Math.PI) / 4)),
    y: move === undefined ? 0 : Math.round(Math.sin((move * Math.PI) / 4)),
    facing: aim ?? move,
    attack: buttons[2],
    charge: buttons[7],
    block: buttons[6],
    run: buttons[4],
  };
}
/** Neutral-before-use prevents held buttons leaking across focus, device, or menu changes. */
export class PadEdges {
  private identity = "";
  private mode = "";
  private armed = false;
  private previous: boolean[] = [];
  sample(pad: PadSample | null | undefined, mode: string) {
    const state = decodePad(pad),
      identity = state.connected ? `${pad!.index}:${pad!.id}` : "";
    if (identity !== this.identity || mode !== this.mode) {
      this.armed = false;
      this.previous = [];
    }
    this.identity = identity;
    this.mode = mode;
    if (!state.connected || mode === "inactive") {
      this.armed = false;
      return {
        ...neutral(),
        connected: state.connected,
        pressed: [] as number[],
        menuDirection: 0,
      };
    }
    const quiet = !state.buttons.some(Boolean) && state.facing === undefined;
    if (!this.armed) {
      this.armed = quiet;
      this.previous = state.buttons;
      return {
        ...neutral(),
        connected: true,
        pressed: [] as number[],
        menuDirection: 0,
      };
    }
    const pressed = state.buttons.flatMap((b, i) =>
      b && !this.previous[i] ? [i] : [],
    );
    this.previous = state.buttons;
    return {
      ...state,
      pressed,
      menuDirection:
        state.buttons[13] || state.buttons[15]
          ? 1
          : state.buttons[12] || state.buttons[14]
            ? -1
            : state.y || state.x,
    };
  }
}
export function createGamepadControls(host: HTMLElement) {
  const edges = new PadEdges();
  let activeIndex: number | undefined,
    lastDirection = 0,
    repeatAt = 0;
  const key = (code: string) => {
    host.dispatchEvent(
      new KeyboardEvent("keydown", { code, bubbles: true, cancelable: true }),
    );
    host.dispatchEvent(
      new KeyboardEvent("keyup", { code, bubbles: true, cancelable: true }),
    );
  };
  return {
    poll(paused: boolean, now: number) {
      let pads: (Gamepad | null)[] = [];
      try {
        pads = Array.from(navigator.getGamepads?.() ?? []);
      } catch {
        /* Unsupported/blocked API leaves keyboard intact. */
      }
      const valid = pads.filter(
        (p): p is Gamepad => !!p?.connected && p.mapping === "standard",
      );
      const pad = valid.find((p) => p.index === activeIndex) ?? valid[0];
      activeIndex = pad?.index;
      const root = host.closest(".game-view")!,
        dialog = root.querySelector<HTMLDialogElement>("dialog[open]"),
        map = root.querySelector<HTMLElement>(".travel-list");
      const mode =
        document.hidden || !document.hasFocus()
          ? "inactive"
          : dialog
            ? "dialog"
            : map
              ? "map"
              : paused
                ? "paused"
                : "game";
      const state = edges.sample(pad, mode),
        down = (button: number) => state.pressed.includes(button);
      if (mode === "inactive")
        return { ...neutral(), connected: state.connected };
      if (dialog || map) {
        const container = dialog ?? map!;
        if (down(1) || down(9) || (map && down(8))) {
          if (dialog) dialog.close();
          else
            root
              .querySelector<HTMLButtonElement>(
                '[aria-label="Map and player list"]',
              )
              ?.click();
          host.focus();
          return { ...neutral(), connected: state.connected };
        }
        const items = Array.from(
          container.querySelectorAll<HTMLElement>(
            "button:not(:disabled),summary,input:not(:disabled),select:not(:disabled),a[href]",
          ),
        ).filter((el) => el.getClientRects().length > 0);
        if (
          state.menuDirection &&
          (state.menuDirection !== lastDirection || now >= repeatAt)
        ) {
          const at = items.indexOf(document.activeElement as HTMLElement),
            index = (at + state.menuDirection + items.length) % items.length;
          items[index]?.focus();
          items[index]?.scrollIntoView({ block: "nearest" });
          repeatAt = now + (state.menuDirection !== lastDirection ? 400 : 180);
        }
        lastDirection = state.menuDirection;
        if (down(0)) {
          const selected =
            items.find((el) => el === document.activeElement) ?? items[0];
          selected?.focus();
          selected?.click();
        }
        return { ...neutral(), connected: state.connected };
      }
      lastDirection = 0;
      if (mode === "paused") {
        if (down(0) || down(9)) host.focus();
        return { ...neutral(), connected: state.connected };
      }
      if (down(9)) key("Escape");
      else if (down(3)) key("KeyI");
      else if (down(8))
        root
          .querySelector<HTMLButtonElement>(
            '[aria-label="Map and player list"]',
          )
          ?.click();
      else {
        for (const [button, code] of [
          [0, "KeyE"],
          [1, "ShiftLeft"],
          [5, "KeyH"],
          [14, "KeyC"],
          [15, "KeyR"],
          [13, "KeyZ"],
          [11, "KeyR"],
          [12, "Space"],
        ] as const)
          if (down(button)) key(code);
        return state;
      }
      return { ...neutral(), connected: state.connected };
    },
  };
}
