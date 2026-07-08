/**
 * Chronicle AI — Narrate Edge Function
 * Phase 2.4 (OpenAI migration)
 *
 * Flow:
 *   1. Validate JWT — reject unauthenticated requests
 *   2. Parse and validate NarrateRequest body
 *   3. Load session from DB — confirm it belongs to the caller and is active
 *   4. Build the AI Director prompt from request payload
 *   5. Call OpenAI (gpt-4o) with streaming
 *   6. Stream tokens to client via SSE
 *   7. On stream complete: persist turn to narrative_turns, increment session turn_number
 *   8. Send final SSE event with NarrateResponse JSON
 *
 * Security:
 *   - JWT required (Supabase auth)
 *   - Session must belong to the authenticated user (verified via campaign ownership)
 *   - player input capped at 500 chars; no prompt injection possible via structured fields
 *   - OPENAI_API_KEY is a Supabase Edge Function secret — server-side only,
 *     never sent to or readable by the client. Never set in Vercel/hosting env.
 *
 * Constitution compliance:
 *   - AI narrates consequences; it does not override outcomes
 *   - All dice results happen client-side before this function is called
 *   - combatTriggered signal returned but mechanical resolution happens client-side
 *   - Provider swap (Anthropic → OpenAI) is presentation/infrastructure only —
 *     the Director's role, prompt philosophy, and response contract are unchanged.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import OpenAI from 'https://esm.sh/openai@4.53.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-stream',
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface NarrateRequest {
  sessionId: string
  mode: 'exploration' | 'combat' | 'map'
  playerInput: string
  character: {
    name: string; level: number; archetype: string; ancestry: string; background: string
    proficiencyBonus: number; hitDie: string; maxHp: number; currentHp: number; armorClass: number
    str: number; dex: number; con: number; int: number; wis: number; cha: number
    strMod: number; dexMod: number; conMod: number; intMod: number; wisMod: number; chaMod: number
  }
  /**
   * Pre-resolved skill check for this turn, if the player's action
   * classified into a real category (FORCE/FINESSE/etc.) — see
   * classifyAction()/resolveCharacterAction() client-side. When present,
   * the Director MUST narrate this exact result. Full dice transparency
   * is a locked Director rule — never invent, re-roll, or override it.
   */
  checkResult?: {
    category: string
    stat: string
    dc: number
    total: number
    outcome: string
    outcomeLabel: string
    isSuccess: boolean
  }
  /**
   * Relevant excerpts from the campaign's indexed reference documents
   * (DM guides, campaign bibles, homebrew rules, world lore — uploaded via
   * DirectorDocumentsPanel, retrieved client-side via whichever
   * DocumentRetriever is active). Omitted when no campaign documents exist
   * or none matched. Phase 10.3.
   */
  documentContext?: Array<{
    fileName: string
    category: string
    excerpt: string
  }>
  directorConfig: {
    tone: string; difficulty: string; rulesStyle: string; hiddenArc: string
  }
  worldContext: {
    campaignTitle: string
    campaignDescription: string | null
    worldTime: string | null
    activeNpcs: Array<{ id: string; name: string }>
    currentLocation: string | null
    recentTurns: Array<{
      turnNumber: number; playerInput: string; aiNarration: string; mode: string
    }>
    /** Durable quest/NPC context beyond the recent-turns window. Phase 9.2. */
    activeQuestDigest: Array<{ id: string; title: string }>
    knownNpcDigest: Array<{ name: string; disposition: string; facts: string[] }>
  }
}

// ─── Prompt builder (server-side) ────────────────────────────────────────────

