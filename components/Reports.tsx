import React, { useState, useMemo, useEffect } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { Transaction, TransactionType, User, AccountType } from '../types';
import { formatCurrency } from '../utils';
import { FileText, Calendar, TrendingUp, TrendingDown, Plus, Save, Trash2, Download, PieChart, ChevronDown, BarChart2, Target, MessageCircle, AlertTriangle, X, Check, User as UserIcon, Send, Sparkles, Loader2, RefreshCw, ArrowRightLeft } from 'lucide-react';
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
  const [selectedQuarter, setSelectedQuarter] = useState<number>(Math.floor(new Date().getMonth() / 3) + 1);
  
  // Weekly Custom Range State
  const [selectedWeekDate, setSelectedWeekDate] = useState(new Date().toISOString().split('T')[0]);
  const [customWeekStart, setCustomWeekStart] = useState('');
  const [customWeekEnd, setCustomWeekEnd] = useState('');


  // WhatsApp Request Flow State
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [selectedFinanceRep, setSelectedFinanceRep] = useState<string>(''); 
  const [selectedBeneficiary, setSelectedBeneficiary] = useState<string>(''); 
  const [beneficiaryNumber, setBeneficiaryNumber] = useState<string>(''); 

  // AI Loading State
  const [isAutoPlanning, setIsAutoPlanning] = useState(false);

  // --- Weekly Input States ---
  const [offeringsInput, setOfferingsInput] = useState<{type: 'CASH' | 'MOMO', amount: string}[]>([
    { type: 'CASH', amount: '' }
  ]);
  
  // Expenses State: Global Source + List of Items
  const [expenseSource, setExpenseSource] = useState<'MOMO' | 'CASH'>('MOMO');
  const [planInput, setPlanInput] = useState<{item: string, cost: string}[]>([
    { item: '', cost: '' }
  ]);

  // --- Helpers ---
  const getMonthName = (monthIndex: number) => {
    return new Date(2025, monthIndex, 1).toLocaleString('default', { month: 'long' });
  };

  const getQuarterRangeName = (quarterIndex: number) => {
      const startMonth = (quarterIndex - 1) * 3;
      const endMonth = startMonth + 2;
      const start = new Date(2025, startMonth, 1).toLocaleString('default', { month: 'short' });
      const end = new Date(2025, endMonth, 1).toLocaleString('default', { month: 'short' });
      return `${start} - ${end}`;
  };

  const getWeekRange = (dateStr: string) => {
    const date = new Date(dateStr);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(date.setDate(diff));
    const saturday = new Date(date.setDate(monday.getDate() + 5)); // Mon to Sat
    monday.setHours(0,0,0,0);
    saturday.setHours(23,59,59,999);
    return { start: monday, end: saturday };
  };

  // Sync custom dates when main date picker changes
  useEffect(() => {
      const { start, end } = getWeekRange(selectedWeekDate);
      setCustomWeekStart(start.toISOString().split('T')[0]);
      setCustomWeekEnd(end.toISOString().split('T')[0]);
  }, [selectedWeekDate]);

  const availableYears = useMemo(() => {
    const years = new Set<number>(transactions.map(t => new Date(t.date).getFullYear()));
    years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [transactions]);

  // --- Data Calculations: Weekly ---
  const weeklyStats = useMemo(() => {
    // Use custom range if set, otherwise fallback to calculated range
    const start = customWeekStart ? new Date(customWeekStart) : getWeekRange(selectedWeekDate).start;
    const end = customWeekEnd ? new Date(customWeekEnd) : getWeekRange(selectedWeekDate).end;
    
    // Ensure end of day for the end date
    end.setHours(23,59,59,999);
    start.setHours(0,0,0,0);

    const weekTrans = transactions.filter(t => {
      const d = new Date(t.date);
      return !t.isArchived && d >= start && d <= end;
    });

    // P&L TOTALS (Exclude Transfers)
    const totalIncome = weekTrans.filter(t => t.type === TransactionType.INCOME).reduce((acc, t) => acc + t.amount, 0);
    const totalExpense = weekTrans.filter(t => t.type === TransactionType.EXPENSE).reduce((acc, t) => acc + t.amount, 0);
    
    // Detailed Breakdown
    const offerings = weekTrans.filter(t => t.category === 'Offerings & Tithes' && t.type === TransactionType.INCOME);
    const snacks = weekTrans.filter(t => t.category === 'Snacks & Meals' && t.type === TransactionType.EXPENSE);
    
    const offeringsCash = offerings.filter(t => t.accountId === AccountType.CASH).reduce((acc, t) => acc + t.amount, 0);
    const offeringsMomo = offerings.filter(t => t.accountId === AccountType.MOMO).reduce((acc, t) => acc + t.amount, 0);
    
    const snacksCash = snacks.filter(t => t.accountId === AccountType.CASH).reduce((acc, t) => acc + t.amount, 0);
    const snacksMomo = snacks.filter(t => t.accountId === AccountType.MOMO).reduce((acc, t) => acc + t.amount, 0);
    
    // --- CASH POSITION LOGIC (Double Entry Aware) ---
    const cashBalance = weekTrans.reduce((acc, t) => {
        if (t.accountId === AccountType.CASH) {
            // Money leaving Cash account
            if (t.type === TransactionType.EXPENSE || t.type === TransactionType.TRANSFER) {
                return acc - t.amount;
            }
            // Money entering Cash account (Direct Income)
            if (t.type === TransactionType.INCOME) {
                return acc + t.amount;
            }
        }
        
        // Money entering Cash account (via Transfer from somewhere else)
        if (t.type === TransactionType.TRANSFER && t.toAccountId === AccountType.CASH) {
            return acc + t.amount;
        }
        
        return acc;
    }, 0);

    return {
        totalIncome,
        totalExpense,
        offerings: { cash: offeringsCash, momo: offeringsMomo },
        snacks: { cash: snacksCash, momo: snacksMomo },
        cashBalance, 
        range: `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
    };
  }, [transactions, selectedWeekDate, customWeekStart, customWeekEnd]);

  // --- Analytical Calculations ---
  const analyticalData = useMemo(() => {
    // Filter out transfers for P&L Reporting
    let filtered = transactions.filter(t => !t.isArchived && t.type !== TransactionType.TRANSFER && new Date(t.date).getFullYear() === selectedYear);
    
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

  const handleAutoPlan = async () => {
      setIsAutoPlanning(true);
      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const historyContext = transactions
            .filter(t => t.type === TransactionType.EXPENSE && t.category === 'Snacks & Meals')
            .slice(0, 20)
            .map(t => `${t.notes || 'Expense'}: ${t.amount} GHS`)
            .join('\n');

          const response = await ai.models.generateContent({
             model: "gemini-3-flash-preview",
             contents: `Based on these recent expense records, suggest 3-4 likely items for this week's plan. Return JSON array. History: ${historyContext}`,
             config: { responseMimeType: "application/json", responseSchema: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { item: { type: Type.STRING }, cost: { type: Type.STRING } } } } }
          });
          
          const raw = JSON.parse(response.text);
          setPlanInput(raw);
      } catch (e) { console.error(e); alert("AI Auto-Plan failed."); } 
      finally { setIsAutoPlanning(false); }
  };

  const saveWeeklyData = () => {
    // Use the user-selected date (Week Date)
    const entryDate = selectedWeekDate;
    const batchToAdd: Omit<Transaction, 'id'>[] = [];
    
    // 1. Process Offerings
    offeringsInput.forEach(entry => {
      if (entry.amount && Number(entry.amount) > 0) {
        // Record Income
        batchToAdd.push({
          date: entryDate,
          type: TransactionType.INCOME,
          category: 'Offerings & Tithes',
          amount: Number(entry.amount),
          accountId: entry.type === 'CASH' ? AccountType.CASH : AccountType.MOMO,
          isArchived: false
        });

        // 2. Auto-Sweep Logic: If Cash, Transfer to MoMo immediately with specific note
        if (entry.type === 'CASH') {
            batchToAdd.push({
                date: entryDate,
                type: TransactionType.TRANSFER,
                category: 'Finance Transfer',
                amount: Number(entry.amount),
                accountId: AccountType.CASH, // Source
                toAccountId: AccountType.MOMO, // Dest
                notes: 'Offering cash at hand transferred',
                isArchived: false
            });
        }
      }
    });

    // 3. Process Expenses (Recorded against Global Source as a single consolidated transaction)
    const validPlanItems = planInput.filter(p => p.item && p.cost && Number(p.cost) > 0);
    if (validPlanItems.length > 0) {
      // Use the global expenseSource for all items in this batch
      const accountForExpenses = expenseSource === 'CASH' ? AccountType.CASH : AccountType.MOMO;

      const totalAmount = validPlanItems.reduce((sum, item) => sum + Number(item.cost), 0);
      const itemNotes = validPlanItems.map(p => p.item).join(', ');

      batchToAdd.push({
          date: entryDate,
          type: TransactionType.EXPENSE,
          category: 'Snacks & Meals',
          amount: totalAmount,
          accountId: accountForExpenses,
          notes: `Weekly Items: ${itemNotes}`,
          isArchived: false,
          meta: { 
              isPlan: true, 
              breakdown: validPlanItems.map(p => ({ item: p.item, amount: Number(p.cost) })) 
          }
      });
    }

    if (batchToAdd.length > 0) {
      onAddTransaction(batchToAdd);
      alert(`Saved ${batchToAdd.length} entries. Cash offerings have been auto-transferred to MoMo.`);
      setOfferingsInput([{ type: 'CASH', amount: '' }]);
      setPlanInput([{ item: '', cost: '' }]);
    }
  };

  const handleShareClick = () => {
      if (activeTab === 'WEEKLY') {
          // Do not prefill users - User must select
          setSelectedFinanceRep("");
          setSelectedBeneficiary("");
          setBeneficiaryNumber("");
          
          setIsRequestModalOpen(true);
      } else {
          generateAndOpenWhatsApp();
      }
  };

  const generateAndOpenWhatsApp = () => {
    // Generate DD/MM/YYYY Format
    const reportDate = new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });

    let text = `*CM ${activeTab} Report*\n`;
    text += `${reportDate}\n`;
    text += `---------------------------\n`;

    if (activeTab === 'WEEKLY') {
      text += `*OFFERINGS*\nCash: ${formatCurrency(weeklyStats.offerings.cash)}\nMoMo: ${formatCurrency(weeklyStats.offerings.momo)}\n\n*Total Offerings: ${formatCurrency(weeklyStats.totalIncome)}*\n\n`;
      
      text += `*EXPENSES*\n`;
      const start = customWeekStart ? new Date(customWeekStart) : getWeekRange(selectedWeekDate).start;
      const end = customWeekEnd ? new Date(customWeekEnd) : getWeekRange(selectedWeekDate).end;
      end.setHours(23,59,59,999);
      
      const weeklyExpenses = transactions.filter(t => !t.isArchived && t.type === TransactionType.EXPENSE && new Date(t.date) >= start && new Date(t.date) <= end);

      if (weeklyExpenses.length > 0) {
          weeklyExpenses.forEach(t => {
              if (t.meta?.breakdown && Array.isArray(t.meta.breakdown)) {
                  t.meta.breakdown.forEach((item: {item: string, amount: number}) => text += `- ${item.item}: ${formatCurrency(item.amount)} (${t.accountId})\n`);
              } else {
                  text += `- ${t.notes || t.category}: ${formatCurrency(t.amount)} (${t.accountId})\n`;
              }
          });
      } else { text += `No expenses recorded.\n`; }
      
      text += `\n*Total Expenses: ${formatCurrency(weeklyStats.totalExpense)}*\n\n`;
      
      // Request Section - Always based on Total Expenses now
      text += `Hello @${selectedFinanceRep}, `;
      text += `could you kindly send *${formatCurrency(weeklyStats.totalExpense)}* to ${beneficiaryNumber} (${selectedBeneficiary}) for the purchase of the above expenses for CM?\n`;

    } else if (activeTab === 'QUARTERLY') {
        const qName = `Q${selectedQuarter}`;
        const qRange = getQuarterRangeName(selectedQuarter);
        const qData = analyticalData.chartData.find(d => d.name === qName);
        
        text += `*Quarterly Report: ${qName}*\n`;
        text += `Period: ${qRange} ${selectedYear}\n\n`;
        
        if (qData) {
            text += `Income: ${formatCurrency(qData.income)}\n`;
            text += `Expense: ${formatCurrency(qData.expense)}\n`;
            text += `*Net: ${formatCurrency(qData.income - qData.expense)}*\n`;
        } else {
            text += `No data available for ${qName}.\n`;
        }

    } else {
      text += `*Period:* ${selectedYear} ${activeTab === 'MONTHLY' ? getMonthName(selectedMonth) : ''}\n\n`;
      text += `Income: ${formatCurrency(analyticalData.totalIncome)}\nExpense: ${formatCurrency(analyticalData.totalExpense)}\n*Net: ${formatCurrency(analyticalData.net)}*\n`;
    }

    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    setIsRequestModalOpen(false); 
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-[2rem] shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden">
        {/* Tab Navigation */}
        <div className="flex flex-wrap border-b border-gray-100 bg-gray-50/50">
          {(['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'] as ReportType[]).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 min-w-[25%] py-6 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative whitespace-nowrap ${activeTab === tab ? 'text-primary' : 'text-gray-400 hover:text-gray-600'}`}>
              {tab}
              {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-t-full mx-4 sm:mx-8 animate-in slide-in-from-bottom-2 duration-300" />}
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
                        {activeTab === 'MONTHLY' ? getMonthName(selectedMonth) : ''} 
                        {activeTab === 'QUARTERLY' ? `Q${selectedQuarter} (${getQuarterRangeName(selectedQuarter)})` : ''}
                        {' '}{selectedYear}
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
                        {activeTab === 'QUARTERLY' && (
                             <div className="relative flex-1 sm:flex-none">
                                <select value={selectedQuarter} onChange={(e) => setSelectedQuarter(Number(e.target.value))} className="w-full appearance-none bg-gray-50 border border-gray-200 text-gray-700 text-xs font-black uppercase tracking-widest py-4 pl-4 pr-10 rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/10 cursor-pointer">
                                    {[1, 2, 3, 4].map(q => <option key={q} value={q}>Q{q} ({getQuarterRangeName(q)})</option>)}
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
                <div className="flex flex-col sm:flex-row gap-2">
                    <input type="date" title="Select Week" className="p-3 border border-gray-200 rounded-2xl text-sm font-bold bg-white focus:ring-4 focus:ring-primary/10 outline-none w-full sm:w-auto"
                      value={selectedWeekDate} onChange={(e) => setSelectedWeekDate(e.target.value)} />
                    
                    <div className="flex items-center gap-1 bg-gray-50 rounded-2xl p-1 border border-gray-100">
                        <input type="date" className="bg-transparent text-[10px] font-bold outline-none p-2 w-24 text-gray-500" 
                            value={customWeekStart} onChange={(e) => setCustomWeekStart(e.target.value)} />
                        <span className="text-gray-300">-</span>
                        <input type="date" className="bg-transparent text-[10px] font-bold outline-none p-2 w-24 text-gray-500" 
                            value={customWeekEnd} onChange={(e) => setCustomWeekEnd(e.target.value)} />
                    </div>
                </div>
              )}
              
              <button onClick={handleShareClick} className="flex items-center justify-center px-6 py-4 bg-[#25D366] text-white text-xs font-black uppercase tracking-widest rounded-2xl hover:bg-[#128C7E] transition-all shadow-xl whitespace-nowrap active:scale-95">
                <MessageCircle size={18} className="mr-2" /> Share on WhatsApp
              </button>
            </div>
          </div>

          {/* --- WEEKLY VIEW CONTENT --- */}
          {activeTab === 'WEEKLY' && (
            <div className="space-y-8 sm:space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
              {/* Stats Grid - Adjusted to 2 columns */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                <div className="bg-emerald-50/50 p-6 sm:p-8 rounded-[1.5rem] sm:rounded-3xl border border-emerald-100 relative overflow-hidden group">
                  <TrendingUp className="absolute -bottom-4 -right-4 text-emerald-200 opacity-20" size={120} />
                  <h4 className="text-[10px] font-black text-emerald-700 uppercase tracking-widest mb-6">Sunday Offerings</h4>
                  <div className="space-y-3 relative z-10">
                    <div className="flex justify-between border-b border-emerald-100 pb-2"><span className="text-xs font-bold text-emerald-600">CASH</span><span className="font-mono font-bold text-emerald-900">{formatCurrency(weeklyStats.offerings.cash)}</span></div>
                    <div className="flex justify-between border-b border-emerald-100 pb-2"><span className="text-xs font-bold text-emerald-600">MoMo</span><span className="font-mono font-bold text-emerald-900">{formatCurrency(weeklyStats.offerings.momo)}</span></div>
                    <div className="pt-2 flex justify-between items-center"><span className="text-sm font-black text-emerald-900">TOTAL INCOME</span><span className="text-2xl font-black text-emerald-950">{formatCurrency(weeklyStats.totalIncome)}</span></div>
                  </div>
                </div>

                <div className="bg-rose-50/50 p-6 sm:p-8 rounded-[1.5rem] sm:rounded-3xl border border-rose-100 relative overflow-hidden group">
                  <TrendingDown className="absolute -bottom-4 -right-4 text-rose-200 opacity-20" size={120} />
                  <h4 className="text-[10px] font-black text-rose-700 uppercase tracking-widest mb-6">Weekly Expenses</h4>
                  <div className="space-y-3 relative z-10">
                    <div className="flex justify-between border-b border-rose-100 pb-2"><span className="text-xs font-bold text-rose-600">CASH</span><span className="font-mono font-bold text-rose-900">{formatCurrency(weeklyStats.snacks.cash)}</span></div>
                    <div className="flex justify-between border-b border-rose-100 pb-2"><span className="text-xs font-bold text-rose-600">MoMo</span><span className="font-mono font-bold text-rose-900">{formatCurrency(weeklyStats.snacks.momo)}</span></div>
                    <div className="pt-2 flex justify-between items-center"><span className="text-sm font-black text-rose-900">TOTAL SPENT</span><span className="text-2xl font-black text-rose-950">{formatCurrency(weeklyStats.totalExpense)}</span></div>
                  </div>
                </div>
              </div>

              {/* Weekly Input Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
                {/* Offerings Input Card */}
                <div className="bg-white border-2 border-emerald-50 rounded-[2rem] shadow-sm p-6">
                  <div className="flex items-center gap-3 mb-6"><div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-600"><Plus size={20}/></div><h3 className="font-black text-emerald-900 uppercase tracking-widest text-xs">Offerings</h3></div>
                  <div className="space-y-4">
                    {offeringsInput.map((entry, idx) => (
                      <div key={idx} className="p-3 bg-gray-50/50 rounded-2xl border border-gray-100 flex gap-3 items-center">
                        <select className="p-2 bg-white rounded-xl border border-gray-100 text-[10px] font-black uppercase tracking-widest outline-none w-20 shrink-0" value={entry.type} onChange={(e) => { const n = [...offeringsInput]; n[idx].type = e.target.value as any; setOfferingsInput(n); }}>
                          <option value="CASH">CASH</option><option value="MOMO">MOMO</option>
                        </select>
                        <input type="number" placeholder="0.00" className="flex-1 min-w-0 p-2 bg-transparent text-sm font-bold outline-none" value={entry.amount} onChange={(e) => { const n = [...offeringsInput]; n[idx].amount = e.target.value; setOfferingsInput(n); }} />
                        
                        {/* Always show delete button if more than 1 item, formatted for mobile */}
                        {offeringsInput.length > 1 && (
                            <button onClick={() => handleRemoveOfferingInput(idx)} className="p-2.5 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-100 shrink-0 active:scale-95 transition-transform">
                                <Trash2 size={16} />
                            </button>
                        )}
                      </div>
                    ))}
                    <button onClick={handleAddOfferingInput} className="w-full py-3 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-colors">+ Add Source</button>
                  </div>
                </div>

                {/* Expenses Input Card */}
                <div className="bg-white border-2 border-primary/5 rounded-[2rem] shadow-sm p-6 relative">
                  <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                          <div className="p-2.5 bg-primary/5 rounded-xl text-primary"><PieChart size={20}/></div>
                          <div>
                             <h3 className="font-black text-primary uppercase tracking-widest text-xs">Expenses</h3>
                             <div className="flex items-center gap-1 mt-1">
                                <span className="text-[9px] font-bold text-gray-400">VIA</span>
                                <select 
                                    value={expenseSource}
                                    onChange={(e) => setExpenseSource(e.target.value as 'MOMO' | 'CASH')}
                                    className="text-[9px] font-black uppercase tracking-widest bg-gray-100 rounded-lg px-2 py-1 outline-none cursor-pointer border-none text-gray-700 hover:bg-gray-200"
                                >
                                    <option value="MOMO">MOMO</option>
                                    <option value="CASH">CASH</option>
                                </select>
                             </div>
                          </div>
                      </div>
                      <button onClick={handleAutoPlan} disabled={isAutoPlanning} className="flex items-center gap-2 px-3 py-1.5 bg-violet-100 text-violet-700 rounded-full text-[9px] font-black uppercase tracking-widest hover:bg-violet-200 transition-colors disabled:opacity-50">
                         {isAutoPlanning ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}{isAutoPlanning ? 'Thinking...' : 'Smart Plan'}
                      </button>
                  </div>

                  <div className="space-y-4">
                    {planInput.map((entry, idx) => (
                      <div key={idx} className="p-3 bg-gray-50/50 rounded-2xl border border-gray-100 flex gap-2 items-center">
                        <input type="text" placeholder="Item Description" className="flex-1 min-w-0 p-2 bg-white rounded-xl border border-gray-100 text-xs font-bold outline-none" value={entry.item} onChange={(e) => { const n = [...planInput]; n[idx].item = e.target.value; setPlanInput(n); }} />
                        <div className="flex gap-2 items-center shrink-0">
                            <span className="text-gray-400 text-xs font-bold pl-1 hidden sm:inline">GHS</span>
                            <input type="number" placeholder="0.00" className="w-20 sm:w-24 p-2 bg-transparent text-sm font-bold outline-none" value={entry.cost} onChange={(e) => { const n = [...planInput]; n[idx].cost = e.target.value; setPlanInput(n); }} />
                        </div>
                        {planInput.length > 1 && <button onClick={() => handleRemovePlanInput(idx)} className="p-2 text-rose-400 hover:text-rose-600 shrink-0"><Trash2 size={16} /></button>}
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
                         <div className="p-8 bg-gray-50 rounded-[3rem] mb-6 animate-pulse"><BarChart2 size={60} className="text-gray-200" /></div>
                         <p className="text-lg font-black text-gray-900 tracking-tighter uppercase">No Financial Data</p>
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
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Net Balance (P&L)</p>
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
                    </>
                )}
             </div>
          )}
        </div>
      </div>
      {/* Request Modal */}
      {isRequestModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-950/70 backdrop-blur-sm animate-in fade-in duration-300">
              <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300">
                  <div className="p-8 bg-blue-50/50 border-b border-blue-100">
                      <h3 className="text-xl font-black text-blue-900 uppercase tracking-tight mb-1">Expense Reimbursement</h3>
                      <p className="text-blue-700 text-sm font-medium">Requesting <span className="font-black">{formatCurrency(weeklyStats.totalExpense)}</span> for weekly expenses.</p>
                  </div>
                  <div className="p-8 space-y-6">
                      <div>
                          <label className="text-[10px] font-black text-gray-400 mb-2 block uppercase tracking-widest">Request To</label>
                          <input list="finance-reps" className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold outline-none" placeholder="Finance Rep..." value={selectedFinanceRep} onChange={(e) => setSelectedFinanceRep(e.target.value)} />
                          <datalist id="finance-reps">{users.filter(u => u.role === 'FINANCE_REP' || u.role === 'ADMIN').map(u => <option key={u.id} value={u.name} />)}</datalist>
                      </div>
                      <div>
                          <label className="text-[10px] font-black text-gray-400 mb-2 block uppercase tracking-widest">Beneficiary Account</label>
                          <input list="beneficiaries" className="w-full p-4 mb-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold outline-none" placeholder="Beneficiary Name..." value={selectedBeneficiary} onChange={(e) => { setSelectedBeneficiary(e.target.value); const u = users.find(user => user.name === e.target.value); if(u) setBeneficiaryNumber(u.momoNumber || ''); }} />
                          <datalist id="beneficiaries">{users.map(u => <option key={u.id} value={u.name} />)}</datalist>
                          <input type="text" className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold outline-none" placeholder="024..." value={beneficiaryNumber} onChange={(e) => setBeneficiaryNumber(e.target.value)} />
                      </div>
                      <button onClick={generateAndOpenWhatsApp} disabled={!selectedFinanceRep || !selectedBeneficiary} className="w-full py-4 bg-[#25D366] text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-[#128C7E] shadow-xl">Generate Request</button>
                      <button onClick={() => setIsRequestModalOpen(false)} className="w-full py-3 text-gray-400 text-[10px] font-black uppercase tracking-widest">Cancel</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Reports;