# CLAUDE.md

This project's agent instructions live in [AGENTS.md](AGENTS.md) — that file is the
source of truth for rules, workflow, and architecture. Read it before making any
changes. This file only exists so Claude Code loads it automatically.

## Workflow checklist

- [ ] Read AGENTS.md (if not already loaded this session).
- [ ] Confirm the task fits one phase, on one feature branch, off latest `main`.
- [ ] Check "Stop and Ask Before" in AGENTS.md — pause if the task touches any of those areas.
- [ ] Implement only what was requested.
- [ ] Run TypeScript, tests, and the production build.
- [ ] Update docs if user-facing behavior changed.
- [ ] Summarize files changed and any remaining limitations.
