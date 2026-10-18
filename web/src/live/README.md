# live

The live-session pipeline shared by the patient view and the therapist portal (F9): webcam or fake poses → features → rule state → `store.ts`, mirrored to the therapist tab over a `BroadcastChannel`. `types.ts` and `store.ts` are the interface the pages read.

- `usePatientSession.ts` (patient tab) runs the plain webcam and relays video over `channel.ts`; it does no analysis. Analysis plugs in by pushing `LiveSample`s and flags into `store.ts` from the patient session; the recorder, physician replay, `InstructionCard` and `AlertTint` already consume them. `useDoctorFeed.ts` (therapist tab) runs the local pipeline demo; `actions.ts` holds `setNear`, `requestRecaptureRest` and `setBuzz`, which work in both tabs. `videoBus.ts` keeps only the latest relayed video frame.
- `pipeline.ts` auto-captures the rest pose (about 1 s of still, visible frames), then runs features and rules for every frame. `fakePose.ts` and `demoLoop.ts` supply deterministic demo poses (demo-only numbers) when there is no camera or no patient tab.
- STUBs until the real tasks merge: `featuresStub.ts` is `STUB(C2)` (replace with `lib/features.ts`), `rulesStub.ts` is `STUB(C5)` (replace with `lib/rules.ts`), and the rest-stillness epsilon in `pipeline.ts` is `STUB(C2)`. Search for `STUB(` when they land.
