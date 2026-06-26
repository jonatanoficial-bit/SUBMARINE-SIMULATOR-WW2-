# Submarine Commander WW2 — Phase 51 Delivery Report

## Build
- Version: v2.0.0-alpha.66
- Build ID: SCWW2-20260626-1814-BRT-F51-CAPTAIN-COMMAND-ROOM
- Phase: 51 — Silent Depth Definitive Captain Command Room
- Save schema: 40 (stable)
- Channel: alpha
- QA: PASS

## Goal
Create the definitive captain command room for mobile-first gameplay. The captain receives reports from crew stations, decides the next order, and can still switch to manual control to operate the submarine alone.

## Implemented
- Added `js/systems/captainCommandRoom.js` as a pure decision-view layer.
- Added `css/phase51-captain-command-room.css` with mobile fullscreen focus and horizontal station cards for small screens.
- Added the new command-room panel to gameplay without replacing Phase 47, 48, 49 or 50 systems.
- Used existing `assets/avatars` and `assets/ui/instruments` files for station portraits and icons.
- Preserved all existing audio/music assets and the current audio director.
- Added captain/manual separation:
  - Captain mode: station recommendations execute as orders.
  - Manual mode: the station cards only navigate to stations; the player operates directly.
- Added PT-BR, EN and ES translations for all command-room UI keys.
- Updated PWA manifest, service worker, smoke harness, package scripts and build metadata.

## Gameplay Behavior
- Patrol: recommends planned patrol or silence.
- Contact: recommends shadowing or preparing attack.
- Target classified: recommends preparing attack.
- TDC/periscope ready: asks captain to authorize fire.
- Torpedo in water: recommends shadowing or evasion.
- Escort/air threat: prioritizes evasion/silent running.
- Critical damage: mechanic report takes priority and recommends repair.
- Manual mode: crew stops executing recommendations automatically.

## Validation
- `node --check js/screens/gameplay.js`: PASS
- `node --check js/systems/captainCommandRoom.js`: PASS
- `npm test`: 377/377 PASS
- `npm run audit`: PASS
- `npm run smoke`: 50/50 PASS

## Notes
- No existing image, audio or music asset was removed.
- Save schema remains stable at 40.
- Build remains alpha; manual mobile/iOS/Android validation is still recommended before public beta.
