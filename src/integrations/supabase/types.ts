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
      atividade_envios: {
        Row: {
          aluno_id: string
          arquivo_nome: string | null
          arquivo_url: string | null
          atividade_id: string
          comentario_professor: string | null
          corrigido_em: string | null
          enviado_em: string | null
          id: string
          nota: number | null
          texto: string | null
          updated_at: string | null
        }
        Insert: {
          aluno_id: string
          arquivo_nome?: string | null
          arquivo_url?: string | null
          atividade_id: string
          comentario_professor?: string | null
          corrigido_em?: string | null
          enviado_em?: string | null
          id?: string
          nota?: number | null
          texto?: string | null
          updated_at?: string | null
        }
        Update: {
          aluno_id?: string
          arquivo_nome?: string | null
          arquivo_url?: string | null
          atividade_id?: string
          comentario_professor?: string | null
          corrigido_em?: string | null
          enviado_em?: string | null
          id?: string
          nota?: number | null
          texto?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "atividade_envios_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atividade_envios_atividade_id_fkey"
            columns: ["atividade_id"]
            isOneToOne: false
            referencedRelation: "atividades"
            referencedColumns: ["id"]
          },
        ]
      }
      atividades: {
        Row: {
          anexo_nome: string | null
          anexo_url: string | null
          aula_id: string | null
          created_at: string
          criado_por: string | null
          curso_id: string | null
          descricao: string | null
          id: string
          nota_maxima: number
          prazo: string | null
          professor_id: string | null
          titulo: string
          turma_id: string
        }
        Insert: {
          anexo_nome?: string | null
          anexo_url?: string | null
          aula_id?: string | null
          created_at?: string
          criado_por?: string | null
          curso_id?: string | null
          descricao?: string | null
          id?: string
          nota_maxima?: number
          prazo?: string | null
          professor_id?: string | null
          titulo: string
          turma_id: string
        }
        Update: {
          anexo_nome?: string | null
          anexo_url?: string | null
          aula_id?: string | null
          created_at?: string
          criado_por?: string | null
          curso_id?: string | null
          descricao?: string | null
          id?: string
          nota_maxima?: number
          prazo?: string | null
          professor_id?: string | null
          titulo?: string
          turma_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "atividades_aula_id_fkey"
            columns: ["aula_id"]
            isOneToOne: false
            referencedRelation: "aulas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atividades_aula_id_fkey"
            columns: ["aula_id"]
            isOneToOne: false
            referencedRelation: "lessons_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atividades_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atividades_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atividades_professor_id_fkey"
            columns: ["professor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atividades_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      aulas: {
        Row: {
          created_at: string | null
          curso_id: string
          descricao: string | null
          id: string
          ordem: number
          titulo: string
          youtube_url: string
        }
        Insert: {
          created_at?: string | null
          curso_id: string
          descricao?: string | null
          id?: string
          ordem?: number
          titulo: string
          youtube_url?: string
        }
        Update: {
          created_at?: string | null
          curso_id?: string
          descricao?: string | null
          id?: string
          ordem?: number
          titulo?: string
          youtube_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "aulas_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
        ]
      }
      community_comments: {
        Row: {
          content: string
          created_at: string | null
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      community_messages: {
        Row: {
          arquivo_nome: string | null
          arquivo_url: string | null
          content: string | null
          created_at: string
          curso_id: string
          id: string
          turma_id: string
          user_id: string
        }
        Insert: {
          arquivo_nome?: string | null
          arquivo_url?: string | null
          content?: string | null
          created_at?: string
          curso_id: string
          id?: string
          turma_id: string
          user_id: string
        }
        Update: {
          arquivo_nome?: string | null
          arquivo_url?: string | null
          content?: string | null
          created_at?: string
          curso_id?: string
          id?: string
          turma_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_messages_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_messages_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      community_posts: {
        Row: {
          content: string
          created_at: string | null
          id: string
          status: string
          tipo: string
          turma_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          status?: string
          tipo?: string
          turma_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          status?: string
          tipo?: string
          turma_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_posts_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      curso_turmas: {
        Row: {
          curso_id: string
          turma_id: string
        }
        Insert: {
          curso_id: string
          turma_id: string
        }
        Update: {
          curso_id?: string
          turma_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "curso_turmas_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curso_turmas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      cursos: {
        Row: {
          created_at: string | null
          descricao: string | null
          id: string
          titulo: string
        }
        Insert: {
          created_at?: string | null
          descricao?: string | null
          id?: string
          titulo: string
        }
        Update: {
          created_at?: string | null
          descricao?: string | null
          id?: string
          titulo?: string
        }
        Relationships: []
      }
      duvidas: {
        Row: {
          aluno_id: string
          anexo_nome: string | null
          anexo_url: string | null
          aula_id: string
          created_at: string
          curso_id: string
          descricao: string | null
          id: string
          professor_id: string | null
          resolved_at: string | null
          resposta: string | null
          status: string
          titulo: string
          turma_id: string
        }
        Insert: {
          aluno_id: string
          anexo_nome?: string | null
          anexo_url?: string | null
          aula_id: string
          created_at?: string
          curso_id: string
          descricao?: string | null
          id?: string
          professor_id?: string | null
          resolved_at?: string | null
          resposta?: string | null
          status?: string
          titulo: string
          turma_id: string
        }
        Update: {
          aluno_id?: string
          anexo_nome?: string | null
          anexo_url?: string | null
          aula_id?: string
          created_at?: string
          curso_id?: string
          descricao?: string | null
          id?: string
          professor_id?: string | null
          resolved_at?: string | null
          resposta?: string | null
          status?: string
          titulo?: string
          turma_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "duvidas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duvidas_aula_id_fkey"
            columns: ["aula_id"]
            isOneToOne: false
            referencedRelation: "aulas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duvidas_aula_id_fkey"
            columns: ["aula_id"]
            isOneToOne: false
            referencedRelation: "lessons_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duvidas_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duvidas_professor_id_fkey"
            columns: ["professor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duvidas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          activated_at: string | null
          created_at: string | null
          email: string
          id: string
          invite_expires_at: string | null
          invite_token: string | null
          reset_expires_at: string | null
          reset_token: string | null
          role: string
          status: string
        }
        Insert: {
          activated_at?: string | null
          created_at?: string | null
          email: string
          id: string
          invite_expires_at?: string | null
          invite_token?: string | null
          reset_expires_at?: string | null
          reset_token?: string | null
          role?: string
          status?: string
        }
        Update: {
          activated_at?: string | null
          created_at?: string | null
          email?: string
          id?: string
          invite_expires_at?: string | null
          invite_token?: string | null
          reset_expires_at?: string | null
          reset_token?: string | null
          role?: string
          status?: string
        }
        Relationships: []
      }
      progresso: {
        Row: {
          aula_id: string
          concluido: boolean | null
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          aula_id: string
          concluido?: boolean | null
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          aula_id?: string
          concluido?: boolean | null
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "progresso_aula_id_fkey"
            columns: ["aula_id"]
            isOneToOne: false
            referencedRelation: "aulas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progresso_aula_id_fkey"
            columns: ["aula_id"]
            isOneToOne: false
            referencedRelation: "lessons_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progresso_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      turmas: {
        Row: {
          created_at: string | null
          descricao: string | null
          id: string
          nome: string
        }
        Insert: {
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome: string
        }
        Update: {
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome?: string
        }
        Relationships: []
      }
      user_turmas: {
        Row: {
          curso_id: string | null
          id: string
          turma_id: string
          user_id: string
        }
        Insert: {
          curso_id?: string | null
          id?: string
          turma_id: string
          user_id: string
        }
        Update: {
          curso_id?: string | null
          id?: string
          turma_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_turmas_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_turmas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_turmas_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      video_access_logs: {
        Row: {
          accessed_at: string
          id: string
          ip_address: string | null
          lesson_id: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          accessed_at?: string
          id?: string
          ip_address?: string | null
          lesson_id: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          accessed_at?: string
          id?: string
          ip_address?: string | null
          lesson_id?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      lessons_public: {
        Row: {
          created_at: string | null
          curso_id: string | null
          descricao: string | null
          id: string | null
          ordem: number | null
          titulo: string | null
        }
        Insert: {
          created_at?: string | null
          curso_id?: string | null
          descricao?: string | null
          id?: string | null
          ordem?: number | null
          titulo?: string | null
        }
        Update: {
          created_at?: string | null
          curso_id?: string | null
          descricao?: string | null
          id?: string | null
          ordem?: number | null
          titulo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aulas_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      has_access_to_turma_curso: {
        Args: { c_id: string; t_id: string }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_professor_of_turma: { Args: { t_id: string }; Returns: boolean }
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
