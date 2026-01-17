export enum TransactionType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
  TRANSFER = 'TRANSFER',
}

export enum AccountType {
  MOMO = 'MoMo Receivables',
  CASH = 'Cash Receivables',
  OTHER = 'Others',
}

export interface Transaction {
  id: string;
  date: string; // ISO String YYYY-MM-DD
  type: TransactionType;
  category: string;
  amount: number;
  accountId: AccountType; // The main account involved
  toAccountId?: AccountType; // For transfers
  recipient?: string; // From/To
  notes?: string;
  isArchived: boolean;
  meta?: {
    receivedFromFinance?: boolean; // For MoMo expenses
    isPlan?: boolean; // If created from "Plan Next Week"
    breakdown?: { item: string; amount: number }[]; // For weekly plan breakdown
  };
}

export interface Category {
  id: string;
  name: string;
  type: 'INCOME' | 'EXPENSE' | 'BOTH';
}

export interface User {
  id: string;
  name: string;
  role: 'ADMIN' | 'VIEWER' | 'FINANCE_REP';
  phone: string;
  email: string;
  status: 'ACTIVE' | 'DISABLED';
  momoNumber?: string;
}

export type Period = 'WEEK' | 'MONTH' | 'QUARTER' | 'YEAR';

export interface DashboardStats {
  income: number;
  expense: number;
  balance: number;
}