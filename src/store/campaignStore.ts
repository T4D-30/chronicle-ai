import { create } from 'zustand'
import {
  listCampaigns,
  deleteCampaign as deleteCampaignService,
  ServiceError,
} from '@/lib/supabase'
import type { Campaign } from '@/lib/supabase'

interface CampaignStore {
  campaigns: Campaign[]
  isLoading: boolean
  error: string | null

  /** Fetch the full campaign library for a user. Replaces the list. */
  fetchCampaigns: (userId: string) => Promise<void>
  /** Remove a campaign from both the DB and the local list. */
  removeCampaign: (id: string) => Promise<void>
  /** Insert or replace a single campaign in the local list without a full refetch. */
  upsertCampaign: (campaign: Campaign) => void
  /** Clear any error state (e.g. after the user dismisses a toast). */
  clearError: () => void
}

/**
 * Campaign library state. Mirrors characterStore.ts's shape exactly — this
 * is intentionally thin, owning only the list view's data. Individual
 * campaign-editing state (the wizard draft, the session page's turn list)
 * lives locally in those components since it doesn't need to be shared
 * across routes.
 */
export const useCampaignStore = create<CampaignStore>((set, get) => ({
  campaigns: [],
  isLoading: false,
  error: null,

  fetchCampaigns: async (userId: string) => {
    set({ isLoading: true, error: null })
    try {
      const campaigns = await listCampaigns(userId)
      set({ campaigns, isLoading: false })
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof ServiceError ? err.message : 'Failed to load campaigns.',
      })
    }
  },

  removeCampaign: async (id: string) => {
    const previous = get().campaigns
    // Optimistic removal — mirrors characterStore's removeCharacter behavior.
    set({ campaigns: previous.filter((c) => c.id !== id) })
    try {
      await deleteCampaignService(id)
    } catch (err) {
      // Roll back on failure
      set({
        campaigns: previous,
        error: err instanceof ServiceError ? err.message : 'Failed to delete campaign.',
      })
    }
  },

  upsertCampaign: (campaign: Campaign) => {
    const existing = get().campaigns
    const index = existing.findIndex((c) => c.id === campaign.id)
    if (index === -1) {
      set({ campaigns: [campaign, ...existing] })
    } else {
      const next = [...existing]
      next[index] = campaign
      set({ campaigns: next })
    }
  },

  clearError: () => set({ error: null }),
}))
