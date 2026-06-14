/* eslint-disable */
// AUTO-GENERATED — DO NOT EDIT
// Run migrations to regenerate.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          date: string
          doctor_name: string
          id: string
          kid_name: string
          profile_id: string
          specialty: string
          time: string
          user_id: string | null
        }
        Insert: {
          date: string
          doctor_name: string
          id: string
          kid_name: string
          profile_id: string
          specialty: string
          time: string
          user_id?: string | null
        }
        Update: {
          date?: string
          doctor_name?: string
          id?: string
          kid_name?: string
          profile_id?: string
          specialty?: string
          time?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      camps: {
        Row: {
          checks: Json
          date: string
          id: string
          profile_id: string
          result_summary: string | null
          school: string
          status: string
          time: string
          title: string
          user_id: string | null
        }
        Insert: {
          checks?: Json
          date: string
          id: string
          profile_id: string
          result_summary?: string | null
          school: string
          status?: string
          time: string
          title: string
          user_id?: string | null
        }
        Update: {
          checks?: Json
          date?: string
          id?: string
          profile_id?: string
          result_summary?: string | null
          school?: string
          status?: string
          time?: string
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "camps_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      co_parents: {
        Row: {
          id: string
          joined_date: string
          name: string
          profile_id: string
          relation: string
          user_id: string | null
        }
        Insert: {
          id: string
          joined_date?: string
          name: string
          profile_id: string
          relation: string
          user_id?: string | null
        }
        Update: {
          id?: string
          joined_date?: string
          name?: string
          profile_id?: string
          relation?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "co_parents_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      growth_points: {
        Row: {
          height: number
          id: string
          kid_id: string
          label: string
          recorded_at: string
          user_id: string | null
          weight: number
        }
        Insert: {
          height?: number
          id: string
          kid_id: string
          label: string
          recorded_at?: string
          user_id?: string | null
          weight?: number
        }
        Update: {
          height?: number
          id?: string
          kid_id?: string
          label?: string
          recorded_at?: string
          user_id?: string | null
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "growth_points_kid_id_fkey"
            columns: ["kid_id"]
            isOneToOne: false
            referencedRelation: "kids"
            referencedColumns: ["id"]
          },
        ]
      }
      kids: {
        Row: {
          age: number
          avatar_color: number
          created_at: string
          dental: string
          eyesight: string
          gender: string
          grade: string
          height_cm: number
          id: string
          last_checkup: string
          name: string
          nutrition: string
          overall_score: number
          profile_id: string
          school: string
          updated_at: string
          user_id: string | null
          weight_kg: number
        }
        Insert: {
          age: number
          avatar_color?: number
          created_at?: string
          dental?: string
          eyesight?: string
          gender: string
          grade?: string
          height_cm?: number
          id: string
          last_checkup?: string
          name: string
          nutrition?: string
          overall_score?: number
          profile_id: string
          school?: string
          updated_at?: string
          user_id?: string | null
          weight_kg?: number
        }
        Update: {
          age?: number
          avatar_color?: number
          created_at?: string
          dental?: string
          eyesight?: string
          gender?: string
          grade?: string
          height_cm?: number
          id?: string
          last_checkup?: string
          name?: string
          nutrition?: string
          overall_score?: number
          profile_id?: string
          school?: string
          updated_at?: string
          user_id?: string | null
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "kids_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_items: {
        Row: {
          detail: string
          eaten: boolean
          id: string
          kcal: number
          kid_id: string
          name: string
          profile_id: string
          time_slot: string
          user_id: string | null
        }
        Insert: {
          detail?: string
          eaten?: boolean
          id: string
          kcal?: number
          kid_id: string
          name: string
          profile_id: string
          time_slot: string
          user_id?: string | null
        }
        Update: {
          detail?: string
          eaten?: boolean
          id?: string
          kcal?: number
          kid_id?: string
          name?: string
          profile_id?: string
          time_slot?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meal_items_kid_id_fkey"
            columns: ["kid_id"]
            isOneToOne: false
            referencedRelation: "kids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_items_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      phone_otps: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          otp_hash: string
          phone: string
          salt: string
          verified: boolean
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          otp_hash: string
          phone: string
          salt?: string
          verified?: boolean
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          otp_hash?: string
          phone?: string
          salt?: string
          verified?: boolean
        }
        Relationships: []
      }
      profiles: {
        Row: {
          camp_reminders_enabled: boolean
          consent_accepted: boolean
          consent_declined: boolean
          created_at: string
          dark_theme: boolean
          family_code: string
          id: string
          is_logged_in: boolean
          locale_code: string
          name: string
          notifications_enabled: boolean
          onboarding_complete: boolean
          phone: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          camp_reminders_enabled?: boolean
          consent_accepted?: boolean
          consent_declined?: boolean
          created_at?: string
          dark_theme?: boolean
          family_code?: string
          id: string
          is_logged_in?: boolean
          locale_code?: string
          name?: string
          notifications_enabled?: boolean
          onboarding_complete?: boolean
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          camp_reminders_enabled?: boolean
          consent_accepted?: boolean
          consent_declined?: boolean
          created_at?: string
          dark_theme?: boolean
          family_code?: string
          id?: string
          is_logged_in?: boolean
          locale_code?: string
          name?: string
          notifications_enabled?: boolean
          onboarding_complete?: boolean
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      streaks: {
        Row: {
          best_streak: number
          current_streak: number
          kid_id: string
          last_log_date: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          best_streak?: number
          current_streak?: number
          kid_id: string
          last_log_date?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          best_streak?: number
          current_streak?: number
          kid_id?: string
          last_log_date?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "streaks_kid_id_fkey"
            columns: ["kid_id"]
            isOneToOne: true
            referencedRelation: "kids"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
  public: {
    Enums: {},
  },
} as const
