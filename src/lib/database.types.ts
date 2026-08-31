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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      specialist_responses: {
        Row: {
          actual_specialty: string
          calibration_version: string
          career_satisfaction: number | null
          consent_version: string
          created_at: string
          id: string
          intention_to_change: string | null
          intention_to_change_code: string | null
          language: string
          questionnaire_version: string
          ratings: Json
          selected_values: Json
          specialty_config_revision: number | null
          specialty_config_version_id: string | null
          specialty_catalog_version: string
          submission_schema_version: number
          value_catalog_version: string
          voluntary_choice: string | null
          voluntary_choice_code: string | null
          would_choose_again: string | null
          would_choose_again_code: string | null
          years_of_experience: number | null
        }
        Insert: {
          actual_specialty: string
          calibration_version?: string
          career_satisfaction?: number | null
          consent_version: string
          created_at?: string
          id?: string
          intention_to_change?: string | null
          intention_to_change_code?: string | null
          language?: string
          questionnaire_version?: string
          ratings: Json
          selected_values: Json
          specialty_config_revision?: number | null
          specialty_config_version_id?: string | null
          specialty_catalog_version?: string
          submission_schema_version?: number
          value_catalog_version?: string
          voluntary_choice?: string | null
          voluntary_choice_code?: string | null
          would_choose_again?: string | null
          would_choose_again_code?: string | null
          years_of_experience?: number | null
        }
        Update: {
          actual_specialty?: string
          calibration_version?: string
          career_satisfaction?: number | null
          consent_version?: string
          created_at?: string
          id?: string
          intention_to_change?: string | null
          intention_to_change_code?: string | null
          language?: string
          questionnaire_version?: string
          ratings?: Json
          selected_values?: Json
          specialty_config_revision?: number | null
          specialty_config_version_id?: string | null
          specialty_catalog_version?: string
          submission_schema_version?: number
          value_catalog_version?: string
          voluntary_choice?: string | null
          voluntary_choice_code?: string | null
          would_choose_again?: string | null
          would_choose_again_code?: string | null
          years_of_experience?: number | null
        }
        Relationships: []
      }
      student_responses: {
        Row: {
          client_scores: Json
          consent_version: string
          created_at: string
          id: string
          language: string
          preferred_specialty: string | null
          questionnaire_version: string
          ratings: Json
          scoring_version: string
          selected_values: Json
          specialty_config_revision: number | null
          specialty_config_version_id: string | null
          specialty_catalog_version: string
          study_year: number | null
          submission_schema_version: number
          value_catalog_version: string
        }
        Insert: {
          client_scores: Json
          consent_version: string
          created_at?: string
          id?: string
          language?: string
          preferred_specialty?: string | null
          questionnaire_version?: string
          ratings: Json
          scoring_version?: string
          selected_values: Json
          specialty_config_revision?: number | null
          specialty_config_version_id?: string | null
          specialty_catalog_version?: string
          study_year?: number | null
          submission_schema_version?: number
          value_catalog_version?: string
        }
        Update: {
          client_scores?: Json
          consent_version?: string
          created_at?: string
          id?: string
          language?: string
          preferred_specialty?: string | null
          questionnaire_version?: string
          ratings?: Json
          scoring_version?: string
          selected_values?: Json
          specialty_config_revision?: number | null
          specialty_config_version_id?: string | null
          specialty_catalog_version?: string
          study_year?: number | null
          submission_schema_version?: number
          value_catalog_version?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_portal_profile: { Args: never; Returns: Json }
      current_user_is_researcher: { Args: never; Returns: boolean }
      get_active_specialty_catalog: { Args: never; Returns: Json }
      get_specialty_catalog_draft: { Args: never; Returns: Json }
      list_specialty_catalog_versions: {
        Args: { p_limit?: number }
        Returns: Json
      }
      publish_specialty_catalog_draft: {
        Args: {
          p_change_note: string
          p_draft_version_id: string
          p_expected_lock_version: number
        }
        Returns: Json
      }
      restore_specialty_catalog_version: {
        Args: {
          p_change_note: string
          p_expected_active_version_id: string
          p_source_version_id: string
        }
        Returns: Json
      }
      save_specialty_catalog_entry_draft: {
        Args: {
          p_change_note: string
          p_clinical_summaries: Json
          p_descriptions: Json
          p_expected_lock_version: number | null
          p_expected_version_id: string | null
          p_profile: Json
          p_specialty_name: string
        }
        Returns: Json
      }
      submit_specialist_response_v1: {
        Args: {
          p_actual_specialty: string
          p_calibration_version: string
          p_career_satisfaction: number
          p_consent_version: string
          p_intention_to_change_code: string
          p_language: string
          p_questionnaire_version: string
          p_ratings: Json
          p_selected_values: Json
          p_specialty_catalog_version: string
          p_submission_id: string
          p_value_catalog_version: string
          p_voluntary_choice_code: string
          p_would_choose_again_code: string
          p_years_of_experience: number
        }
        Returns: string
      }
      submit_student_response_v1: {
        Args: {
          p_client_scores: Json
          p_consent_version: string
          p_language: string
          p_preferred_specialty: string
          p_questionnaire_version: string
          p_ratings: Json
          p_scoring_version: string
          p_selected_values: Json
          p_specialty_catalog_version: string
          p_study_year: number
          p_submission_id: string
          p_value_catalog_version: string
        }
        Returns: string
      }
      submit_specialist_response_v2: {
        Args: {
          p_actual_specialty: string
          p_calibration_version: string
          p_career_satisfaction: number
          p_consent_version: string
          p_intention_to_change_code: string
          p_language: string
          p_questionnaire_version: string
          p_ratings: Json
          p_selected_values: Json
          p_specialty_catalog_version: string
          p_specialty_config_version_id: string
          p_submission_id: string
          p_value_catalog_version: string
          p_voluntary_choice_code: string
          p_would_choose_again_code: string
          p_years_of_experience: number
        }
        Returns: string
      }
      submit_student_response_v2: {
        Args: {
          p_client_scores: Json
          p_consent_version: string
          p_language: string
          p_preferred_specialty: string
          p_questionnaire_version: string
          p_ratings: Json
          p_scoring_version: string
          p_selected_values: Json
          p_specialty_catalog_version: string
          p_specialty_config_version_id: string
          p_study_year: number
          p_submission_id: string
          p_value_catalog_version: string
        }
        Returns: string
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
  public: {
    Enums: {},
  },
} as const
