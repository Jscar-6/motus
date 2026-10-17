# patient

Pieces of the landing page and the patient view (`pages/Landing.tsx`, `pages/Session.tsx`).

- `cues.ts`: turns a live sample into one warm cue and a severity (PLAN §20 I3b wording).
- `InstructionCard.tsx`: the white card; the sentence cross-fades only when the cue changes.
- `AlertTint.tsx`: full-viewport vignette that deepens from beige to red as alerts fire (opacity only).
- `PoseCanvas.tsx`: stick figure and wrist trail on a canvas, drawn in its own rAF loop from the live store.
- `NearFarControl.tsx`: frosted Near | Far toggle.
- `StippleArc.tsx`: decorative stippled reach arc for the landing page.
- `PlaceholderPage.tsx`: shared layout for Setup and Results.
- `motion.ts`: the shared "materialize" entrance and the house ease-out.
