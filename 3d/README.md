# WGP#1 Championship Racing 3.1

A browser-based Three.js/WebGL closed-course water-racing game with
hydrodynamic handling, tactical eight-rider AI, lap timing, official race
rules, and broadcast-style presentation.

## Controls

- Desktop: `A/D` or left/right arrows to steer, `S` or down arrow to brake,
  `Shift` or `Space` for Nitro, and `P` or `Esc` to pause.
- Touch: left/right steering buttons plus Brake and Nitro. Landscape
  orientation is recommended.

## Race weekend

- A repeatable 920 m Pattaya circuit with two-, three-, and five-lap formats
- Championship, Arcade Sprint, and Technical Cup handling/rules presets
- Three race conditions: Race Day, Golden Hour, and Heavy Chop
- Sector checkpoints, missed-checkpoint penalties, lap times, best lap,
  final-lap call, and chequered-flag sequence
- Eight-rider starting grid, live classification, proximity radar, circuit
  map, official results, and a three-rider podium
- Broadcast opening card, race-control banners, countdown tones, overtake
  feedback, and position-change treatment

## Riding and AI

- Three selectable riders with distinct power, handling, boost, and stability
  characteristics
- Hydrodynamic grip, lateral momentum, centrifugal load, wake effects, water
  chop, edge drag, launch, landing, and hard-landing momentum loss
- Seven named rivals with Technical, Holeshot, Smooth, Aggressor, Late Braker,
  Defender, and Comeback racecraft profiles
- AI multi-line planning, look-ahead braking, apex and exit selection,
  committed overtakes, single-move defending, side-by-side awareness,
  obstacle avoidance, slipstreaming, Nitro strategy, reaction times,
  pressure errors, buoy impacts, and recovery
- Sport, Pro, and World Class difficulty changes reaction, consistency,
  line quality, and decisions rather than teleporting rivals or granting
  hidden catch-up speed

## Rendering and audio

- Detailed procedural jet skis, riders, helmets, suits, buoys, gates, ramps,
  officials' boats, crowds, grandstands, palms, flags, clouds,
  shoreline, and mountains
- Multi-wave shader ocean with condition-sensitive wave scale, Fresnel
  reflection, crest foam, sun sparkle, animated sky, fog, and cinematic tone
  mapping
- PBR clear-coat vehicles, generated environment reflections, adaptive bloom,
  and an automatic software-renderer fallback
- Chase-camera lean, impact shake, speed vignette, Nitro trails, wake sheets,
  spray droplets, and water-on-lens effects
- Procedural engine, wind, boost, impact, landing, countdown, lap, and finish
  audio with a dedicated mute control
- Responsive desktop, phone, and tablet interfaces with Auto, High, and Low
  graphics quality

The production 2D game remains at the repository root. This version is
isolated under `/3d/`.

## Real-time multiplayer path

The preview remains a complete single-player build. A fair real-time mode
must use an authoritative room server rather than trusting positions sent by
players' browsers. The intended production architecture is one WebSocket room
per race, with:

- server-validated steering, braking, Nitro, checkpoints, laps, contacts, and
  official results
- 20 Hz authoritative simulation plus client prediction and interpolation for
  smooth 60 FPS rendering
- room codes, private/public lobbies, reconnect support, spectators, and AI
  taking over disconnected or empty grid positions
- region-aware rooms and latency display before the start

The current static preview does not expose a non-functional Online button.
Multiplayer should be enabled only after a room server endpoint is deployed
and its synchronization and anti-cheat tests pass.

## Third-party assets

- Three.js 0.185.1 — MIT License
- Noto Sans Thai — SIL Open Font License 1.1
