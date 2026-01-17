import React, { useState, useMemo } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { Transaction, TransactionType, User, AccountType } from '../types';
import { formatCurrency, getGreeting } from '../utils';
import { FileText, Calendar, TrendingUp, TrendingDown, Plus, Save, Trash2, Download, PieChart, ChevronDown, BarChart2, Target, MessageCircle, AlertTriangle, X, Check, User as UserIcon, Send, Sparkles, Loader2 } from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  Cell
} from 'recharts';

interface ReportsProps {
  transactions: Transaction[];
  users: User[];
  onAddTransaction: (t: Omit<Transaction, 'id'> | Omit<Transaction, 'id'>[]) => void;
  financeRep: User | undefined;
}

type ReportType = 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

const Reports: React.FC<ReportsProps> = ({ transactions, users, onAddTransaction, financeRep }) => {
  const [activeTab, setActiveTab] = useState<ReportType>('WEEKLY');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedWeekDate, setSelectedWeekDate] = useState(new Date().toISOString().split('T')[0]);

  // WhatsApp Request Flow State
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [selectedFinanceRep, setSelectedFinanceRep] = useState<string>(''); // Name of Finance person
  const [selectedBeneficiary, setSelectedBeneficiary] = useState<string>(''); // Name of person receiving MoMo
  const [beneficiaryNumber, setBeneficiaryNumber] = useState<string>(''); // Number of person receiving MoMo

  // AI Loading State
  const [isAutoPlanning, setIsAutoPlanning] = useState(false);

  // --- Weekly Input States ---
  const [offeringsInput, setOfferingsInput] = useState<{type: 'CASH' | 'MOMO', amount: string}[]>([
    { type: 'CASH', amount: '' }
  ]);
  const [planInput, setPlanInput] = useState<{item: string, cost: string}[]>([
    { item: '', cost: '' }
  ]);

  // --- Helpers ---
  const getMonthName = (monthIndex: number) => {
    return new Date(2025, monthIndex, 1).toLocaleString('default', { month: 'long' });
  };

  const getWeekRange = (dateStr: string) => {
    const date = new Date(dateStr);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(date.setDate(diff));
    const sunday = new Date(date.setDate(monday.getDate() + 6));
    monday.setHours(0,0,0,0);
    sunday.setHours(23,59,59,999);
    return { start: monday, end: sunday };
  };

  const availableYears = useMemo(() => {
    const years = new Set<number>(transactions.map(t => new Date(t.date).getFullYear()));
    years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [transactions]);

  // --- Data Calculations: Weekly ---
  const weeklyStats = useMemo(() => {
    const { start, end } = getWeekRange(selectedWeekDate);
    const weekTrans = transactions.filter(t => {
      const d = new Date(t.date);
      return !t.isArchived && d >= start && d <= end;
    });

    const offerings = weekTrans.filter(t => t.category === 'Offerings & Tithes' && t.type === TransactionType.INCOME);
    const snacks = weekTrans.filter(t => t.category === 'Snacks & Meals' && t.type === TransactionType.EXPENSE);
    
    // Calculate totals
    const totalIncome = weekTrans.filter(t => t.type === TransactionType.INCOME).reduce((acc, t) => acc + t.amount, 0);
    const totalExpense = weekTrans.filter(t => t.type === TransactionType.EXPENSE).reduce((acc, t) => acc + t.amount, 0);
    
    // Cash Specifics
    const cashIncome = offerings.filter(t => t.accountId === AccountType.CASH).reduce((acc, t) => acc + t.amount, 0);
    const cashExpense = snacks.filter(t => t.accountId === AccountType.CASH).reduce((acc, t) => acc + t.amount, 0);
    const cashBalance = cashIncome - cashExpense;

    return {
        totalIncome,
        totalExpense,
        offerings: {
          cash: cashIncome,
          momo: offerings.filter(t => t.accountId === AccountType.MOMO).reduce((acc, t) => acc + t.amount, 0)
        },
        snacks: {
          cash: cashExpense,
          momo: snacks.filter(t => t.accountId === AccountType.MOMO).reduce((acc, t) => acc + t.amount, 0)
        },
        cashBalance, // The "Spent Value" or "Net Position" requested
        range: `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`
    };
  }, [transactions, selectedWeekDate]);

  // --- Data Calculations: Analytical (Monthly/Quarterly/Yearly) ---
  const analyticalData = useMemo(() => {
    let filtered = transactions.filter(t => !t.isArchived && new Date(t.date).getFullYear() === selectedYear);
    let chartData: { name: string, income: number, expense: number, sortOrder: number }[] = [];
    
    if (activeTab === 'MONTHLY') {
        filtered = filtered.filter(t => new Date(t.date).getMonth() === selectedMonth);
        filtered.forEach(t => {
            const d = new Date(t.date);
            const weekNum = Math.ceil(d.getDate() / 7);
            const key = `Week ${weekNum}`;
            const existing = chartData.find(c => c.name === key);
            if (existing) {
                if (t.type === TransactionType.INCOME) existing.income += t.amount;
                if (t.type === TransactionType.EXPENSE) existing.expense += t.amount;
            } else {
                chartData.push({ name: key, income: t.type === TransactionType.INCOME ? t.amount : 0, expense: t.type === TransactionType.EXPENSE ? t.amount : 0, sortOrder: weekNum });
            }
        });
    } else if (activeTab === 'QUARTERLY') {
        [1, 2, 3, 4].forEach(q => chartData.push({ name: `Q${q}`, income: 0, expense: 0, sortOrder: q }));
        filtered.forEach(t => {
            const month = new Date(t.date).getMonth();
            const q = Math.floor(month / 3) + 1;
            const entry = chartData.find(c => c.name === `Q${q}`);
            if (entry) {
                 if (t.type === TransactionType.INCOME) entry.income += t.amount;
                 if (t.type === TransactionType.EXPENSE) entry.expense += t.amount;
            }
        });
    } else if (activeTab === 'YEARLY') {
        Array.from({ length: 12 }).forEach((_, i) => chartData.push({ name: new Date(2000, i, 1).toLocaleString('default', { month: 'short' }), income: 0, expense: 0, sortOrder: i }));
        filtered.forEach(t => {
            const month = new Date(t.date).getMonth();
            const entry = chartData[month];
            if (entry) {
                 if (t.type === TransactionType.INCOME) entry.income += t.amount;
                 if (t.type === TransactionType.EXPENSE) entry.expense += t.amount;
            }
        });
    }
    chartData.sort((a,b) => a.sortOrder - b.sortOrder);

    const totalIncome = filtered.filter(t => t.type === TransactionType.INCOME).reduce((acc, t) => acc + t.amount, 0);
    const totalExpense = filtered.filter(t => t.type === TransactionType.EXPENSE).reduce((acc, t) => acc + t.amount, 0);

    const getTopCategories = (type: TransactionType) => {
        const map: Record<string, number> = {};
        filtered.filter(t => t.type === type).forEach(t => {
            map[t.category] = (map[t.category] || 0) + t.amount;
        });
        return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 3);
    };

    return {
        chartData, totalIncome, totalExpense, net: totalIncome - totalExpense,
        topIncome: getTopCategories(TransactionType.INCOME), topExpense: getTopCategories(TransactionType.EXPENSE),
        isEmpty: filtered.length === 0
    };
  }, [transactions, activeTab, selectedYear, selectedMonth]);


  // --- Handlers ---
  const handleAddOfferingInput = () => setOfferingsInput([...offeringsInput, { type: 'CASH', amount: '' }]);
  const handleRemoveOfferingInput = (idx: number) => setOfferingsInput(offeringsInput.filter((_, i) => i !== idx));
  const handleAddPlanInput = () => setPlanInput([...planInput, { item: '', cost: '' }]);
  const handleRemovePlanInput = (idx: number) => setPlanInput(planInput.filter((_, i) => i !== idx));

  // --- AI HANDLER ---
  const handleAutoPlan = async () => {
      setIsAutoPlanning(true);
      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          
          // Gather last 20 expense transactions for context
          const historyContext = transactions
            .filter(t => t.type === TransactionType.EXPENSE && t.category === 'Snacks & Meals')
            .slice(0, 20)
            .map(t => `${t.notes || 'Expense'}: ${t.amount} GHS`)
            .join('\n');

          const response = await ai.models.generateContent({
             model: "gemini-3-flash-preview",
             contents: `Based on these recent expense records, suggest 3-5 likely items for this week's plan with estimated costs. Return ONLY valid JSON.
             
             History:
             ${historyContext}`,
             config: {
                 responseMimeType: "application/json",
                 responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            item: { type: Type.STRING },
                            cost: { type: Type.STRING } // Keeping as string to match input state
                        }
                    }
                 }
             }
          });

          const jsonText = response.text;
          const suggestions = JSON.parse(jsonText);
          
          if (Array.isArray(suggestions) && suggestions.length > 0) {
              setPlanInput(suggestions);
          } else {
              alert("AI couldn't find a pattern, try adding items manually.");
          }

      } catch (e) {
          console.error(e);
          alert("Failed to generate smart plan. Please check API Key.");
      } finally {
          setIsAutoPlanning(false);
      }
  };

  const saveWeeklyData = () => {
    const today = new Date().toISOString().split('T')[0];
    const batchToAdd: Omit<Transaction, 'id'>[] = [];
    
    offeringsInput.forEach(entry => {
      if (entry.amount && Number(entry.amount) > 0) {
        batchToAdd.push({
          date: today,
          type: TransactionType.INCOME,
          category: 'Offerings & Tithes',
          amount: Number(entry.amount),
          accountId: entry.type === 'CASH' ? AccountType.CASH : AccountType.MOMO,
          isArchived: false
        });
      }
    });

    const validPlanItems = planInput.filter(p => p.item && p.cost && Number(p.cost) > 0);
    if (validPlanItems.length > 0) {
      const totalCost = validPlanItems.reduce((acc, p) => acc + Number(p.cost), 0);
      batchToAdd.push({
        date: today,
        type: TransactionType.EXPENSE,
        category: 'Snacks & Meals',
        amount: totalCost,
        accountId: AccountType.CASH,
        notes: `Planned: ${validPlanItems.map(p => p.item).join(', ')}`,
        isArchived: false,
        meta: { isPlan: true }
      });
    }

    if (batchToAdd.length > 0) {
      onAddTransaction(batchToAdd);
      alert(`Saved ${batchToAdd.length} entries.`);
      setOfferingsInput([{ type: 'CASH', amount: '' }]);
      setPlanInput([{ item: '', cost: '' }]);
    }
  };

  const handleShareClick = () => {
      // If Weekly and Cash Balance is negative, show Request Modal
      if (activeTab === 'WEEKLY' && weeklyStats.cashBalance < 0) {
          // Preset beneficiary if only 1 user with number exists
          const usersWithNumbers = users.filter(u => u.momoNumber);
          if (usersWithNumbers.length === 1) {
              setSelectedBeneficiary(usersWithNumbers[0].name);
              setBeneficiaryNumber(usersWithNumbers[0].momoNumber || '');
          }
          // Preset Finance Rep if available
          if (financeRep) {
              setSelectedFinanceRep(financeRep.name);
          }
          setIsRequestModalOpen(true);
      } else {
          generateAndOpenWhatsApp();
      }
  };

  const generateAndOpenWhatsApp = () => {
    let text = `*CM ${activeTab} Report*\n`;
    text += `${new Date().toLocaleDateString()}\n`;
    text += `---------------------------\n`;

    if (activeTab === 'WEEKLY') {
      text += `*Period:* ${weeklyStats.range}\n\n`;
      
      text += `*OFFERINGS*\n`;
      text += `Cash: ${formatCurrency(weeklyStats.offerings.cash)}\n`;
      text += `MoMo: ${formatCurrency(weeklyStats.offerings.momo)}\n\n`;
      
      text += `*EXPENSES*\n`;
      text += `Cash: ${formatCurrency(weeklyStats.snacks.cash)}\n\n`;
      //text += `MoMo: ${formatCurrency(weeklyStats.snacks.momo)}\n\n`;
      
      //text += `*SUMMARY*\n`;
      text += `Cash Balance: ${formatCurrency(weeklyStats.cashBalance)}\n\n`; // Explicitly show Cash Balance
      
      if (weeklyStats.cashBalance < 0 && selectedFinanceRep) {
           //text += `\n*URGENT REQUEST*\n`;
           text += `Dear ${selectedFinanceRep},\n`;
           text += `We have a deficit of *${formatCurrency(Math.abs(weeklyStats.cashBalance))}* for this week's purchases.\n`;
           text += `Kindly transfer this amount via MoMo to:\n`;
           text += `*Name:* ${selectedBeneficiary}\n`;
           text += `*Number:* ${beneficiaryNumber}\n\n`;
           text += `Thank you for you time and God bless you\n`;
      } else {
           text += `Net Position: ${formatCurrency(weeklyStats.totalIncome - weeklyStats.totalExpense)}\n`;
      }

    } else {
      text += `*Period:* ${selectedYear} ${activeTab === 'MONTHLY' ? getMonthName(selectedMonth) : ''}\n\n`;
      text += `Total Income: ${formatCurrency(analyticalData.totalIncome)}\n`;
      text += `Total Expense: ${formatCurrency(analyticalData.totalExpense)}\n`;
      text += `*Net Position: ${formatCurrency(analyticalData.net)}*\n\n`;
      
      if (analyticalData.topIncome.length > 0) {
        text += `*Top Income:*\n`;
        analyticalData.topIncome.forEach(i => text += `- ${i.name}: ${formatCurrency(i.value)}\n`);
        text += `\n`;
      }
      if (analyticalData.topExpense.length > 0) {
        text += `*Top Expenses:*\n`;
        analyticalData.topExpense.forEach(i => text += `- ${i.name}: ${formatCurrency(i.value)}\n`);
      }
    }

    const encodedText = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encodedText}`, '_blank');
    setIsRequestModalOpen(false); // Close modal if open
  };

  const handleBeneficiarySelect = (name: string) => {
      setSelectedBeneficiary(name);
      const user = users.find(u => u.name === name);
      if (user && user.momoNumber) {
          setBeneficiaryNumber(user.momoNumber);
      } else {
          setBeneficiaryNumber('');
      }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-[2rem] shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden">
        {/* Tab Navigation */}
        <div className="flex flex-wrap border-b border-gray-100 bg-gray-50/50">
          {(['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'] as ReportType[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 min-w-[25%] py-6 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative whitespace-nowrap ${
                activeTab === tab ? 'text-primary' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {tab}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-t-full mx-4 sm:mx-8 animate-in slide-in-from-bottom-2 duration-300" />
              )}
            </button>
          ))}
        </div>

        <div className="p-4 sm:p-6 md:p-10 min-h-[500px]">
          {/* Header Controls */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 lg:mb-10 gap-6">
            <div className="flex flex-col">
              <h3 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tighter capitalize">{activeTab.toLowerCase()} Overview</h3>
              <div className="flex items-center gap-2 mt-2">
                 {activeTab === 'WEEKLY' ? (
                     <span className="text-xs font-bold text-gray-400 flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-full w-fit">
                        <Calendar size={14} className="text-primary"/> {weeklyStats.range}
                     </span>
                 ) : (
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                        {activeTab === 'MONTHLY' ? getMonthName(selectedMonth) : ''} {selectedYear}
                    </span>
                 )}
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
               {activeTab !== 'WEEKLY' && (
                   <div className="flex gap-2">
                        {activeTab === 'MONTHLY' && (
                             <div className="relative flex-1 sm:flex-none">
                                <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} className="w-full appearance-none bg-gray-50 border border-gray-200 text-gray-700 text-xs font-black uppercase tracking-widest py-4 pl-4 pr-10 rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/10 cursor-pointer">
                                    {Array.from({length: 12}).map((_, i) => <option key={i} value={i}>{getMonthName(i)}</option>)}
                                </select>
                                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                             </div>
                        )}
                        <div className="relative flex-1 sm:flex-none">
                            <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="w-full appearance-none bg-gray-50 border border-gray-200 text-gray-700 text-xs font-black uppercase tracking-widest py-4 pl-4 pr-10 rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/10 cursor-pointer">
                                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        </div>
                   </div>
               )}

              {activeTab === 'WEEKLY' && (
                <input type="date" className="p-3 border border-gray-200 rounded-2xl text-sm font-bold bg-white focus:ring-4 focus:ring-primary/10 outline-none w-full sm:w-auto"
                  value={selectedWeekDate} onChange={(e) => setSelectedWeekDate(e.target.value)} />
              )}
              
              <button 
                onClick={handleShareClick}
                className="flex items-center justify-center px-6 py-4 bg-[#25D366] text-white text-xs font-black uppercase tracking-widest rounded-2xl hover:bg-[#128C7E] transition-all shadow-xl whitespace-nowrap active:scale-95"
              >
                <MessageCircle size={18} className="mr-2" /> Share on WhatsApp
              </button>
            </div>
          </div>

          {/* --- WEEKLY VIEW CONTENT --- */}
          {activeTab === 'WEEKLY' && (
            <div className="space-y-8 sm:space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                <div className="bg-emerald-50/50 p-6 sm:p-8 rounded-[1.5rem] sm:rounded-3xl border border-emerald-100 relative overflow-hidden group">
                  <TrendingUp className="absolute -bottom-4 -right-4 text-emerald-200 opacity-20" size={120} />
                  <h4 className="text-[10px] font-black text-emerald-700 uppercase tracking-widest mb-6">Sunday Offerings</h4>
                  <div className="space-y-3 relative z-10">
                    <div className="flex justify-between border-b border-emerald-100 pb-2">
                      <span className="text-xs font-bold text-emerald-600">CASH</span>
                      <span className="font-mono font-bold text-emerald-900">{formatCurrency(weeklyStats.offerings.cash)}</span>
                    </div>
                    <div className="flex justify-between border-b border-emerald-100 pb-2">
                      <span className="text-xs font-bold text-emerald-600">MoMo</span>
                      <span className="font-mono font-bold text-emerald-900">{formatCurrency(weeklyStats.offerings.momo)}</span>
                    </div>
                    <div className="pt-2 flex justify-between items-center">
                      <span className="text-sm font-black text-emerald-900">TOTAL</span>
                      <span className="text-2xl font-black text-emerald-950">{formatCurrency(weeklyStats.totalIncome)}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-rose-50/50 p-6 sm:p-8 rounded-[1.5rem] sm:rounded-3xl border border-rose-100 relative overflow-hidden group">
                  <TrendingDown className="absolute -bottom-4 -right-4 text-rose-200 opacity-20" size={120} />
                  <h4 className="text-[10px] font-black text-rose-700 uppercase tracking-widest mb-6">Expenses</h4>
                  <div className="space-y-3 relative z-10">
                    <div className="flex justify-between border-b border-rose-100 pb-2">
                      <span className="text-xs font-bold text-rose-600">CASH</span>
                      <span className="font-mono font-bold text-rose-900">{formatCurrency(weeklyStats.snacks.cash)}</span>
                    </div>
                    <div className="flex justify-between border-b border-rose-100 pb-2">
                      <span className="text-xs font-bold text-rose-600">MoMo</span>
                      <span className="font-mono font-bold text-rose-900">{formatCurrency(weeklyStats.snacks.momo)}</span>
                    </div>
                    <div className="pt-2 flex justify-between items-center">
                      <span className="text-sm font-black text-rose-900">SPENT</span>
                      <span className="text-2xl font-black text-rose-950">{formatCurrency(weeklyStats.totalExpense)}</span>
                    </div>
                  </div>
                </div>

                {/* Modified Summary Card for Cash Balance */}
                <div className="bg-gray-900 p-6 sm:p-8 rounded-[1.5rem] sm:rounded-3xl flex flex-col justify-between md:col-span-2 lg:col-span-1 shadow-2xl">
                  <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Cash Position</h4>
                  <p className={`text-4xl font-black tracking-tighter my-4 ${weeklyStats.cashBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {formatCurrency(weeklyStats.cashBalance)}
                  </p>
                  <div className="bg-white/10 p-3 rounded-2xl text-[10px] text-gray-300 font-bold text-center uppercase tracking-widest flex items-center justify-center gap-2">
                      {weeklyStats.cashBalance < 0 && <AlertTriangle size={12} className="text-rose-400" />}
                      {weeklyStats.cashBalance < 0 ? 'Top-up Required' : 'Cash Surplus'}
                  </div>
                </div>
              </div>

              {/* Weekly Input Section - Optimized for Mobile */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
                {/* Income Inputs */}
                <div className="bg-white border-2 border-emerald-50 rounded-[2rem] shadow-sm p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-600"><Plus size={20}/></div>
                    <h3 className="font-black text-emerald-900 uppercase tracking-widest text-xs">Offerings</h3>
                  </div>
                  <div className="space-y-4">
                    {offeringsInput.map((entry, idx) => (
                      <div key={idx} className="p-3 bg-gray-50/50 rounded-2xl border border-gray-100 flex gap-3 items-center">
                        <select className="p-2 bg-white rounded-xl border border-gray-100 text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-emerald-500/10 w-20" value={entry.type} onChange={(e) => { const n = [...offeringsInput]; n[idx].type = e.target.value as any; setOfferingsInput(n); }}>
                          <option value="CASH">CASH</option>
                          <option value="MOMO">MOMO</option>
                        </select>
                        <input type="number" placeholder="0.00" className="flex-1 p-2 bg-transparent text-sm font-bold outline-none" value={entry.amount} onChange={(e) => { const n = [...offeringsInput]; n[idx].amount = e.target.value; setOfferingsInput(n); }} />
                        {offeringsInput.length > 1 && <button onClick={() => handleRemoveOfferingInput(idx)} className="p-2 text-rose-400 hover:text-rose-600"><Trash2 size={16} /></button>}
                      </div>
                    ))}
                    <button onClick={handleAddOfferingInput} className="w-full py-3 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-colors">+ Add Source</button>
                  </div>
                </div>

                {/* Planning Inputs */}
                <div className="bg-white border-2 border-primary/5 rounded-[2rem] shadow-sm p-6 relative">
                  <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-primary/5 rounded-xl text-primary"><PieChart size={20}/></div>
                        <h3 className="font-black text-primary uppercase tracking-widest text-xs">Expenses</h3>
                      </div>
                      
                      {/* AI AUTO PLAN BUTTON */}
                      <button 
                        onClick={handleAutoPlan} 
                        disabled={isAutoPlanning}
                        className="flex items-center gap-2 px-3 py-1.5 bg-violet-100 text-violet-700 rounded-full text-[9px] font-black uppercase tracking-widest hover:bg-violet-200 transition-colors disabled:opacity-50"
                      >
                         {isAutoPlanning ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                         {isAutoPlanning ? 'Thinking...' : 'Smart Plan'}
                      </button>
                  </div>

                  <div className="space-y-4">
                    {planInput.map((entry, idx) => (
                      <div key={idx} className="p-3 bg-gray-50/50 rounded-2xl border border-gray-100 flex flex-col gap-2">
                        <input type="text" placeholder="Item Description" className="w-full p-2 bg-white rounded-xl border border-gray-100 text-xs font-bold outline-none" value={entry.item} onChange={(e) => { const n = [...planInput]; n[idx].item = e.target.value; setPlanInput(n); }} />
                        <div className="flex gap-2 items-center">
                            <span className="text-gray-400 text-xs font-bold pl-2">GHS</span>
                             <input type="number" placeholder="0.00" className="flex-1 p-2 bg-transparent text-sm font-bold outline-none" value={entry.cost} onChange={(e) => { const n = [...planInput]; n[idx].cost = e.target.value; setPlanInput(n); }} />
                            {planInput.length > 1 && <button onClick={() => handleRemovePlanInput(idx)} className="p-2 text-rose-400 hover:text-rose-600"><Trash2 size={16} /></button>}
                        </div>
                      </div>
                    ))}
                    <button onClick={handleAddPlanInput} className="w-full py-3 bg-primary/5 text-primary rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary/10 transition-colors">+ Add Item</button>
                  </div>
                </div>
              </div>

              <div className="flex justify-center xl:justify-end pb-10 sm:pb-0">
                <button onClick={saveWeeklyData} className="w-full sm:w-auto px-12 py-5 bg-primary text-white text-xs font-black uppercase tracking-[0.2em] rounded-[2rem] shadow-2xl shadow-primary/40 hover:bg-teal-800 hover:scale-105 active:scale-95 transition-all">
                  <Save size={20} className="inline mr-3"/> Commit Weekly Report
                </button>
              </div>
            </div>
          )}

          {/* --- ANALYTICAL VIEWS (Monthly, Quarterly, Yearly) --- */}
          {activeTab !== 'WEEKLY' && (
             <div className="animate-in fade-in duration-500 space-y-8">
                {analyticalData.isEmpty ? (
                    <div className="flex flex-col items-center justify-center py-20">
                         <div className="p-8 bg-gray-50 rounded-[3rem] mb-6 animate-pulse">
                            <BarChart2 size={60} className="text-gray-200" />
                        </div>
                        <p className="text-lg font-black text-gray-900 tracking-tighter uppercase">No Financial Data</p>
                        <p className="text-xs text-gray-400 mt-2">There are no records for this period.</p>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                            <div className="bg-emerald-50/50 p-6 rounded-[2rem] border border-emerald-100">
                                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Period Income</p>
                                <p className="text-3xl font-black text-emerald-900 mt-2 tracking-tighter">{formatCurrency(analyticalData.totalIncome)}</p>
                            </div>
                            <div className="bg-rose-50/50 p-6 rounded-[2rem] border border-rose-100">
                                <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest">Period Expenses</p>
                                <p className="text-3xl font-black text-rose-900 mt-2 tracking-tighter">{formatCurrency(analyticalData.totalExpense)}</p>
                            </div>
                            <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-lg shadow-gray-100">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Net Balance</p>
                                <p className={`text-3xl font-black mt-2 tracking-tighter ${analyticalData.net >= 0 ? 'text-primary' : 'text-rose-500'}`}>{formatCurrency(analyticalData.net)}</p>
                            </div>
                        </div>

                        <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] shadow-xl shadow-gray-100 border border-gray-100">
                            <h4 className="text-sm font-black text-gray-900 uppercase tracking-widest mb-6 flex items-center gap-2"><TrendingUp size={16} className="text-primary"/> Financial Trend Analysis</h4>
                            <div className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={analyticalData.chartData} barSize={20}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 10}} dy={10} />
                                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 10}} />
                                        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} formatter={(value: number) => formatCurrency(value)} cursor={{fill: '#f9fafb'}} />
                                        <Legend iconType="circle" wrapperStyle={{paddingTop: '20px'}} />
                                        <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="expense" name="Expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] shadow-xl shadow-gray-100 border border-gray-100">
                                 <h4 className="text-xs font-black text-emerald-700 uppercase tracking-widest mb-6 flex items-center gap-2"><Target size={16}/> Top Income Sources</h4>
                                <div className="space-y-6">
                                    {analyticalData.topIncome.map((item, idx) => (
                                        <div key={idx} className="space-y-2">
                                            <div className="flex justify-between items-center text-sm"><span className="font-bold text-gray-700">{item.name}</span><span className="font-black text-emerald-600">{formatCurrency(item.value)}</span></div>
                                            <div className="h-2 w-full bg-emerald-50 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 rounded-full transition-all duration-1000" style={{ width: `${(item.value / analyticalData.totalIncome) * 100}%` }}/></div>
                                        </div>
                                    ))}
                                    {analyticalData.topIncome.length === 0 && <p className="text-gray-400 text-xs italic">No income data available.</p>}
                                </div>
                            </div>
                            <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] shadow-xl shadow-gray-100 border border-gray-100">
                                 <h4 className="text-xs font-black text-rose-700 uppercase tracking-widest mb-6 flex items-center gap-2"><Target size={16}/> Top Cost Drivers</h4>
                                <div className="space-y-6">
                                    {analyticalData.topExpense.map((item, idx) => (
                                        <div key={idx} className="space-y-2">
                                            <div className="flex justify-between items-center text-sm"><span className="font-bold text-gray-700">{item.name}</span><span className="font-black text-rose-600">{formatCurrency(item.value)}</span></div>
                                            <div className="h-2 w-full bg-rose-50 rounded-full overflow-hidden"><div className="h-full bg-rose-500 rounded-full transition-all duration-1000" style={{ width: `${(item.value / analyticalData.totalExpense) * 100}%` }}/></div>
                                        </div>
                                    ))}
                                    {analyticalData.topExpense.length === 0 && <p className="text-gray-400 text-xs italic">No expense data available.</p>}
                                </div>
                            </div>
                        </div>
                    </>
                )}
             </div>
          )}
        </div>
      </div>

      {/* Cash Request Modal */}
      {isRequestModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-950/70 backdrop-blur-sm animate-in fade-in duration-300">
              <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300">
                  <div className="p-8 bg-rose-50/50 border-b border-rose-100">
                      <div className="flex items-center gap-3 mb-2">
                          <div className="p-2 bg-rose-100 rounded-full text-rose-600"><AlertTriangle size={20}/></div>
                          <h3 className="text-xl font-black text-rose-900 uppercase tracking-tight">Cash Deficit Detected</h3>
                      </div>
                      <p className="text-rose-700 text-sm font-medium">
                          You need <span className="font-black">{formatCurrency(Math.abs(weeklyStats.cashBalance))}</span> to cover expenses.
                      </p>
                  </div>
                  <div className="p-8 space-y-6">
                      <div>
                          <label className="text-[10px] font-black text-gray-400 mb-2 block uppercase tracking-widest">Request From (Finance)</label>
                          <div className="relative">
                              <UserIcon size={16} className="absolute left-4 top-4 text-gray-400" />
                              <input 
                                  list="finance-reps"
                                  className="w-full p-4 pl-12 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-primary/10"
                                  placeholder="Select or Type Name..."
                                  value={selectedFinanceRep}
                                  onChange={(e) => setSelectedFinanceRep(e.target.value)}
                              />
                              <datalist id="finance-reps">
                                  {users.filter(u => u.role === 'FINANCE_REP' || u.role === 'ADMIN').map(u => (
                                      <option key={u.id} value={u.name} />
                                  ))}
                              </datalist>
                          </div>
                      </div>

                      <div>
                          <label className="text-[10px] font-black text-gray-400 mb-2 block uppercase tracking-widest">Send MoMo To (Beneficiary)</label>
                          <div className="space-y-3">
                                <div className="relative">
                                    <UserIcon size={16} className="absolute left-4 top-4 text-gray-400" />
                                    <input 
                                        list="beneficiaries"
                                        className="w-full p-4 pl-12 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-primary/10"
                                        placeholder="Select or Type Name..."
                                        value={selectedBeneficiary}
                                        onChange={(e) => handleBeneficiarySelect(e.target.value)}
                                    />
                                    <datalist id="beneficiaries">
                                        {users.map(u => (
                                            <option key={u.id} value={u.name} />
                                        ))}
                                    </datalist>
                                </div>
                                <input 
                                    type="text"
                                    className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-primary/10"
                                    placeholder="MoMo Number"
                                    value={beneficiaryNumber}
                                    onChange={(e) => setBeneficiaryNumber(e.target.value)}
                                />
                          </div>
                      </div>

                      <button 
                          onClick={generateAndOpenWhatsApp}
                          disabled={!selectedFinanceRep || !selectedBeneficiary || !beneficiaryNumber}
                          className="w-full py-4 bg-[#25D366] text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-[#128C7E] transition-all shadow-xl active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                          <Send size={16} /> Generate Request
                      </button>
                      
                      <button 
                        onClick={() => setIsRequestModalOpen(false)}
                        className="w-full py-3 text-gray-400 text-[10px] font-black uppercase tracking-widest hover:text-gray-600"
                      >
                          Cancel
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Reports;