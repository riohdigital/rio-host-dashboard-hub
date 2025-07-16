export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      expense_categories: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: string | null
          created_at: string | null
          description: string
          expense_date: string
          expense_type: string | null
          id: string
          is_recurrent: boolean | null
          payment_status: string | null
          property_id: string | null
          recurrence_group_id: string | null
        }
        Insert: {
          amount: number
          category?: string | null
          created_at?: string | null
          description: string
          expense_date: string
          expense_type?: string | null
          id?: string
          is_recurrent?: boolean | null
          payment_status?: string | null
          property_id?: string | null
          recurrence_group_id?: string | null
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string | null
          description?: string
          expense_date?: string
          expense_type?: string | null
          id?: string
          is_recurrent?: boolean | null
          payment_status?: string | null
          property_id?: string | null
          recurrence_group_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      investment_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          address: string | null
          airbnb_link: string | null
          base_nightly_price: number | null
          booking_link: string | null
          cleaning_fee: number | null
          commission_rate: number | null
          created_at: string | null
          default_checkin_time: string | null
          default_checkout_time: string | null
          id: string
          max_guests: number | null
          name: string
          nickname: string | null
          notes: string | null
          property_type: string
          status: string
        }
        Insert: {
          address?: string | null
          airbnb_link?: string | null
          base_nightly_price?: number | null
          booking_link?: string | null
          cleaning_fee?: number | null
          commission_rate?: number | null
          created_at?: string | null
          default_checkin_time?: string | null
          default_checkout_time?: string | null
          id?: string
          max_guests?: number | null
          name: string
          nickname?: string | null
          notes?: string | null
          property_type?: string
          status?: string
        }
        Update: {
          address?: string | null
          airbnb_link?: string | null
          base_nightly_price?: number | null
          booking_link?: string | null
          cleaning_fee?: number | null
          commission_rate?: number | null
          created_at?: string | null
          default_checkin_time?: string | null
          default_checkout_time?: string | null
          id?: string
          max_guests?: number | null
          name?: string
          nickname?: string | null
          notes?: string | null
          property_type?: string
          status?: string
        }
        Relationships: []
      }
      property_investments: {
        Row: {
          amount: number
          category_id: string
          created_at: string
          description: string
          id: string
          investment_date: string
          notes: string | null
          property_id: string
          receipt_url: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          category_id: string
          created_at?: string
          description: string
          id?: string
          investment_date: string
          notes?: string | null
          property_id: string
          receipt_url?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          category_id?: string
          created_at?: string
          description?: string
          id?: string
          investment_date?: string
          notes?: string | null
          property_id?: string
          receipt_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_investments_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "investment_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_investments_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          base_revenue: number | null
          check_in_date: string
          check_out_date: string
          checkin_time: string | null
          checkout_time: string | null
          commission_amount: number | null
          created_at: string | null
          guest_name: string | null
          id: string
          is_communicated: boolean | null
          net_revenue: number | null
          number_of_guests: number | null
          payment_date: string | null
          payment_status: string | null
          platform: string
          property_id: string | null
          receipt_sent: boolean | null
          reservation_code: string
          reservation_status: string | null
          total_revenue: number
        }
        Insert: {
          base_revenue?: number | null
          check_in_date: string
          check_out_date: string
          checkin_time?: string | null
          checkout_time?: string | null
          commission_amount?: number | null
          created_at?: string | null
          guest_name?: string | null
          id?: string
          is_communicated?: boolean | null
          net_revenue?: number | null
          number_of_guests?: number | null
          payment_date?: string | null
          payment_status?: string | null
          platform?: string
          property_id?: string | null
          receipt_sent?: boolean | null
          reservation_code: string
          reservation_status?: string | null
          total_revenue: number
        }
        Update: {
          base_revenue?: number | null
          check_in_date?: string
          check_out_date?: string
          checkin_time?: string | null
          checkout_time?: string | null
          commission_amount?: number | null
          created_at?: string | null
          guest_name?: string | null
          id?: string
          is_communicated?: boolean | null
          net_revenue?: number | null
          number_of_guests?: number | null
          payment_date?: string | null
          payment_status?: string | null
          platform?: string
          property_id?: string | null
          receipt_sent?: boolean | null
          reservation_code?: string
          reservation_status?: string | null
          total_revenue?: number
        }
        Relationships: [
          {
            foreignKeyName: "reservations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
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