function buildSystemPrompt(req: NarrateRequest, currentTurnNumber: number): string {
  const { directorConfig: cfg, character: char, worldContext: ctx, checkResult, documentContext } = req

  const toneGuide: Record<string, string> = {
    heroic:    'Classic fantasy adventure — bold deeds, clear stakes, triumphant possibilities.',
    grim:      'Dark and grounded — loss is real, victories are costly, the world is dangerous.',
    mysterious:'Secrets and slow revelation — the world hides things worth uncovering.',
    comedic:   'Lighter and playful — absurdity welcome, stakes can bend for a good bit.',
  }

  const difficultyGuide: Record<string, string> = {
    easy:     'Favour the player\'s success; cushion failures with forward momentum.',
    standard: 'Balanced — describe outcomes honestly, both good and ill.',
    brutal:   'Failures sting and have real consequences. Tension is constant.',
  }

  const styleGuide: Record<string, string> = {
    narrative: 'Elaborate richly — immersive prose, sensory detail, emotional resonance.',
    standard:  'Balanced narration — clear outcomes with enough colour to feel alive.',
    crunchy:   'Reference modifiers, conditions, and mechanical effects explicitly in prose.',
    cinematic: 'Maximum tension and theatrical weight — every outcome is a dramatic beat.',
  }

  // Durable context digests (Phase 9.2) — persist across the whole campaign,
  // not just the last 4-8 turns. Formatted compactly: these are reminders of
  // established facts, not narration to re-read, so verbosity here is pure
  // token cost with no benefit.
  const questDigest = ctx.activeQuestDigest.length > 0
    ? ctx.activeQuestDigest.map((q) => q.title).join('; ')
    : null
  const npcDigest = ctx.knownNpcDigest.length > 0
    ? ctx.knownNpcDigest
        .map((n) => `${n.name} (${n.disposition}${n.facts.length > 0 ? `: ${n.facts.join(', ')}` : ''})`)
        .join('; ')
    : null

  return `You are the Director AI for Chronicle AI, a solo tabletop RPG.

## CAMPAIGN
"${ctx.campaignTitle}"${ctx.campaignDescription ? `\n${ctx.campaignDescription}` : ''}
TONE: ${cfg.tone} — ${toneGuide[cfg.tone] ?? cfg.tone}
DIFFICULTY: ${cfg.difficulty} — ${difficultyGuide[cfg.difficulty] ?? cfg.difficulty}
NARRATION STYLE: ${cfg.rulesStyle} — ${styleGuide[cfg.rulesStyle] ?? cfg.rulesStyle}
${cfg.hiddenArc ? `HIDDEN ARC (for Director eyes only — never reveal directly): ${cfg.hiddenArc}` : ''}

## CHARACTER
${char.name}, Level ${char.level} ${char.ancestry} ${char.archetype}
HP: ${char.currentHp}/${char.maxHp} | AC: ${char.armorClass} | Prof: +${char.proficiencyBonus}
STR ${char.str}(${char.strMod >= 0 ? '+' : ''}${char.strMod}) DEX ${char.dex}(${char.dexMod >= 0 ? '+' : ''}${char.dexMod}) CON ${char.con}(${char.conMod >= 0 ? '+' : ''}${char.conMod}) INT ${char.int}(${char.intMod >= 0 ? '+' : ''}${char.intMod}) WIS ${char.wis}(${char.wisMod >= 0 ? '+' : ''}${char.wisMod}) CHA ${char.cha}(${char.chaMod >= 0 ? '+' : ''}${char.chaMod})

## WORLD STATE
TURN: ${currentTurnNumber}
${ctx.worldTime ? `TIME: ${ctx.worldTime}\n` : ''}${ctx.currentLocation ? `LOCATION: ${ctx.currentLocation}\n` : ''}${ctx.activeNpcs.length > 0 ? `NPCs PRESENT: ${ctx.activeNpcs.map(n => n.name).join(', ')}\n` : ''}${questDigest ? `ACTIVE QUESTS: ${questDigest}\n` : ''}${npcDigest ? `KNOWN NPCs (disposition, facts): ${npcDigest}\n` : ''}
${checkResult ? `## THIS TURN'S CHECK (already resolved — narrate this exact result, do not invent a different one)
${checkResult.category} check, ${checkResult.stat}, DC ${checkResult.dc}, rolled ${checkResult.total} → ${checkResult.outcomeLabel} (${checkResult.isSuccess ? 'success' : 'failure'})
` : ''}
${documentContext && documentContext.length > 0 ? `## REFERENCE DOCUMENTS (retrieved excerpts — for your background knowledge only)
${documentContext.map((d) => `[${d.category}] ${d.fileName}: ${d.excerpt}`).join('\n')}
` : ''}
## DIRECTOR RULES
These are locked design decisions. Never violate them.
- Narrate in SECOND PERSON ("you push the door open," never "Aldric pushes the door open" or "I push the door open").
- EXPAND the player's stated action into vivid consequence — never invent a
  different decision than the one the player actually made. If they said
  they open the door, they open the door; you narrate what's behind it, you
  don't have them do something else instead.
- Narrate the CONSEQUENCE of the player's action. Never override a mechanical outcome.
- MEDIUM-LENGTH, CINEMATIC descriptions: 2-4 sentences for exploration.
  Rich sensory and emotional detail, but not exhausting — a beat, not a chapter.
- HIDE INFORMATION UNTIL EARNED. Don't volunteer secrets, hidden mechanisms,
  or the solution to a puzzle just because the player is nearby — reveal
  only what their action and any successful check actually uncover.
- ESCALATE HINTS ONLY IF THE PLAYER BECOMES STUCK. On a first attempt, describe
  outcomes without nudging toward the answer. If the player's recent actions
  show they're circling the same problem without progress, the next
  narration may include one concrete, in-world hint — not a solution.
- FULL DICE TRANSPARENCY: if THIS TURN'S CHECK is present above, your
  narration MUST reflect that exact roll and outcome — mention or clearly
  imply success/failure consistent with it. Never invent a different result,
  never roll your own, never soften or embellish away a failure. If no check
  is present, this was pure narration/dialogue/movement — do not invent one.
- If REFERENCE DOCUMENTS are present above, treat them as background
  knowledge you may draw on naturally — the way a DM who has actually read
  their own campaign notes would. Do not quote them verbatim or announce
  "according to my notes"; weave the relevant fact into your narration.
  These are retrieved excerpts, not the full document — never claim
  knowledge of anything beyond what's actually shown here. If no REFERENCE
  DOCUMENTS section is present, you have no uploaded reference material
  relevant to this turn — do not invent lore that would plausibly live in
  a document the player hasn't actually given you.
- Suggest 2-3 concrete follow-up actions at the end.
- Signal combatTriggered:true ONLY if an encounter has genuinely begun.
- Never invent dice rolls — the resolution engine handles all mechanics.
- Stay consistent with ACTIVE QUESTS and KNOWN NPCs above — these persist
  across the whole campaign even when a turn isn't in your recent history.
  Don't reintroduce a known NPC as a stranger or contradict their established
  disposition/facts without an in-story reason.
- If the player has moved to a new or different location, set currentLocationId
  to its id (existing or newly added via newLocations in the same response).
  Only set it when the narration actually places the player somewhere —
  never guess or default it.
- SCHEDULING FUTURE EVENTS: when the player's action establishes a clear
  future consequence — something that will predictably happen after a
  number of turns, like a caravan due back, a festival that will begin, a
  patrol due to arrive, crops finishing growth, a storm moving in, or
  repairs completing — record it via scheduledEventsToAdd. Only do this
  when the narration has genuinely established that consequence; never
  invent one just to populate this field, and never use it for something
  that should happen immediately (narrate that directly instead — this is
  only for things that have not happened yet).
  - triggerAtTurn must be an absolute turn number: the current TURN (see
    WORLD STATE above) plus however many turns until it happens. Never use
    a relative phrase like "in 5 turns" as the value — if it is turn 12 and
    something happens in 5 turns, triggerAtTurn is 17.
  - Give each event a short, stable, descriptive id (same slug convention
    as newThreads, e.g. "caravan-return" or "harvest-festival"). If you
    reference the same future event again on a later turn, reuse its exact
    id rather than inventing a new one — this is how duplicate scheduling
    is avoided, so choose ids that describe the event itself, not the turn
    or moment you're narrating.
  - Only "id", "description", and "triggerAtTurn" are required. Add "type"
    or "title" only if a short category or label is genuinely useful for
    later reference. Add "directorHint" when a brief reminder of what to
    narrate would help your future self when this fires. Add "payload"
    only when there is real structured data worth carrying forward (e.g. an
    NPC or location id involved) — omit it otherwise.
- When a quest-worthy goal emerges (a request, a mystery, a clear objective),
  add it via newThreads. When a quest concludes, update it via threadUpdates
  with status "resolved" or "abandoned". Do not invent quests that didn't
  arise from the narration.
- When a named NPC is introduced or their disposition/facts change, record it
  via npcMemoryUpdates. Only include NPCs actually present in this narration —
  do not backfill or invent NPC history that wasn't established.
- Respond ONLY with valid JSON matching the exact schema below. No preamble.

## RESPONSE SCHEMA (strict)
{
  "narration": "<2-4 sentence narrative consequence>",
  "worldStateUpdates": {
    "currentLocationId": "<location id, only if the player moved — omit otherwise>",
    "newLocations": [],
    "npcUpdates": [],
    "scheduledEventsToAdd": [{ "id": "<short-slug>", "description": "<what happens when it fires>", "triggerAtTurn": <absolute turn number>, "source": "director" }]
  },
  "directorConfigUpdates": {
    "newThreads": [{ "id": "<short-slug>", "title": "<quest title>", "description": "<1 sentence>" }],
    "threadUpdates": [{ "id": "<existing thread id>", "status": "resolved" }],
    "npcMemoryUpdates": [{ "id": "<short-slug>", "name": "<npc name>", "disposition": "friendly", "knownFacts": ["<fact>"] }]
  },
  "suggestedActions": ["<action 1>", "<action 2>", "<action 3>"],
  "combatTriggered": false,
  "mapUpdate": null
}

Omit any field above (worldStateUpdates sub-fields, directorConfigUpdates, or
its sub-fields) entirely when there is nothing to report this turn — do not
include empty arrays or null placeholders just to match the shape.`
}

