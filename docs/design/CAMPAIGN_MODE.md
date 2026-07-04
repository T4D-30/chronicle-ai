# Chronicle AI — Campaign Mode Specification

*Elaborates [`DIRECTOR_BIBLE.md`](DIRECTOR_BIBLE.md) §10. Status: 📐 the *behavior* already exists implicitly; this spec formalizes it as a named, explicit, enforced mode.*

---

## What This Formalizes (not a new experience — a name and a boundary)

Every campaign created in Chronicle AI today is, functionally, already Campaign Mode: it has a title, a premise, a tone, a `hiddenArc`, and an implied scope. Nothing currently *enforces* that scope, though — a long enough session could, in principle, drift the story well past whatever the premise originally implied, and the Director has no explicit instruction not to.

This spec's job is narrow: give Campaign Mode a name, a boundary the Director is instructed to respect, and — for the future campaign-import work explicitly named in the original design brief — a place to attach uploaded/predefined content.

---

## Boundary Rules (📐 new Director instruction, not yet in the live prompt)

The Director must respect, for the life of a Campaign Mode campaign:

- **Defined locations** — doesn't invent major new regions or settlements that weren't set up in the premise or discovered organically; can still add local color (a side alley, a minor NPC's shop) without violating scope
- **Defined NPCs** — established NPCs keep their established role; the Director doesn't casually introduce a second secret villain that competes with the campaign's actual `hiddenArc`
- **Defined quests/scope** — the campaign has an intended arc (even if loosely defined at creation); the Director steers toward eventual resolution rather than infinite open-ended drift
- **A recognizable end state** — Campaign Mode campaigns are expected to *conclude*. `Campaign.status` already includes an end-state concept (`GameStatus` — see `src/types/game.ts`); this spec doesn't require a new status value, just Director awareness that conclusion is the expected shape.

**Explicitly not a hard technical constraint** — this is prompt guidance, not an engine-enforced rule. There is no code that can detect "the Director invented a region that violates campaign scope." This is analogous to how "don't invent quests that didn't arise from the narration" (Phase 9.2) is enforced by instructing the Director, not by validating its output against a rule engine. Same category of constraint, same enforcement mechanism.

---

## Relationship to Existing Fields

No new required fields for the *behavior* — `DirectorConfig.hiddenArc`, `tone`, `difficulty`, and the premise text already captured at campaign creation are sufficient to define a Campaign Mode boundary. What's missing is only the explicit **mode marker** itself, needed to distinguish a Campaign Mode campaign from a Chronicle Mode one (see `CHRONICLE_MODE.md`) and to let the Director prompt branch its instructions accordingly.

```typescript
type WorldMode = 'campaign' | 'chronicle'

// Addition to the Campaign interface (src/types/campaign.ts):
interface Campaign {
  // ...existing fields unchanged...
  /** Which world mode this campaign runs under. Set at creation, immutable
      thereafter (switching modes mid-campaign is out of scope — see below). */
  worldMode: WorldMode
}
```

Default for all *existing* campaigns created before this field exists: `'campaign'` — this preserves current behavior exactly, since every campaign to date has been operating under implicit Campaign Mode rules already.

---

## Campaign Import / Constraint System (the other half of this spec)

The original design brief names a future "Campaign Import/Constraint System" (Phase 10.5). This is the mechanism by which a player-authored or uploaded campaign premise becomes the enforced boundary described above, rather than just the freeform premise text captured today by `PremiseStep.tsx`.

**Scope of that future work (📐, not detailed further here — flagged for its own spec when prioritized):**
- Structured campaign definition beyond free text (a defined location list, a defined NPC roster, a defined quest outline) that the Director receives as explicit constraints rather than inferring scope from prose
- Validation that Director output stays within the defined bounds (this is the piece that could eventually make the boundary *enforced* rather than *requested* — likely a post-response check, not a pre-response constraint, consistent with how dice results are validated after resolution, not predicted before)

This is intentionally left underspecified here — it's a genuinely separate, larger effort from "add a `worldMode` field," and conflating them would make this spec harder to implement incrementally.

---

## Implementation Checklist (Phase 10.5 for import/constraint; the `worldMode` field itself is small enough to fold into Phase 10.1 setup work)

- [ ] Add `WorldMode` type and `Campaign.worldMode` field, default `'campaign'`
- [ ] Add a mode-selection step to the campaign creation wizard (likely between `PremiseStep` and `ToneStep`, or folded into `PremiseStep` — a UI decision for whoever implements this)
- [ ] Extend Edge Function prompt: branch on `worldMode`, add Campaign Mode boundary instructions when `'campaign'`
- [ ] (Later, Phase 10.5) Structured campaign definition + import UI + constraint validation

---

*Last updated: Phase 10.0 — Director Bible + World Modes Spec*
