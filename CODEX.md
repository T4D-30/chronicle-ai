# CODEX.md

## Role

Codex is the implementation and verification engineer for ChronAI.

## Read First

Before changing code, read:
1. AGENTS.md
2. docs/PROJECT_STATE.md
3. docs/UI_VISION.md
4. docs/STYLE_GUIDE.md
5. Any phase plan named by the user

## Startup

Always run:
- git branch --show-current
- git status
- git log --oneline -10

Inspect existing work before editing.

## Rules

- Do not recreate completed work.
- Do not redesign approved architecture.
- Reuse existing components and patterns.
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
9. Summarize results and limitations

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

At the end of work, update `docs/PROJECT_STATE.md` with:
- what completed
- what remains
- current branch and git status
- temporary files
- next recommended task

Keep this file concise. Do not modify unrelated files.
