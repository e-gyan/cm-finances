import React, { useState, useMemo } from 'react';
import { Transaction, AccountType, TransactionType, Period } from '../types';
import { formatCurrency } from '../utils';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, TrendingDown, Wallet, CreditCard, Banknote, ChevronRight } from 'lucide-react';

interface OverviewProps {
  transactions: Transaction[];
  onFilterAccount: (account: AccountType | null) => void;
  selectedYear: number;
  onYearChange: (year: number) => void;
}

const Overview: React.FC<OverviewProps> = ({ transactions, onFilterAccount, selectedYear, onYearChange }) => {
  const [graphPeriod, setGraphPeriod] = useState<'WEEK' | 'QUARTER' | 'YEAR'>('WEEK');

  const availableYears = useMemo(() => {
    const years = new Set<number>(transactions.map(t => new Date(t.date).getFullYear()));
    years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => !t.isArchived && new Date(t.date).getFullYear() === selectedYear);
  }, [transactions, selectedYear]);

  // Account Balances include Transfers
  const calculateBalance = (account?: AccountType) => {
    return filteredTransactions.reduce((acc, t) => {
      if (t.type === TransactionType.TRANSFER) {
        if (!account) return acc;
        if (t.accountId === account) return acc - t.amount;
        if (t.toAccountId === account) return acc + t.amount;
        return acc;
      }
      if (account && t.accountId !== account) return acc;
      if (t.type === TransactionType.INCOME) return acc + t.amount;
      if (t.type === TransactionType.EXPENSE) return acc - t.amount;
      return acc;
    }, 0);
  };

  // Global Totals EXCLUDE Transfers (P&L View)
  const totals = useMemo(() => {
    const income = filteredTransactions
      .filter(t => t.type === TransactionType.INCOME)
      .reduce((acc, t) => acc + t.amount, 0);
    const expense = filteredTransactions
      .filter(t => t.type === TransactionType.EXPENSE)
      .reduce((acc, t) => acc + t.amount, 0);
    return { income, expense, balance: income - expense };
  }, [filteredTransactions]);

  const chartData = useMemo(() => {
    const data: Record<string, { name: string; income: number; expense: number }> = {};
    // Exclude Transfers from the Graph to show P&L Trend
    filteredTransactions.filter(t => t.type !== TransactionType.TRANSFER).forEach(t => {
      let key = '';
      const date = new Date(t.date);
      if (graphPeriod === 'YEAR') {
        key = date.toLocaleString('default', { month: 'short' });
      } else if (graphPeriod === 'QUARTER') {
        const q = Math.floor((date.getMonth() + 3) / 3);
        key = `Q${q}`;
      } else {
        const firstDay = new Date(date.setDate(date.getDate() - date.getDay()));
        key = `${firstDay.getDate()}/${firstDay.getMonth()+1}`;
      }
      if (!data[key]) data[key] = { name: key, income: 0, expense: 0 };
      if (t.type === TransactionType.INCOME) data[key].income += t.amount;
      if (t.type === TransactionType.EXPENSE) data[key].expense += t.amount;
    });
    return Object.values(data);
  }, [filteredTransactions, graphPeriod]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-4 rounded-3xl shadow-sm border border-gray-100 gap-4">
        <h2 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight">Overview</h2>
        <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">Fiscal Year</span>
            <select 
                className="bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs font-bold focus:ring-4 focus:ring-primary/10 outline-none w-full sm:w-auto cursor-pointer"
                value={selectedYear}
                onChange={(e) => onYearChange(Number(e.target.value))}
            >
                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
        </div>
      </div>

      {/* Snippets - Improved Grid for Tablets (sm:grid-cols-2) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-emerald-50 p-6 rounded-[2rem] border border-emerald-100 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-emerald-600 font-black text-[10px] uppercase tracking-widest">Total Income</p>
            <p className="text-2xl md:text-3xl font-black text-emerald-900 mt-2 tracking-tighter">{formatCurrency(totals.income)}</p>
          </div>
          <div className="p-3 bg-white rounded-full text-emerald-600 shadow-sm">
            <TrendingUp size={24} />
          </div>
        </div>
        <div className="bg-rose-50 p-6 rounded-[2rem] border border-rose-100 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-rose-600 font-black text-[10px] uppercase tracking-widest">Total Expenses</p>
            <p className="text-2xl md:text-3xl font-black text-rose-900 mt-2 tracking-tighter">{formatCurrency(totals.expense)}</p>
          </div>
          <div className="p-3 bg-white rounded-full text-rose-600 shadow-sm">
            <TrendingDown size={24} />
          </div>
        </div>
        <div className="bg-blue-50 p-6 rounded-[2rem] border border-blue-100 flex items-center justify-between shadow-sm sm:col-span-2 lg:col-span-1">
          <div>
            <p className="text-blue-600 font-black text-[10px] uppercase tracking-widest">Net Balance</p>
            <p className={`text-2xl md:text-3xl font-black mt-2 tracking-tighter ${totals.balance >= 0 ? 'text-blue-900' : 'text-rose-700'}`}>
                {formatCurrency(totals.balance)}
            </p>
          </div>
          <div className="p-3 bg-white rounded-full text-blue-600 shadow-sm">
            <Wallet size={24} />
          </div>
        </div>
      </div>

      {/* Account Cards - Improved Grid for Tablets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[AccountType.MOMO, AccountType.CASH, AccountType.OTHER].map((acc) => (
          <button
            key={acc}
            onClick={() => onFilterAccount(acc)}
            className="group relative overflow-hidden bg-white p-6 rounded-[2rem] shadow-sm border border-gray-200 hover:shadow-xl hover:shadow-gray-200/50 transition-all text-left active:scale-95 duration-200"
          >
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                {acc === AccountType.MOMO ? <CreditCard size={80} /> : acc === AccountType.CASH ? <Banknote size={80} /> : <Wallet size={80} />}
            </div>
            <h3 className="text-gray-400 font-black text-[10px] uppercase tracking-widest truncate pr-8">{acc}</h3>
            <p className="text-2xl font-black text-gray-900 mt-3 tracking-tight">{formatCurrency(calculateBalance(acc))}</p>
            <div className="mt-4 flex items-center text-[10px] font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity transform translate-y-2 group-hover:translate-y-0">
                View Ledger <ChevronRight size={14} className="ml-1" />
            </div>
          </button>
        ))}
      </div>

      {/* Balance History Graph */}
      <div className="bg-white p-4 sm:p-8 rounded-[2rem] shadow-sm border border-gray-200">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight">Financial History</h3>
            <div className="flex bg-gray-50 rounded-xl p-1 w-full sm:w-auto">
                {(['WEEK', 'QUARTER', 'YEAR'] as const).map((p) => (
                    <button
                        key={p}
                        onClick={() => setGraphPeriod(p)}
                        className={`flex-1 sm:flex-none px-4 py-2 text-[10px] rounded-lg font-black uppercase tracking-widest transition-all ${
                            graphPeriod === p ? 'bg-white text-primary shadow-sm' : 'text-gray-400 hover:text-gray-600'
                        }`}
                    >
                        {p}
                    </button>
                ))}
            </div>
        </div>
        <div className="h-64 sm:h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                    <defs>
                        <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 10, fontWeight: 700}} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 10, fontWeight: 700}} />
                    <Tooltip 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                        formatter={(value: number) => formatCurrency(value)}
                        labelStyle={{fontWeight: 900, color: '#1f2937', marginBottom: '8px'}}
                    />
                    <Legend iconType="circle" wrapperStyle={{paddingTop: '20px'}} />
                    <Area type="monotone" dataKey="income" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorIncome)" name="Income" />
                    <Area type="monotone" dataKey="expense" stroke="#f43f5e" strokeWidth={3} fillOpacity={1} fill="url(#colorExpense)" name="Expenses" />
                </AreaChart>
            </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Overview;