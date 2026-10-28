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
      automation_state: {
        Row: {
          id: number
          last_ai_post_at: string | null
          locked_until: string | null
          paused_reason: string | null
        }
        Insert: {
          id?: number
          last_ai_post_at?: string | null
          locked_until?: string | null
          paused_reason?: string | null
        }
        Update: {
          id?: number
          last_ai_post_at?: string | null
          locked_until?: string | null
          paused_reason?: string | null
        }
        Relationships: []
      }
      events: {
        Row: {
          city: string
          created_at: string
          date: string
          description: string
          id: string
          lineup: string[]
          program_id: string
          published: boolean
          title: string
          venue: string
        }
        Insert: {
          city?: string
          created_at?: string
          date: string
          description?: string
          id?: string
          lineup?: string[]
          program_id: string
          published?: boolean
          title: string
          venue?: string
        }
        Update: {
          city?: string
          created_at?: string
          date?: string
          description?: string
          id?: string
          lineup?: string[]
          program_id?: string
          published?: boolean
          title?: string
          venue?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      organizer_applications: {
        Row: {
          created_at: string
          email: string
          event_type: string
          id: string
          message: string
          name: string
          organization: string
          phone: string
          status: string
        }
        Insert: {
          created_at?: string
          email: string
          event_type?: string
          id?: string
          message?: string
          name: string
          organization?: string
          phone?: string
          status?: string
        }
        Update: {
          created_at?: string
          email?: string
          event_type?: string
          id?: string
          message?: string
          name?: string
          organization?: string
          phone?: string
          status?: string
        }
        Relationships: []
      }
      posts: {
        Row: {
          body: string
          created_at: string
          event_id: string | null
          excerpt: string
          id: string
          kind: string
          program_id: string | null
          published_at: string | null
          slug: string
          source: string
          status: string
          title: string
        }
        Insert: {
          body?: string
          created_at?: string
          event_id?: string | null
          excerpt?: string
          id?: string
          kind?: string
          program_id?: string | null
          published_at?: string | null
          slug: string
          source?: string
          status?: string
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          event_id?: string | null
          excerpt?: string
          id?: string
          kind?: string
          program_id?: string | null
          published_at?: string | null
          slug?: string
          source?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      price_phases: {
        Row: {
          id: string
          label: string
          price: number
          starts_at: string
          tier_id: string
        }
        Insert: {
          id?: string
          label: string
          price: number
          starts_at: string
          tier_id: string
        }
        Update: {
          id?: string
          label?: string
          price?: number
          starts_at?: string
          tier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_phases_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "ticket_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      program_admins: {
        Row: {
          email: string
          program_id: string
          user_id: string
        }
        Insert: {
          email?: string
          program_id: string
          user_id: string
        }
        Update: {
          email?: string
          program_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_admins_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      programs: {
        Row: {
          created_at: string
          id: string
          image_key: string
          name: string
          owner: string
          slug: string
          tagline: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_key?: string
          name: string
          owner?: string
          slug: string
          tagline?: string
        }
        Update: {
          created_at?: string
          id?: string
          image_key?: string
          name?: string
          owner?: string
          slug?: string
          tagline?: string
        }
        Relationships: []
      }
      ticket_tiers: {
        Row: {
          closed: boolean
          created_at: string
          event_id: string
          id: string
          name: string
          quantity: number
          sales_end_at: string
          sold: number
        }
        Insert: {
          closed?: boolean
          created_at?: string
          event_id: string
          id?: string
          name: string
          quantity?: number
          sales_end_at: string
          sold?: number
        }
        Update: {
          closed?: boolean
          created_at?: string
          event_id?: string
          id?: string
          name?: string
          quantity?: number
          sales_end_at?: string
          sold?: number
        }
        Relationships: [
          {
            foreignKeyName: "ticket_tiers_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
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
      can_manage_program: { Args: { _program_id: string }; Returns: boolean }
      event_program: { Args: { _event_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      tier_program: { Args: { _tier_id: string }; Returns: string }
    }
    Enums: {
      app_role: "superadmin" | "admin"
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
      app_role: ["superadmin", "admin"],
    },
  },
} as const
