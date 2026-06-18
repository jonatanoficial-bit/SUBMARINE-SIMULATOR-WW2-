# Navigation Architecture v1 — Phase 5

## Purpose

Phase 5 introduces deterministic operational navigation without coupling geographic calculations to the DOM. The simulation engine owns every navigation value; the screen only sends commands and renders immutable snapshots.

## State model

`NavigationSystem` stores:

- geographic position in decimal latitude/longitude;
- current heading and ordered heading in degrees;
- rudder angle from 35° port to 35° starboard;
- autopilot state;
- mission route and active waypoint index;
- patrol-sector bounds and entry status;
- requested and effective time compression;
- tactical safety limit;
- simulated elapsed time and travelled distance;
- current speed in knots and route ETA.

The navigation block is embedded in `SimulationEngine.snapshot()` as snapshot format v2. Operation autosaves therefore restore route edits, heading, rudder, position, selected waypoint, patrol progress and compression requests.

## Determinism

Movement uses the engine fixed step. Knots are converted to nautical miles using simulated milliseconds. Latitude uses 60 NM per degree; longitude is corrected by the cosine of mean latitude. No DOM timer performs navigation calculations.

## Autopilot

The route autopilot:

1. calculates the bearing to the active waypoint;
2. selects rudder proportionally to the shortest heading error;
3. advances the boat using telegraph speed and submarine speed statistics;
4. marks a waypoint reached inside a 0.22 NM radius;
5. advances to the next waypoint and completes the route after the final point.

Manual rudder input disengages autopilot. Heading nudges re-enable heading control.

## Time-compression interlock

Available requests are ×1, ×2, ×4, ×8 and ×16. The requested value is retained, but the effective value is constrained:

- maximum ×16 during undetected patrol;
- maximum ×4 during alert;
- maximum ×1 during hunt, periscope exposure, torpedo transit, active repair, recent damage or mission failure.

When conditions become safe, the system may restore the retained request automatically. This prevents high compression from skipping tactical danger.

## Mission navigation data

Every mission includes:

- map bounds;
- geographic origin and initial heading;
- one patrol-sector rectangle;
- three validated route waypoints.

`dataLoader.js` blocks startup if a route is empty, exceeds eight points, lies outside the map, or has malformed sector bounds.

## User-created route points

The chart converts pointer coordinates into geographic coordinates. Custom waypoints are clamped to the mission map and the complete route is limited to eight points. Users can skip a waypoint, remove the last point or restore the original mission route.

## Future expansion

Phase 5 deliberately keeps one operational map layer. Later phases can add coastline geometry, weather cells, depth contours, minefields, convoy tracks, radio intelligence and ports without changing the save contract.
