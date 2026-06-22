# Phase 11 — Independent Campaigns Audit

PASS: 26/26

- [PASS] metadata points to phase 11 retrofit — {'product': 'Submarine Commander WW2', 'studio': 'Vale Games', 'version': 'v2.0.0-alpha.26', 'semver': '2.0.0-alpha.26', 'buildId': 'SCWW2-20260622-1240-BRT-F11-TRI-CAMPAIGN', 'date': '2026-06-22', 'time': '12:40', 'timezone': 'America/Sao_Paulo', 'phase': '11', 'phaseName': 'Independent Germany UK USA Campaign Retrofit', 'channel': 'alpha', 'release': False, 'qaStatus': 'PASS', 'saveSchemaVersion': 6, 'notes': 'Phase 11 retrofit on top of the latest base build. Adds a tri-nation independent campaign selector, preview-only safeguards, timeline/act maps for Germany, United Kingdom and United States, and anti-mix launch guards so missions cannot be started with the wrong navy profile. Later systems through phase 25 remain preserved.'}
- [PASS] package and manifest updated — {'pkg': '2.0.0-alpha.26', 'manifest': '2.0.0-alpha.26'}
- [PASS] service worker cache bumped — 
- [PASS] index title and meta updated — 
- [PASS] phase 11 CSS still loaded and expanded — 
- [PASS] exactly three independent campaign nations — ['de', 'uk', 'us']
- [PASS] de has eight ordered mission ids — ['de1', 'de2', 'de3', 'de4', 'de5', 'de6', 'de7', 'de8']
- [PASS] de has timeline and act map — 
- [PASS] de chapters are isolated inside same campaign — 
- [PASS] uk has eight ordered mission ids — ['uk1', 'uk2', 'uk3', 'uk4', 'uk5', 'uk6', 'uk7', 'uk8']
- [PASS] uk has timeline and act map — 
- [PASS] uk chapters are isolated inside same campaign — 
- [PASS] us has eight ordered mission ids — ['us1', 'us2', 'us3', 'us4', 'us5', 'us6', 'us7', 'us8']
- [PASS] us has timeline and act map — 
- [PASS] us chapters are isolated inside same campaign — 
- [PASS] state stores selected campaign preview nation — 
- [PASS] app filters preview missions by selected nation — 
- [PASS] wrong-nation launch guard exists — 
- [PASS] campaign renderer includes three-nation selector — 
- [PASS] campaign renderer blocks other-nation launch visually — 
- [PASS] translation parity across PT/EN/ES — {'pt-BR': 1402, 'en': 1402, 'es': 1402}
- [PASS] new campaign UI keys translated pt-BR — []
- [PASS] new campaign UI keys translated en — []
- [PASS] new campaign UI keys translated es — []
- [PASS] campaign unit tests pass — TAP version 13
# Subtest: each nation has one independent campaign with eight ordered missions
ok 1 - each nation has one independent campaign with eight ordered missions
  ---
  duration_ms: 1.736124
  type: 'test'
  ...
# Subtest: missions carry campaign metadata, briefing keys and valid navigation
ok 2 - missions carry campaign metadata, briefing keys and valid navigation
  ---
  duration_ms: 0.447969
  type: 'test'
  ...
# Subtest: campaign progression unlocks only within the same nation
ok 3 - campaign progression unlocks only within the same nation
  ---
  duration_ms: 0.198935
  type: 'test'
  ...
# Subtest: all campaign and mission keys are translated in three languages
ok 4 - all campaign and mission keys are translated in three languages
  ---
  duration_ms: 0.458913
  type: 'test'
  ...
# Subtest: campaign screen can preview all nations without launching wrong-nation missions
ok 5 - campaign screen can preview all nations without launching wrong-nation missions
  ---
  duration_ms: 2.111183
  type: 'test'
  ...
1..5
# tests 5
# suites 0
# pass 5
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 110.428482


- [PASS] all JavaScript modules pass syntax check — []
