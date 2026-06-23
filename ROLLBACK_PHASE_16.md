# Rollback Plan — Phase 16

To rollback Phase 16:
1. Restore v2.0.0-alpha.30 build files.
2. Remove `data/campaign_events.json`.
3. Remove `js/systems/campaignEvents.js`.
4. Remove `css/phase16-campaign-events.css`.
5. Revert `BUILD_INFO.json`, `js/build.js`, `manifest.json`, `package.json`, `service-worker.js`, `js/dataLoader.js`, `js/app.js`, `js/save.js`, `js/screens/campaign.js`, `js/screens/strategy.js`, translations and smoke harness updates.
6. Keep user saves safe: schema 10 saves contain `strategy.campaignEvents`; schema 9 readers will ignore it only after restoring previous migration logic.
