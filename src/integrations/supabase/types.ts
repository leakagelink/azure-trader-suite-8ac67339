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
      admin_audit_log: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          id: string
          metadata: Json | null
          reason: string | null
          target_id: string | null
          target_table: string
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          reason?: string | null
          target_id?: string | null
          target_table: string
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          reason?: string | null
          target_id?: string | null
          target_table?: string
          target_user_id?: string | null
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          api_key: string
          created_at: string | null
          daily_limit: number | null
          id: string
          is_active: boolean | null
          last_used_at: string | null
          priority: number
          service_name: string
          updated_at: string | null
          usage_count: number | null
        }
        Insert: {
          api_key: string
          created_at?: string | null
          daily_limit?: number | null
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          priority?: number
          service_name: string
          updated_at?: string | null
          usage_count?: number | null
        }
        Update: {
          api_key?: string
          created_at?: string | null
          daily_limit?: number | null
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          priority?: number
          service_name?: string
          updated_at?: string | null
          usage_count?: number | null
        }
        Relationships: []
      }
      deposit_requests: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          created_at: string
          currency: string
          deleted_at: string | null
          deleted_by: string | null
          id: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_proof_url: string | null
          rejection_reason: string | null
          status: Database["public"]["Enums"]["deposit_status"]
          transaction_id: string
          user_id: string
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          currency?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_proof_url?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["deposit_status"]
          transaction_id: string
          user_id: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          currency?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_proof_url?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["deposit_status"]
          transaction_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deposit_requests_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "admin_users_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposit_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_users_view"
            referencedColumns: ["id"]
          },
        ]
      }
      kyc_submissions: {
        Row: {
          address: string
          annual_income: string | null
          business_type: string | null
          city: string
          country: string
          created_at: string
          date_of_birth: string
          document_url: string | null
          first_name: string
          id: string
          id_document_type: string
          job_title: string | null
          last_name: string
          occupation_type: string | null
          postal_code: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["kyc_status"]
          trading_experience: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address: string
          annual_income?: string | null
          business_type?: string | null
          city: string
          country: string
          created_at?: string
          date_of_birth: string
          document_url?: string | null
          first_name: string
          id?: string
          id_document_type: string
          job_title?: string | null
          last_name: string
          occupation_type?: string | null
          postal_code: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["kyc_status"]
          trading_experience?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string
          annual_income?: string | null
          business_type?: string | null
          city?: string
          country?: string
          created_at?: string
          date_of_birth?: string
          document_url?: string | null
          first_name?: string
          id?: string
          id_document_type?: string
          job_title?: string | null
          last_name?: string
          occupation_type?: string | null
          postal_code?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["kyc_status"]
          trading_experience?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kyc_submissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "admin_users_view"
            referencedColumns: ["id"]
          },
        ]
      }
      limit_orders: {
        Row: {
          amount: number | null
          created_at: string
          executed_at: string | null
          id: string
          input_mode: string
          leverage: number
          limit_price: number
          lot_size: number | null
          position_type: Database["public"]["Enums"]["position_type"]
          status: Database["public"]["Enums"]["limit_order_status"]
          stop_loss: number | null
          symbol: string
          take_profit: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          executed_at?: string | null
          id?: string
          input_mode?: string
          leverage?: number
          limit_price: number
          lot_size?: number | null
          position_type: Database["public"]["Enums"]["position_type"]
          status?: Database["public"]["Enums"]["limit_order_status"]
          stop_loss?: number | null
          symbol: string
          take_profit?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          executed_at?: string | null
          id?: string
          input_mode?: string
          leverage?: number
          limit_price?: number
          lot_size?: number | null
          position_type?: Database["public"]["Enums"]["position_type"]
          status?: Database["public"]["Enums"]["limit_order_status"]
          stop_loss?: number | null
          symbol?: string
          take_profit?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_settings: {
        Row: {
          id: string
          setting_key: string
          setting_value: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          setting_key: string
          setting_value: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          setting_key?: string
          setting_value?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "admin_users_view"
            referencedColumns: ["id"]
          },
        ]
      }
      position_audit_log: {
        Row: {
          change_type: string
          changed_by: string | null
          created_at: string
          field_name: string
          id: string
          new_value: string | null
          old_value: string | null
          position_id: string
          position_type: string | null
          source: string | null
          symbol: string | null
          user_id: string
        }
        Insert: {
          change_type: string
          changed_by?: string | null
          created_at?: string
          field_name: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          position_id: string
          position_type?: string | null
          source?: string | null
          symbol?: string | null
          user_id: string
        }
        Update: {
          change_type?: string
          changed_by?: string | null
          created_at?: string
          field_name?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          position_id?: string
          position_type?: string | null
          source?: string | null
          symbol?: string | null
          user_id?: string
        }
        Relationships: []
      }
      positions: {
        Row: {
          amount: number
          close_price: number | null
          closed_at: string | null
          closed_by: string | null
          created_at: string
          current_price: number
          entry_price: number
          id: string
          leverage: number
          margin: number
          momentum_active: boolean
          momentum_direction: string | null
          momentum_target_price: number | null
          opened_at: string
          pnl: number | null
          position_type: Database["public"]["Enums"]["position_type"]
          price_mode: string | null
          status: Database["public"]["Enums"]["position_status"]
          stop_loss: number | null
          symbol: string
          take_profit: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          close_price?: number | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          current_price: number
          entry_price: number
          id?: string
          leverage?: number
          margin: number
          momentum_active?: boolean
          momentum_direction?: string | null
          momentum_target_price?: number | null
          opened_at?: string
          pnl?: number | null
          position_type: Database["public"]["Enums"]["position_type"]
          price_mode?: string | null
          status?: Database["public"]["Enums"]["position_status"]
          stop_loss?: number | null
          symbol: string
          take_profit?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          close_price?: number | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          current_price?: number
          entry_price?: number
          id?: string
          leverage?: number
          margin?: number
          momentum_active?: boolean
          momentum_direction?: string | null
          momentum_target_price?: number | null
          opened_at?: string
          pnl?: number | null
          position_type?: Database["public"]["Enums"]["position_type"]
          price_mode?: string | null
          status?: Database["public"]["Enums"]["position_status"]
          stop_loss?: number | null
          symbol?: string
          take_profit?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          avatar_url: string | null
          client_id: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_approved: boolean
          max_leverage: number | null
          mobile_number: string | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          avatar_url?: string | null
          client_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          is_approved?: boolean
          max_leverage?: number | null
          mobile_number?: string | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          avatar_url?: string | null
          client_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_approved?: boolean
          max_leverage?: number | null
          mobile_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "admin_users_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "admin_users_view"
            referencedColumns: ["id"]
          },
        ]
      }
      trading_signals: {
        Row: {
          confidence: number
          created_at: string
          created_by: string | null
          display_order: number
          entry_price: string
          id: string
          is_active: boolean
          pair: string
          signal_type: string
          stop_loss: string
          take_profit: string
          updated_at: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          created_by?: string | null
          display_order?: number
          entry_price: string
          id?: string
          is_active?: boolean
          pair: string
          signal_type: string
          stop_loss: string
          take_profit: string
          updated_at?: string
        }
        Update: {
          confidence?: number
          created_at?: string
          created_by?: string | null
          display_order?: number
          entry_price?: string
          id?: string
          is_active?: boolean
          pair?: string
          signal_type?: string
          stop_loss?: string
          take_profit?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_payment_methods: {
        Row: {
          account_name: string | null
          account_number: string | null
          bank_name: string | null
          created_at: string
          id: string
          ifsc_code: string | null
          is_default: boolean
          label: string | null
          method_type: string
          updated_at: string
          upi_id: string | null
          user_id: string
        }
        Insert: {
          account_name?: string | null
          account_number?: string | null
          bank_name?: string | null
          created_at?: string
          id?: string
          ifsc_code?: string | null
          is_default?: boolean
          label?: string | null
          method_type: string
          updated_at?: string
          upi_id?: string | null
          user_id: string
        }
        Update: {
          account_name?: string | null
          account_number?: string | null
          bank_name?: string | null
          created_at?: string
          id?: string
          ifsc_code?: string | null
          is_default?: boolean
          label?: string | null
          method_type?: string
          updated_at?: string
          upi_id?: string | null
          user_id?: string
        }
        Relationships: []
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
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_users_view"
            referencedColumns: ["id"]
          },
        ]
      }
      user_wallets: {
        Row: {
          balance: number
          created_at: string
          currency: string
          id: string
          locked_balance: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          locked_balance?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          locked_balance?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_users_view"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_transactions: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          reference_id: string | null
          status: string
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          reference_id?: string | null
          status: string
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          reference_id?: string | null
          status?: string
          type?: Database["public"]["Enums"]["transaction_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_users_view"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawal_requests: {
        Row: {
          account_details: Json
          admin_notes: string | null
          amount: number
          created_at: string
          currency: string
          deleted_at: string | null
          deleted_by: string | null
          id: string
          processed_at: string | null
          processed_by: string | null
          rejection_reason: string | null
          status: Database["public"]["Enums"]["withdrawal_status"]
          transaction_reference: string | null
          user_id: string
          withdrawal_method: string
        }
        Insert: {
          account_details: Json
          admin_notes?: string | null
          amount: number
          created_at?: string
          currency?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          processed_at?: string | null
          processed_by?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["withdrawal_status"]
          transaction_reference?: string | null
          user_id: string
          withdrawal_method: string
        }
        Update: {
          account_details?: Json
          admin_notes?: string | null
          amount?: number
          created_at?: string
          currency?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          processed_at?: string | null
          processed_by?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["withdrawal_status"]
          transaction_reference?: string | null
          user_id?: string
          withdrawal_method?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawal_requests_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "admin_users_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawal_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_users_view"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      admin_users_view: {
        Row: {
          avatar_url: string | null
          email: string | null
          email_confirmed_at: string | null
          full_name: string | null
          id: string | null
          last_sign_in_at: string | null
          roles: Database["public"]["Enums"]["app_role"][] | null
          signup_date: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_clear_user_trade_history: {
        Args: { p_user_id: string }
        Returns: number
      }
      admin_delete_position: {
        Args: { p_position_id: string }
        Returns: undefined
      }
      admin_submit_kyc:
        | {
            Args: {
              p_address: string
              p_city: string
              p_country: string
              p_date_of_birth: string
              p_document_url?: string
              p_first_name: string
              p_id_document_type: string
              p_last_name: string
              p_postal_code: string
              p_user_id: string
            }
            Returns: string
          }
        | {
            Args: {
              p_address: string
              p_annual_income?: string
              p_business_type?: string
              p_city: string
              p_country: string
              p_date_of_birth: string
              p_document_url?: string
              p_first_name: string
              p_id_document_type: string
              p_job_title?: string
              p_last_name: string
              p_occupation_type?: string
              p_postal_code: string
              p_user_id: string
            }
            Returns: string
          }
      approve_deposit: { Args: { deposit_id: string }; Returns: undefined }
      approve_kyc: { Args: { kyc_id: string }; Returns: undefined }
      approve_user: { Args: { target_user_id: string }; Returns: undefined }
      approve_withdrawal: {
        Args: { transaction_ref?: string; withdrawal_id: string }
        Returns: undefined
      }
      check_edited_positions_consistency: {
        Args: never
        Returns: {
          amount: number
          current_price: number
          entry_price: number
          expected_pnl: number
          issues: string[]
          momentum_active: boolean
          momentum_direction: string
          momentum_target_price: number
          pnl_drift: number
          position_id: string
          position_type: string
          seconds_since_update: number
          stored_pnl: number
          symbol: string
          user_id: string
        }[]
      }
      drift_edited_positions: { Args: never; Returns: undefined }
      generate_client_id: { Args: never; Returns: string }
      get_active_api_key: { Args: { p_service_name: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      lock_deposit: {
        Args: {
          p_amount: number
          p_currency: string
          p_deposit_id: string
          p_user_id: string
        }
        Returns: undefined
      }
      reject_deposit: { Args: { deposit_id: string }; Returns: undefined }
      reject_kyc: {
        Args: { kyc_id: string; reason?: string }
        Returns: undefined
      }
      reject_withdrawal: {
        Args: { reason?: string; withdrawal_id: string }
        Returns: undefined
      }
      stress_test_price_mode_toggling: {
        Args: { p_iterations?: number }
        Returns: {
          drift_violations: number
          duration_ms: number
          failed: number
          guard_violations: number
          iterations: number
          passed: number
          pnl_violations: number
          sample_violations: string[]
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      deposit_status: "pending" | "approved" | "rejected" | "locked"
      kyc_status: "pending" | "approved" | "rejected"
      limit_order_status: "pending" | "executed" | "cancelled"
      payment_method: "upi" | "netbanking"
      position_status: "open" | "closed"
      position_type: "long" | "short"
      transaction_type: "deposit" | "withdrawal" | "trade"
      withdrawal_status: "pending" | "approved" | "rejected" | "processing"
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
    Enums: {
      app_role: ["admin", "moderator", "user"],
      deposit_status: ["pending", "approved", "rejected", "locked"],
      kyc_status: ["pending", "approved", "rejected"],
      limit_order_status: ["pending", "executed", "cancelled"],
      payment_method: ["upi", "netbanking"],
      position_status: ["open", "closed"],
      position_type: ["long", "short"],
      transaction_type: ["deposit", "withdrawal", "trade"],
      withdrawal_status: ["pending", "approved", "rejected", "processing"],
    },
  },
} as const
