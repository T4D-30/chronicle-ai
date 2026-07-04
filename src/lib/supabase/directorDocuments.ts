/**
 * Chronicle AI — Director Documents Service
 * Phase 10.3
 *
 * Typed Supabase operations for the director_documents table AND the
 * director-documents Storage bucket (migration 0006). Follows the exact
 * conventions of characters.ts/campaigns.ts: ServiceError on failure,
 * typed inputs, RLS-respecting queries.
 *
 * This is the first service module in the project that touches Supabase
 * Storage (every prior file upload — portraits — used a base64 text
 * column instead). Storage objects are always written to
 * `${userId}/${documentId}` so the bucket's RLS policy (owner-only via
 * storage.foldername()[1] === auth.uid()) is meaningful.
 */

import { supabase } from './client'
import { ServiceError, fromPostgrestError, assertFound } from './errors'
import type { Tables, TablesInsert, TablesUpdate } from '@/types/supabase-generated'
import type {
  DirectorDocumentCategory,
  DirectorDocumentMetadata,
  SupportedDirectorDocumentType,
} from '@/lib/directorDocuments/types'
import { SUPPORTED_DIRECTOR_DOCUMENT_TYPES } from '@/lib/directorDocuments/types'

type DocumentRow = Tables<'director_documents'>
type DocumentInsert = TablesInsert<'director_documents'>
type DocumentUpdate = TablesUpdate<'director_documents'>

const BUCKET = 'director-documents'

function rowToMetadata(row: DocumentRow): DirectorDocumentMetadata {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    userId: row.user_id,
    category: row.category,
    fileName: row.file_name,
    fileType: row.file_type,
    fileSizeBytes: row.file_size_bytes,
    storagePath: row.storage_path,
    isIndexed: row.is_indexed,
    uploadedAt: row.uploaded_at,
  }
}

export interface UploadDirectorDocumentInput {
  campaignId: string
  userId: string
  category: DirectorDocumentCategory
  file: File
}

function validateUploadInput(input: UploadDirectorDocumentInput): void {
  if (!input.campaignId) throw new ServiceError('campaignId is required.', 'VALIDATION')
  if (!input.userId) throw new ServiceError('userId is required.', 'VALIDATION')
  if (!input.file) throw new ServiceError('file is required.', 'VALIDATION')
  if (!(SUPPORTED_DIRECTOR_DOCUMENT_TYPES as readonly string[]).includes(input.file.type)) {
    throw new ServiceError(
      `Unsupported file type "${input.file.type || 'unknown'}". Supported types: PDF, DOCX, TXT, Markdown.`,
      'VALIDATION',
    )
  }
}

/**
 * Uploads a reference document: writes the raw file to Storage, then
 * inserts the metadata row. If the metadata insert fails after a
 * successful Storage write, the uploaded object is cleaned up (best
 * effort — a cleanup failure is logged, not thrown, since the primary
 * operation's failure is the one the caller needs to see).
 *
 * Does NOT extract text — extracted_text/is_indexed stay at their column
 * defaults (null / false). Call indexDirectorDocument() separately once a
 * DirectorDocumentParser has produced text — see
 * src/lib/directorDocuments/manualParser.ts for the shipped
 * (extraction-free) implementation.
 *
 * @throws ServiceError('VALIDATION') for missing fields or unsupported file type
 * @throws ServiceError('DB_ERROR') on Storage or DB failure
 */
export async function uploadDirectorDocument(
  input: UploadDirectorDocumentInput,
): Promise<DirectorDocumentMetadata> {
  validateUploadInput(input)

  const documentId = crypto.randomUUID()
  const storagePath = `${input.userId}/${documentId}`

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, input.file, { contentType: input.file.type, upsert: false })

  if (uploadError) {
    throw new ServiceError(`Failed to upload document: ${uploadError.message}`, 'DB_ERROR')
  }

  const row: DocumentInsert = {
    id: documentId,
    campaign_id: input.campaignId,
    user_id: input.userId,
    category: input.category,
    file_name: input.file.name,
    file_type: input.file.type as SupportedDirectorDocumentType,
    file_size_bytes: input.file.size,
    storage_path: storagePath,
  }

  const { data, error } = await supabase
    .from('director_documents')
    .insert(row)
    .select('*')
    .single()

  if (error) {
    await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => {})
    throw fromPostgrestError(error, 'uploadDirectorDocument')
  }

  return rowToMetadata(data as DocumentRow)
}

