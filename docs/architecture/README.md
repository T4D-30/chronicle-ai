# Chronicle AI Architecture

This folder is the architecture handbook for Chronicle AI. Chronicle AI is
designed around deterministic gameplay, persistent world state, and
AI-driven storytelling — three concerns that are deliberately kept separate
so that none of them can compromise the others.

The project's architectural philosophy is:

> The model proposes.
> The rules engine resolves.
> The database remembers.

Every document in this folder exists to describe, in implementation-agnostic
terms, how that philosophy is upheld across the system — what each subsystem
and concept is responsible for, what it owns, and where its boundaries are.

---

## Reading Order

These documents build on each other. Read them in this order the first time:

1. [architecture-principles.md](./architecture-principles.md)
2. [system-overview.md](./system-overview.md)
3. [world-model.md](./world-model.md)
4. [rules-engine.md](./rules-engine.md)
5. [persistence.md](./persistence.md)
6. [ai-director.md](./ai-director.md)
7. [adventure-controller.md](./adventure-controller.md)
8. [frontend.md](./frontend.md)

Then the domain documents — [character.md](./character.md),
[npc.md](./npc.md), [relationship.md](./relationship.md),
[reputation.md](./reputation.md), [faction.md](./faction.md),
[region.md](./region.md), and [location.md](./location.md) — which each
elaborate on a single concept from the World Model in more depth.

---

## Architecture Layers

Chronicle AI's architecture is organized in layers, each building on the one
above it:

```
Core Principles
      ↓
  World Model
      ↓
 Core Systems
      ↓
Domain Concepts
      ↓
   Gameplay
      ↓
   Platform
```

Core Principles state what must always be true. The World Model defines the
shared vocabulary built on top of those principles. Core Systems are the
subsystems that enforce the principles and operate on the World Model.
Domain Concepts elaborate individual pieces of the World Model in depth.
Gameplay and Platform are where this architecture meets the player and the
underlying environment it runs on.

---

## Current Architecture Documents

**Core Principles**
- [architecture-principles.md](./architecture-principles.md)
- [system-overview.md](./system-overview.md)

**World Model**
- [world-model.md](./world-model.md)

**Core Systems**
- [rules-engine.md](./rules-engine.md)
- [persistence.md](./persistence.md)
- [ai-director.md](./ai-director.md)
- [adventure-controller.md](./adventure-controller.md)
- [frontend.md](./frontend.md)

**Domain Concepts**
- [character.md](./character.md)
- [npc.md](./npc.md)
- [relationship.md](./relationship.md)
- [reputation.md](./reputation.md)
- [faction.md](./faction.md)
- [region.md](./region.md)
- [location.md](./location.md)

---

## Design Goals

Chronicle AI's architecture emphasizes:

- Deterministic mechanics.
- Persistent world state.
- Subsystem separation.
- Long-term maintainability.
- Extensibility.
- AI provider independence.
- Multiple rulesets.

---

## Document Philosophy

Architecture documents in this folder:

- Define meaning.
- Define ownership.
- Define boundaries.

They do not define:

- Implementation.
- APIs.
- Schemas.
- TypeScript.
- Frameworks.

If a document in this folder starts describing any of the latter, it has
drifted out of scope.

---

## Future Architecture

This handbook will continue to grow. Areas expected to gain their own
architecture documents over time include:

- **World Domain** — remaining World Model concepts not yet documented in
  depth (such as Item, Inventory, Quest, Encounter, Journal, Codex, and
  Timeline).
- **Gameplay** — how Turns, Sessions, and Campaigns come together as played
  experience.
- **AI** — narrative style, memory consumption, and provider integration
  patterns at the architecture level.
- **Platform** — the operational and environmental concerns Chronicle AI
  runs within.
- **Developer Experience** — how contributors are meant to work with this
  architecture day to day.

---

Read this README before modifying anything in this folder. Every document
here exists to keep Chronicle AI's subsystems honest about what they own —
changes to architecture should strengthen that separation, not blur it.
