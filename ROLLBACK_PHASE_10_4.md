# Rollback — Phase 10.4

1. Keep the current save export and the Phase 10.3 ZIP.
2. Remove the deployed Phase 10.4 files.
3. Deploy `v2.0.0-alpha.10.3`.
4. Clear the old PWA cache if the browser keeps Phase 10.4 assets.
5. Existing schema-v3 campaign saves remain compatible. Tactical autosaves created with snapshot v10 should be discarded before rollback.
