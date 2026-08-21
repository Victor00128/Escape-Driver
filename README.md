# Escape Driver

[![CI](https://github.com/Victor00128/Escape-Driver/actions/workflows/ci.yml/badge.svg)](https://github.com/Victor00128/Escape-Driver/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-0F172A.svg)](./LICENSE)

**Play it:** [escape-driver.vercel.app](https://escape-driver.vercel.app)

![Escape Driver Gameplay](assets/gameplay.webp.png)

> A top-down police-chase arcade game set in an open neon arena. Outrun a coordinated police force across a wide procedural map — drift, escape and survive.

**Escape Driver** is an action game built with React and the HTML5 Canvas. You drive a hypercar across an open neon arena while an increasingly smart police force hunts you down GTA-style. Bait patrol cars into each other, grab power-ups and stay alive until the clock runs out.

## What's new

This version is a major overhaul of the original prototype:

- **Open neon arena** — a wide, obstacle-free map built for pure high-speed pursuit: nothing to crash into, just you, the cops and open ground. A reference grid and scattered decorative zones keep your bearings as you weave and escape.
- **Real engine sound** — the engine is synthesized live with the Web Audio API: layered harmonics, combustion noise, a turbo whine and **two-tone police sirens** that rise with your wanted level. No audio files, zero load time.
- **2026 cars** — detailed top-down vehicles with gradient bodies, cockpits, LED head/tail-lights, alloy wheels and turbo flames. Pick from **4 selectable hypercar models**, each with its own paint and underglow.
- **Smarter police AI** — patrols coordinate with distinct roles (pursuer, interceptor, flankers and blocker) to **surround and cut you off** instead of trailing in a line. They predict your path, attempt PIT-style rams and call in reinforcements as your wanted level climbs.
- **Juice** — particle sparks and debris, persistent drift marks, screen shake, a wanted-level red/blue vignette, an upgraded minimap and a speedometer.

## How to play

The goal is simple: **survive until the timer hits zero.** Don't let the police catch you.

### Controls

| Action            | Keyboard           | Touch            |
| :---------------- | :----------------- | :--------------- |
| Drive             | `Arrows` or `WASD` | On-screen D-pad  |
| Handbrake / Drift | `Spacebar`         | `DERRAPE` button |
| Pause             | `P`                | On-screen button |
| Mute              | On-screen button   | On-screen button |

On viewports under 768 px the game shows a labelled on-screen pad (accelerate,
brake/reverse, steer left/right and handbrake) below the canvas while a run is
in progress. The buttons drive the same key state as the keyboard, so both
inputs behave identically. The minimap is hidden on the narrowest screens to
keep the canvas readable.

### Tips

- Keep your speed up — at full throttle you can outrun the patrols across open ground.
- Use the handbrake to whip around tight corners without losing momentum.
- Bait patrol cars into crashing into each other for big points and breathing room.
- Watch the minimap — patrols flank from several sides at once, so always keep an escape lane open.

## Power-ups

- `Turbo`: boosts top speed by x1.75.
- `Shield`: makes you temporarily invulnerable.
- `Magnet`: automatically pulls in nearby coins.
- `Bomb`: destroys the nearest police car.

## Difficulties

| Level      | Description | Challenge     |
| :--------- | :---------- | :------------ |
| Normal     | 4 police    | Survive 2 min |
| Hard       | 6 police    | Survive 3 min |
| Impossible | 8 police    | Survive 4 min |

As you survive longer and wreck more patrols, your **wanted level** (1–5 stars) rises: more patrols spawn, they drive faster and upgrade from sedans to interceptors to armored SWAT units.

## Tech stack

- Frontend: React 19 + TypeScript
- Build tool: Vite
- Graphics: HTML5 Canvas API (decoupled game loop, not React-bound)
- Styling: Tailwind CSS v4
- Audio: Web Audio API (fully synthesized)
- UI: Radix UI and Lucide React

## Project structure

```
client/src/
  game/
    audio.ts      # synthesized engine, turbo, sirens & SFX
    city.ts       # open-map / arena generator
    vehicles.ts   # 2026 car & police rendering
    engine.ts     # game state, simulation, AI, collisions & canvas render
  pages/
    Game.tsx      # React orchestration: loop, HUD, menus, minimap
    Home.tsx      # landing screen
```

## Install & run

Requires Node.js 22.13 or newer and pnpm 11.

```bash
git clone https://github.com/Victor00128/Escape-Driver.git
cd Escape-Driver
corepack enable
pnpm install --frozen-lockfile
pnpm run dev
```

Open your browser at `http://localhost:3000`.

## Quality checks

CI runs all of these on every push and pull request
([workflow](.github/workflows/ci.yml)). There is no `typecheck` script in this
repo — type checking is the `check` script.

```bash
pnpm run lint          # ESLint over client/src
pnpm run check         # tsc --noEmit (this project's typecheck)
pnpm run format:check  # Prettier
pnpm test              # Vitest: city generation and engine logic
pnpm run build         # Vite client bundle + esbuild server bundle
```

## Achievements

The game has a persistent achievement system saved in the browser — collect coins, hold long drifts, trigger chain reactions, reach 5 stars, win without losing a life, and more.

## License

MIT. See the [LICENSE](LICENSE) file.
