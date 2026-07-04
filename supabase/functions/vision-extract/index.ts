/**
 * Chronicle AI — Vision Extract Edge Function
 * Phase 11.3
 *
 * Mirrors supabase/functions/narrate/index.ts's established conventions
 * exactly: JWT auth via a user-scoped Supabase client, OPENAI_API_KEY read
 * from Deno.env (server-side only, never sent to or readable by the
 * client), chat.completions.create with response_format: json_object for
 * structured output.
 *
 * WHAT THIS FUNCTION DOES: receives one or more page images (already
 * rendered client-side — see src/lib/ocr/filePreparation.ts, which
 * handles PDF-to-image rendering via pdfjs-dist before this function ever
 * sees a request) and a `kind` indicating whether to extract a character
 * sheet or a campaign document. Sends the images to OpenAI's Vision
 * model (gpt-4o, which is natively multimodal) with a kind-specific
 * extraction prompt, and returns structured JSON matching
 * VisionExtractionResponse (src/lib/ocr/types.ts).
 *
 * SECURITY: identical posture to narrate — OPENAI_API_KEY only ever
 * exists as a Supabase Edge Function secret. This function does not
 * write to any database table; it has no side effects beyond the OpenAI
 * call itself. The caller (CharacterImportUpload/CampaignImportUpload,
 * via src/lib/ocr/visionClient.ts) is solely responsible for what
 * happens with the returned data — this function never touches
 * characters, campaigns, or any persisted record.
 *
 * WHAT THIS FUNCTION DOES NOT DO: it does not validate that the images
 * are genuinely a character sheet or campaign document — a player could
 * upload any image and get back whatever the model infers. The review
 * screen (unchanged by this phase) is exactly where a bad or nonsensical
 * extraction gets caught by the player before anything is saved. This
 * function's only job is to try, honestly report its own confidence, and
 * never fail silently.
 *
 * TESTABILITY: the response-sanitizing/merging logic
 * (sanitizePageResult, mergePageResults) lives in
 * src/lib/ocr/visionResponseContract.ts, not inline here — Deno Edge
 * Functions cannot be imported into this project's Vitest suite at all
 * (esm.sh URL imports and the global Deno namespace don't exist under
 * Node), so any logic worth unit-testing needs to live somewhere Vitest
 * CAN reach. That file has zero Deno/Node-specific dependency, so this
 * function imports it via a plain relative path and Vitest imports the
 * exact same file via the normal @/ alias — see
 * tests/unit/visionResponseContract.test.ts for real, direct tests of
 * this exact logic. narrate/index.ts (the other Edge Function in this
 * project) is intentionally NOT refactored to match this pattern — it
 * has no equivalent pure logic worth extracting, and there's no reason
 * to touch working code to enforce a stylistic consistency that doesn't
 * add real value there.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import OpenAI from 'https://esm.sh/openai@4.53.0'
import {
  sanitizePageResult,
  mergePageResults,
} from '../../../src/lib/ocr/visionResponseContract.ts'
import type { SanitizedPageResult } from '../../../src/lib/ocr/visionResponseContract.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PageImage {
  pageNumber: number
  base64: string
  mimeType: 'image/png' | 'image/jpeg'
}

type VisionExtractionKind = 'character_sheet' | 'campaign_document'

interface VisionExtractRequest {
  kind: VisionExtractionKind
  pages: PageImage[]
}

const MAX_PAGES_PER_REQUEST = 20

const CHARACTER_SHEET_SYSTEM_PROMPT = `You are extracting structured data from an image of a tabletop RPG character sheet. Read every visible field carefully.

Extract these fields where visible (omit any field you cannot find on the sheet — do not guess or invent a value):
- name (string): the character's name
- archetype (string): class/profession — this is a FREE TEXT field, extract exactly what's written even if it's an unusual or homebrew class name, do not force it into a fixed list
- ancestry (string): species/race, free text
- background (string): background/origin, free text
- level (number): character level
- scores (object with keys strength, dexterity, constitution, intelligence, wisdom, charisma, all numbers): ability scores
- maxHp (number): maximum hit points
- armorClass (number): armor class
- skillProficiencies (array of lowercase strings): checked/marked skill proficiencies
- savingThrowProficiencies (array of uppercase 3-letter ability abbreviations, e.g. "STR", "DEX"): marked saving throw proficiencies
- equipment (array of objects with keys name (string), slot (one of "weapon","armor","shield","accessory","other"), equipped (boolean)): listed gear

For each field you extract, provide:
- value: the extracted value in the type described above
- confidence: "high" if clearly legible and unambiguous, "medium" if legible but you had to interpret handwriting or an unusual format, "low" if you're genuinely unsure, "needs-review" if you could only partially make it out
- sourceText: the literal text/marks you read that led to this value (for the player to double-check against their real sheet)

If you notice text you cannot map to any of the fields above (e.g. a spell list, personality notes, a backstory paragraph), include it verbatim in unstructuredNotes as an array of strings — do not discard it.

Set overallConfidence to your honest overall assessment of how legible and complete this sheet was, not just an average of the per-field values.

Respond with ONLY a JSON object of this exact shape:
{"fields": {"<fieldName>": {"value": ..., "confidence": "...", "sourceText": "..."}, ...}, "unstructuredNotes": ["..."], "overallConfidence": "..."}`

const CAMPAIGN_DOCUMENT_SYSTEM_PROMPT = `You are extracting structured campaign metadata from an image of a tabletop RPG campaign document — this could be a campaign bible, an adventure module cover/summary page, a homebrew pitch document, or similar.

Extract these fields where identifiable (omit any field you cannot reasonably identify — do not guess or invent a value):
- title (string): the campaign or adventure's title
- premise (string): a summary of what the campaign/adventure is about — synthesize this from the visible text if there's no single explicit "premise" label, but only from what is actually written, never invented
- tone (string, one of "heroic","grim","mysterious","comedic"): the apparent tone, only if reasonably inferable from the actual content — do not guess if genuinely unclear
- difficulty (string, one of "easy","standard","brutal"): only if explicitly stated or very strongly implied
- directorNotes (string): any GM-facing secrets, twists, or hidden information visible on the page — content clearly meant for the game master's eyes, not the players'

For each field you extract, provide:
- value: the extracted value
- confidence: "high"/"medium"/"low"/"needs-review" using the same honest scale as above
- sourceText: the literal text that led to this value

Include any other notable content (named locations, NPCs, plot hooks) you find but cannot map to the fields above in unstructuredNotes as an array of strings.

Set overallConfidence to your honest overall assessment of this page's legibility and how much genuinely useful campaign information it contained.

Respond with ONLY a JSON object of this exact shape:
{"fields": {"<fieldName>": {"value": ..., "confidence": "...", "sourceText": "..."}, ...}, "unstructuredNotes": ["..."], "overallConfidence": "..."}`

function systemPromptFor(kind: VisionExtractionKind): string {
  return kind === 'character_sheet' ? CHARACTER_SHEET_SYSTEM_PROMPT : CAMPAIGN_DOCUMENT_SYSTEM_PROMPT
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing authorization header.' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const jwt = authHeader.slice(7)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const openaiKey = Deno.env.get('OPENAI_API_KEY')!

    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    })

    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token.' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json() as VisionExtractRequest
    if (body.kind !== 'character_sheet' && body.kind !== 'campaign_document') {
      return new Response(JSON.stringify({ error: 'kind must be "character_sheet" or "campaign_document".' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (!Array.isArray(body.pages) || body.pages.length === 0) {
      return new Response(JSON.stringify({ error: 'At least one page image is required.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (body.pages.length > MAX_PAGES_PER_REQUEST) {
      return new Response(JSON.stringify({ error: `Too many pages — maximum ${MAX_PAGES_PER_REQUEST} per request.` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const openai = new OpenAI({ apiKey: openaiKey })
    const systemPrompt = systemPromptFor(body.kind)

    const pageResults: SanitizedPageResult[] = []
    let pagesFailed = 0

    for (const page of body.pages) {
      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o',
          max_tokens: 1500,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: [
                { type: 'text', text: `This is page ${page.pageNumber} of the uploaded document. Extract the fields described in your instructions.` },
                { type: 'image_url', image_url: { url: `data:${page.mimeType};base64,${page.base64}` } },
              ],
            },
          ],
        })

        const rawText = completion.choices[0]?.message?.content ?? ''
        let parsed: unknown
        try {
          parsed = JSON.parse(rawText)
        } catch {
          pagesFailed++
          continue
        }

        const sanitized = sanitizePageResult(parsed)
        if (sanitized) {
          pageResults.push(sanitized)
        } else {
          pagesFailed++
        }
      } catch {
        pagesFailed++
      }
    }

    const response = mergePageResults(pageResults, pagesFailed)

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
