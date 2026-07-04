/**
 * Chronicle AI — Full-Text Document Retriever
 * Phase 10.3
 *
 * The shipped, real implementation of DocumentRetriever. Calls the
 * search_director_documents Postgres function (migration 0006) via
 * supabase.rpc() — that function does the actual ranked full-text search
 * (ts_rank) and excerpt generation (ts_headline), verified against a real
 * local Postgres instance during development (see docs/ROADMAP.md's
 * Phase 10.3 entry for the exact queries run).
 *
 * This is the "modular retrieval architecture" the request asked for:
 * DocumentRetriever (types.ts) is the swappable contract; this file is
 * one implementation of it. A future embeddings-based retriever would
 * implement the same interface and be selected by
 * getActiveDocumentRetriever() below — no consumer of retrieval results
 * (the Edge Function prompt builder) needs to know or care which
 * implementation is active.
 */

import { supabase } from '@/lib/supabase/client'
import { ServiceError } from '@/lib/supabase/errors'
import type { DocumentRetriever, DocumentSearchResult } from './types'

export const FullTextRetriever: DocumentRetriever = {
  name: 'PostgreSQL Full-Text Search',

  async retrieve(campaignId: string, query: string, limit = 5): Promise<DocumentSearchResult[]> {
    if (!query.trim()) return []

    const { data, error } = await supabase.rpc('search_director_documents', {
      p_campaign_id: campaignId,
      p_query: query,
      p_limit: limit,
    })

    if (error) {
      throw new ServiceError(`Document search failed: ${error.message}`, 'DB_ERROR')
    }

    return (data ?? []).map((row) => ({
      documentId: row.document_id,
      fileName: row.file_name,
      category: row.category,
      excerpt: row.excerpt,
      relevanceScore: row.relevance_score,
    }))
  },
}

/**
 * Returns the currently active document retriever. Single swap point for
 * a future embeddings-based retriever — see
 * docs/specs/DIRECTOR_DOCUMENT_UPLOAD.md for the trade-offs that were
 * considered and why full-text search was chosen as the starting
 * implementation.
 */
export function getActiveDocumentRetriever(): DocumentRetriever {
  return FullTextRetriever
}
