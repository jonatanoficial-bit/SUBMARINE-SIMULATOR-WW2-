# Rollback — Phase 5

## Safe rollback target

`v2.0.0-alpha.04` — Phase 4.

## Procedure

1. Preserve exported `.scww2save.json` profile archives.
2. Replace all Phase 5 files with the complete Phase 4 ZIP.
3. Clear only the PWA cache named for `2.0.0-alpha.5` or unregister the service worker once.
4. Reload the application.
5. Phase 4 can read the profile save schema v3, but it will ignore navigation fields inside a Phase 5 operation snapshot. Discard an active Phase 5 operation before rollback for a completely clean tactical state.

## Files introduced in Phase 5

- `js/engine/navigation/NavigationSystem.js`
- `css/phase5-navigation.css`
- `tests/navigation.test.js`
- `docs/NAVIGATION_ARCHITECTURE_V1.md`
