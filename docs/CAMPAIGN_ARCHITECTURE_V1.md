# Campaign Architecture V1 — Phase 11

## Goal
Phase 11 replaces the shared mission list with independent national campaigns for Germany, the United Kingdom and the United States while preserving the homologated simulator core from Phase 10.4.

## Data model
- `data/campaigns.json` defines one campaign per nation.
- `data/missions.json` contains mission-level metadata with `nationId`, `campaignId`, `campaignOrder`, campaign briefing keys and navigation plans.
- Each campaign owns exactly eight ordered missions.
- The first mission of each campaign starts as `available`; the remaining missions are unlocked only by completing the previous mission in the same national campaign.

## Runtime integration
- `loadGameData()` loads and validates campaigns, mission relations and campaign membership.
- `missionsForNation()` filters the campaign screen to the active commander's nation.
- `syncMissionAvailability()` now unlocks progression by campaign lane instead of global mission order.
- Briefing screens receive campaign intelligence: base, strategic goal and enemy force.

## Save compatibility
The save schema remains v3. Completed mission IDs are preserved. Older saves with legacy mission IDs remain loadable; new progression starts through the current campaign lane.

## Anti-break rules
- Campaigns must reference existing missions.
- Missions must reference valid nations and campaigns.
- Campaign mission order must match mission `campaignOrder`.
- All keys must exist in PT-BR, EN and ES.
- Mobile campaign view must fit 360 px width without overflow.
