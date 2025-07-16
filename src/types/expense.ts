
export interface Expense {
  id: string;
  property_id: string;
  expense_date: string;
  description: string;
  category: string;
  expense_type: string;
  amount: number;
  created_at: string;
  is_recurrent?: boolean;
  recurrence_group_id?: string;
  payment_status?: string;
  properties?: {
    name: string;
    nickname?: string;
  };
}

export interface ExpenseCategory {
  id: string;
  name: string;
  created_at: string;
}
