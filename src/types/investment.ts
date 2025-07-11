
export interface InvestmentCategory {
  id: string;
  name: string;
  description?: string;
  created_at: string;
}

export interface PropertyInvestment {
  id: string;
  property_id: string;
  category_id: string;
  description: string;
  amount: number;
  investment_date: string;
  receipt_url?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  // Relacionamentos
  category?: InvestmentCategory;
  property?: {
    id: string;
    name: string;
    nickname?: string;
  };
}

export interface PropertyROI {
  property_id: string;
  property_name: string;
  property_nickname?: string;
  total_investment: number;
  total_revenue: number;
  total_expenses: number;
  net_revenue: number;
  roi_percentage: number;
  payback_months: number;
  break_even_date?: string;
  is_profitable: boolean;
  investment_recovered_percentage: number;
}
