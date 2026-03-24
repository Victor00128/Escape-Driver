# Escape Driver

![Escape Driver Gameplay](assets/gameplay.webp.png)

> Juego arcade de persecucion policial con estetica retro neon, construido para priorizar ritmo, control y supervivencia.

**Escape Driver** es un juego de accion desarrollado con React y Canvas donde tu objetivo es sobrevivir tanto tiempo como sea posible mientras la intensidad de la persecucion policial aumenta. Derrapa, usa power-ups y haz que los policias choquen entre si para lograr la puntuacion mas alta.

## Como jugar

El objetivo es simple: **no dejes que te atrapen**.

### Controles

| Accion | Teclado |
| :--- | :--- |
| Moverse | `Flechas` o `WASD` |
| Drift / Derrape | `Barra espaciadora` |
| Pausar | `P` |
| Silenciar | Boton en pantalla |

### Consejos

- Usa el espacio para girar mas rapido en curvas cerradas.
- Haz que los coches de policia choquen entre si para sumar puntos y limpiar el mapa.
- Cuanto mas tiempo sobrevives, mas agresiva se vuelve la policia.

## Power-ups

- `Turbo`: aumenta la velocidad maxima x1.8.
- `Escudo`: te vuelve invulnerable temporalmente.
- `Iman`: atrae monedas cercanas automaticamente.
- `Bomba`: destruye al policia mas cercano.

## Dificultades

| Nivel | Descripcion | Reto |
| :--- | :--- | :--- |
| Normal | 4 policias | Sobrevivir 2 min |
| Dificil | 6 policias | Sobrevivir 3 min |
| Imposible | 8 policias | Sobrevivir 4 min |

## Tecnologias

- Frontend: React + TypeScript
- Build tool: Vite
- Graficos: HTML5 Canvas API
- Estilos: Tailwind CSS v4
- Audio: Web Audio API
- UI: Radix UI y Lucide React

## Instalacion y ejecucion

```bash
git clone https://github.com/Victor00128/Escape-Driver.git
cd Escape-Driver
npm install --legacy-peer-deps
npm run dev
```

Abre el navegador en `http://localhost:5173`.

## Configuracion opcional

El juego puede arrancar sin configuracion extra. Si quieres habilitar integraciones opcionales, crea un archivo `.env` basandote en `.env.example`.

Variables disponibles:

- `VITE_OAUTH_PORTAL_URL`
- `VITE_APP_ID`
- `VITE_FRONTEND_FORGE_API_KEY`
- `VITE_FRONTEND_FORGE_API_URL`
- `VITE_ANALYTICS_ENDPOINT`
- `VITE_ANALYTICS_WEBSITE_ID`

## Logros

El juego cuenta con un sistema de logros persistente guardado en el navegador:

- Primera moneda: recoge tu primera moneda.
- Rey del drift: manten un derrape por 30 segundos acumulados.
- Reaccion en cadena: haz que 3 policias exploten simultaneamente.
- Intocable: gana una partida sin perder ninguna vida.

## Estado actual

Esta version publica prioriza:

- gameplay rapido y arcade
- presentacion visual fuerte
- progresion por supervivencia
- una base lista para seguir puliendo

## Licencia

MIT. Ver el archivo [LICENSE](LICENSE).
