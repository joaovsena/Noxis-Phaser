Map Pipeline (v1)

Goal
- Keep map art, collision, and gameplay metadata separated.
- Allow replacing the visual base image without rewriting server logic.

Folder layout
- `public/maps/A1/`
- `public/maps/A2/`

Files per map
- `reference.json`: metadata from the concept/base image.
- `collision.json`: authoritative collision primitives (`rect`/`circle`).
- `spawns.json`: player/mob spawn and optional points of interest.

Current status
- `A1` has a first draft generated from the provided forest concept.
- Server still uses `server/config/index.ts` constants directly.

Next step to fully automate
1. Move `MAP_FEATURES_BY_KEY` loader to read `public/maps/<code>/collision.json`.
2. Add an offline script to convert painted collision layers to primitives.
3. Add a validator to ensure portals/spawns are not inside collision.
