export { supabase } from './client'
export { authService } from './auth'

// ── Character service ──────────────────────────────────────────────────────────
export {
  createCharacter,
  getCharacter,
  updateCharacter,
  listCharacters,
  deleteCharacter,
  duplicateCharacter,
} from './characters'
export type { CharacterRecord, CreateCharacterInput, UpdateCharacterInput } from './characters'
export type { FeatureRow, InventoryItemRow, SpellDataRow } from '@/types/database'

// ── Campaign service ───────────────────────────────────────────────────────────
export {
  createCampaign,
  getCampaign,
  listCampaigns,
  updateCampaign,
  updateWorldState,
  updateDirectorConfig,
  deleteCampaign,
} from './campaigns'
export type { CreateCampaignInput, UpdateCampaignInput } from './campaigns'
export type {
  Campaign,
  DirectorConfig,
  WorldState,
  CampaignTone,
  CampaignDifficulty,
  RulesStyle,
} from '@/types/campaign'

// ── Session service ────────────────────────────────────────────────────────────
export {
  startSession,
  endSession,
  pauseSession,
  resumeSession,
  appendTurn,
  getRecentTurns,
  getActiveSession,
  getResumableSession,
} from './sessions'
export type { GameSession, NarrativeTurn, AppendTurnInput } from './sessions'

// ── Director Documents service ───────────────────────────────────────────────
export {
  uploadDirectorDocument,
  listDirectorDocuments,
  getDirectorDocument,
  indexDirectorDocument,
  getDirectorDocumentSignedUrl,
  deleteDirectorDocument,
} from './directorDocuments'
export type { UploadDirectorDocumentInput } from './directorDocuments'

// ── Error types ────────────────────────────────────────────────────────────────
export { ServiceError } from './errors'
