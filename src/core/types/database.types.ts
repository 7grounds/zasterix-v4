export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      agent_definitions: {
        Row: {
          id: string;
          name: string;
          system_prompt: string;
          icon: string | null;
          status: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          system_prompt: string;
          icon?: string | null;
          status?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          system_prompt?: string;
          icon?: string | null;
          status?: string | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
      discussion_logs: {
        Row: {
          id: string;
          project_id: string | null;
          agent_id: string | null;
          speaker_name: string;
          content: string;
          turn_number: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id?: string | null;
          agent_id?: string | null;
          speaker_name: string;
          content: string;
          turn_number?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string | null;
          agent_id?: string | null;
          speaker_name?: string;
          content?: string;
          turn_number?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "discussion_logs_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "discussion_logs_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "agent_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      hierarchy: {
        Row: {
          id: string;
          project_id: string | null;
          agent_id: string | null;
          agent_name: string;
          turn_order: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id?: string | null;
          agent_id?: string | null;
          agent_name: string;
          turn_order: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string | null;
          agent_id?: string | null;
          agent_name?: string;
          turn_order?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "hierarchy_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "hierarchy_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "agent_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      agent_templates: {
        Row: {
          id: string;
          name: string;
          description: string;
          level: number | null;
          system_prompt: string;
          organization_id: string | null;
          category: string | null;
          icon: string | null;
          search_keywords: string[] | null;
          parent_template_id: string | null;
          ai_model_config: Json | null;
          course_roadmap: Json | null;
          shared_logic_id: string | null;
          spawn_metadata: Json | null;
          produced_by: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          description: string;
          level?: number | null;
          system_prompt: string;
          organization_id?: string | null;
          category?: string | null;
          icon?: string | null;
          search_keywords?: string[] | null;
          parent_template_id?: string | null;
          ai_model_config?: Json | null;
          course_roadmap?: Json | null;
          shared_logic_id?: string | null;
          spawn_metadata?: Json | null;
          produced_by?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string;
          level?: number | null;
          system_prompt?: string;
          organization_id?: string | null;
          category?: string | null;
          icon?: string | null;
          search_keywords?: string[] | null;
          parent_template_id?: string | null;
          ai_model_config?: Json | null;
          course_roadmap?: Json | null;
          shared_logic_id?: string | null;
          spawn_metadata?: Json | null;
          produced_by?: string | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "agent_templates_parent_template_id_fkey";
            columns: ["parent_template_id"];
            isOneToOne: false;
            referencedRelation: "agent_blueprints";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agent_templates_shared_logic_id_fkey";
            columns: ["shared_logic_id"];
            isOneToOne: false;
            referencedRelation: "shared_logic";
            referencedColumns: ["id"];
          },
        ];
      };
      agent_blueprints: {
        Row: {
          id: string;
          name: string;
          logic_template: Json;
          ai_model_config: Json;
          validation_library: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          logic_template?: Json;
          ai_model_config?: Json;
          validation_library?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          logic_template?: Json;
          ai_model_config?: Json;
          validation_library?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      shared_logic: {
        Row: {
          id: string;
          organization_id: string | null;
          logic_key: string;
          logic_payload: Json;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          logic_key: string;
          logic_payload?: Json;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string | null;
          logic_key?: string;
          logic_payload?: Json;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "shared_logic_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      billing_logs: {
        Row: {
          id: string;
          user_id: string | null;
          organization_id: string | null;
          provider: string;
          agent_name: string | null;
          token_count: number;
          cost_usd: number | null;
          cost_chf: number | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          organization_id?: string | null;
          provider: string;
          agent_name?: string | null;
          token_count: number;
          cost_usd?: number | null;
          cost_chf?: number | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          organization_id?: string | null;
          provider?: string;
          agent_name?: string | null;
          token_count?: number;
          cost_usd?: number | null;
          cost_chf?: number | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
      search_logs: {
        Row: {
          id: string;
          user_id: string | null;
          organization_id: string | null;
          query: string;
          results_found: boolean;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          organization_id?: string | null;
          query: string;
          results_found?: boolean;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          organization_id?: string | null;
          query?: string;
          results_found?: boolean;
          created_at?: string | null;
        };
        Relationships: [];
      };
      user_flows: {
        Row: {
          id: string;
          user_id: string | null;
          organization_id: string | null;
          domain: string;
          current_step: string | null;
          status: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          organization_id?: string | null;
          domain: string;
          current_step?: string | null;
          status?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          organization_id?: string | null;
          domain?: string;
          current_step?: string | null;
          status?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          organization_id: string;
          full_name: string | null;
          avatar_url: string | null;
          updated_at: string | null;
        };
        Insert: {
          id: string;
          organization_id: string;
          full_name?: string | null;
          avatar_url?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          id: string;
          organization_id: string | null;
          name: string;
          type: string;
          status: string;
          metadata: Json;
          current_discussion_step: number;
          current_turn_agent_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          name: string;
          type?: string;
          status?: string;
          metadata?: Json;
          current_discussion_step?: number;
          current_turn_agent_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string | null;
          name?: string;
          type?: string;
          status?: string;
          metadata?: Json;
          current_discussion_step?: number;
          current_turn_agent_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "projects_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "projects_current_turn_agent_id_fkey";
            columns: ["current_turn_agent_id"];
            isOneToOne: false;
            referencedRelation: "agent_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      user_progress: {
        Row: {
          id: string;
          user_id: string;
          organization_id: string | null;
          stage_id: string;
          module_id: string;
          completed_tasks: string[] | null;
          is_completed: boolean | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          organization_id?: string | null;
          stage_id: string;
          module_id: string;
          completed_tasks?: string[] | null;
          is_completed?: boolean | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          organization_id?: string | null;
          stage_id?: string;
          module_id?: string;
          completed_tasks?: string[] | null;
          is_completed?: boolean | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      universal_history: {
        Row: {
          id: string;
          user_id: string;
          organization_id: string | null;
          payload: Json;
          summary_payload: Json | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          organization_id?: string | null;
          payload: Json;
          summary_payload?: Json | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          organization_id?: string | null;
          payload?: Json;
          summary_payload?: Json | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
