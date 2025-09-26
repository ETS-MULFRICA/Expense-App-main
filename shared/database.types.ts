export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: number
          username: string
          password: string
          name: string
          email: string
          currency: string | null
          role: string | null
          created_at: string
        }
        Insert: {
          id?: number
          username: string
          password: string
          name: string
          email: string
          currency?: string | null
          role?: string | null
          created_at?: string
        }
        Update: {
          id?: number
          username?: string
          password?: string
          name?: string
          email?: string
          currency?: string | null
          role?: string | null
          created_at?: string
        }
      }
      expense_categories: {
        Row: {
          id: number
          user_id: number
          name: string
          description: string | null
          is_system: boolean | null
          created_at: string
        }
        Insert: {
          id?: number
          user_id: number
          name: string
          description?: string | null
          is_system?: boolean | null
          created_at?: string
        }
        Update: {
          id?: number
          user_id?: number
          name?: string
          description?: string | null
          is_system?: boolean | null
          created_at?: string
        }
      }
      expense_subcategories: {
        Row: {
          id: number
          category_id: number
          user_id: number
          name: string
          description: string | null
          is_system: boolean | null
          created_at: string
        }
        Insert: {
          id?: number
          category_id: number
          user_id: number
          name: string
          description?: string | null
          is_system?: boolean | null
          created_at?: string
        }
        Update: {
          id?: number
          category_id?: number
          user_id?: number
          name?: string
          description?: string | null
          is_system?: boolean | null
          created_at?: string
        }
      }
      expenses: {
        Row: {
          id: number
          user_id: number
          amount: number
          description: string
          date: string
          category_id: number
          subcategory_id: number | null
          merchant: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: number
          user_id: number
          amount: number
          description: string
          date: string
          category_id: number
          subcategory_id?: number | null
          merchant?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: number
          user_id?: number
          amount?: number
          description?: string
          date?: string
          category_id?: number
          subcategory_id?: number | null
          merchant?: string | null
          notes?: string | null
          created_at?: string
        }
      }
      income_categories: {
        Row: {
          id: number
          user_id: number
          name: string
          description: string | null
          is_system: boolean | null
          created_at: string
        }
        Insert: {
          id?: number
          user_id: number
          name: string
          description?: string | null
          is_system?: boolean | null
          created_at?: string
        }
        Update: {
          id?: number
          user_id?: number
          name?: string
          description?: string | null
          is_system?: boolean | null
          created_at?: string
        }
      }
      income_subcategories: {
        Row: {
          id: number
          category_id: number
          user_id: number
          name: string
          description: string | null
          is_system: boolean | null
          created_at: string
        }
        Insert: {
          id?: number
          category_id: number
          user_id: number
          name: string
          description?: string | null
          is_system?: boolean | null
          created_at?: string
        }
        Update: {
          id?: number
          category_id?: number
          user_id?: number
          name?: string
          description?: string | null
          is_system?: boolean | null
          created_at?: string
        }
      }
      incomes: {
        Row: {
          id: number
          user_id: number
          amount: number
          description: string
          date: string
          category_id: number
          subcategory_id: number | null
          source: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: number
          user_id: number
          amount: number
          description: string
          date: string
          category_id: number
          subcategory_id?: number | null
          source?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: number
          user_id?: number
          amount?: number
          description?: string
          date?: string
          category_id?: number
          subcategory_id?: number | null
          source?: string | null
          notes?: string | null
          created_at?: string
        }
      }
      budgets: {
        Row: {
          id: number
          user_id: number
          name: string
          period: string
          start_date: string
          end_date: string
          amount: number
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: number
          user_id: number
          name: string
          period?: string
          start_date: string
          end_date: string
          amount: number
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: number
          user_id?: number
          name?: string
          period?: string
          start_date?: string
          end_date?: string
          amount?: number
          notes?: string | null
          created_at?: string
        }
      }
      budget_allocations: {
        Row: {
          id: number
          budget_id: number
          category_id: number
          subcategory_id: number | null
          amount: number
          created_at: string
        }
        Insert: {
          id?: number
          budget_id: number
          category_id: number
          subcategory_id?: number | null
          amount: number
          created_at?: string
        }
        Update: {
          id?: number
          budget_id?: number
          category_id?: number
          subcategory_id?: number | null
          amount?: number
          created_at?: string
        }
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
  }
}
