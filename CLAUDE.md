# Rules for Claude in the TrueReach repo

## 1. Before doing anything
1. **Read `PLAN.md`.** It is the source of truth. If a request conflicts with it, say so before writing code.
2. **Confirm who and what.** Ask the user for their name and task ID (PLAN.md §14–15) if they haven't said. Only touch the files that task needs (repo layout: §17).
3. **Check dependencies.** Look up the task in PLAN.md §13.3 (dependency map) and §13.4 (wait points). Run `git fetch && git log origin/main --oneline` and check that every task this one depends on is **merged on `main`**. A ticked box in PLAN.md is not proof; the merged code is. Then tell the user one of:
   - "All dependencies are on `main`; building against the real code."
   - "<taskID> isn't on `main` yet; I'll build against the contract with a stub and mark it `STUB(<taskID>)`."
   - "This task can't start meaningfully until <taskID> lands. Suggest picking <next unblocked task in your lane>."

## 2. Working in parallel without stepping on each other
4. **Build against contracts, not teammates' branches.** Never copy code from, branch off, or merge a teammate's unmerged branch. If you need something that isn't on `main`, use the types in `web/src/lib/types.ts` plus a fake or stub. Existing fakes: `fakeSensor.ts` (A3), fake `PoseFrame`s (F1), stub `/classify` (E3a).
5. **Mark every stub** with a comment `// STUB(<taskID>): replace when <taskID> merges` (Python: `# STUB(...)`). When that task merges, search for `STUB(<taskID>)` and replace each one.
6. **Stay in your files.** Each folder or file has an owner in PLAN.md §17.
   - If your task needs a change in another lane's file, stop and tell the user which file, what change, and why, so they can ask the owner.
   - `types.ts` and the serial/REST contracts change only via an `[ACCEPTED]` entry in PLAN.md §20.
   - `config.ts` thresholds are set only by Ehan's D3/E4 tasks; others read them.
7. **Before every commit:**
   - Run `git status` and confirm only your task's files changed.
   - Don't commit stray edits to shared files.
8. **Before opening a PR:**
   - `git fetch && git merge origin/main` into your branch. Merge, never rebase a pushed branch.
   - Resolve conflicts only in your own files; if a conflict is in someone else's file, stop and ask.
   - Build or run what you touched (`npm run build` in `web/`, `pio run` in `firmware/`, or the Python script).
   - Re-check §1 rule 3: if a dependency still isn't on `main`, say which stub you used in the PR template.
9. **Camera-first.** Everything except tasks B and S must work with the webcam alone and no sleeve connected. Never make camera-only mode depend on the sleeve.
10. **Improvements (PLAN.md §15)** start only after Gate 2 and the user's own Phase 2 tasks are done.
    - They must be additive (new files, profiles, toggles).
    - The forward-reach camera-only demo must still work with the improvement off.

## 3. Plan changes
11. **New idea or change of direction:** don't improvise. Draft a one-line `[PROPOSED]` entry for PLAN.md §20 (name · what · why · tasks affected), show it to the user, and wait. Don't implement it until it's `[ACCEPTED]`. Plan edits go in their own PR that only touches PLAN.md.
12. **PLAN.md edits:**
    - On existing lines, only tick a task checkbox (in the PR that completes it) or add/remove an `@name` claim.
    - Everything else is appended to §20.

## 4. Git safety
13. Work only on a branch named `<person>/<taskID>-<short>`.
    - Never commit to `main`, never force-push, never rewrite history.
    - Never run `git reset --hard`, `git clean -fd`, or delete branches you didn't create.
    - Ask before any command that discards uncommitted work.
14. Small commits. Message format: `<taskID>: <what>`, e.g. `C2: rest-pose capture`.
15. Fill in `.github/pull_request_template.md` completely, including dependencies and stubs. Say exactly what you tested.
16. **Never commit** `.env`, API keys or Kaggle tokens, anything in `ml/data/trsp/`, model files over 50 MB, or raw video.

## 5. Correctness
17. **Never invent numbers.**
    - Every value in `config.ts` needs a comment naming its source (TRSP analysis, RPSS, "hand-tuned during spot check", or "therapist input, not data-validated").
    - Until a real value exists, use a clearly named placeholder.
    - Accuracy numbers come only from `ml/eval.py` and the documented spot check.
18. **Feature math must match** between `web/src/lib/features.ts` and `ml/features.py` (PLAN.md §6.1). If you change one, flag that the other needs the same change.
19. **Rules and reps are generic over `ExerciseProfile`.** Never hard-code forward-reach logic in `rules.ts` or `reps.ts`; put it in the profile.
20. **Keep it simple on purpose.** Don't add GRUs, fine-tuning, new datasets, or exercises outside PLAN.md §15.
21. **Code quality (the AI-track judges read the repo):**
    - one-line docstring per function
    - a short README section per folder
    - no dead code, no commented-out blocks
