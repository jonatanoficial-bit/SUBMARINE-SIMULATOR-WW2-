# Rollback — Phase 4

## Previous safe build

`SUBMARINE-COMMANDER-WW2-v2.0.0-alpha.03-FASE-3.zip`

## Procedure

1. Export each Phase 4 profile from **Manage profiles and saves**.
2. Preserve the entire Phase 4 ZIP and exported `.scww2save.json` files.
3. Remove Phase 4 files from hosting.
4. Publish the complete Phase 3 ZIP.
5. Clear or update the service worker cache `submarine-commander-2.0.0-alpha.4`.
6. Reload twice or reinstall the PWA.
7. Confirm `v2.0.0-alpha.03` in the visible build footer.

## Save warning

Phase 4 uses schema 3 and new profile keys. Phase 3 reads only the legacy single-save keys and will not import a Phase 4 archive through its UI. The schema-2 source record is retained in `valeGames.submarineCommander.v3.legacyArchive` when migration occurred, but it may not include progress created after Phase 4. Returning to Phase 4 restores access to the v3 profiles.
