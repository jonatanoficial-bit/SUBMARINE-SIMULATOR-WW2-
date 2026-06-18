# Training and Difficulty Architecture v1

## Difficulty
`DifficultyProfile.js` is the single source of truth for Cadet, Officer, Simulator and Hardcore. The active profile is selected in settings, sanitized before persistence and passed into `SimulationEngine`. The engine includes the profile in tactical snapshots, so resume operations remain deterministic.

The profile modifies enemy detection, incoming damage, sensor confidence, TDC quality, historical torpedo failure probability and resource consumption. No profile bypasses depth, noise, contact, arc, reload, damage-control or disengagement rules.

## Operational qualification
`OperationalTraining.js` observes immutable simulation snapshots. It never changes the simulation. Checklist progress is inferred from real actions: propulsion, depth, contact acquisition, periscope observation, TDC solution, torpedo launch, evasion and safe-area confirmation.

## Context help
The gameplay shell owns the help drawer. Every station has a localized explanation and a short doctrine recommendation. The drawer is independent of the engine and can be disabled in settings.

## Propulsion homologation
Phase 10.4 also formalizes the distinction between telegraph order and measured speed. `SubmarinePhysicsSystem` computes a target speed from energy, damage, depth and class efficiency, then approaches it with deterministic acceleration/deceleration. Navigation, noise and gauges read the measured speed, while the telegraph remains only a command.

## Homologation gates
Release requires static parsing, ESM import, unit tests, five Chromium browser batteries, 13-mission tactical telemetry, four-profile difficulty telemetry and manifest verification after clean ZIP extraction.
