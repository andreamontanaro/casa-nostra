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
      chore_logs: {
        Row: {
          area: Database["public"]["Enums"]["chore_area"]
          created_at: string
          created_by: string
          done_at: string
          done_by: string
          id: string
          note: string | null
          template_id: string | null
          title: string
          updated_at: string
          xp: number
        }
        Insert: {
          area: Database["public"]["Enums"]["chore_area"]
          created_at?: string
          created_by: string
          done_at?: string
          done_by: string
          id?: string
          note?: string | null
          template_id?: string | null
          title: string
          updated_at?: string
          xp: number
        }
        Update: {
          area?: Database["public"]["Enums"]["chore_area"]
          created_at?: string
          created_by?: string
          done_at?: string
          done_by?: string
          id?: string
          note?: string | null
          template_id?: string | null
          title?: string
          updated_at?: string
          xp?: number
        }
        Relationships: [
          {
            foreignKeyName: "chore_logs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chore_logs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_expense_shares"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "chore_logs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_user_open_balance"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "chore_logs_done_by_fkey"
            columns: ["done_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chore_logs_done_by_fkey"
            columns: ["done_by"]
            isOneToOne: false
            referencedRelation: "v_expense_shares"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "chore_logs_done_by_fkey"
            columns: ["done_by"]
            isOneToOne: false
            referencedRelation: "v_user_open_balance"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "chore_logs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "chore_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chore_logs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "v_chore_status"
            referencedColumns: ["id"]
          },
        ]
      }
      chore_templates: {
        Row: {
          active: boolean
          area: Database["public"]["Enums"]["chore_area"]
          cadence_days: number | null
          created_at: string
          effort_xp: number
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          area: Database["public"]["Enums"]["chore_area"]
          cadence_days?: number | null
          created_at?: string
          effort_xp: number
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          area?: Database["public"]["Enums"]["chore_area"]
          cadence_days?: number | null
          created_at?: string
          effort_xp?: number
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      expense_attachments: {
        Row: {
          created_at: string
          expense_id: string
          file_name: string
          id: string
          mime_type: string
          size_bytes: number
          storage_path: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          expense_id: string
          file_name: string
          id?: string
          mime_type: string
          size_bytes: number
          storage_path: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          expense_id?: string
          file_name?: string
          id?: string
          mime_type?: string
          size_bytes?: number
          storage_path?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_attachments_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_attachments_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "v_expense_shares"
            referencedColumns: ["expense_id"]
          },
          {
            foreignKeyName: "expense_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "v_expense_shares"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "expense_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "v_user_open_balance"
            referencedColumns: ["user_id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: Database["public"]["Enums"]["expense_category"]
          created_at: string
          created_by: string
          custom_other_share: number | null
          description: string
          expense_date: string
          id: string
          paid_by: string
          settlement_id: string | null
          split_rule: Database["public"]["Enums"]["split_rule"]
          updated_at: string
        }
        Insert: {
          amount: number
          category: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          created_by: string
          custom_other_share?: number | null
          description: string
          expense_date?: string
          id?: string
          paid_by: string
          settlement_id?: string | null
          split_rule: Database["public"]["Enums"]["split_rule"]
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          created_by?: string
          custom_other_share?: number | null
          description?: string
          expense_date?: string
          id?: string
          paid_by?: string
          settlement_id?: string | null
          split_rule?: Database["public"]["Enums"]["split_rule"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_expense_shares"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_user_open_balance"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "expenses_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "v_expense_shares"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "expenses_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "v_user_open_balance"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "expenses_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "settlements"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          higher_income: boolean
          id: string
          telegram_user_id: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          higher_income?: boolean
          id: string
          telegram_user_id?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          higher_income?: boolean
          id?: string
          telegram_user_id?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      settlements: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          from_user_id: string
          id: string
          notes: string | null
          settled_at: string
          to_user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by: string
          from_user_id: string
          id?: string
          notes?: string | null
          settled_at?: string
          to_user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          from_user_id?: string
          id?: string
          notes?: string | null
          settled_at?: string
          to_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "settlements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_expense_shares"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "settlements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_user_open_balance"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "settlements_from_user_id_fkey"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlements_from_user_id_fkey"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "v_expense_shares"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "settlements_from_user_id_fkey"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "v_user_open_balance"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "settlements_to_user_id_fkey"
            columns: ["to_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlements_to_user_id_fkey"
            columns: ["to_user_id"]
            isOneToOne: false
            referencedRelation: "v_expense_shares"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "settlements_to_user_id_fkey"
            columns: ["to_user_id"]
            isOneToOne: false
            referencedRelation: "v_user_open_balance"
            referencedColumns: ["user_id"]
          },
        ]
      }
      telegram_messages: {
        Row: {
          chat_id: number
          content: string
          created_at: string
          id: number
          role: string
          sender_name: string | null
          update_id: number | null
        }
        Insert: {
          chat_id: number
          content: string
          created_at?: string
          id?: never
          role: string
          sender_name?: string | null
          update_id?: number | null
        }
        Update: {
          chat_id?: number
          content?: string
          created_at?: string
          id?: never
          role?: string
          sender_name?: string | null
          update_id?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      v_chore_status: {
        Row: {
          area: Database["public"]["Enums"]["chore_area"] | null
          cadence_days: number | null
          days_since: number | null
          due_in_days: number | null
          effort_xp: number | null
          id: string | null
          last_done_at: string | null
          last_done_by: string | null
          last_done_by_name: string | null
          name: string | null
          sort_order: number | null
        }
        Relationships: [
          {
            foreignKeyName: "chore_logs_done_by_fkey"
            columns: ["last_done_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chore_logs_done_by_fkey"
            columns: ["last_done_by"]
            isOneToOne: false
            referencedRelation: "v_expense_shares"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "chore_logs_done_by_fkey"
            columns: ["last_done_by"]
            isOneToOne: false
            referencedRelation: "v_user_open_balance"
            referencedColumns: ["user_id"]
          },
        ]
      }
      v_chore_week: {
        Row: {
          chore_count: number | null
          display_name: string | null
          user_id: string | null
          week_start: string | null
          xp: number | null
        }
        Relationships: [
          {
            foreignKeyName: "chore_logs_done_by_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chore_logs_done_by_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_expense_shares"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "chore_logs_done_by_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_user_open_balance"
            referencedColumns: ["user_id"]
          },
        ]
      }
      v_expense_shares: {
        Row: {
          expense_amount: number | null
          expense_date: string | null
          expense_id: string | null
          paid_by: string | null
          settlement_id: string | null
          user_id: string | null
          user_share: number | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "v_expense_shares"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "expenses_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "v_user_open_balance"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "expenses_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "settlements"
            referencedColumns: ["id"]
          },
        ]
      }
      v_user_open_balance: {
        Row: {
          display_name: string | null
          higher_income: boolean | null
          net_position: number | null
          total_anticipated: number | null
          total_owed: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      is_authorized_user: { Args: never; Returns: boolean }
      register_settlement: {
        Args: { p_expense_ids?: string[]; p_notes?: string }
        Returns: string
      }
    }
    Enums: {
      chore_area:
        | "cucina"
        | "bagno"
        | "pulizie"
        | "spazzatura"
        | "bucato"
        | "spesa"
        | "manutenzione"
        | "altro"
      expense_category:
        | "affitto"
        | "bolletta"
        | "spesa_alimentare"
        | "abbonamento"
        | "manutenzione"
        | "viaggi"
        | "altro"
      split_rule: "fifty_fifty" | "sixty_forty" | "custom"
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
      chore_area: [
        "cucina",
        "bagno",
        "pulizie",
        "spazzatura",
        "bucato",
        "spesa",
        "manutenzione",
        "altro",
      ],
      expense_category: [
        "affitto",
        "bolletta",
        "spesa_alimentare",
        "abbonamento",
        "manutenzione",
        "viaggi",
        "altro",
      ],
      split_rule: ["fifty_fifty", "sixty_forty", "custom"],
    },
  },
} as const
