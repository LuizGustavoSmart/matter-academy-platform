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
          avaliada_com_nota: boolean
          created_at: string
          criado_por: string | null
          curso_id: string | null
          descricao: string | null
          id: string
          nota_maxima: number
          ordem: number
          prazo: string | null
          professor_id: string | null
          publicada: boolean
          titulo: string
          turma_id: string
        }
        Insert: {
          anexo_nome?: string | null
          anexo_url?: string | null
          aula_id?: string | null
          avaliada_com_nota?: boolean
          created_at?: string
          criado_por?: string | null
          curso_id?: string | null
          descricao?: string | null
          id?: string
          nota_maxima?: number
          ordem?: number
          prazo?: string | null
          professor_id?: string | null
          publicada?: boolean
          titulo: string
          turma_id: string
        }
        Update: {
          anexo_nome?: string | null
          anexo_url?: string | null
          aula_id?: string | null
          avaliada_com_nota?: boolean
          created_at?: string
          criado_por?: string | null
          curso_id?: string | null
          descricao?: string | null
          id?: string
          nota_maxima?: number
          ordem?: number
          prazo?: string | null
          professor_id?: string | null
          publicada?: boolean
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
      aula_horarios: {
        Row: {
          aula_id: string
          created_at: string
          curso_id: string
          data_hora: string
          id: string
          turma_id: string
        }
        Insert: {
          aula_id: string
          created_at?: string
          curso_id: string
          data_hora: string
          id?: string
          turma_id: string
        }
        Update: {
          aula_id?: string
          created_at?: string
          curso_id?: string
          data_hora?: string
          id?: string
          turma_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "aula_horarios_aula_id_fkey"
            columns: ["aula_id"]
            isOneToOne: false
            referencedRelation: "aulas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aula_horarios_aula_id_fkey"
            columns: ["aula_id"]
            isOneToOne: false
            referencedRelation: "lessons_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aula_horarios_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aula_horarios_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      aulas: {
        Row: {
          capa_url: string | null
          created_at: string | null
          curso_id: string
          descricao: string | null
          id: string
          ordem: number
          publicada: boolean
          titulo: string
          youtube_url: string
        }
        Insert: {
          capa_url?: string | null
          created_at?: string | null
          curso_id: string
          descricao?: string | null
          id?: string
          ordem?: number
          publicada?: boolean
          titulo: string
          youtube_url?: string
        }
        Update: {
          capa_url?: string | null
          created_at?: string | null
          curso_id?: string
          descricao?: string | null
          id?: string
          ordem?: number
          publicada?: boolean
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
          data_fim: string | null
          data_inicio: string | null
          dia_semana: string | null
          horario_fim: string | null
          horario_inicio: string | null
          ordem: number
          professor_id: string | null
          turma_id: string
        }
        Insert: {
          curso_id: string
          data_fim?: string | null
          data_inicio?: string | null
          dia_semana?: string | null
          horario_fim?: string | null
          horario_inicio?: string | null
          ordem?: number
          professor_id?: string | null
          turma_id: string
        }
        Update: {
          curso_id?: string
          data_fim?: string | null
          data_inicio?: string | null
          dia_semana?: string | null
          horario_fim?: string | null
          horario_inicio?: string | null
          ordem?: number
          professor_id?: string | null
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
            foreignKeyName: "curso_turmas_professor_id_fkey"
            columns: ["professor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          capa_url: string | null
          created_at: string | null
          descricao: string | null
          faixa: string | null
          id: string
          link_ao_vivo: string | null
          titulo: string
        }
        Insert: {
          capa_url?: string | null
          created_at?: string | null
          descricao?: string | null
          faixa?: string | null
          id?: string
          link_ao_vivo?: string | null
          titulo: string
        }
        Update: {
          capa_url?: string | null
          created_at?: string | null
          descricao?: string | null
          faixa?: string | null
          id?: string
          link_ao_vivo?: string | null
          titulo?: string
        }
        Relationships: []
      }
      duvidas: {
        Row: {
          aluno_id: string
          anexo_nome: string | null
          anexo_url: string | null
          aula_id: string | null
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
          aula_id?: string | null
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
          aula_id?: string | null
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
      faixa_capas: {
        Row: {
          capa_url: string | null
          faixa: string
          updated_at: string
        }
        Insert: {
          capa_url?: string | null
          faixa: string
          updated_at?: string
        }
        Update: {
          capa_url?: string | null
          faixa?: string
          updated_at?: string
        }
        Relationships: []
      }
      presencas: {
        Row: {
          atualizado_em: string
          aula_id: string
          criado_em: string
          editado_por: string | null
          id: string
          origem: string
          percentual_assistido: number | null
          presente: boolean
          turma_id: string
          user_id: string
        }
        Insert: {
          atualizado_em?: string
          aula_id: string
          criado_em?: string
          editado_por?: string | null
          id?: string
          origem: string
          percentual_assistido?: number | null
          presente?: boolean
          turma_id: string
          user_id: string
        }
        Update: {
          atualizado_em?: string
          aula_id?: string
          criado_em?: string
          editado_por?: string | null
          id?: string
          origem?: string
          percentual_assistido?: number | null
          presente?: boolean
          turma_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "presencas_aula_id_fkey"
            columns: ["aula_id"]
            isOneToOne: false
            referencedRelation: "aulas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presencas_aula_id_fkey"
            columns: ["aula_id"]
            isOneToOne: false
            referencedRelation: "lessons_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presencas_editado_por_fkey"
            columns: ["editado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presencas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presencas_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          activated_at: string | null
          avatar_url: string | null
          cargo: string | null
          created_at: string | null
          data_nascimento: string | null
          email: string
          empresa: string | null
          id: string
          invite_expires_at: string | null
          invite_token: string | null
          nome: string | null
          reset_expires_at: string | null
          reset_token: string | null
          role: string
          sexo: string | null
          sobrenome: string | null
          status: string
          telefone: string | null
          tour_visto: boolean
        }
        Insert: {
          activated_at?: string | null
          avatar_url?: string | null
          cargo?: string | null
          created_at?: string | null
          data_nascimento?: string | null
          email: string
          empresa?: string | null
          id: string
          invite_expires_at?: string | null
          invite_token?: string | null
          nome?: string | null
          reset_expires_at?: string | null
          reset_token?: string | null
          role?: string
          sexo?: string | null
          sobrenome?: string | null
          status?: string
          telefone?: string | null
          tour_visto?: boolean
        }
        Update: {
          activated_at?: string | null
          avatar_url?: string | null
          cargo?: string | null
          created_at?: string | null
          data_nascimento?: string | null
          email?: string
          empresa?: string | null
          id?: string
          invite_expires_at?: string | null
          invite_token?: string | null
          nome?: string | null
          reset_expires_at?: string | null
          reset_token?: string | null
          role?: string
          sexo?: string | null
          sobrenome?: string | null
          status?: string
          telefone?: string | null
          tour_visto?: boolean
        }
        Relationships: []
      }
      progresso: {
        Row: {
          aula_id: string
          concluido: boolean | null
          id: string
          percentual_assistido: number
          segundos_assistidos: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          aula_id: string
          concluido?: boolean | null
          id?: string
          percentual_assistido?: number
          segundos_assistidos?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          aula_id?: string
          concluido?: boolean | null
          id?: string
          percentual_assistido?: number
          segundos_assistidos?: number
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
          capa_url: string | null
          codigo: string | null
          created_at: string | null
          data_inicio: string | null
          descricao: string | null
          id: string
          nome: string
          tipo_cobranca: string | null
          valor: number | null
        }
        Insert: {
          capa_url?: string | null
          codigo?: string | null
          created_at?: string | null
          data_inicio?: string | null
          descricao?: string | null
          id?: string
          nome: string
          tipo_cobranca?: string | null
          valor?: number | null
        }
        Update: {
          capa_url?: string | null
          codigo?: string | null
          created_at?: string | null
          data_inicio?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          tipo_cobranca?: string | null
          valor?: number | null
        }
        Relationships: []
      }
      user_turmas: {
        Row: {
          curso_id: string | null
          id: string
          is_embaixador: boolean
          is_staff: boolean
          turma_id: string
          user_id: string
        }
        Insert: {
          curso_id?: string | null
          id?: string
          is_embaixador?: boolean
          is_staff?: boolean
          turma_id: string
          user_id: string
        }
        Update: {
          curso_id?: string | null
          id?: string
          is_embaixador?: boolean
          is_staff?: boolean
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
          capa_url: string | null
          created_at: string | null
          curso_id: string | null
          descricao: string | null
          id: string | null
          ordem: number | null
          publicada: boolean | null
          titulo: string | null
        }
        Insert: {
          capa_url?: string | null
          created_at?: string | null
          curso_id?: string | null
          descricao?: string | null
          id?: string | null
          ordem?: number | null
          publicada?: boolean | null
          titulo?: string | null
        }
        Update: {
          capa_url?: string | null
          created_at?: string | null
          curso_id?: string | null
          descricao?: string | null
          id?: string | null
          ordem?: number | null
          publicada?: boolean | null
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
      aula_curso_id: { Args: { a_id: string }; Returns: string }
      can_manage_presenca: {
        Args: { a_id: string; t_id: string }
        Returns: boolean
      }
      has_access_to_turma_curso: {
        Args: { c_id: string; t_id: string }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_embaixador_of_turma: { Args: { p_turma_id: string }; Returns: boolean }
      is_embaixador_over_user: { Args: { p_user_id: string }; Returns: boolean }
      is_professor_of_turma: { Args: { t_id: string }; Returns: boolean }
      is_professor_of_turma_curso: {
        Args: { c_id: string; t_id: string }
        Returns: boolean
      }
      shares_turma_with: { Args: { _other: string }; Returns: boolean }
      storage_can_access_atividade_path: {
        Args: { _path: string }
        Returns: boolean
      }
      storage_can_access_turma_curso: {
        Args: { _path: string }
        Returns: boolean
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
