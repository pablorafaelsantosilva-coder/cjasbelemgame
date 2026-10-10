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
      audit_logs: {
        Row: {
          action: string
          admin_id: string | null
          created_at: string
          details: Json
          entity_id: string | null
          entity_type: string | null
          id: string
        }
        Insert: {
          action: string
          admin_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type?: string | null
          id?: string
        }
        Update: {
          action?: string
          admin_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type?: string | null
          id?: string
        }
        Relationships: []
      }
      challenges: {
        Row: {
          allow_resubmit: boolean
          audience: string | null
          created_at: string
          created_by: string | null
          description: string
          ends_at: string
          extra_rules: string | null
          id: string
          instructions: string
          max_participants: number | null
          points: number
          requires_photo: boolean
          requires_video: boolean
          share_photos_in_chat: boolean
          starts_at: string
          status: Database["public"]["Enums"]["challenge_status"]
          title: string
          type: Database["public"]["Enums"]["challenge_type"]
          updated_at: string
        }
        Insert: {
          allow_resubmit?: boolean
          audience?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          ends_at?: string
          extra_rules?: string | null
          id?: string
          instructions?: string
          max_participants?: number | null
          points?: number
          requires_photo?: boolean
          requires_video?: boolean
          share_photos_in_chat?: boolean
          starts_at?: string
          status?: Database["public"]["Enums"]["challenge_status"]
          title: string
          type?: Database["public"]["Enums"]["challenge_type"]
          updated_at?: string
        }
        Update: {
          allow_resubmit?: boolean
          audience?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          ends_at?: string
          extra_rules?: string | null
          id?: string
          instructions?: string
          max_participants?: number | null
          points?: number
          requires_photo?: boolean
          requires_video?: boolean
          share_photos_in_chat?: boolean
          starts_at?: string
          status?: Database["public"]["Enums"]["challenge_status"]
          title?: string
          type?: Database["public"]["Enums"]["challenge_type"]
          updated_at?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          author_id: string
          author_name: string
          body: string
          created_at: string
          hidden: boolean
          id: string
          reply_to_id: string | null
          updated_at: string
        }
        Insert: {
          author_id: string
          author_name?: string
          body: string
          created_at?: string
          hidden?: boolean
          id?: string
          reply_to_id?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string
          author_name?: string
          body?: string
          created_at?: string
          hidden?: boolean
          id?: string
          reply_to_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      direct_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          recipient_id: string
          reply_to_id: string | null
          sender_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          recipient_id: string
          reply_to_id?: string | null
          sender_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          recipient_id?: string
          reply_to_id?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "direct_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "direct_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      event_settings: {
        Row: {
          end_date: string
          finished: boolean
          id: number
          logo_url: string | null
          max_file_mb: number
          name: string
          org_message: string
          rules: string
          start_date: string
          updated_at: string
        }
        Insert: {
          end_date?: string
          finished?: boolean
          id?: number
          logo_url?: string | null
          max_file_mb?: number
          name?: string
          org_message?: string
          rules?: string
          start_date?: string
          updated_at?: string
        }
        Update: {
          end_date?: string
          finished?: boolean
          id?: number
          logo_url?: string | null
          max_file_mb?: number
          name?: string
          org_message?: string
          rules?: string
          start_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      points_transactions: {
        Row: {
          challenge_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          points: number
          type: string
          user_id: string
        }
        Insert: {
          challenge_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          points: number
          type?: string
          user_id: string
        }
        Update: {
          challenge_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          points?: number
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "points_transactions_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string
          created_at: string
          email: string | null
          id: string
          name: string
          status: string
          total_points: number
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string
          created_at?: string
          email?: string | null
          id: string
          name?: string
          status?: string
          total_points?: number
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          status?: string
          total_points?: number
          updated_at?: string
        }
        Relationships: []
      }
      submission_chat_shares: {
        Row: {
          created_at: string
          hidden: boolean
          submission_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          hidden?: boolean
          submission_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          hidden?: boolean
          submission_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "submission_chat_shares_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: true
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      submission_files: {
        Row: {
          created_at: string
          file_size: number
          file_type: string
          id: string
          storage_path: string
          submission_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_size?: number
          file_type: string
          id?: string
          storage_path: string
          submission_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_size?: number
          file_type?: string
          id?: string
          storage_path?: string
          submission_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "submission_files_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          challenge_id: string
          created_at: string
          id: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["submission_status"]
          submitted_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          challenge_id: string
          created_at?: string
          id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["submission_status"]
          submitted_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          challenge_id?: string
          created_at?: string
          id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["submission_status"]
          submitted_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "submissions_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      adjust_points: {
        Args: { _description: string; _points: number; _user_id: string }
        Returns: undefined
      }
      delete_challenge: { Args: { _challenge_id: string }; Returns: undefined }
      get_chat_people: {
        Args: { _limit?: number; _search?: string }
        Returns: {
          avatar_url: string
          id: string
          name: string
        }[]
      }
      get_chat_shared_media: {
        Args: { _before?: string; _limit?: number }
        Returns: {
          author_id: string
          author_name: string
          challenge_title: string
          created_at: string
          file_ids: string[]
          file_paths: string[]
          file_types: string[]
          submission_id: string
        }[]
      }
      get_direct_inbox: {
        Args: never
        Returns: {
          last_at: string
          last_body: string
          last_sender_id: string
          peer_active: boolean
          peer_avatar_url: string
          peer_id: string
          peer_name: string
        }[]
      }
      get_leaderboard: {
        Args: never
        Returns: {
          avatar_url: string
          id: string
          name: string
          rank_position: number
          total_points: number
        }[]
      }
      get_participant_bio: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      reset_leaderboard: { Args: never; Returns: undefined }
      resubmit_proof: { Args: { _submission_id: string }; Returns: undefined }
      review_submission: {
        Args: { _approve: boolean; _reason?: string; _submission_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "participant"
      challenge_status: "rascunho" | "agendado" | "encerrado" | "cancelado"
      challenge_type: "normal" | "relampago"
      submission_status: "submitted" | "confirmed" | "rejected"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "participant"],
      challenge_status: ["rascunho", "agendado", "encerrado", "cancelado"],
      challenge_type: ["normal", "relampago"],
      submission_status: ["submitted", "confirmed", "rejected"],
    },
  },
} as const
