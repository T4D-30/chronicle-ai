# Chronicle AI — Architecture Document Standard

## Purpose

This document defines the required structure for every architecture document
in Chronicle AI. Every future architecture document should follow this
standard, so that the handbook reads as one consistent body of work rather
than a collection of independently styled notes. See
[../README.md](../README.md) for how documents following this standard fit
together.

## Scope

This standard applies to every document in `docs/architecture/`, including
core system documents (such as `rules-engine.md` or `persistence.md`) and
domain concept documents (such as `character.md` or `faction.md`). It does
not apply to non-architecture documentation elsewhere in `docs/`.

## Required Sections

Every architecture document should include the following sections, in this
order, omitting only those explicitly marked as conditional:

- **Purpose** — what the document defines and why it exists.
- **Concept Definition** — what the subsystem or concept is, in plain terms.
- **Responsibilities** (if applicable) — what the subsystem or concept is
  responsible for doing or representing.
- **Authoritative Ownership** — which subsystem owns mechanics, persistence,
  narration, orchestration, and presentation for this concept.
- **Relationship to Other Concepts** — how this document's subject connects
  to other parts of the architecture.
- **Lifecycle** (when applicable) — how the subject comes into existence,
  changes over time, and ceases to be relevant.
- **Architectural Invariants** — the non-negotiable rules that must always
  hold true.
- **Mermaid Diagram** (when appropriate) — a conceptual visualization of the
  document's subject and its relationships.
- **Cross References** — links to related architecture documents.

A document may use different heading text where it reads more naturally
(for example, "What a Faction Represents" rather than "Concept Definition"),
provided the underlying content and ordering match this standard.

## Writing Style

Architecture documents should be:

- Implementation agnostic.
- Concise.
- Precise.
- Professional.

Architecture documents should not include:

- Implementation details.
- APIs.
- Database schemas.
- TypeScript.
- Framework discussion.

If a sentence would need to change because of a refactor, a library upgrade,
or a database migration, it does not belong in an architecture document.

## Ownership Rules

Every document should clearly define who owns:

- **Mechanics** — the Rules Engine.
- **Persistence** — the Persistence Layer.
- **Narration** — the AI Director.
- **Orchestration** — the Adventure Controller.
- **Presentation** — the Frontend.

A document that describes a concept without stating which subsystem is
authoritative for each of these five concerns is incomplete.

## Cross References

Documents should reference related concepts rather than duplicate them. If a
concept is already defined elsewhere — in
[world-model.md](../world-model.md) or in another domain document — link to
it instead of restating its definition. Cross-referencing keeps the
handbook consistent as it grows; duplicated definitions drift apart over
time and become a source of contradiction.

## Mermaid Guidelines

Diagrams should be conceptual. They should illustrate relationships,
ownership, and flow between subsystems or concepts — never implementation
structures such as tables, endpoints, or class hierarchies. If a diagram
would only make sense to someone reading the source code, it does not belong
in an architecture document.

## Review Checklist

Before committing a new or updated architecture document, confirm:

- [ ] The document follows the required section order.
- [ ] Every required section is present, or its omission is justified by
      "if applicable" / "when applicable" language.
- [ ] The document states who owns mechanics, persistence, narration,
      orchestration, and presentation.
- [ ] The document cross-references related concepts instead of duplicating
      their definitions.
- [ ] Any Mermaid diagram is conceptual, not implementation-shaped.
- [ ] No implementation details, APIs, database schemas, TypeScript, or
      framework discussion appear anywhere in the document.
- [ ] The document's terminology matches the rest of the handbook.
- [ ] The document is concise, precise, and professional in tone.

---

This standard exists to ensure the Chronicle AI architecture handbook
remains consistent as the project grows.
