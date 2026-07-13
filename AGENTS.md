# Chronicle AI Agent Guide

Chronicle AI is an AI-powered tabletop RPG platform.

Core rule:

The AI proposes. The rules engine resolves. The database remembers.

This file is the shared instruction guide for any AI agent working on Chronicle AI, including Claude, Codex, ChatGPT, or future tools.

## Project Continuity Documents

A fresh AI session should understand the project by reading these files in order:

1. `AGENTS.md` — repository-wide rules and development discipline.
2. `docs/PROJECT_STATE.md` — current branch, milestone, active work, temporary files, and next task.
3. `docs/ROADMAP.md` — long-term build order.
4. `docs/GAME_DESIGN.md` — canonical gameplay design.
5. `docs/DECISIONS.md` — architectural rationale and tradeoffs.
6. `docs/ARCHITECTURE.md` — living system responsibilities and data flow.
7. `docs/UI_VISION.md` — canonical presentation philosophy.
8. `docs/STYLE_GUIDE.md` — tokens, primitives, and UI code patterns.
9. `docs/CHANGELOG.md` — append-only historical record.

## Agent Roles

- ChatGPT: planning, architecture, system design, code review, roadmap, product decisions.
- Claude Code: implementation, refactoring, tests, documentation updates.
- Codex: implementation, verification, debugging, targeted edits, code review, and maintainability checks.

## Non-Negotiable Rules

1. Never fabricate game state.
2. Never let AI prose decide mechanical outcomes.
3. Preserve deterministic engine behavior.
4. Preserve database-backed persistence.
5. Do not modify Supabase migrations, Edge Functions, AI Director logic, or core engine logic without explicit approval.
6. Do not introduce parallel architectures when an existing subsystem or pattern already owns the job.
7. Work on one feature branch per phase.
8. Do not mix unrelated phases in one branch.
9. Add or update tests for user-facing changes.
10. Run TypeScript, tests, and production build before completion.
11. Remove temporary preview routes, verification pages, and scratch files before committing.
12. Do not push directly to `main`.

## Definition of Done

A task is not complete until:

- TypeScript passes.
- `npx vitest run` passes unless the user explicitly narrows verification.
- `npm run build:check` passes.
- Documentation is updated if user-facing behavior changed.
- `docs/PROJECT_STATE.md` is updated after each completed phase.
- `docs/CHANGELOG.md` receives an append-only entry after each completed phase.
- `docs/ARCHITECTURE.md` is updated if subsystem responsibilities or data flow changed.
- Files changed are summarized.
- Remaining limitations are documented.
- No secrets are committed.

## Chronicle AI Architecture

- The model proposes possible story narration.
- The rules engine resolves actions, dice, modifiers, conditions, combat, and outcomes.
- Supabase stores persistent characters, campaigns, sessions, turns, world state, and related records.
- The frontend displays and submits player decisions.
- The database is the source of truth for persistent state.
- Presentation components may read game state and submit intent, but must not mutate authoritative game state directly.
- Supabase writes belong in service/controller flows, not presentation components.

## Development Workflow

1. Inspect the current branch, status, recent commits, and project-state docs.
2. Continue from the current milestone; do not restart completed phases.
3. Create or stay on one feature branch per phase.
4. Implement only the requested phase or milestone.
5. Preserve existing behavior unless the task explicitly changes it.
6. Reuse existing components, services, engine functions, and UI patterns.
7. Run verification before every commit.
8. Remove temporary artifacts before committing.
9. Commit once per verified milestone with a clear message.
10. Update continuity docs before handoff.
11. Push the feature branch and open a pull request when requested.
12. Do not merge automatically unless instructed.

## Branching and Commit Discipline

- Use feature branches named for the phase or milestone.
- Keep unrelated work out of the branch.
- Do not combine roadmap phases in one commit.
- Do not commit temporary preview routes, manual verification pages, generated scratch files, or secrets.
- A commit should leave the repository understandable to a new AI session from the continuity docs alone.

## Coding Standards

- Prefer existing local helpers, components, hooks, services, and engine APIs.
- Keep changes narrow and aligned with current ownership boundaries.
- Add abstractions only when they remove real duplication or match an established pattern.
- Keep presentation additive over real state; do not invent state to make UI feel complete.
- Tests should cover user-facing behavior, architecture boundaries, and regressions introduced by the change.

## Stop and Ask Before

Stop and ask before:

- Changing database schema.
- Changing migrations.
- Changing engine rules.
- Changing AI Director behavior.
- Adding new paid services.
- Adding new environment variables.
- Deleting files.
- Rewriting large subsystems.
- Combining multiple roadmap phases.
- Changing public architecture documents in a way that contradicts current code.
