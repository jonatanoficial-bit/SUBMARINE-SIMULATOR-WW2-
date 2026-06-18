# Known Issues — Phase 4

No critical or blocking defect remains open in this delivery.

## Planned limitations

- Profiles are local to the browser/device; cloud synchronization is not part of Phase 4.
- Browser storage can still be erased by the user, private browsing policies or operating-system cleanup. Manual export is the external backup path.
- Tactical recovery resumes from the latest protected snapshot, not from an exact rendered animation frame.
- Only one tactical autosave is kept per profile; starting a new mission intentionally replaces the prior unfinished operation after confirmation through the interface flow.
- Phase 3 does not understand the new v3 profile keys. The original legacy record is archived, and users should export profiles before a manual rollback.
- The simulation rules remain simplified until navigation and submarine physics phases.
- The visual harness uses Chromium with real project files injected into a deterministic page because the environment blocks localhost navigation administratively.
