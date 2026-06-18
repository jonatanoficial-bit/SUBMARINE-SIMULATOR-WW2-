# Save Architecture v3 — Phase 4

## Objectives

The Phase 4 save layer separates campaigns into three independent local profiles and prevents a partially written record from replacing the last valid career.

## Storage layout

- `valeGames.submarineCommander.v3.profiles`: active slot and profile metadata.
- `valeGames.submarineCommander.v3.slot-N.primary`: verified primary campaign.
- `valeGames.submarineCommander.v3.slot-N.backup.1..3`: rotating recovery copies.
- `valeGames.submarineCommander.v3.slot-N.temp`: verified temporary transaction record.
- `valeGames.submarineCommander.v3.slot-N.operation`: tactical operation autosave.
- `valeGames.submarineCommander.v3.transaction`: pending write journal.
- `valeGames.submarineCommander.v3.legacyArchive`: preserved Phase 1–3 save before migration.

## Transaction sequence

1. Sanitize and migrate the in-memory save to schema 3.
2. Build a checksum-protected envelope.
3. Write a transaction journal containing the previous primary record and the checksum expected for the new record.
4. Write and decode the temporary record.
5. Rotate up to three valid backups.
6. Write and decode the primary record.
7. Update profile metadata.
8. Remove the temporary record and journal.

If any mandatory step fails, the previous primary record is restored. On the next boot, an unfinished journal is either completed from the verified temporary record or rolled back.

## Legacy migration

The old Phase 1–3 keys are decoded, sanitized, upgraded to schema 3, committed to slot 1 and archived. A migration marker ensures that deleting a migrated profile does not recreate it from the legacy archive.

## Export and import

Exports use the `SCWW2_SAVE_ARCHIVE` format. The archive contains the sanitized career, source slot, build version, export timestamp and checksum. Imports are rejected when the checksum, JSON structure or save schema cannot be validated. Import uses the same transaction and backup path as a normal save.

## Tactical autosave

The deterministic engine serializes mission identity, depth, speed, hull, systems, torpedoes, decoys, contacts, escort state, detection, periscope view, torpedo transit, cooldowns, repair state and mission metrics. A protected operation autosave is written periodically and again when leaving gameplay. Completed or failed operations clear the tactical autosave.

## Rollback compatibility

Phase 4 upgrades the local save schema from 2 to 3. The original schema-2 record is archived, but Phase 3 cannot directly read the new profile keys. Export a Phase 4 profile before rolling back. Returning to Phase 4 will read the v3 profiles normally.
