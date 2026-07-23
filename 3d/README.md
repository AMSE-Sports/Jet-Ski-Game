# WGP#1 Championship Racing · Physics 2.0

A browser-based Three.js/WebGL water-racing game with curved-course
hydrodynamics, tactical rivals, and scalable cinematic rendering.

## Controls

- Desktop: `A/D` or left/right arrows to steer, `S` or down arrow to brake, `Shift` or `Space` for Nitro, and `P` or `Esc` to pause.
- Touch: left/right steering buttons plus Brake and Nitro. Landscape orientation is recommended.

## Features

- Three selectable stylized 3D riders with different handling, boost, and stability characteristics
- Six-rider near-abreast starts with Sport, Pro, and World Class AI difficulty
- Rival acceleration, racing-line selection, slipstreaming, defending, overtakes, Nitro strategy, contact, and distance-accurate placement
- Fair AI physics: rivals can miss an avoidance decision, strike a buoy, lose momentum, and recover just like the player
- Curved course geometry with predictive turn calls, centrifugal load, hydrodynamic grip, water chop, edge drag, and wave-driven launch/landing
- Live six-rider order, leader gaps, overtake feedback, and floating position labels for rivals ahead
- Detailed procedural jet skis, articulated riders, helmets, suits, buoys, ramps, gates, venue arch, officials' boats, crowd, palms, flags, clouds, and shoreline
- Multi-wave shader ocean with Fresnel reflection, crest foam, sun sparkle, animated sky, soft fog, and cinematic tone mapping
- PBR clear-coat vehicles, generated environment reflections, bloom on supported hardware, and an automatic software-renderer fallback
- Chase-camera lean, impact shake, speed vignette, Nitro trails, wake sheets, circular spray droplets, and water-on-lens effects
- Procedural engine, wind, boost, impact, and landing audio with a dedicated mute control
- Grip, G-force, water-surface, racing-line, and proximity-radar telemetry
- Time Attack, Sprint, and Precision modes
- 1 km, 3 km, and 5 km course options
- Automatic, High, and Low graphics quality
- Responsive desktop, phone, and tablet interfaces

The production 2D game remains at the repository root. This prototype is isolated under `/3d/`.

## Third-party assets

- Three.js 0.185.1 — MIT License
- Noto Sans Thai — SIL Open Font License 1.1
