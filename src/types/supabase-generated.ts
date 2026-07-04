/**
 * Chronicle AI — Generated Database Types
 *
 * Generated from local PostgreSQL schema after applying migrations 0001–0003.
 *
 * Generation process:
 *   1. Applied migrations 0001, 0002, 0003 to chronicle_ai_test database
 *   2. Introspected schema via pg information_schema + check constraints
 *   3. Generated types in Supabase CLI output format
 *
 * To regenerate:
 *   npm run db:types
 *   (requires local Postgres running — see SETUP.md)
 *
 * This file follows the exact format that `supabase gen types typescript` produces,
 * enabling `createClient<Database>()` to provide full type inference on all
 * .insert(), .update(), .select(), and .upsert() calls.
 *
 * ⚠️  Do not edit manually. Re-run `npm run db:types` after schema changes.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          display_name: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          display_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          display_name?: string | null
          avatar_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'profiles_id_fkey'
            columns: ['id']
            isOneToOne: true
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }

      characters: {
        Row: {
          id: string
          user_id: string
          name: string
          archetype: string
          ancestry: string
          background: string
          level: number
          experience: number
          str: number
          dex: number
          con: number
          int: number
          wis: number
          cha: number
          max_hp: number
          current_hp: number
          temp_hp: number
          armor_class: number
          speed: number
          proficiency_bonus: number
          hit_die: 'd6' | 'd8' | 'd10' | 'd12'
          death_saves_success: number
          death_saves_failure: number
          conditions: Json
          features: Json
          inventory: Json
          spells: Json
          concentration: Json | null
          skill_proficiencies: Json
          saving_throw_proficiencies: Json
          equipment: Json
          portrait_url: string | null
          bio: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          archetype?: string
          ancestry?: string
          background?: string
          level?: number
          experience?: number
          str?: number
          dex?: number
          con?: number
          int?: number
          wis?: number
          cha?: number
          max_hp?: number
          current_hp?: number
          temp_hp?: number
          armor_class?: number
          speed?: number
          proficiency_bonus?: number
          hit_die?: 'd6' | 'd8' | 'd10' | 'd12'
          death_saves_success?: number
          death_saves_failure?: number
          conditions?: Json
          features?: Json
          inventory?: Json
          spells?: Json
          concentration?: Json | null
          skill_proficiencies?: Json
          saving_throw_proficiencies?: Json
          equipment?: Json
          portrait_url?: string | null
          bio?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          archetype?: string
          ancestry?: string
          background?: string
          level?: number
          experience?: number
          str?: number
          dex?: number
          con?: number
          int?: number
          wis?: number
          cha?: number
          max_hp?: number
          current_hp?: number
          temp_hp?: number
          armor_class?: number
          speed?: number
          proficiency_bonus?: number
          hit_die?: 'd6' | 'd8' | 'd10' | 'd12'
          death_saves_success?: number
          death_saves_failure?: number
          conditions?: Json
          features?: Json
          inventory?: Json
          spells?: Json
          concentration?: Json | null
          skill_proficiencies?: Json
          saving_throw_proficiencies?: Json
          equipment?: Json
          portrait_url?: string | null
          bio?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'characters_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }

      campaigns: {
        Row: {
          id: string
          user_id: string
          title: string
          description: string | null
          status: 'idle' | 'active' | 'paused' | 'completed'
          character_id: string | null
          director_config: Json
          world_state: Json
          tone: 'grim' | 'heroic' | 'mysterious' | 'comedic' | null
          difficulty: 'easy' | 'standard' | 'brutal'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          description?: string | null
          status?: 'idle' | 'active' | 'paused' | 'completed'
          character_id?: string | null
          director_config?: Json
          world_state?: Json
          tone?: 'grim' | 'heroic' | 'mysterious' | 'comedic' | null
          difficulty?: 'easy' | 'standard' | 'brutal'
          created_at?: string
          updated_at?: string
        }
        Update: {
          title?: string
          description?: string | null
          status?: 'idle' | 'active' | 'paused' | 'completed'
          character_id?: string | null
          director_config?: Json
          world_state?: Json
          tone?: 'grim' | 'heroic' | 'mysterious' | 'comedic' | null
          difficulty?: 'easy' | 'standard' | 'brutal'
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'campaigns_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'campaigns_character_id_fkey'
            columns: ['character_id']
            isOneToOne: false
            referencedRelation: 'characters'
            referencedColumns: ['id']
          },
        ]
      }

      game_sessions: {
        Row: {
          id: string
          campaign_id: string
          turn_number: number
          status: 'active' | 'paused' | 'completed'
          current_mode: 'exploration' | 'combat' | 'map'
          started_at: string
          ended_at: string | null
        }
        Insert: {
          id?: string
          campaign_id: string
          turn_number?: number
          status?: 'active' | 'paused' | 'completed'
          current_mode?: 'exploration' | 'combat' | 'map'
          started_at?: string
          ended_at?: string | null
        }
        Update: {
          turn_number?: number
          status?: 'active' | 'paused' | 'completed'
          current_mode?: 'exploration' | 'combat' | 'map'
          ended_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'game_sessions_campaign_id_fkey'
            columns: ['campaign_id']
            isOneToOne: false
            referencedRelation: 'campaigns'
            referencedColumns: ['id']
          },
        ]
      }

      narrative_turns: {
        Row: {
          id: string
          session_id: string
          turn_number: number
          player_input: string
          ai_narration: string
          dice_rolls: Json
          mode: 'exploration' | 'combat' | 'map'
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          turn_number: number
          player_input: string
          ai_narration?: string
          dice_rolls?: Json
          mode?: 'exploration' | 'combat' | 'map'
          created_at?: string
        }
        Update: {
          ai_narration?: string
          dice_rolls?: Json
          mode?: 'exploration' | 'combat' | 'map'
        }
        Relationships: [
          {
            foreignKeyName: 'narrative_turns_session_id_fkey'
            columns: ['session_id']
            isOneToOne: false
            referencedRelation: 'game_sessions'
            referencedColumns: ['id']
          },
        ]
      }

      director_documents: {
        Row: {
          id: string
          campaign_id: string
          user_id: string
          category: 'dm_guide' | 'campaign_bible' | 'homebrew_rules' | 'world_lore' | 'character_notes' | 'other'
          file_name: string
          file_type: 'application/pdf' | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' | 'text/plain' | 'text/markdown'
          file_size_bytes: number
          storage_path: string
          extracted_text: string | null
          is_indexed: boolean
          uploaded_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          campaign_id: string
          user_id: string
          category?: 'dm_guide' | 'campaign_bible' | 'homebrew_rules' | 'world_lore' | 'character_notes' | 'other'
          file_name: string
          file_type: 'application/pdf' | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' | 'text/plain' | 'text/markdown'
          file_size_bytes: number
          storage_path: string
          extracted_text?: string | null
          is_indexed?: boolean
          uploaded_at?: string
          updated_at?: string
        }
        Update: {
          category?: 'dm_guide' | 'campaign_bible' | 'homebrew_rules' | 'world_lore' | 'character_notes' | 'other'
          extracted_text?: string | null
          is_indexed?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'director_documents_campaign_id_fkey'
            columns: ['campaign_id']
            isOneToOne: false
            referencedRelation: 'campaigns'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'director_documents_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
    }

    Views: {
      [_ in never]: never
    }

    Functions: {
      search_director_documents: {
        Args: {
          p_campaign_id: string
          p_query: string
          p_limit?: number
        }
        Returns: {
          document_id: string
          file_name: string
          category: 'dm_guide' | 'campaign_bible' | 'homebrew_rules' | 'world_lore' | 'character_notes' | 'other'
          excerpt: string
          relevance_score: number
        }[]
      }
    }

    Enums: {
      [_ in never]: never
    }

    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// ── Convenience type helpers (mirrors supabase-js patterns) ──────────────────

type PublicSchema = Database['public']

export type Tables<
  T extends keyof PublicSchema['Tables'],
> = PublicSchema['Tables'][T]['Row']

export type TablesInsert<
  T extends keyof PublicSchema['Tables'],
> = PublicSchema['Tables'][T]['Insert']

export type TablesUpdate<
  T extends keyof PublicSchema['Tables'],
> = PublicSchema['Tables'][T]['Update']