function buildUserMessage(req: NarrateRequest): string {
  const { worldContext: ctx } = req
  const recent = ctx.recentTurns.slice(-4)
    .map(t => `[Turn ${t.turnNumber}] Player: "${t.playerInput}" → Director: "${t.aiNarration.slice(0, 120)}…"`)
    .join('\n')

  // Short-term tactical recency only — durable campaign memory (active
  // quests, known NPCs) is already in the system prompt's WORLD STATE
  // section and does not need to be repeated here. Phase 9.2.
  return `${recent ? `RECENT TURNS (short-term):\n${recent}\n\n` : ''}MODE: ${req.mode}
PLAYER ACTION: ${req.playerInput.slice(0, 500)}`
}

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const wantsStream = req.headers.get('x-stream') === 'true'

  try {
    // 1. Auth
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing authorization header.' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const jwt = authHeader.slice(7)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const openaiKey = Deno.env.get('OPENAI_API_KEY')!

    // Use service role for DB writes; verify user via anon client
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    })
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey)

    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token.' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Parse request
    const body = await req.json() as NarrateRequest
    if (!body.sessionId || !body.playerInput?.trim()) {
      return new Response(JSON.stringify({ error: 'sessionId and playerInput are required.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 3. Verify session ownership — the session must belong to a campaign owned by this user
    const { data: sessionRow, error: sessionError } = await serviceClient
      .from('game_sessions')
      .select('id, turn_number, status, campaign_id')
      .eq('id', body.sessionId)
      .single()

    if (sessionError || !sessionRow) {
      return new Response(JSON.stringify({ error: 'Session not found.' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: campaignRow } = await serviceClient
      .from('campaigns')
      .select('user_id')
      .eq('id', sessionRow.campaign_id)
      .single()

    if (campaignRow?.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden.' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (sessionRow.status !== 'active') {
      return new Response(JSON.stringify({ error: 'Session is not active.' }), {
        status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 4. Build prompt
    // The turn about to complete — same value the client independently
    // computes as session.turnNumber + 1 (see adventureController.ts's
    // runPlayerTurn). Passed into the prompt so the Director can compute
    // an absolute triggerAtTurn for any scheduledEventsToAdd it emits.
    const currentTurnNumber = (sessionRow.turn_number ?? 0) + 1
    const systemPrompt = buildSystemPrompt(body, currentTurnNumber)
    const userMessage = buildUserMessage(body)

    // 5. Call OpenAI
    const openai = new OpenAI({ apiKey: openaiKey })

    if (wantsStream) {
      // ── Streaming response ──────────────────────────────────────────────────
      const { readable, writable } = new TransformStream()
      const writer = writable.getWriter()
      const encoder = new TextEncoder()

      const write = (data: string) => writer.write(encoder.encode(`data: ${data}\n\n`))

      ;(async () => {
        let fullNarration = ''
        try {
          const stream = await openai.chat.completions.create({
            model: 'gpt-4o',
            max_tokens: 600,
            response_format: { type: 'json_object' },
            stream: true,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userMessage },
            ],
          })

          for await (const chunk of stream) {
            const token = chunk.choices[0]?.delta?.content
            if (token) {
              fullNarration += token
              await write(token)
            }
          }

          // Parse the full JSON response from the narration
          let parsed: {
            narration?: string
            worldStateUpdates?: Record<string, unknown>
            directorConfigUpdates?: Record<string, unknown>
            suggestedActions?: string[]
            combatTriggered?: boolean
            mapUpdate?: null
          }
          try {
            parsed = JSON.parse(fullNarration)
          } catch {
            // Fallback: treat the entire output as narration prose
            parsed = { narration: fullNarration, suggestedActions: [], combatTriggered: false }
          }

          const narration = parsed.narration ?? fullNarration

          // 6. Persist turn
          const nextTurn = currentTurnNumber
          const { data: turnRow } = await serviceClient
            .from('narrative_turns')
            .insert({
              session_id: body.sessionId,
              turn_number: nextTurn,
              player_input: body.playerInput.slice(0, 500),
              ai_narration: narration.slice(0, 4000),
              dice_rolls: [],
              mode: body.mode,
            })
            .select('id')
            .single()

          await serviceClient
            .from('game_sessions')
            .update({ turn_number: nextTurn })
            .eq('id', body.sessionId)

          // Final event — full response JSON
          const finalResponse = {
            narration,
            worldStateUpdates: parsed.worldStateUpdates ?? {},
            directorConfigUpdates: parsed.directorConfigUpdates ?? {},
            suggestedActions: parsed.suggestedActions ?? [],
            combatTriggered: parsed.combatTriggered ?? false,
            mapUpdate: null,
            turnId: turnRow?.id ?? '',
          }
          await write(JSON.stringify(finalResponse))
          await write('[DONE]')
        } catch (err) {
          await write(`[ERROR] ${err instanceof Error ? err.message : 'Unknown error'}`)
        } finally {
          await writer.close()
        }
      })()

      return new Response(readable, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      })
    }

    // ── Non-streaming response ────────────────────────────────────────────────
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 600,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    })

    const rawText = completion.choices[0]?.message?.content ?? ''

    let parsed: {
      narration?: string
      worldStateUpdates?: Record<string, unknown>
      directorConfigUpdates?: Record<string, unknown>
      suggestedActions?: string[]
      combatTriggered?: boolean
      mapUpdate?: null
    }
    try {
      parsed = JSON.parse(rawText)
    } catch {
      parsed = { narration: rawText, suggestedActions: [], combatTriggered: false }
    }

    const narration = parsed.narration ?? rawText
    const nextTurn = currentTurnNumber

    const { data: turnRow } = await serviceClient
      .from('narrative_turns')
      .insert({
        session_id: body.sessionId,
        turn_number: nextTurn,
        player_input: body.playerInput.slice(0, 500),
        ai_narration: narration.slice(0, 4000),
        dice_rolls: [],
        mode: body.mode,
      })
      .select('id')
      .single()

    await serviceClient
      .from('game_sessions')
      .update({ turn_number: nextTurn })
      .eq('id', body.sessionId)

    return new Response(
      JSON.stringify({
        narration,
        worldStateUpdates: parsed.worldStateUpdates ?? {},
        directorConfigUpdates: parsed.directorConfigUpdates ?? {},
        suggestedActions: parsed.suggestedActions ?? [],
        combatTriggered: parsed.combatTriggered ?? false,
        mapUpdate: null,
        turnId: turnRow?.id ?? '',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('[narrate] Unhandled error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal server error.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
