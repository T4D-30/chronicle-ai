# Chronicle AI — Architecture Principles

This document is the architecture constitution for Chronicle AI. It states
the permanent, high-level principles that every subsystem — present or
future — must uphold. Where other architecture documents describe how a
specific subsystem works (see [system-overview.md](./system-overview.md) and
[rules-engine.md](./rules-engine.md)), this document states *why* the
architecture is shaped the way it is, and which parts of that shape are not
open for revision.

## Core Principle

> The model proposes. The rules engine resolves. The database remembers.

Every subsystem in Chronicle AI exists in service of this principle. No
component may take on a responsibility that belongs to another link in this
chain:

- **The model proposes.** AI-generated narration suggests story framing,
  tone, and direction.
- **The rules engine resolves.** Mechanical outcomes are computed
  deterministically, independent of narration.
- **The database remembers.** Durable state is recorded once, in one place,
  and treated as fact from then on.

## Deterministic Mechanics Are Non-Negotiable

Mechanical resolution — dice, modifiers, conditions, combat, and any other
rule-governed outcome — must be deterministic: the same inputs and state
always produce the same outcome. This is not a quality goal to be balanced
against others; it is a hard constraint. A system that makes gameplay
outcomes trustworthy and auditable cannot allow probabilistic or
discretionary components — including AI models — anywhere in the mechanical
resolution path.

## Persistence Is the Source of Truth

Supabase (or whatever persistence layer Chronicle AI uses) is the single
source of truth for durable state: characters, campaigns, sessions, turns,
and world state. Every other subsystem treats persisted state as fact rather
than maintaining its own competing copy of the truth. If it matters to
gameplay and it needs to survive beyond a single request, it belongs in
persistence — not in memory, and not in an AI response.

## Separation of Concerns

Chronicle AI's architecture is divided into five subsystems, each with a
single, non-overlapping responsibility:

- **Frontend** — presents state to the player and collects player decisions.
  It does not determine outcomes.
- **Adventure Controller** — orchestrates the order in which the other
  subsystems execute for a given request. It does not implement game rules.
- **Rules Engine** — resolves mechanics deterministically. It does not
  narrate, persist, or orchestrate.
- **AI Director** — generates narration based on resolved outcomes. It does
  not decide those outcomes.
- **Persistence Layer** — stores durable state as the system of record. It
  does not decide outcomes or narrate them.

Each subsystem may only act within its own boundary. A change that makes one
subsystem quietly absorb another's responsibility is an architecture
violation, regardless of how small it appears.

## Narration Describes; It Does Not Decide

AI narration may describe an outcome in any voice, tone, or level of detail.
It may never create, alter, or override a mechanical outcome. By the time
narration is generated, the outcome it describes has already been fixed by
the Rules Engine and is no longer in question. Narration that contradicts a
resolved outcome is a bug, not a stylistic choice.

## Extensibility

Chronicle AI is expected to grow along several axes without disturbing the
principles above:

- **Multiple rule systems** — the architecture must accommodate additional
  tabletop systems alongside whatever is currently supported, without
  changing the responsibilities of the surrounding subsystems.
- **Multiple AI providers** — the source of narration or proposals must be
  able to change without affecting how mechanics are resolved or how state is
  persisted.
- **Future modules** — new capabilities should extend the existing subsystem
  boundaries rather than blur them. A new module still fits into one of the
  five responsibilities above, or it does not belong in this architecture.

Extensibility is achieved by adding to the architecture, not by relaxing its
boundaries.

## Architectural Invariants

The following are permanent constraints. They apply regardless of feature,
rule system, or AI provider:

- Equal inputs always produce equal mechanical outputs.
- AI narration cannot modify mechanical outcomes.
- Persisted state is the only source of truth for durable game state.
- Every resolved action becomes part of persistent campaign history.
- Mechanics are resolved before narration is generated.
- Each subsystem acts only within its own responsibility.
- No subsystem may bypass the Adventure Controller's orchestration to invoke
  another subsystem directly.
