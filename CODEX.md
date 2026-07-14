# CODEX.md

## Role

Codex is the implementation and verification engineer for ChronAI.

## Read First

Before changing code, read:
1. AGENTS.md
2. docs/PROJECT_STATE.md
3. docs/ROADMAP.md
4. docs/GAME_DESIGN.md
5. docs/DECISIONS.md
6. docs/ARCHITECTURE.md
7. docs/UI_VISION.md
8. Any phase plan named by the user

## Startup

Always run:
- git branch --show-current
- git status
- git log --oneline -10

Inspect existing work before editing.

## Rules

- Read `docs/PROJECT_STATE.md` before implementing.
- Continue from the current milestone.
- Never restart completed phases.
- Do not recreate completed work.
- Do not redesign approved architecture.
- Never introduce parallel architectures.
- Reuse existing components and patterns.
- Follow existing patterns.
- Presentation may read game state but never mutate it directly.
- Never fabricate world state.
- Never write directly to Supabase from presentation components.
- Do not change AI, rules, persistence, combat, or world-tick contracts unless explicitly approved.
- Remove temporary preview routes and verification files before committing.
- One verified commit per milestone.
- Stop and ask when scope or architecture is ambiguous.

## Workflow

1. Inspect
2. Summarize current state
3. Propose the smallest safe plan
4. Implement
5. Verify
6. Remove temporary artifacts
7. Commit
8. Update docs/PROJECT_STATE.md
9. Append docs/CHANGELOG.md
10. Update docs/ARCHITECTURE.md if responsibilities changed
11. Summarize results and limitations

## Verification

Before each commit run:
- npx tsc --noEmit
- npx vitest run
- npm run build:check

For visual work also verify:
- browser behavior
- responsive layout
- accessibility
- reduced motion
- zero console errors

## Handoff

After every completed phase, update `docs/PROJECT_STATE.md` with:
- what completed
- what remains
- current branch and git status
- temporary files
- next recommended task

Append `docs/CHANGELOG.md` with the date, branch, summary, architectural decisions, and verification results. Update `docs/ARCHITECTURE.md` when responsibilities, boundaries, or data flow changed.

Leave the repository ready for a fresh AI session.

Keep this file concise. Do not modify unrelated files.
