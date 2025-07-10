
export interface Expense {
  id: string;
  property_id: string;
  expense_date: string;
  description: string;
  category: string;
  expense_type: string;
  amount: number;
  created_at: string;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  created_at: string;
}
