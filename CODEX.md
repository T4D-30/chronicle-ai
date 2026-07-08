# Codex Entry Point

`AGENTS.md` is the source of truth for Chronicle AI agent instructions. Read and follow it before doing any work in this repository.

Codex should focus on code review, bug finding, debugging, targeted fixes, and maintainability checks. Keep changes narrow, preserve deterministic engine behavior, and avoid modifying protected areas unless the user explicitly approves it.

## Review Checklist

- Verify AI prose does not determine mechanical outcomes.
- Confirm game state comes from persisted data, not fabricated assumptions.
- Check for regressions in deterministic rules engine behavior.
- Verify the implementation follows the current architecture instead of introducing parallel patterns.
- Look for missing tests around user-facing or behavioral changes.
- Flag maintainability risks, unclear ownership boundaries, and unnecessary broad refactors.
- Ensure TypeScript, relevant tests, and production build are run before completion when code changes are made.
