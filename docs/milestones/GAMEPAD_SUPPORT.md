# Xbox controller support

User-authorized after M7 and the combat-rhythm update. This is a client input/accessibility addition; no M8 content, protocol bump, save change or new backend service.

## Controls

Connect an Xbox controller by USB or Bluetooth, enter the Meadow, then press a button so the browser exposes it. Center both sticks and release buttons before play. The existing name-entry screen and text editing use keyboard/mouse.

| Input | Action |
| --- | --- |
| Left stick | Move in eight directions, at keyboard speed |
| Right stick | Aim; otherwise face movement direction |
| X, held | Normal attack / blade combo |
| RT, held then released | Charge attack |
| LT, held | Block / timed parry |
| RB | Class skill |
| D-pad down | Cycle weapon |
| B | Roll |
| A | Gather / feed nearby pet / channel nearby vines |
| LB, held | Run |
| Y | Satchel |
| View | Map/player list |
| Menu | Pause menu |
| D-pad left | Companion follow/stay |
| D-pad right or right-stick click | Recall companion |
| D-pad up | Wave |
| D-pad / left stick in menus | Navigate visible enabled controls |
| A / B in menus | Activate / back |

The menu contains the mapping and connection status. First-play combat/movement hints and contextual gather/feed/vine/satchel prompts switch to Xbox labels when a standard controller is detected, and back to keyboard labels on disconnect. Controller and keyboard first-play hints have independent dismissal keys, so connecting a controller can teach its mapping even after keyboard onboarding was dismissed. The connection/disconnection hint switch is covered by the browser test. A or Menu resumes a paused playfield. Controller gameplay is suppressed while navigating the satchel, menu or player list. Keyboard movement takes precedence if both devices supply movement; the right stick can still aim.

## Contract

`app/gamepad.ts` polls the browser [Gamepad API standard layout](https://www.w3.org/TR/gamepad/) through the existing animation loop. Nonstandard mappings are ignored rather than guessed; unavailable/blocked APIs leave keyboard input intact. One standard controller is selected and retained until disconnected. No device identifiers are sent to the server.

A radial 0.24 dead zone removes drift. Sticks become the existing eight-direction input/facing, retaining diagonal normalization, collision and speed limits. Buttons are edge-triggered except held attack/run/charge/block. Reconnection, focus changes and transitions between gameplay/menus require neutral controls before accepting new actions. Disconnect clears controller movement and held attacks without clearing keyboard state. There are no additional timers/listeners to leak on renderer disposal.

Gameplay actions enter the same existing input handlers and validated intent stream. Damage, inventory awards, ownership and world changes remain server-owned. Menu navigation moves native DOM focus, skips hidden/disabled controls, and repeats direction after 400 ms then every 180 ms. No custom virtual cursor or text keyboard is introduced.

## Verification

- Six targeted tests passed: controller mapping/dead zone/nonstandard rejection/neutral gating plus network-client and combat timing regressions. TypeScript and production build passed.
- Chromium browser test overrides only `navigator.getGamepads` with simulated standard-layout input. It verifies movement, aiming, held combo, roll, gathering, satchel, D-pad/A menu activation, menu suppression, map toggle, disconnect stop and keyboard movement afterward. No page errors. [Report](evidence/gamepad-browser.json), [capture](evidence/gamepad-browser.png).
- Physical Xbox USB/Bluetooth behavior, browser/OS driver mappings, Safari/Firefox and haptics were not verified. Analog speed, remapping, multiple local players and controller-only name entry are not implemented. No hosted deployment was performed.

Existing M6 release/performance gates remain unchanged. M8 is not implemented.

The subsequent [combat arsenal](COMBAT_ARSENAL.md) remaps RT/LT/RB and companion shortcuts as listed above, adds wire protocol 6 and extends the browser check to charge, guard, skills and weapon selection. Earlier verification counts describe the original controller increment.
