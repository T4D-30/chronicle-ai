# Chronicle AI Agent Guide

Chronicle AI is an AI-powered tabletop RPG platform.

Core rule:

The AI proposes. The rules engine resolves. The database remembers.

This file is the shared instruction guide for any AI agent working on Chronicle AI, including Claude, Codex, ChatGPT, or future tools.

## Agent Roles

- ChatGPT: planning, architecture, system design, code review, roadmap, product decisions.
- Claude Code: implementation, refactoring, tests, documentation updates.
- Codex: code review, debugging, targeted edits, maintainability checks.

## Non-Negotiable Rules

1. Never fabricate game state.
2. Never let AI prose decide mechanical outcomes.
3. Preserve deterministic engine behavior.
4. Preserve database-backed persistence.
5. Do not modify Supabase migrations, Edge Functions, AI Director logic, or core engine logic without explicit approval.
6. Do not push directly to main.
7. Work on one feature branch per phase.
8. Do not mix unrelated phases in one branch.
9. Add or update tests for user-facing changes.
10. Run TypeScript, tests, and production build before completion.

## Definition of Done

A task is not complete until:

- TypeScript passes.
- Relevant tests pass.
- Production build passes.
- Documentation is updated if user-facing behavior changed.
- Files changed are summarized.
- Remaining limitations are documented.
- No secrets are committed.

## Chronicle AI Architecture

- The model proposes possible story narration.
- The rules engine resolves actions, dice, modifiers, conditions, combat, and outcomes.
- Supabase stores persistent characters, campaigns, sessions, turns, world state, and related records.
- The frontend displays and submits player decisions.
- The database is the source of truth for persistent state.

## Development Workflow

1. Start from latest main.
2. Create a feature branch.
3. Implement only the requested phase.
4. Preserve existing behavior unless the task explicitly changes it.
5. Run verification.
6. Commit with a clear message.
7. Push the feature branch.
8. Open a pull request.
9. Do not merge automatically unless instructed.

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
