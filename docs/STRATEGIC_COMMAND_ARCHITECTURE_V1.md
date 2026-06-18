# Strategic Command Architecture V1 — Phase 13

Phase 13 adds a strategic naval command layer over the Phase 12 career/logistics loop. It introduces national theaters, convoy lanes, directives, intelligence networks, command points, decryption, false-contact risk and exportable intelligence dossiers.

## Rules preserved
- Independent Germany, United Kingdom and United States campaigns remain unchanged.
- Career, logistics, save slots, PWA and gameplay systems remain additive.
- Launch safety still blocks patrols when supplies are insufficient.

## New save block
`save.strategy` stores theater selection, selected convoy lane, active directive, intelligence level, decryption, false-contact risk, strategic pressure, command points and command/intelligence history.
