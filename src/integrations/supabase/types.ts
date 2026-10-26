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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          description: string
          expense_date: string | null
          id: string
          receipt_hash: string | null
          receipt_path: string | null
          request_id: string
          user_id: string
          vendor: string
        }
        Insert: {
          amount?: number
          category?: string
          created_at?: string
          description?: string
          expense_date?: string | null
          id?: string
          receipt_hash?: string | null
          receipt_path?: string | null
          request_id: string
          user_id?: string
          vendor?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          description?: string
          expense_date?: string | null
          id?: string
          receipt_hash?: string | null
          receipt_path?: string | null
          request_id?: string
          user_id?: string
          vendor?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          cost_center: string
          cpf: string
          created_at: string
          department: string
          email: string
          full_name: string
          id: string
        }
        Insert: {
          cost_center?: string
          cpf?: string
          created_at?: string
          department?: string
          email?: string
          full_name?: string
          id: string
        }
        Update: {
          cost_center?: string
          cpf?: string
          created_at?: string
          department?: string
          email?: string
          full_name?: string
          id?: string
        }
        Relationships: []
      }
      request_events: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          from_status: Database["public"]["Enums"]["request_status"] | null
          id: string
          note: string
          request_id: string
          to_status: Database["public"]["Enums"]["request_status"]
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["request_status"] | null
          id?: string
          note?: string
          request_id: string
          to_status: Database["public"]["Enums"]["request_status"]
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["request_status"] | null
          id?: string
          note?: string
          request_id?: string
          to_status?: Database["public"]["Enums"]["request_status"]
        }
        Relationships: [
          {
            foreignKeyName: "request_events_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      receipt_scans: {
        Row: {
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      requests: {
        Row: {
          advance_amount: number
          created_at: string
          destination: string
          end_date: string | null
          id: string
          last_note: string
          original_requested_amount: number | null
          paid_at: string | null
          purpose: string
          settlement_amount: number
          spent_amount: number
          start_date: string | null
          status: Database["public"]["Enums"]["request_status"]
          submitted_at: string | null
          title: string
          type: Database["public"]["Enums"]["request_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          advance_amount?: number
          created_at?: string
          destination?: string
          end_date?: string | null
          id?: string
          last_note?: string
          original_requested_amount?: number | null
          paid_at?: string | null
          purpose?: string
          settlement_amount?: number
          spent_amount?: number
          start_date?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          submitted_at?: string | null
          title: string
          type: Database["public"]["Enums"]["request_type"]
          updated_at?: string
          user_id?: string
        }
        Update: {
          advance_amount?: number
          created_at?: string
          destination?: string
          end_date?: string | null
          id?: string
          last_note?: string
          original_requested_amount?: number | null
          paid_at?: string | null
          purpose?: string
          settlement_amount?: number
          spent_amount?: number
          start_date?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          submitted_at?: string | null
          title?: string
          type?: Database["public"]["Enums"]["request_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      return_receipts: {
        Row: {
          created_at: string
          file_name: string
          id: string
          receipt_path: string
          request_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          id?: string
          receipt_path: string
          request_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          file_name?: string
          id?: string
          receipt_path?: string
          request_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "return_receipts_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      can_edit_expenses: { Args: { _request_id: string }; Returns: boolean }
      expense_duplicates: {
        Args: { _request_id: string }
        Returns: {
          expense_id: string
          other_request_id: string | null
          other_request_title: string | null
          other_owner: string | null
          reason: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      normalize_vendor: { Args: { _vendor: string }; Returns: string }
      profile_cpf: { Args: { _user_id: string }; Returns: string | null }
      receipt_file_locked: { Args: { _path: string }; Returns: boolean }
      receipt_hash_in_use: { Args: { _hash: string }; Returns: boolean }
    }
    Enums: {
      app_role: "gerente" | "financeiro" | "diretoria" | "admin" | "colaborador"
      request_status:
        | "rascunho"
        | "aguardando_diretoria"
        | "aprovado"
        | "adiantamento_pago"
        | "em_conferencia"
        | "aguardando_diretoria_excedente"
        | "a_pagar"
        | "aguardando_devolucao"
        | "pago"
        | "concluido"
        | "rejeitado"
        | "aguardando_diretoria_pagamento"
      request_type: "adiantamento" | "reembolso"
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
      app_role: ["gerente", "financeiro", "diretoria", "admin", "colaborador"],
      request_status: [
        "rascunho",
        "aguardando_diretoria",
        "aprovado",
        "adiantamento_pago",
        "em_conferencia",
        "aguardando_diretoria_excedente",
        "a_pagar",
        "aguardando_devolucao",
        "pago",
        "concluido",
        "rejeitado",
        "aguardando_diretoria_pagamento",
      ],
      request_type: ["adiantamento", "reembolso"],
    },
  },
} as const
