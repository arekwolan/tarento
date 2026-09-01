export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      ai_generations: {
        Row: {
          accepted_at: string | null
          created_at: string
          id: string
          input_tokens: number | null
          kind: string
          model: string
          output_tokens: number | null
          prompt_hash: string | null
          rejected_reason: string | null
          response: Json | null
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          input_tokens?: number | null
          kind: string
          model: string
          output_tokens?: number | null
          prompt_hash?: string | null
          rejected_reason?: string | null
          response?: Json | null
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          input_tokens?: number | null
          kind?: string
          model?: string
          output_tokens?: number | null
          prompt_hash?: string | null
          rejected_reason?: string | null
          response?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_generations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      book_lab_notes: {
        Row: {
          archived_at: string | null
          content: string
          created_at: string
          id: string
          ordinal: number
          owner_id: string
          project_id: string
          source_locator: string | null
        }
        Insert: {
          archived_at?: string | null
          content: string
          created_at?: string
          id?: string
          ordinal: number
          owner_id: string
          project_id: string
          source_locator?: string | null
        }
        Update: {
          archived_at?: string | null
          content?: string
          created_at?: string
          id?: string
          ordinal?: number
          owner_id?: string
          project_id?: string
          source_locator?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "book_lab_notes_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_lab_notes_project_owner_fkey"
            columns: ["project_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "book_lab_projects"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
      book_lab_projects: {
        Row: {
          archived_at: string | null
          base_path_id: string | null
          created_at: string
          desired_change: string
          generated_draft: Json | null
          id: string
          locale: string
          owner_id: string
          path_id: string | null
          prompt_version: string
          request_key: string
          source_author: string
          source_title: string
          status: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          base_path_id?: string | null
          created_at?: string
          desired_change: string
          generated_draft?: Json | null
          id?: string
          locale?: string
          owner_id: string
          path_id?: string | null
          prompt_version: string
          request_key: string
          source_author: string
          source_title: string
          status?: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          base_path_id?: string | null
          created_at?: string
          desired_change?: string
          generated_draft?: Json | null
          id?: string
          locale?: string
          owner_id?: string
          path_id?: string | null
          prompt_version?: string
          request_key?: string
          source_author?: string
          source_title?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_lab_projects_base_path_id_fkey"
            columns: ["base_path_id"]
            isOneToOne: false
            referencedRelation: "paths"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_lab_projects_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_lab_projects_path_id_fkey"
            columns: ["path_id"]
            isOneToOne: true
            referencedRelation: "paths"
            referencedColumns: ["id"]
          },
        ]
      }
      book_lab_note_contexts: {
        Row: {
          created_at: string
          note_id: string
          owner_id: string
          context_value: string
          source_conflict_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          note_id: string
          owner_id: string
          context_value: string
          source_conflict_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          note_id?: string
          owner_id?: string
          context_value?: string
          source_conflict_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      protocol_conflict_reviews: {
        Row: {
          algorithm_version: string
          archived_at: string | null
          created_at: string
          id: string
          input_fingerprint: string
          owner_id: string
          path_id: string
          request_key: string
          semantic_status: string
          state_fingerprint: string
          status: string
          updated_at: string
        }
        Insert: {
          algorithm_version: string
          archived_at?: string | null
          created_at?: string
          id?: string
          input_fingerprint: string
          owner_id: string
          path_id: string
          request_key: string
          semantic_status?: string
          state_fingerprint: string
          status?: string
          updated_at?: string
        }
        Update: {
          algorithm_version?: string
          archived_at?: string | null
          created_at?: string
          id?: string
          input_fingerprint?: string
          owner_id?: string
          path_id?: string
          request_key?: string
          semantic_status?: string
          state_fingerprint?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      protocol_conflicts: {
        Row: {
          archived_at: string | null
          available_minutes: number | null
          confidence: string | null
          conflict_key: string
          conflict_type: string
          context_a: string | null
          context_b: string | null
          created_at: string
          day_kinds: string[] | null
          decision: string | null
          description: string | null
          existing_habit_id: string | null
          id: string
          incoming_practice_id: string | null
          note_a_id: string | null
          note_b_id: string | null
          owner_id: string
          required_minutes: number | null
          resolved_at: string | null
          review_id: string
          stage_id: string | null
          time_of_day: string | null
        }
        Insert: {
          archived_at?: string | null
          available_minutes?: number | null
          confidence?: string | null
          conflict_key: string
          conflict_type: string
          context_a?: string | null
          context_b?: string | null
          created_at?: string
          day_kinds?: string[] | null
          decision?: string | null
          description?: string | null
          existing_habit_id?: string | null
          id?: string
          incoming_practice_id?: string | null
          note_a_id?: string | null
          note_b_id?: string | null
          owner_id: string
          required_minutes?: number | null
          resolved_at?: string | null
          review_id: string
          stage_id?: string | null
          time_of_day?: string | null
        }
        Update: {
          archived_at?: string | null
          available_minutes?: number | null
          confidence?: string | null
          conflict_key?: string
          conflict_type?: string
          context_a?: string | null
          context_b?: string | null
          created_at?: string
          day_kinds?: string[] | null
          decision?: string | null
          description?: string | null
          existing_habit_id?: string | null
          id?: string
          incoming_practice_id?: string | null
          note_a_id?: string | null
          note_b_id?: string | null
          owner_id?: string
          required_minutes?: number | null
          resolved_at?: string | null
          review_id?: string
          stage_id?: string | null
          time_of_day?: string | null
        }
        Relationships: []
      }
      path_enrollment_requests: {
        Row: {
          created_at: string
          id: string
          owner_id: string
          path_id: string
          request_fingerprint: string
          request_key: string
          review_id: string | null
          user_path_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          owner_id: string
          path_id: string
          request_fingerprint: string
          request_key: string
          review_id?: string | null
          user_path_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          owner_id?: string
          path_id?: string
          request_fingerprint?: string
          request_key?: string
          review_id?: string | null
          user_path_id?: string | null
        }
        Relationships: []
      }
      daily_quotes: {
        Row: {
          id: string
          quote_id: string
          shown_on: string
          user_id: string
        }
        Insert: {
          id?: string
          quote_id: string
          shown_on: string
          user_id: string
        }
        Update: {
          id?: string
          quote_id?: string
          shown_on?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_quotes_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_quotes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      day_blocks: {
        Row: {
          archived_at: string | null
          end_time: string
          id: string
          kind: string
          label: string | null
          start_time: string
          template_id: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          end_time: string
          id?: string
          kind: string
          label?: string | null
          start_time: string
          template_id: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          end_time?: string
          id?: string
          kind?: string
          label?: string | null
          start_time?: string
          template_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "day_blocks_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "day_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "day_blocks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      day_notes: {
        Row: {
          body: string
          created_at: string
          id: string
          note_date: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          note_date: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          note_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "day_notes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      day_plan_items: {
        Row: {
          created_at: string
          day_plan_id: string
          estimated_minutes: number
          habit_id: string
          id: string
          plan_state: string
          reason: string
          sort_order: number
          target_value: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          day_plan_id: string
          estimated_minutes: number
          habit_id: string
          id?: string
          plan_state: string
          reason: string
          sort_order: number
          target_value: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          day_plan_id?: string
          estimated_minutes?: number
          habit_id?: string
          id?: string
          plan_state?: string
          reason?: string
          sort_order?: number
          target_value?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "day_plan_items_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "day_plan_items_plan_owner_fkey"
            columns: ["day_plan_id", "user_id"]
            isOneToOne: false
            referencedRelation: "day_plans"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      day_plans: {
        Row: {
          created_at: string
          daily_ceiling: number
          day_kind: string | null
          day_start_hour: number
          id: string
          is_quiet_week: boolean
          is_rest: boolean
          minute_budget: number | null
          plan_date: string
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          daily_ceiling: number
          day_kind?: string | null
          day_start_hour: number
          id?: string
          is_quiet_week?: boolean
          is_rest?: boolean
          minute_budget?: number | null
          plan_date: string
          timezone: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          daily_ceiling?: number
          day_kind?: string | null
          day_start_hour?: number
          id?: string
          is_quiet_week?: boolean
          is_rest?: boolean
          minute_budget?: number | null
          plan_date?: string
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "day_plans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      day_rotations: {
        Row: {
          anchor_date: string
          created_at: string
          id: string
          template_ids: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          anchor_date: string
          created_at?: string
          id?: string
          template_ids: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          anchor_date?: string
          created_at?: string
          id?: string
          template_ids?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "day_rotations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      day_templates: {
        Row: {
          archived_at: string | null
          created_at: string
          id: string
          kind: string
          name: string
          self_minutes: number
          sleep_time: string
          sort_order: number
          updated_at: string
          user_id: string
          wake_time: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          id?: string
          kind: string
          name: string
          self_minutes?: number
          sleep_time?: string
          sort_order?: number
          updated_at?: string
          user_id: string
          wake_time?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          id?: string
          kind?: string
          name?: string
          self_minutes?: number
          sleep_time?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
          wake_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "day_templates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      habit_downshifts: {
        Row: {
          accepted_at: string | null
          from_params: Json
          habit_id: string
          id: string
          offered_at: string
          to_params: Json | null
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          from_params: Json
          habit_id: string
          id?: string
          offered_at?: string
          to_params?: Json | null
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          from_params?: Json
          habit_id?: string
          id?: string
          offered_at?: string
          to_params?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habit_downshifts_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "habit_downshifts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      habit_friction_events: {
        Row: {
          archived_at: string | null
          created_at: string
          event_date: string
          habit_id: string
          id: string
          idempotency_key: string
          reason: string
          request_fingerprint: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          event_date: string
          habit_id: string
          id?: string
          idempotency_key: string
          reason: string
          request_fingerprint: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          event_date?: string
          habit_id?: string
          id?: string
          idempotency_key?: string
          reason?: string
          request_fingerprint?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habit_friction_events_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "habit_friction_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      habit_friction_responses: {
        Row: {
          created_at: string
          effective_on: string
          habit_id: string
          id: string
          idempotency_key: string
          reason: string
          request_fingerprint: string
          response: string
          suppressed_until: string
          user_id: string
        }
        Insert: {
          created_at?: string
          effective_on: string
          habit_id: string
          id?: string
          idempotency_key: string
          reason: string
          request_fingerprint: string
          response: string
          suppressed_until: string
          user_id: string
        }
        Update: {
          created_at?: string
          effective_on?: string
          habit_id?: string
          id?: string
          idempotency_key?: string
          reason?: string
          request_fingerprint?: string
          response?: string
          suppressed_until?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habit_friction_responses_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "habit_friction_responses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      habit_logs: {
        Row: {
          completed_at: string
          habit_id: string
          id: string
          log_date: string
          note: string | null
          status: string
          target_value: number
          user_id: string
          value_completed: number | null
        }
        Insert: {
          completed_at?: string
          habit_id: string
          id?: string
          log_date: string
          note?: string | null
          status: string
          target_value: number
          user_id: string
          value_completed?: number | null
        }
        Update: {
          completed_at?: string
          habit_id?: string
          id?: string
          log_date?: string
          note?: string | null
          status?: string
          target_value?: number
          user_id?: string
          value_completed?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "habit_logs_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "habit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      habit_retirements: {
        Row: {
          accepted_at: string | null
          declined_at: string | null
          habit_id: string
          id: string
          offered_at: string
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          declined_at?: string | null
          habit_id: string
          id?: string
          offered_at?: string
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          declined_at?: string | null
          habit_id?: string
          id?: string
          offered_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habit_retirements_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "habit_retirements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      habit_revisions: {
        Row: {
          after_snapshot: Json
          before_snapshot: Json | null
          created_at: string
          effective_on: string
          habit_id: string
          id: string
          idempotency_key: string
          reason: string
          request_fingerprint: string | null
          restores_revision_id: string | null
          revision_number: number
          source: string
          user_id: string
        }
        Insert: {
          after_snapshot: Json
          before_snapshot?: Json | null
          created_at?: string
          effective_on: string
          habit_id: string
          id?: string
          idempotency_key: string
          reason: string
          request_fingerprint?: string | null
          restores_revision_id?: string | null
          revision_number: number
          source: string
          user_id: string
        }
        Update: {
          after_snapshot?: Json
          before_snapshot?: Json | null
          created_at?: string
          effective_on?: string
          habit_id?: string
          id?: string
          idempotency_key?: string
          reason?: string
          request_fingerprint?: string | null
          restores_revision_id?: string | null
          revision_number?: number
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habit_revisions_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "habit_revisions_restores_revision_id_fkey"
            columns: ["restores_revision_id"]
            isOneToOne: false
            referencedRelation: "habit_revisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "habit_revisions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      habit_templates: {
        Row: {
          category: string | null
          description: string | null
          icon: string | null
          id: string
          increment_value: number
          language: string
          progression_mode: string
          sort_order: number | null
          source_author: string | null
          source_book: string | null
          start_value: number
          target_value: number | null
          title: string
          unit: string
        }
        Insert: {
          category?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          increment_value?: number
          language?: string
          progression_mode?: string
          sort_order?: number | null
          source_author?: string | null
          source_book?: string | null
          start_value?: number
          target_value?: number | null
          title: string
          unit?: string
        }
        Update: {
          category?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          increment_value?: number
          language?: string
          progression_mode?: string
          sort_order?: number | null
          source_author?: string | null
          source_book?: string | null
          start_value?: number
          target_value?: number | null
          title?: string
          unit?: string
        }
        Relationships: []
      }
      habits: {
        Row: {
          archived_at: string | null
          category: string | null
          color: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          increment_value: number
          progression_mode: string
          reminder_time: string | null
          retired_at: string | null
          schedule_days: number[] | null
          schedule_type: string
          sort_order: number
          source_author: string | null
          source_book: string | null
          source_path_id: string | null
          source_stage_id: string | null
          start_value: number
          started_on: string
          target_value: number | null
          time_of_day: string | null
          title: string
          unit: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          category?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          increment_value?: number
          progression_mode?: string
          reminder_time?: string | null
          retired_at?: string | null
          schedule_days?: number[] | null
          schedule_type?: string
          sort_order?: number
          source_author?: string | null
          source_book?: string | null
          source_path_id?: string | null
          source_stage_id?: string | null
          start_value?: number
          started_on?: string
          target_value?: number | null
          time_of_day?: string | null
          title: string
          unit?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          category?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          increment_value?: number
          progression_mode?: string
          reminder_time?: string | null
          retired_at?: string | null
          schedule_days?: number[] | null
          schedule_type?: string
          sort_order?: number
          source_author?: string | null
          source_book?: string | null
          source_path_id?: string | null
          source_stage_id?: string | null
          start_value?: number
          started_on?: string
          target_value?: number | null
          time_of_day?: string | null
          title?: string
          unit?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habits_source_path_id_fkey"
            columns: ["source_path_id"]
            isOneToOne: false
            referencedRelation: "paths"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "habits_source_stage_id_fkey"
            columns: ["source_stage_id"]
            isOneToOne: false
            referencedRelation: "path_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "habits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      letters: {
        Row: {
          body: string
          deliver_on: string
          delivered_at: string | null
          id: string
          user_id: string
          written_on: string
        }
        Insert: {
          body: string
          deliver_on: string
          delivered_at?: string | null
          id?: string
          user_id: string
          written_on: string
        }
        Update: {
          body?: string
          deliver_on?: string
          delivered_at?: string | null
          id?: string
          user_id?: string
          written_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "letters_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      path_implementation_confirmations: {
        Row: {
          answers_archived_at: string | null
          completed_at: string
          completed_stages: Json
          created_at: string
          id: string
          path_id: string
          practice_outcomes: Json
          protocol_type: string
          source_author: string | null
          source_title: string
          source_type: string | null
          user_id: string
          user_path_id: string
          user_sentence: string | null
        }
        Insert: {
          answers_archived_at?: string | null
          completed_at?: string
          completed_stages: Json
          created_at?: string
          id?: string
          path_id: string
          practice_outcomes: Json
          protocol_type: string
          source_author?: string | null
          source_title: string
          source_type?: string | null
          user_id: string
          user_path_id: string
          user_sentence?: string | null
        }
        Update: {
          answers_archived_at?: string | null
          completed_at?: string
          completed_stages?: Json
          created_at?: string
          id?: string
          path_id?: string
          practice_outcomes?: Json
          protocol_type?: string
          source_author?: string | null
          source_title?: string
          source_type?: string | null
          user_id?: string
          user_path_id?: string
          user_sentence?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "path_implementation_confirmations_path_id_fkey"
            columns: ["path_id"]
            isOneToOne: false
            referencedRelation: "paths"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "path_implementation_confirmations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "path_implementation_confirmations_user_path_owner_fkey"
            columns: ["user_path_id", "user_id"]
            isOneToOne: false
            referencedRelation: "user_paths"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      path_practices: {
        Row: {
          category: string | null
          how: string
          id: string
          increment_value: number
          is_optional: boolean
          progression_mode: string
          retires_practice_id: string | null
          schedule_days: number[] | null
          schedule_type: string
          sort_order: number
          source_note_ordinals: number[] | null
          stage_id: string
          start_value: number
          target_value: number | null
          time_of_day: string | null
          title: string
          unit: string
          when_hard: string | null
          why: string
        }
        Insert: {
          category?: string | null
          how: string
          id?: string
          increment_value?: number
          is_optional?: boolean
          progression_mode?: string
          retires_practice_id?: string | null
          schedule_days?: number[] | null
          schedule_type?: string
          sort_order?: number
          source_note_ordinals?: number[] | null
          stage_id: string
          start_value?: number
          target_value?: number | null
          time_of_day?: string | null
          title: string
          unit: string
          when_hard?: string | null
          why: string
        }
        Update: {
          category?: string | null
          how?: string
          id?: string
          increment_value?: number
          is_optional?: boolean
          progression_mode?: string
          retires_practice_id?: string | null
          schedule_days?: number[] | null
          schedule_type?: string
          sort_order?: number
          source_note_ordinals?: number[] | null
          stage_id?: string
          start_value?: number
          target_value?: number | null
          time_of_day?: string | null
          title?: string
          unit?: string
          when_hard?: string | null
          why?: string
        }
        Relationships: [
          {
            foreignKeyName: "path_practices_retires_practice_id_fkey"
            columns: ["retires_practice_id"]
            isOneToOne: false
            referencedRelation: "path_practices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "path_practices_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "path_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      path_readings: {
        Row: {
          attribution: string | null
          author: string | null
          body: string | null
          framing: string
          id: string
          quote_source: string | null
          quote_text: string | null
          source_kind: string
          source_locator: string | null
          stage_id: string
          title: string
          week: number
        }
        Insert: {
          attribution?: string | null
          author?: string | null
          body?: string | null
          framing: string
          id?: string
          quote_source?: string | null
          quote_text?: string | null
          source_kind: string
          source_locator?: string | null
          stage_id: string
          title: string
          week: number
        }
        Update: {
          attribution?: string | null
          author?: string | null
          body?: string | null
          framing?: string
          id?: string
          quote_source?: string | null
          quote_text?: string | null
          source_kind?: string
          source_locator?: string | null
          stage_id?: string
          title?: string
          week?: number
        }
        Relationships: [
          {
            foreignKeyName: "path_readings_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "path_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      path_setup_actions: {
        Row: {
          archived_at: string | null
          client_request_id: string | null
          created_at: string
          decided_on: string | null
          explanation: string | null
          id: string
          sort_order: number
          stage_id: string
          status: string
          status_changed_at: string
          title: string
          updated_at: string
          user_id: string
          user_path_id: string
        }
        Insert: {
          archived_at?: string | null
          client_request_id?: string | null
          created_at?: string
          decided_on?: string | null
          explanation?: string | null
          id?: string
          sort_order?: number
          stage_id: string
          status?: string
          status_changed_at?: string
          title: string
          updated_at?: string
          user_id: string
          user_path_id: string
        }
        Update: {
          archived_at?: string | null
          client_request_id?: string | null
          created_at?: string
          decided_on?: string | null
          explanation?: string | null
          id?: string
          sort_order?: number
          stage_id?: string
          status?: string
          status_changed_at?: string
          title?: string
          updated_at?: string
          user_id?: string
          user_path_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "path_setup_actions_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "path_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "path_setup_actions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "path_setup_actions_user_path_id_fkey"
            columns: ["user_path_id"]
            isOneToOne: false
            referencedRelation: "user_paths"
            referencedColumns: ["id"]
          },
        ]
      }
      path_stages: {
        Row: {
          completion_threshold: number
          daily_minutes_p50: number
          description: string
          environment_setup: string | null
          environment_setup_note_ordinals: number[] | null
          id: string
          max_days: number
          min_days: number
          name: string
          ordinal: number
          path_id: string
          transition_criterion: string | null
          transition_note_ordinals: number[] | null
        }
        Insert: {
          completion_threshold: number
          daily_minutes_p50: number
          description: string
          environment_setup?: string | null
          environment_setup_note_ordinals?: number[] | null
          id?: string
          max_days: number
          min_days: number
          name: string
          ordinal: number
          path_id: string
          transition_criterion?: string | null
          transition_note_ordinals?: number[] | null
        }
        Update: {
          completion_threshold?: number
          daily_minutes_p50?: number
          description?: string
          environment_setup?: string | null
          environment_setup_note_ordinals?: number[] | null
          id?: string
          max_days?: number
          min_days?: number
          name?: string
          ordinal?: number
          path_id?: string
          transition_criterion?: string | null
          transition_note_ordinals?: number[] | null
        }
        Relationships: [
          {
            foreignKeyName: "path_stages_path_id_fkey"
            columns: ["path_id"]
            isOneToOne: false
            referencedRelation: "paths"
            referencedColumns: ["id"]
          },
        ]
      }
      path_transfer_responses: {
        Row: {
          advanced_to_stage_id: string | null
          answered_on: string
          archived_at: string | null
          client_request_id: string
          created_at: string
          decision: string
          defer_until: string | null
          evidence: string | null
          id: string
          protocol_type: string
          response: string
          retired_habit_ids: string[]
          retired_titles: string[]
          stage_id: string
          supersedes_response_id: string | null
          user_id: string
          user_path_id: string
        }
        Insert: {
          advanced_to_stage_id?: string | null
          answered_on: string
          archived_at?: string | null
          client_request_id: string
          created_at?: string
          decision: string
          defer_until?: string | null
          evidence?: string | null
          id?: string
          protocol_type: string
          response: string
          retired_habit_ids?: string[]
          retired_titles?: string[]
          stage_id: string
          supersedes_response_id?: string | null
          user_id: string
          user_path_id: string
        }
        Update: {
          advanced_to_stage_id?: string | null
          answered_on?: string
          archived_at?: string | null
          client_request_id?: string
          created_at?: string
          decision?: string
          defer_until?: string | null
          evidence?: string | null
          id?: string
          protocol_type?: string
          response?: string
          retired_habit_ids?: string[]
          retired_titles?: string[]
          stage_id?: string
          supersedes_response_id?: string | null
          user_id?: string
          user_path_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "path_transfer_responses_advanced_to_stage_id_fkey"
            columns: ["advanced_to_stage_id"]
            isOneToOne: false
            referencedRelation: "path_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "path_transfer_responses_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "path_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "path_transfer_responses_supersedes_response_id_fkey"
            columns: ["supersedes_response_id"]
            isOneToOne: false
            referencedRelation: "path_transfer_responses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "path_transfer_responses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "path_transfer_responses_user_path_owner_fkey"
            columns: ["user_path_id", "user_id"]
            isOneToOne: false
            referencedRelation: "user_paths"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      paths: {
        Row: {
          archived_at: string | null
          closing_letter: boolean
          completion_note: string | null
          created_at: string
          curated_by: string | null
          disclaimer: string | null
          duration_days: number
          honesty: string | null
          hook: string
          id: string
          is_published: boolean
          language: string
          origin_kind: string
          owner_id: string | null
          path_kind: string
          repeat_cooldown_days: number | null
          review_status: string
          slug: string
          sort_order: number
          source_author: string | null
          source_edition: string | null
          source_identifier: string | null
          source_title: string | null
          source_type: string | null
          title: string
          version: number
          version_parent_id: string | null
        }
        Insert: {
          archived_at?: string | null
          closing_letter?: boolean
          completion_note?: string | null
          created_at?: string
          curated_by?: string | null
          disclaimer?: string | null
          duration_days: number
          honesty?: string | null
          hook: string
          id?: string
          is_published?: boolean
          language?: string
          origin_kind?: string
          owner_id?: string | null
          path_kind?: string
          repeat_cooldown_days?: number | null
          review_status?: string
          slug: string
          sort_order?: number
          source_author?: string | null
          source_edition?: string | null
          source_identifier?: string | null
          source_title?: string | null
          source_type?: string | null
          title: string
          version?: number
          version_parent_id?: string | null
        }
        Update: {
          archived_at?: string | null
          closing_letter?: boolean
          completion_note?: string | null
          created_at?: string
          curated_by?: string | null
          disclaimer?: string | null
          duration_days?: number
          honesty?: string | null
          hook?: string
          id?: string
          is_published?: boolean
          language?: string
          origin_kind?: string
          owner_id?: string | null
          path_kind?: string
          repeat_cooldown_days?: number | null
          review_status?: string
          slug?: string
          sort_order?: number
          source_author?: string | null
          source_edition?: string | null
          source_identifier?: string | null
          source_title?: string | null
          source_type?: string | null
          title?: string
          version?: number
          version_parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "paths_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paths_version_parent_id_fkey"
            columns: ["version_parent_id"]
            isOneToOne: false
            referencedRelation: "paths"
            referencedColumns: ["id"]
          },
        ]
      }
      personal_experiment_commands: {
        Row: {
          action: string
          created_at: string
          experiment_id: string
          id: string
          idempotency_key: string
          request_fingerprint: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          experiment_id: string
          id?: string
          idempotency_key: string
          request_fingerprint: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          experiment_id?: string
          id?: string
          idempotency_key?: string
          request_fingerprint?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "personal_experiment_commands_experiment_id_fkey"
            columns: ["experiment_id"]
            isOneToOne: false
            referencedRelation: "personal_experiments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personal_experiment_commands_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      personal_experiments: {
        Row: {
          a_completed: number
          a_expected: number
          b_completed: number
          b_expected: number
          block_started_on: string | null
          cancelled_on: string | null
          completed_on: string | null
          create_idempotency_key: string
          created_at: string
          current_block: string | null
          decided_on: string | null
          decision: string | null
          habit_id: string
          hypothesis: string
          id: string
          opportunity_target: number
          original_snapshot: Json
          paused_on: string | null
          planned_a_end: string
          planned_a_start: string
          planned_b_end: string
          planned_b_start: string
          reminder_opt_in: boolean
          request_fingerprint: string
          started_on: string | null
          state: string
          transition_idempotency_key: string
          updated_at: string
          user_id: string
          variant_a: Json
          variant_b: Json
        }
        Insert: {
          a_completed?: number
          a_expected?: number
          b_completed?: number
          b_expected?: number
          block_started_on?: string | null
          cancelled_on?: string | null
          completed_on?: string | null
          create_idempotency_key: string
          created_at?: string
          current_block?: string | null
          decided_on?: string | null
          decision?: string | null
          habit_id: string
          hypothesis: string
          id?: string
          opportunity_target?: number
          original_snapshot: Json
          paused_on?: string | null
          planned_a_end: string
          planned_a_start: string
          planned_b_end: string
          planned_b_start: string
          reminder_opt_in?: boolean
          request_fingerprint: string
          started_on?: string | null
          state?: string
          transition_idempotency_key?: string
          updated_at?: string
          user_id: string
          variant_a: Json
          variant_b: Json
        }
        Update: {
          a_completed?: number
          a_expected?: number
          b_completed?: number
          b_expected?: number
          block_started_on?: string | null
          cancelled_on?: string | null
          completed_on?: string | null
          create_idempotency_key?: string
          created_at?: string
          current_block?: string | null
          decided_on?: string | null
          decision?: string | null
          habit_id?: string
          hypothesis?: string
          id?: string
          opportunity_target?: number
          original_snapshot?: Json
          paused_on?: string | null
          planned_a_end?: string
          planned_a_start?: string
          planned_b_end?: string
          planned_b_start?: string
          reminder_opt_in?: boolean
          request_fingerprint?: string
          started_on?: string | null
          state?: string
          transition_idempotency_key?: string
          updated_at?: string
          user_id?: string
          variant_a?: Json
          variant_b?: Json
        }
        Relationships: [
          {
            foreignKeyName: "personal_experiments_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personal_experiments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          daily_ceiling: number
          day_start_hour: number
          display_name: string | null
          id: string
          locale: string
          onboarding_completed_at: string | null
          subscription_tier: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          daily_ceiling?: number
          day_start_hour?: number
          display_name?: string | null
          id: string
          locale?: string
          onboarding_completed_at?: string | null
          subscription_tier?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          daily_ceiling?: number
          day_start_hour?: number
          display_name?: string | null
          id?: string
          locale?: string
          onboarding_completed_at?: string | null
          subscription_tier?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      quiet_weeks: {
        Row: {
          created_at: string
          ended_early_at: string | null
          ends_on: string
          id: string
          started_on: string
          user_id: string
        }
        Insert: {
          created_at?: string
          ended_early_at?: string | null
          ends_on: string
          id?: string
          started_on: string
          user_id: string
        }
        Update: {
          created_at?: string
          ended_early_at?: string | null
          ends_on?: string
          id?: string
          started_on?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiet_weeks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_favorites: {
        Row: {
          created_at: string
          quote_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          quote_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          quote_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_favorites_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          author: string
          content: string
          created_at: string
          id: string
          is_active: boolean
          is_public_domain: boolean
          language: string
          source_book: string | null
          tags: string[] | null
        }
        Insert: {
          author: string
          content: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_public_domain?: boolean
          language?: string
          source_book?: string | null
          tags?: string[] | null
        }
        Update: {
          author?: string
          content?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_public_domain?: boolean
          language?: string
          source_book?: string | null
          tags?: string[] | null
        }
        Relationships: []
      }
      rest_days: {
        Row: {
          created_at: string
          id: string
          rest_date: string | null
          user_id: string
          weekday: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          rest_date?: string | null
          user_id: string
          weekday?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          rest_date?: string | null
          user_id?: string
          weekday?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rest_days_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      self_rule_events: {
        Row: {
          created_at: string
          effective_on: string
          event_type: string
          evidence_snapshot: Json | null
          id: string
          idempotency_key: string
          rule_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          effective_on: string
          event_type: string
          evidence_snapshot?: Json | null
          id?: string
          idempotency_key: string
          rule_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          effective_on?: string
          event_type?: string
          evidence_snapshot?: Json | null
          id?: string
          idempotency_key?: string
          rule_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "self_rule_events_rule_owner_fkey"
            columns: ["rule_id", "user_id"]
            isOneToOne: false
            referencedRelation: "self_rules"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      self_rules: {
        Row: {
          algorithm_version: string
          archived_at: string | null
          conclusion_key: string
          created_at: string
          evidence_hash: string
          evidence_snapshot: Json
          id: string
          range_end: string
          range_start: string
          reevaluate_on: string
          review_required_at: string | null
          rule_key: string
          rule_type: string
          sample_size: number
          status: string
          subject_habit_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          algorithm_version: string
          archived_at?: string | null
          conclusion_key: string
          created_at?: string
          evidence_hash: string
          evidence_snapshot: Json
          id?: string
          range_end: string
          range_start: string
          reevaluate_on: string
          review_required_at?: string | null
          rule_key: string
          rule_type: string
          sample_size: number
          status?: string
          subject_habit_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          algorithm_version?: string
          archived_at?: string | null
          conclusion_key?: string
          created_at?: string
          evidence_hash?: string
          evidence_snapshot?: Json
          id?: string
          range_end?: string
          range_start?: string
          reevaluate_on?: string
          review_required_at?: string | null
          rule_key?: string
          rule_type?: string
          sample_size?: number
          status?: string
          subject_habit_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "self_rules_subject_habit_id_fkey"
            columns: ["subject_habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "self_rules_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_path_practices: {
        Row: {
          activated_on: string
          habit_id: string
          id: string
          practice_id: string
          retired_on: string | null
          user_id: string
          user_path_id: string
        }
        Insert: {
          activated_on: string
          habit_id: string
          id?: string
          practice_id: string
          retired_on?: string | null
          user_id: string
          user_path_id: string
        }
        Update: {
          activated_on?: string
          habit_id?: string
          id?: string
          practice_id?: string
          retired_on?: string | null
          user_id?: string
          user_path_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_path_practices_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_path_practices_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "path_practices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_path_practices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_path_practices_user_path_id_fkey"
            columns: ["user_path_id"]
            isOneToOne: false
            referencedRelation: "user_paths"
            referencedColumns: ["id"]
          },
        ]
      }
      user_paths: {
        Row: {
          created_at: string
          current_stage_id: string | null
          ended_at: string | null
          ended_reason: string | null
          fit: Json | null
          id: string
          path_id: string
          paused_at: string | null
          reentry_until: string | null
          stage_entered_on: string
          started_on: string
          state: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_stage_id?: string | null
          ended_at?: string | null
          ended_reason?: string | null
          fit?: Json | null
          id?: string
          path_id: string
          paused_at?: string | null
          reentry_until?: string | null
          stage_entered_on: string
          started_on: string
          state?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_stage_id?: string | null
          ended_at?: string | null
          ended_reason?: string | null
          fit?: Json | null
          id?: string
          path_id?: string
          paused_at?: string | null
          reentry_until?: string | null
          stage_entered_on?: string
          started_on?: string
          state?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_paths_current_stage_id_fkey"
            columns: ["current_stage_id"]
            isOneToOne: false
            referencedRelation: "path_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_paths_path_id_fkey"
            columns: ["path_id"]
            isOneToOne: false
            referencedRelation: "paths"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_paths_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      advance_path_stage: {
        Args: {
          p_from_stage_id: string
          p_today: string
          p_user_path_id: string
        }
        Returns: {
          next_stage_id: string
          retired_habit_ids: string[]
          retired_titles: string[]
        }[]
      }
      allocated_window_minutes: {
        Args: { p_date: string; p_user_id: string }
        Returns: number
      }
      apply_personal_experiment_patch: {
        Args: {
          p_effective_on: string
          p_experiment_id: string
          p_idempotency_key: string
          p_patch: Json
          p_reason: string
        }
        Returns: undefined
      }
      archive_book_lab_project: {
        Args: { p_project_id: string }
        Returns: undefined
      }
      archive_path_transfer_data: {
        Args: { p_user_path_id: string }
        Returns: undefined
      }
      book_lab_free_minutes: { Args: { p_user_id: string }; Returns: number }
      book_lab_item_minutes: {
        Args: { p_start_value: number; p_unit: string }
        Returns: number
      }
      book_lab_safe_budget_ratio: { Args: never; Returns: number }
      capped_skip_ids: {
        Args: { p_skip: string[]; p_stage_id: string }
        Returns: string[]
      }
      complete_onboarding: { Args: never; Returns: string }
      create_personal_experiment_draft: {
        Args: {
          p_a_target?: number
          p_a_time_of_day?: string
          p_b_target?: number
          p_b_time_of_day?: string
          p_habit_id: string
          p_hypothesis?: string
          p_idempotency_key?: string
          p_reminder_opt_in?: boolean
          p_today?: string
        }
        Returns: Json
      }
      day_is_quiet: {
        Args: { p_day: string; p_user_id: string }
        Returns: boolean
      }
      day_is_rest: {
        Args: { p_day: string; p_user_id: string }
        Returns: boolean
      }
      day_kind_for_date: {
        Args: { p_day: string; p_user_id: string }
        Returns: string
      }
      decide_self_rule: {
        Args: {
          p_action: string
          p_effective_on: string
          p_idempotency_key: string
          p_rule_id: string
        }
        Returns: {
          algorithm_version: string
          archived_at: string | null
          conclusion_key: string
          created_at: string
          evidence_hash: string
          evidence_snapshot: Json
          id: string
          range_end: string
          range_start: string
          reevaluate_on: string
          review_required_at: string | null
          rule_key: string
          rule_type: string
          sample_size: number
          status: string
          subject_habit_id: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "self_rules"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_user_account: { Args: never; Returns: undefined }
      end_path: {
        Args: {
          p_keep_practices: boolean
          p_reason: string
          p_user_path_id: string
        }
        Returns: undefined
      }
      enroll_in_path: {
        Args: {
          p_fit: Json
          p_lite: boolean
          p_path_id: string
          p_skip_practice_ids: string[]
          p_today: string
        }
        Returns: string
      }
      enroll_in_path_reviewed: {
        Args: {
          p_fit: Json
          p_lite: boolean
          p_path_id: string
          p_request_id: string
          p_review_id: string
          p_skip_practice_ids: string[]
          p_today: string
        }
        Returns: string
      }
      ensure_day_plan: { Args: { p_plan_date: string }; Returns: Json }
      get_daily_summary: {
        Args: { p_from: string; p_to: string }
        Returns: {
          completed: number
          day: string
          scheduled: number
        }[]
      }
      get_expected_habit_opportunities: {
        Args: { p_from: string; p_to: string }
        Returns: {
          day: string
          habit_id: string
          outcome: string
        }[]
      }
      get_habit_plan_progress: {
        Args: { p_before: string }
        Returns: {
          expected_count: number
          habit_id: string
        }[]
      }
      get_habit_stats: {
        Args: { p_today: string }
        Returns: {
          completed_30: number
          completed_7: number
          current_streak: number
          habit_id: string
          longest_streak: number
          recent_days: boolean[]
          scheduled_30: number
          scheduled_7: number
        }[]
      }
      get_habit_streak: {
        Args: { p_habit_id: string }
        Returns: {
          current_streak: number
          longest_streak: number
        }[]
      }
      get_habit_streak_for_day: {
        Args: { p_habit_id: string; p_today: string }
        Returns: {
          current_streak: number
          longest_streak: number
        }[]
      }
      get_habits_progress: {
        Args: { p_before: string }
        Returns: {
          completed_count: number
          habit_id: string
        }[]
      }
      get_habits_streaks: {
        Args: never
        Returns: {
          current_streak: number
          habit_id: string
          longest_streak: number
        }[]
      }
      get_habits_streaks_for_day: {
        Args: { p_today: string }
        Returns: {
          current_streak: number
          habit_id: string
          longest_streak: number
        }[]
      }
      get_today_path_setup_actions: {
        Args: { p_today: string }
        Returns: {
          archived_at: string | null
          client_request_id: string | null
          created_at: string
          decided_on: string | null
          explanation: string | null
          id: string
          sort_order: number
          stage_id: string
          status: string
          status_changed_at: string
          title: string
          updated_at: string
          user_id: string
          user_path_id: string
        }[]
      }
      get_path_completion_ratio: {
        Args: { p_days?: number; p_today: string; p_user_path_id: string }
        Returns: number
      }
      get_personal_experiment: {
        Args: { p_habit_id: string; p_today: string }
        Returns: Json
      }
      get_self_rule_evidence: {
        Args: { p_from: string; p_to: string }
        Returns: {
          day: string
          day_kind: string
          friction_reason: string
          habit_id: string
          is_minimal: boolean
          outcome: string
          revision_id: string
          revision_number: number
          revision_reason: string
          revision_source: string
          schedule_key: string
          target_value: number
          time_of_day: string
        }[]
      }
      habit_is_scheduled_on: {
        Args: {
          p_day: string
          p_schedule_days: number[]
          p_schedule_type: string
        }
        Returns: boolean
      }
      habit_revision_snapshot: {
        Args: { p_habit: Database["public"]["Tables"]["habits"]["Row"] }
        Returns: Json
      }
      habit_revision_snapshot_minutes: {
        Args: { p_snapshot: Json }
        Returns: number
      }
      habit_weekday_completion: {
        Args: { p_days: number; p_habit_id: string }
        Returns: {
          completed: number
          dow: number
          scheduled: number
        }[]
      }
      logical_today: { Args: { p_user_id: string }; Returns: string }
      materialize_path_practice: {
        Args: {
          p_lite: boolean
          p_practice_id: string
          p_today: string
          p_user_path_id: string
        }
        Returns: string
      }
      path_practice_params: {
        Args: { p_lite: boolean; p_practice_id: string; p_reentry: boolean }
        Returns: {
          increment_value: number
          start_value: number
        }[]
      }
      pause_path: { Args: { p_user_path_id: string }; Returns: undefined }
      personal_experiment_counts: {
        Args: { p_block: string; p_experiment_id: string; p_through: string }
        Returns: {
          completed: number
          expected: number
          last_opportunity_on: string
        }[]
      }
      personal_experiment_forecast_dates: {
        Args: {
          p_count: number
          p_from: string
          p_habit_id: string
          p_user_id: string
        }
        Returns: {
          opportunity_on: string
          ordinal: number
        }[]
      }
      personal_experiment_has_path_conflict: {
        Args: { p_habit_id: string; p_until: string; p_user_id: string }
        Returns: boolean
      }
      personal_experiment_json: {
        Args: { p_experiment_id: string; p_through: string }
        Returns: Json
      }
      personal_experiment_original_patch: {
        Args: {
          p_experiment: Database["public"]["Tables"]["personal_experiments"]["Row"]
        }
        Returns: Json
      }
      personal_experiment_period_counts: {
        Args: {
          p_from: string
          p_habit_id: string
          p_limit: number
          p_original_snapshot: Json
          p_to: string
          p_user_id: string
        }
        Returns: {
          completed: number
          expected: number
          last_opportunity_on: string
        }[]
      }
      preview_habit_revision_restore: {
        Args: {
          p_effective_on: string
          p_habit_id: string
          p_revision_id: string
        }
        Returns: Json
      }
      respond_habit_friction_suggestion: {
        Args: {
          p_effective_on: string
          p_habit_id: string
          p_idempotency_key: string
          p_reason: string
          p_response: string
        }
        Returns: Json
      }
      restore_habit_revision: {
        Args: {
          p_accept_path_conflict: boolean
          p_effective_on: string
          p_expected_revision_id: string
          p_habit_id: string
          p_idempotency_key: string
          p_revision_id: string
        }
        Returns: Json
      }
      restore_path_parameters: {
        Args: { p_user_path_id: string }
        Returns: undefined
      }
      resolve_protocol_conflict: {
        Args: {
          p_conflict_id: string
          p_context_a?: string | null
          p_context_b?: string | null
          p_decision: string
          p_review_id: string
        }
        Returns: Json
      }
      resolve_path_setup_action: {
        Args: {
          p_action_id: string
          p_client_request_id: string
          p_status: string
          p_today: string
        }
        Returns: {
          archived_at: string | null
          client_request_id: string | null
          created_at: string
          decided_on: string | null
          explanation: string | null
          id: string
          sort_order: number
          stage_id: string
          status: string
          status_changed_at: string
          title: string
          updated_at: string
          user_id: string
          user_path_id: string
        }[]
      }
      resume_path: {
        Args: {
          p_today: string
          p_user_path_id: string
          p_with_reentry: boolean
        }
        Returns: undefined
      }
      run_personal_experiment_action: {
        Args: {
          p_action: string
          p_experiment_id: string
          p_idempotency_key: string
          p_today: string
        }
        Returns: Json
      }
      save_book_lab_protocol: {
        Args: { p_draft: Json; p_project_id: string }
        Returns: string
      }
      save_habit_friction_event: {
        Args: {
          p_event_date: string
          p_habit_id: string
          p_idempotency_key: string
          p_reason: string
        }
        Returns: Json
      }
      self_rule_value_is_valid: {
        Args: { p_rule_type: string; p_value: string }
        Returns: boolean
      }
      set_habit_friction_event_archived: {
        Args: { p_archived: boolean; p_event_id: string }
        Returns: Json
      }
      set_habit_lifecycle_with_revision: {
        Args: {
          p_effective_on: string
          p_expected_updated_at: string
          p_habit_id: string
          p_idempotency_key: string
          p_state: string
        }
        Returns: Json
      }
      set_path_practice_retired: {
        Args: { p_habit_id: string; p_retired: boolean; p_today: string }
        Returns: undefined
      }
      set_self_rule_archived: {
        Args: {
          p_archived: boolean
          p_effective_on: string
          p_idempotency_key: string
          p_rule_id: string
        }
        Returns: {
          algorithm_version: string
          archived_at: string | null
          conclusion_key: string
          created_at: string
          evidence_hash: string
          evidence_snapshot: Json
          id: string
          range_end: string
          range_start: string
          reevaluate_on: string
          review_required_at: string | null
          rule_key: string
          rule_type: string
          sample_size: number
          status: string
          subject_habit_id: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "self_rules"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_path_transfer: {
        Args: {
          p_client_request_id: string
          p_decision: string
          p_evidence: string
          p_response: string
          p_stage_id: string
          p_today: string
          p_user_path_id: string
        }
        Returns: {
          deferred_until: string
          next_stage_id: string
          response_id: string
          retired_habit_ids: string[]
          retired_titles: string[]
        }[]
      }
      sync_personal_experiment: { Args: { p_today: string }; Returns: Json }
      sync_self_rule_candidates: {
        Args: { p_candidates: Json; p_effective_on: string }
        Returns: {
          algorithm_version: string
          archived_at: string | null
          conclusion_key: string
          created_at: string
          evidence_hash: string
          evidence_snapshot: Json
          id: string
          range_end: string
          range_start: string
          reevaluate_on: string
          review_required_at: string | null
          rule_key: string
          rule_type: string
          sample_size: number
          status: string
          subject_habit_id: string
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "self_rules"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      update_habit_with_revision: {
        Args: {
          p_effective_on: string
          p_expected_updated_at: string
          p_habit_id: string
          p_idempotency_key: string
          p_reason: string
          p_source: string
          p_values: Json
        }
        Returns: Json
      }
      upsert_habit_log_for_plan: {
        Args: {
          p_habit_id: string
          p_log_date: string
          p_note?: string
          p_status: string
          p_target_value: number
          p_value_completed?: number
        }
        Returns: Json
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

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
