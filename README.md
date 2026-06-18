# Escape Driver

![Escape Driver Gameplay](assets/gameplay.webp.png)

> A retro-neon police-chase arcade game, built to put pace, control, and survival first.

**Escape Driver** is an action game built with React and Canvas where your goal is to survive as long as possible while the police chase grows more intense. Drift, use power-ups, and make the cops crash into each other to reach the highest score.

## How to play

The goal is simple: **don't let them catch you**.

### Controls

| Action | Keyboard | Touch |
| :--- | :--- | :--- |
| Move | `Arrows` or `WASD` | Virtual joystick |
| Drift | `Spacebar` | `DRIFT` button |
| Pause | `P` | On-screen `⏸` |
| Mute | On-screen button | On-screen button |

On phones and tablets a virtual joystick and a drift button appear automatically, and the canvas resizes to fit the screen — the game is fully playable with one thumb.

### Tips

- Use space to turn faster on tight corners.
- Make police cars crash into each other to score points and clear the map.
- The longer you survive, the more aggressive the police become.

## Power-ups

- `Turbo` ⚡: boosts top speed by x1.8.
- `Shield` 🛡️: makes you temporarily invulnerable.
- `Magnet` 🧲: automatically pulls in nearby coins.
- `Freeze` ❄️: freezes every police car for a few seconds.
- `Repair` ❤️: restores one life (up to 5).
- `Bomb` 💣: destroys the nearest police car.

## Difficulties

| Level | Description | Challenge |
| :--- | :--- | :--- |
| Normal | 4 police | Survive 2 min |
| Hard | 6 police | Survive 3 min |
| Impossible | 8 police | Survive 4 min |
| Endless ♾️ | scaling chaos | No time limit — chase the high score |

At 4+ wanted stars, faster black **interceptor** units join the regular patrols. High scores are stored per difficulty.

## Tech stack

- Frontend: React + TypeScript
- Build tool: Vite
- Graphics: HTML5 Canvas API
- Styling: Tailwind CSS v4
- Audio: Web Audio API
- UI: Radix UI and Lucide React

## Install & run

```bash
git clone https://github.com/Victor00128/Escape-Driver.git
cd Escape-Driver
npm install --legacy-peer-deps
npm run dev
```

Open your browser at `http://localhost:3000`.

## Optional configuration

The game runs with no extra configuration. If you want to enable optional integrations, create a `.env` file based on `.env.example`.

Available variables:

- `VITE_OAUTH_PORTAL_URL`
- `VITE_APP_ID`
- `VITE_FRONTEND_FORGE_API_KEY`
- `VITE_FRONTEND_FORGE_API_URL`
- `VITE_ANALYTICS_ENDPOINT`
- `VITE_ANALYTICS_WEBSITE_ID`

## Achievements

The game has a persistent achievement system saved in the browser (14 in total), including:

- First coin: collect your first coin.
- Drift king: hold a drift for 30 seconds total.
- Chain reaction: make 3 police cars explode simultaneously.
- Untouchable: win a run without losing a single life.
- Iceman: freeze the police with a Freeze power-up.
- Demolition: destroy 25 police cars.
- Marathon: survive 5 minutes (great for Endless mode).

## Current status

This public version prioritizes:

- fast, arcade gameplay
- strong visual presentation
- survival-based progression
- a base ready to keep polishing

## License

MIT. See the [LICENSE](LICENSE) file.
