import { Transaction, TransactionType, AccountType, Category, User } from './types';

const generateId = () => Math.random().toString(36).substr(2, 9);

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: 'GHS',
  }).format(amount);
};

export const parseDate = (dateStr: string): string => {
  // Handle DD/MM/YYYY or DD/MM/YYYY to YYYY-MM-DD
  if (!dateStr) return new Date().toISOString().split('T')[0];
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  return dateStr;
};

export const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

// Default Categories
export const INITIAL_CATEGORIES: Category[] = [
  { id: 'c1', name: 'Offerings & Tithes', type: 'INCOME' },
  { id: 'c2', name: 'Snacks & Meals', type: 'EXPENSE' },
  { id: 'c3', name: 'Transport & Fuel', type: 'EXPENSE' },
  { id: 'c4', name: 'Stationery', type: 'EXPENSE' },
  { id: 'c5', name: 'Finance Transfer', type: 'BOTH' },
  { id: 'c6', name: 'Teaching Materials', type: 'EXPENSE' },
  { id: 'c7', name: 'Cleaning & Maintenance', type: 'EXPENSE' },
  { id: 'c8', name: 'MoMo & Tax Charges', type: 'EXPENSE' },
  { id: 'c9', name: 'Logistics', type: 'EXPENSE' },
  { id: 'c10', name: 'Donations & Partnerships', type: 'INCOME' },
  { id: 'c11', name: 'Miscellaneous', type: 'BOTH' },
  { id: 'c12', name: 'Cell Offerings', type: 'INCOME' },
  { id: 'c13', name: 'Bus Offerings', type: 'INCOME' },
  { id: 'c14', name: 'Child Support', type: 'INCOME' },
  { id: 'c15', name: 'Seeds', type: 'INCOME' },
  { id: 'c16', name: 'Stipends & Honour', type: 'EXPENSE' },
  { id: 'c17', name: 'Church & External Support', type: 'INCOME' },
  { id: 'c18', name: 'Contingency Fund', type: 'EXPENSE' },
  { id: 'c19', name: 'Printed Materials', type: 'EXPENSE' },
];

export const INITIAL_USERS: User[] = [
  { id: 'u1', name: 'Admin User', email: 'admin@thesaurus.com', phone: '0200000000', role: 'ADMIN', status: 'ACTIVE', momoNumber: '0200000000' },
  { id: 'u2', name: 'Finance Director', email: 'finance@church.com', phone: '0544444444', role: 'FINANCE_REP', status: 'ACTIVE' },
];

// Empty Initial Transactions as requested
export const INITIAL_TRANSACTIONS: Transaction[] = [];