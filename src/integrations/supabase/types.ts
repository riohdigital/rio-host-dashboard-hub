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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      alerts_destination_property_links: {
        Row: {
          destination_id: string
          id: string
          property_id: string
        }
        Insert: {
          destination_id: string
          id?: string
          property_id: string
        }
        Update: {
          destination_id?: string
          id?: string
          property_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_destination_property_links_destination_id_fkey"
            columns: ["destination_id"]
            isOneToOne: false
            referencedRelation: "notification_destinations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_destination_property_links_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      anfitriao_alerta_chat_history: {
        Row: {
          createdAt: string | null
          id: number
          message: Json
          sessionId: string
        }
        Insert: {
          createdAt?: string | null
          id?: number
          message: Json
          sessionId: string
        }
        Update: {
          createdAt?: string | null
          id?: number
          message?: Json
          sessionId?: string
        }
        Relationships: []
      }
      cleaner_profiles: {
        Row: {
          address: string | null
          created_at: string
          id: string
          notes: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      cleaner_properties: {
        Row: {
          created_at: string
          id: string
          property_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          property_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          property_id?: string
          user_id?: string
        }
        Relationships: []
      }
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
      notification_destinations: {
        Row: {
          auth_code: string | null
          auth_code_expires_at: string | null
          created_at: string | null
          destination_name: string
          destination_role: string
          id: string
          is_authenticated: boolean | null
          preferences: Json | null
          user_id: string
          whatsapp_number: string | null
        }
        Insert: {
          auth_code?: string | null
          auth_code_expires_at?: string | null
          created_at?: string | null
          destination_name: string
          destination_role: string
          id?: string
          is_authenticated?: boolean | null
          preferences?: Json | null
          user_id: string
          whatsapp_number?: string | null
        }
        Update: {
          auth_code?: string | null
          auth_code_expires_at?: string | null
          created_at?: string | null
          destination_name?: string
          destination_role?: string
          id?: string
          is_authenticated?: boolean | null
          preferences?: Json | null
          user_id?: string
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_destinations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
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
          created_by: string | null
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
          created_by?: string | null
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
          created_by?: string | null
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
          cleaner_user_id: string | null
          cleaning_allocation: string | null
          cleaning_fee: number | null
          cleaning_notes: string | null
          cleaning_payment_status: string | null
          cleaning_rating: number | null
          cleaning_status: string | null
          commission_amount: number | null
          created_at: string | null
          guest_name: string | null
          guest_phone: string | null
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
          cleaner_user_id?: string | null
          cleaning_allocation?: string | null
          cleaning_fee?: number | null
          cleaning_notes?: string | null
          cleaning_payment_status?: string | null
          cleaning_rating?: number | null
          cleaning_status?: string | null
          commission_amount?: number | null
          created_at?: string | null
          guest_name?: string | null
          guest_phone?: string | null
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
          cleaner_user_id?: string | null
          cleaning_allocation?: string | null
          cleaning_fee?: number | null
          cleaning_notes?: string | null
          cleaning_payment_status?: string | null
          cleaning_rating?: number | null
          cleaning_status?: string | null
          commission_amount?: number | null
          created_at?: string | null
          guest_name?: string | null
          guest_phone?: string | null
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
      sent_alerts: {
        Row: {
          alert_type: string
          destination_id: string
          id: string
          reservation_id: string | null
          sent_at: string | null
        }
        Insert: {
          alert_type: string
          destination_id: string
          id?: string
          reservation_id?: string | null
          sent_at?: string | null
        }
        Update: {
          alert_type?: string
          destination_id?: string
          id?: string
          reservation_id?: string | null
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sent_alerts_destination_id_fkey"
            columns: ["destination_id"]
            isOneToOne: false
            referencedRelation: "notification_destinations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sent_alerts_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          created_at: string | null
          id: string
          permission_type: string
          permission_value: boolean | null
          resource_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          permission_type: string
          permission_value?: boolean | null
          resource_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          permission_type?: string
          permission_value?: boolean | null
          resource_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          is_active: boolean | null
          role: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          role?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          role?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_property_access: {
        Row: {
          access_level: string | null
          created_at: string | null
          id: string
          property_id: string | null
          user_id: string | null
        }
        Insert: {
          access_level?: string | null
          created_at?: string | null
          id?: string
          property_id?: string | null
          user_id?: string | null
        }
        Update: {
          access_level?: string | null
          created_at?: string | null
          id?: string
          property_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_property_access_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_property_access_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assign_cleaning_to_cleaner: {
        Args: { cleaner_id: string; reservation_id: string }
        Returns: string
      }
      can_manage_property_access: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      debug_auth_context: {
        Args: Record<PropertyKey, never>
        Returns: {
          current_user_id: string
          session_exists: boolean
          user_role: string
        }[]
      }
      fn_get_all_available_reservations: {
        Args:
          | Record<PropertyKey, never>
          | { end_date?: string; property_ids?: string[]; start_date?: string }
        Returns: {
          base_revenue: number
          check_in_date: string
          check_out_date: string
          checkin_time: string
          checkout_time: string
          cleaner_user_id: string
          cleaning_allocation: string
          cleaning_fee: number
          cleaning_notes: string
          cleaning_payment_status: string
          cleaning_rating: number
          cleaning_status: string
          commission_amount: number
          created_at: string
          guest_name: string
          guest_phone: string
          id: string
          is_communicated: boolean
          net_revenue: number
          next_check_in_date: string
          next_checkin_time: string
          number_of_guests: number
          payment_date: string
          payment_status: string
          platform: string
          properties: Json
          property_id: string
          receipt_sent: boolean
          reservation_code: string
          reservation_status: string
          total_revenue: number
        }[]
      }
      fn_get_all_cleaner_reservations: {
        Args:
          | Record<PropertyKey, never>
          | { end_date?: string; property_ids?: string[]; start_date?: string }
        Returns: {
          base_revenue: number
          check_in_date: string
          check_out_date: string
          checkin_time: string
          checkout_time: string
          cleaner_info: Json
          cleaner_user_id: string
          cleaning_allocation: string
          cleaning_fee: number
          cleaning_notes: string
          cleaning_payment_status: string
          cleaning_rating: number
          cleaning_status: string
          commission_amount: number
          created_at: string
          guest_name: string
          guest_phone: string
          id: string
          is_communicated: boolean
          net_revenue: number
          next_check_in_date: string
          next_checkin_time: string
          number_of_guests: number
          payment_date: string
          payment_status: string
          platform: string
          properties: Json
          property_id: string
          receipt_sent: boolean
          reservation_code: string
          reservation_status: string
          total_revenue: number
        }[]
      }
      fn_get_available_reservations: {
        Args: { cleaner_id: string }
        Returns: {
          base_revenue: number
          check_in_date: string
          check_out_date: string
          checkin_time: string
          checkout_time: string
          cleaner_user_id: string
          cleaning_allocation: string
          cleaning_fee: number
          cleaning_notes: string
          cleaning_payment_status: string
          cleaning_rating: number
          cleaning_status: string
          commission_amount: number
          created_at: string
          guest_name: string
          guest_phone: string
          id: string
          is_communicated: boolean
          net_revenue: number
          next_check_in_date: string
          next_checkin_time: string
          number_of_guests: number
          payment_date: string
          payment_status: string
          platform: string
          properties: Json
          property_id: string
          receipt_sent: boolean
          reservation_code: string
          reservation_status: string
          total_revenue: number
        }[]
      }
      fn_get_cleaner_reservations: {
        Args: { cleaner_id: string }
        Returns: {
          base_revenue: number
          check_in_date: string
          check_out_date: string
          checkin_time: string
          checkout_time: string
          cleaner_user_id: string
          cleaning_allocation: string
          cleaning_fee: number
          cleaning_notes: string
          cleaning_payment_status: string
          cleaning_rating: number
          cleaning_status: string
          commission_amount: number
          created_at: string
          guest_name: string
          guest_phone: string
          id: string
          is_communicated: boolean
          net_revenue: number
          next_check_in_date: string
          next_checkin_time: string
          number_of_guests: number
          payment_date: string
          payment_status: string
          platform: string
          properties: Json
          property_id: string
          receipt_sent: boolean
          reservation_code: string
          reservation_status: string
          total_revenue: number
        }[]
      }
      fn_get_cleaners_for_properties: {
        Args: { property_ids?: string[] }
        Returns: {
          email: string
          full_name: string
          id: string
          is_active: boolean
          phone: string
          user_id: string
        }[]
      }
      get_current_user_role: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_my_properties_count: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      master_reassign_cleaning: {
        Args: { new_cleaner_id: string; reservation_id: string }
        Returns: string
      }
      master_unassign_cleaning: {
        Args: { reservation_id: string }
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