/**
 * Lists all reference documents for a campaign, most recently uploaded first.
 *
 * @throws ServiceError('DB_ERROR') on Supabase failure
 */
export async function listDirectorDocuments(campaignId: string): Promise<DirectorDocumentMetadata[]> {
  const { data, error } = await supabase
    .from('director_documents')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('uploaded_at', { ascending: false })

  if (error) throw fromPostgrestError(error, 'listDirectorDocuments')

  return (data ?? []).map((row) => rowToMetadata(row as DocumentRow))
}

/**
 * Fetches one document's metadata by id.
 *
 * @throws ServiceError('NOT_FOUND') if the document doesn't exist or RLS blocks it
 * @throws ServiceError('DB_ERROR') on Supabase failure
 */
export async function getDirectorDocument(id: string): Promise<DirectorDocumentMetadata> {
  const { data, error } = await supabase
    .from('director_documents')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) throw fromPostgrestError(error, 'getDirectorDocument')
  assertFound(data, `getDirectorDocument(${id})`)

  return rowToMetadata(data as DocumentRow)
}

/**
 * Updates a document's extracted text and marks it indexed. Called after a
 * DirectorDocumentParser (real or the manual no-op) has run.
 *
 * @throws ServiceError('NOT_FOUND') if the document doesn't exist or RLS blocks it
 * @throws ServiceError('DB_ERROR') on Supabase failure
 */
export async function indexDirectorDocument(
  id: string,
  extractedText: string | null,
): Promise<DirectorDocumentMetadata> {
  const patch: DocumentUpdate = {
    extracted_text: extractedText,
    is_indexed: extractedText !== null,
  }

  const { data, error } = await supabase
    .from('director_documents')
    .update(patch)
    .eq('id', id)
    .select('*')
    .maybeSingle()

  if (error) throw fromPostgrestError(error, 'indexDirectorDocument')
  assertFound(data, `indexDirectorDocument(${id})`)

  return rowToMetadata(data as DocumentRow)
}

/**
 * Returns a time-limited signed URL for downloading a document's raw file.
 * Never a public URL — the bucket is private; this is the only sanctioned
 * read path for the actual file bytes. Metadata reads (listDirectorDocuments,
 * getDirectorDocument) don't need this.
 *
 * @throws ServiceError('DB_ERROR') on Storage failure
 */
export async function getDirectorDocumentSignedUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 60 * 5)

  if (error || !data) {
    throw new ServiceError(`Failed to create signed URL: ${error?.message ?? 'unknown error'}`, 'DB_ERROR')
  }

  return data.signedUrl
}

/**
 * Deletes a document — removes both the Storage object and the metadata
 * row. Storage removal happens first; if it fails, the metadata row is
 * left intact (fail-safe: better an orphaned-but-listed row a user can
 * retry deleting than a metadata row pointing at nothing).
 *
 * @throws ServiceError('DB_ERROR') on Storage or DB failure
 */
export async function deleteDirectorDocument(id: string, storagePath: string): Promise<void> {
  const { error: storageError } = await supabase.storage.from(BUCKET).remove([storagePath])
  if (storageError) {
    throw new ServiceError(`Failed to delete document file: ${storageError.message}`, 'DB_ERROR')
  }

  const { error } = await supabase
    .from('director_documents')
    .delete()
    .eq('id', id)

  if (error) throw fromPostgrestError(error, 'deleteDirectorDocument')
}
