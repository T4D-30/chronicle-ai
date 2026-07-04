# Phase 12 — Creator Tools: Engineering Specification

*Status: 📐 Not implemented. Design basis: `docs/design/CAMPAIGN_MODE.md`'s "Campaign Import / Constraint System" section.*

**Numbering note:** this is "Phase 12" per the original design brief's literal sequence (10=Director Intelligence, 11=Living World, 12=Creator Tools, 13=Release Candidate). `docs/design/PUBLIC_ALPHA_ROADMAP.md` sequences Reputation+Legacy *before* Creator Tools in actual dependency order, since Reputation/Legacy depend on Living World and Creator Tools doesn't depend on anything above. Both numberings are intentional and reconciled: implement in whichever order suits available engineering time — this phase has no hard dependency on Phase 11.

---

## Goal

Give players a way to define a Campaign Mode campaign's boundaries explicitly — locations, NPCs, quests, scope — beyond today's freeform premise text, and give the Director those boundaries as enforceable-in-spirit constraints (see "Enforcement Model" below for what "enforceable" actually means here).

---

## Current State (what this extends)

`PremiseStep.tsx` (campaign creation wizard) captures a single freeform text field. `DirectorConfig.hiddenArc` captures another freeform field for the secret plot. Neither is structured. The Director infers scope from prose, with no explicit boundary list to check against — this is exactly what `CAMPAIGN_MODE.md` flags as "requested, not enforced."

---

## 1. Structured Campaign Definition

### New types

```typescript
// src/types/campaign.ts

/** A player-authored (or future: uploaded) definition of a Campaign Mode
    campaign's intended scope. Optional — a campaign can still be created
    with just freeform premise text, same as today; this is additive
    richness, not a new requirement. */
export interface CampaignDefinition {
  /** Named locations the campaign is expected to involve. Distinct from
      WorldState.locations (which tracks discovery state during play) —
      this is the pre-authored intended roster, checked against as new
      locations are proposed during play. */
  intendedLocations: Array<{ name: string; type: LocationType; role: string }>
  /** Named NPCs with their intended role in the story. */
  intendedNpcs: Array<{ name: string; role: string }>
  /** High-level quest/plot beats the campaign is meant to hit, in rough order. */
  intendedBeats: string[]
}

export interface Campaign {
  // ...existing fields unchanged...
  /** Structured scope definition, if the player provided one. Null for
      campaigns using only freeform premise text (the default/current
      experience — this field is fully optional). */
  definition: CampaignDefinition | null
}
```

### Wizard change

New optional step, or an expansion of `PremiseStep.tsx` with a collapsible "Define scope in detail (optional)" section — implementation-time UI decision. Recommend optional/collapsible: the existing 8-step wizard should remain fully usable without this for players who just want to type a premise and go, consistent with how Campaign Mode already works today.

### Persistence

`definition` is additive JSONB on the existing `campaigns` table pattern — no migration required, same as every Phase 9 addition.

---

## 2. Director Awareness

`buildNarrateRequest` (`src/lib/ai/promptBuilder.ts`) gains a new optional worldContext field, populated only when `campaign.definition` is non-null:

```typescript
// NarrateRequest['worldContext']
campaignDefinition?: {
  intendedLocations: string[]  // names only, for prompt brevity
  intendedNpcs: string[]
  intendedBeats: string[]
}
```

`buildSystemPrompt` — new section, only rendered when present:
```
${ctx.campaignDefinition ? `## CAMPAIGN SCOPE (defined by the player at creation — stay within this unless play organically extends it)
Intended locations: ${ctx.campaignDefinition.intendedLocations.join(', ')}
Intended NPCs: ${ctx.campaignDefinition.intendedNpcs.join(', ')}
Intended story beats: ${ctx.campaignDefinition.intendedBeats.join('; ')}
` : ''}
```

Add to `## DIRECTOR RULES`:
```
- If CAMPAIGN SCOPE is defined above, treat it as the intended boundary —
  don't introduce major new locations/NPCs/plots that compete with or
  ignore it. Minor local color (a side NPC, a small side location) is
  fine. If play has organically and deliberately moved past the original
  scope, follow the player's actual story rather than rigidly enforcing
  the original definition — this is guidance for staying coherent, not a
  hard lock.
```

---

## 3. Enforcement Model — What "Enforced" Actually Means

**Important scoping decision, stated explicitly so a future implementer doesn't over-build this:** there is no proposed mechanism in this spec for *validating* Director output against `CampaignDefinition` and rejecting/retrying non-conforming responses. That would require either a second LLM call (cost, latency) or a rules-engine-style content classifier (significant new complexity, uncertain accuracy) — neither is justified by the value this feature provides at alpha stage.

**This phase ships prompt-level guidance only** — the same enforcement model already used successfully for "don't invent quests that didn't arise from the narration" (Phase 9.2) and "respect campaign boundary" concepts generally (`CAMPAIGN_MODE.md`). If Director drift from defined scope turns out to be a real, measured problem post-launch, a validation layer is a natural Phase 13+ candidate — explicitly not this phase.

---

## 4. Import (Future, Not This Phase)

The original design brief names "campaign import" as part of this system. This spec deliberately does **not** cover parsing an uploaded document into a `CampaignDefinition` — that's a content-extraction problem (similar in shape and risk to the character-sheet-import OCR work explicitly deferred in `KNOWN_LIMITATIONS.md`) and should not be bundled into this phase. This phase covers only: the `CampaignDefinition` type, a UI for a player to *type* one directly, and Director awareness of it. Import-from-file is a clearly separable follow-up, flagged here rather than silently scoped in.

---

## Tests

- `buildNarrateRequest` — new test block for `campaignDefinition` presence/absence, following the exact pattern of every other optional-field test added in Phase 9.2/9.3 (`describe('buildNarrateRequest — campaignDefinition ...')`)
- Wizard step (if built as a new step component) — component tests following the pattern of existing step tests (check `tests/unit/CampaignWizard.test.tsx` for the established style)
- No dispatcher changes needed — `definition` is set once at creation, not patched turn-by-turn like `WorldState`/`DirectorConfig` fields

```bash
npx tsc --noEmit
npm test
npm run build
```

No integration test required unless the wizard's campaign-creation service call changes shape (it will, slightly — `createCampaign` gains an optional `definition` param) — if that service function is touched, follow the Phase 9.2 rule and run integration tests too.

---

## Exit Criteria

- [ ] `CampaignDefinition` type, `Campaign.definition` field
- [ ] Wizard UI for optional structured definition entry
- [ ] Director prompt awareness (`CAMPAIGN SCOPE` section + rule)
- [ ] Explicitly no validation/enforcement layer (documented as out of scope, not silently missing)
- [ ] `npx tsc --noEmit`, `npm test`, `npm run build` clean
- [ ] `docs/ROADMAP.md` updated (append)
- [ ] `docs/design/CAMPAIGN_MODE.md` status updated

---

*Last updated: Phase 10.0 — Director Bible + World Modes Spec*
