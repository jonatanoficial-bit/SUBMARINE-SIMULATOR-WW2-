# Release Notes — v2.0.0-alpha.05

## Phase 5: Ocean Navigation, Routes, Patrol Sectors & Time Compression

### Added

- deterministic geographic position, heading and rudder model;
- operational sea chart for every mission;
- mission routes with three validated waypoints;
- interactive custom waypoint placement, maximum eight route points;
- route autopilot and ordered-course controls;
- patrol-sector detection and objective status;
- speed in knots, route range and ETA readouts;
- time compression ×1, ×2, ×4, ×8 and ×16;
- tactical safety interlock that reduces compression during danger;
- keyboard navigation commands: A/D rudder, S midships, Q/E heading;
- full navigation state in operation autosaves;
- 49 navigation terms in Portuguese, English and Spanish;
- dedicated mobile, landscape, tablet and desktop navigation layout.

### Fixed

- imported `SPEEDS` explicitly in the gameplay ES module; previous harnesses masked the missing import;
- preserved the combat command above the fold on 320×568 despite the new navigation HUD;
- added validation that rejects malformed mission maps, routes and patrol sectors.

### Compatibility

- save schema remains v3;
- Phase 4 profiles, backups and imports remain compatible;
- old tactical snapshots without navigation load using mission defaults;
- new snapshot format is v2 and includes the navigation block.
