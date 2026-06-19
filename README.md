# Escape Driver

![Escape Driver Gameplay](assets/gameplay.webp.png)

> A top-down police-chase arcade game set in a living neon city. Outrun a coordinated police force across a procedural metropolis of skyscrapers, parks and traffic — drift, escape and survive.

**Escape Driver** is an action game built with React and the HTML5 Canvas. You drive a 2026 hypercar through a fully procedural city while an increasingly smart police force hunts you down GTA-style. Weave through traffic, bait patrol cars into each other, grab power-ups and stay alive until the clock runs out.

## What's new

This version is a major overhaul of the original prototype:

- **Open neon arena** — a wide, obstacle-free map built for pure high-speed pursuit: nothing to crash into, just you, the cops and open ground. A reference grid and scattered decorative zones keep your bearings as you weave and escape.
- **Real engine sound** — the engine is synthesized live with the Web Audio API: layered harmonics, combustion noise, a turbo whine and **two-tone police sirens** that rise with your wanted level. No audio files, zero load time.
- **2026 cars** — detailed top-down vehicles with gradient bodies, cockpits, LED head/tail-lights, alloy wheels and turbo flames. Pick from **4 selectable hypercar models**, each with its own paint and underglow.
- **Smarter police AI** — patrols coordinate with distinct roles (pursuer, interceptor, flankers and blocker) to **surround and cut you off** instead of trailing in a line. They predict your path, attempt PIT-style rams, steer around buildings and call in reinforcements as your wanted level climbs.
- **Juice** — particle sparks and debris, persistent drift marks, screen shake, a wanted-level red/blue vignette, an upgraded minimap and a speedometer.

## How to play

The goal is simple: **survive until the timer hits zero.** Don't let the police catch you.

### Controls

| Action | Keyboard |
| :--- | :--- |
| Drive | `Arrows` or `WASD` |
| Handbrake / Drift | `Spacebar` |
| Pause | `P` |
| Mute | On-screen button |

### Tips

- Keep your speed up — at full throttle you can outrun the patrols on open avenues.
- Use the handbrake to whip around tight corners without losing momentum.
- Bait patrol cars into crashing into each other for big points and breathing room.
- Watch the minimap — patrols flank from several sides at once, so always keep an escape lane open.

## Power-ups

- `Turbo`: boosts top speed by x1.75.
- `Shield`: makes you temporarily invulnerable.
- `Magnet`: automatically pulls in nearby coins.
- `Bomb`: destroys the nearest police car.

## Difficulties

| Level | Description | Challenge |
| :--- | :--- | :--- |
| Normal | 4 police | Survive 2 min |
| Hard | 6 police | Survive 3 min |
| Impossible | 8 police | Survive 4 min |

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

```bash
git clone https://github.com/Victor00128/Escape-Driver.git
cd Escape-Driver
npm install --legacy-peer-deps
npm run dev
```

Open your browser at `http://localhost:3000`.

## Achievements

The game has a persistent achievement system saved in the browser — collect coins, hold long drifts, trigger chain reactions, reach 5 stars, win without losing a life, and more.

## License

MIT. See the [LICENSE](LICENSE) file.
