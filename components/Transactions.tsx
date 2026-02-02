import React, { useState, useEffect, useDeferredValue, useMemo } from 'react';
import { Transaction, TransactionType, AccountType, Category } from '../types';
import { formatCurrency } from '../utils';
import { Search, Plus, Save, X, Archive, ArrowRight, Calendar, CreditCard, User, FileText, ChevronRight, Eye, EyeOff, ListFilter, Filter, Edit2, Check, ArrowRightLeft } from 'lucide-react';
import { TransactionFilters } from '../App';

interface TransactionsProps {
  transactions: Transaction[];
  categories: Category[];
  accounts: AccountType[];
  initialFilters: TransactionFilters;
  onAddTransaction: (t: Omit<Transaction, 'id'> | Omit<Transaction, 'id'>[]) => void;
  onUpdateTransaction: (t: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
  filterYear: number;
}

type TabType = 'INCOME' | 'EXPENSE' | 'TRANSFER';

const SHORT_ACCOUNT_LABELS: Record<AccountType, string> = {
    [AccountType.MOMO]: 'MoMo',
    [AccountType.CASH]: 'Cash',
    [AccountType.OTHER]: 'Others'
};

// --- Sub-Components ---

// 1. Memoized History List (Refactored for Mobile Fit)
const HistoryList = React.memo(({ 
  displayedList, 
  onSelect, 
  showArchived 
}: { 
  displayedList: Transaction[], 
  onSelect: (t: Transaction) => void, 
  showArchived: boolean 
}) => {
  return (
    <div className="divide-y divide-gray-50">
        {displayedList.map(t => (
            <div 
                key={t.id} 
                onClick={() => onSelect(t)}
                className={`p-4 md:px-8 md:py-5 flex items-start gap-3 md:gap-6 transition-all cursor-pointer hover:bg-gray-50 active:scale-[0.99] group ${t.isArchived ? 'opacity-60 bg-gray-50/50 grayscale-[0.5]' : ''}`}
            >
                {/* Date Box - Compact */}
                <div className={`shrink-0 flex flex-col items-center justify-center w-12 h-12 md:w-14 md:h-14 rounded-2xl border border-gray-100 ${t.isArchived ? 'bg-gray-200' : 'bg-white shadow-sm'}`}>
                    <span className="text-[9px] font-black text-gray-400 uppercase leading-none">{new Date(t.date).toLocaleString('default', { month: 'short' }).toUpperCase()}</span>
                    <span className="text-lg md:text-xl font-black text-gray-900 leading-none mt-0.5">{new Date(t.date).getDate()}</span>
                </div>

                {/* Content Area - Stacked for Mobile, Row for Desktop */}
                <div className="flex-1 min-w-0 py-0.5">
                    {/* Top Row: Title & Amount */}
                    <div className="flex justify-between items-start mb-1">
                        <h4 className={`font-bold text-sm md:text-base truncate pr-2 ${t.isArchived ? 'text-gray-500' : 'text-gray-900'}`}>
                            {t.category}
                        </h4>
                        <span className={`text-sm md:text-lg font-black tracking-tight whitespace-nowrap ${
                            t.isArchived ? 'text-gray-400' :
                            t.type === TransactionType.INCOME ? 'text-emerald-600' : 
                            t.type === TransactionType.EXPENSE ? 'text-rose-600' : 'text-blue-600'
                        }`}>
                            {t.type === TransactionType.EXPENSE ? '-' : ''}{formatCurrency(t.amount)}
                        </span>
                    </div>

                    {/* Bottom Row: Metadata Tags */}
                    <div className="flex flex-wrap items-center gap-1.5 md:gap-2 text-[10px] md:text-xs">
                        {/* Type Badge */}
                        <span className={`px-1.5 py-0.5 rounded-md font-black uppercase tracking-wider ${
                             t.type === TransactionType.INCOME ? 'bg-emerald-50 text-emerald-700' :
                             t.type === TransactionType.EXPENSE ? 'bg-rose-50 text-rose-700' : 'bg-blue-50 text-blue-700'
                        }`}>
                            {t.type === TransactionType.TRANSFER ? 'TRANS' : t.type}
                        </span>

                        {/* Account Badge */}
                        <span className="px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-500 font-bold uppercase tracking-wider truncate max-w-[100px]">
                            {t.type === TransactionType.TRANSFER ? `${SHORT_ACCOUNT_LABELS[t.accountId] || t.accountId} → ${SHORT_ACCOUNT_LABELS[t.toAccountId!] || t.toAccountId}` : (SHORT_ACCOUNT_LABELS[t.accountId] || t.accountId)}
                        </span>

                        {/* Notes (Truncated) */}
                        {t.notes && (
                            <span className="hidden sm:inline text-gray-400 font-medium truncate max-w-[150px] md:max-w-xs border-l border-gray-200 pl-2">
                                {t.notes}
                            </span>
                        )}
                    </div>
                    {/* Mobile Only Notes Line */}
                    {t.notes && (
                        <p className="sm:hidden text-[10px] text-gray-400 mt-1 truncate font-medium">
                            {t.notes}
                        </p>
                    )}
                </div>

                {/* Desktop Arrow */}
                <ChevronRight className="hidden md:block text-gray-300 group-hover:text-primary transition-colors self-center" size={18} />
            </div>
        ))}
        {displayedList.length === 0 && (
            <div className="py-24 text-center">
                <FileText size={48} className="mx-auto text-gray-100 mb-4" />
                <p className="text-gray-400 font-bold italic">No records match your criteria.</p>
            </div>
        )}
    </div>
  );
});

// 2. Entry Form Component
const EntryForm = ({
  activeTab,
  setActiveTab,
  entries,
  handleRemoveEntry,
  handleAddEntry,
  updateEntry,
  validateAndSave,
  categories,
  accounts
}: any) => {
  return (
    <>
      <div className="flex flex-wrap border-b border-gray-100 bg-gray-50/30">
          {(['INCOME', 'EXPENSE', 'TRANSFER'] as TabType[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 min-w-[33%] py-4 md:py-6 text-[10px] font-black tracking-widest transition-all outline-none relative uppercase ${
                activeTab === tab 
                  ? tab === 'INCOME' ? 'text-emerald-600' : tab === 'EXPENSE' ? 'text-rose-600' : 'text-blue-600'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {tab}
              {activeTab === tab && (
                <div className={`absolute bottom-0 left-0 right-0 h-1 mx-4 md:mx-8 rounded-t-full animate-in slide-in-from-bottom-2 duration-300 ${
                  tab === 'INCOME' ? 'bg-emerald-500' : tab === 'EXPENSE' ? 'bg-rose-500' : 'bg-blue-500'
                }`} />
              )}
            </button>
          ))}
        </div>

        <div className="p-4 md:p-10 max-h-[75vh] md:max-h-none overflow-y-auto">
          <div className="space-y-6">
            {entries.map((entry: any, index: number) => (
              <div key={index} className="relative p-5 md:p-8 bg-gray-50/50 rounded-3xl border border-gray-200 space-y-4 md:space-y-6 shadow-inner group transition-all hover:bg-white hover:shadow-lg">
                {entries.length > 1 && (
                    <button onClick={() => handleRemoveEntry(index)} className="absolute top-2 right-2 md:top-4 md:right-4 text-gray-300 hover:text-rose-500 z-10 p-2 bg-white rounded-2xl shadow-sm border border-gray-100">
                        <X size={16} />
                    </button>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 mb-2 uppercase tracking-widest">Entry Date</label>
                    <input 
                        type="date" 
                        value={entry.date}
                        onChange={(e) => updateEntry(index, 'date', e.target.value)}
                        className="w-full rounded-2xl border-gray-100 shadow-sm focus:ring-4 focus:ring-primary/10 focus:border-primary p-3.5 border text-sm font-bold outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 mb-2 uppercase tracking-widest">GHC Amount</label>
                    <input 
                        type="number" 
                        placeholder="0.00"
                        value={entry.amount}
                        onChange={(e) => updateEntry(index, 'amount', e.target.value)}
                        className="w-full rounded-2xl border-gray-100 shadow-sm focus:ring-4 focus:ring-primary/10 focus:border-primary p-3.5 border text-sm font-bold outline-none transition-shadow duration-200"
                    />
                  </div>
                  
                  <div className="md:col-span-2">
                      <label className="block text-[10px] font-black text-gray-400 mb-2 uppercase tracking-widest">Classification</label>
                      <select 
                          value={entry.category}
                          onChange={(e) => updateEntry(index, 'category', e.target.value)}
                          className="w-full rounded-2xl border-gray-100 shadow-sm focus:ring-4 focus:ring-primary/10 focus:border-primary p-3.5 border text-sm font-bold outline-none bg-white cursor-pointer"
                      >
                          <option value="">Select Category...</option>
                          {categories
                              .filter((c: Category) => c.type === 'BOTH' || (activeTab !== 'TRANSFER' && c.type === activeTab))
                              .map((c: Category) => <option key={c.id} value={c.name}>{c.name}</option>)}
                      </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                   {activeTab === 'TRANSFER' ? (
                       <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                           <div>
                                <label className="block text-[10px] font-black text-blue-400 mb-2 uppercase tracking-widest">From (Source)</label>
                                <select 
                                    value={entry.accountId}
                                    onChange={(e) => updateEntry(index, 'accountId', e.target.value)}
                                    className="w-full rounded-2xl border-gray-100 shadow-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 p-3.5 border text-sm font-bold outline-none bg-white cursor-pointer"
                                >
                                    <option value="">Select Account...</option>
                                    {accounts.map((a: string) => <option key={a} value={a}>{SHORT_ACCOUNT_LABELS[a as AccountType] || a}</option>)}
                                </select>
                           </div>
                           <div className="relative">
                                <div className="hidden md:flex absolute -left-5 top-1/2 -translate-y-1/2 z-10 bg-white rounded-full p-1 border border-blue-100 text-blue-400 shadow-sm">
                                    <ArrowRight size={16} />
                                </div>
                                <label className="block text-[10px] font-black text-blue-400 mb-2 uppercase tracking-widest">To (Destination)</label>
                                <select 
                                    value={entry.toAccountId}
                                    onChange={(e) => updateEntry(index, 'toAccountId', e.target.value)}
                                    className="w-full rounded-2xl border-gray-100 shadow-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 p-3.5 border text-sm font-bold outline-none bg-white cursor-pointer"
                                >
                                    <option value="">Select Account...</option>
                                    {accounts.map((a: string) => <option key={a} value={a}>{SHORT_ACCOUNT_LABELS[a as AccountType] || a}</option>)}
                                </select>
                           </div>
                           <div className="md:col-span-2">
                               <label className="block text-[10px] font-black text-blue-400 mb-2 uppercase tracking-widest">Transfer Notes</label>
                               <input
                                    type="text"
                                    placeholder="Reason for transfer..."
                                    value={entry.notes}
                                    onChange={(e) => updateEntry(index, 'notes', e.target.value)}
                                    className="w-full rounded-2xl border-gray-100 shadow-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 p-3.5 border text-sm font-bold outline-none bg-white"
                                />
                           </div>
                       </div>
                   ) : (
                       <>
                           <div>
                                <label className="block text-[10px] font-black text-gray-400 mb-2 uppercase tracking-widest">Account Type</label>
                                <select 
                                    value={entry.accountId}
                                    onChange={(e) => updateEntry(index, 'accountId', e.target.value)}
                                    className="w-full rounded-2xl border-gray-100 shadow-sm focus:ring-4 focus:ring-primary/10 focus:border-primary p-3.5 border text-sm font-bold outline-none bg-white cursor-pointer"
                                >
                                    <option value="">Select Account...</option>
                                    {accounts.map((a: string) => <option key={a} value={a}>{SHORT_ACCOUNT_LABELS[a as AccountType] || a}</option>)}
                                </select>
                           </div>
                           <div>
                               <label className="block text-[10px] font-black text-gray-400 mb-2 uppercase tracking-widest">Notes / Description</label>
                               <textarea
                                    placeholder="Enter description or recipient details..."
                                    value={entry.notes}
                                    onChange={(e) => updateEntry(index, 'notes', e.target.value)}
                                    className="w-full rounded-2xl border-gray-100 shadow-sm focus:ring-4 focus:ring-primary/10 focus:border-primary p-3.5 border text-sm font-bold outline-none transition-shadow duration-200"
                                    rows={1}
                                />
                           </div>
                       </>
                   )}
                </div>
              </div>
            ))}
            
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4">
                <button 
                    onClick={handleAddEntry}
                    className="w-full sm:w-auto flex items-center justify-center text-[10px] font-black uppercase tracking-widest text-primary hover:text-teal-800 p-4 hover:bg-teal-50 rounded-2xl transition-all border border-transparent hover:border-teal-100"
                >
                    <Plus size={18} className="mr-2" /> Add Batch Item
                </button>
                <button 
                    onClick={validateAndSave}
                    className={`w-full sm:w-auto flex items-center justify-center px-10 py-5 rounded-[2rem] text-white text-xs font-black uppercase tracking-widest shadow-xl shadow-gray-200 transition-all active:scale-95 duration-200 ${
                        activeTab === 'INCOME' ? 'bg-emerald-600 hover:bg-emerald-700' 
                        : activeTab === 'EXPENSE' ? 'bg-rose-600 hover:bg-rose-700' 
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                >
                    <Save size={20} className="mr-3" /> Commit Records
                </button>
            </div>
          </div>
        </div>
    </>
  );
};


// --- Main Component ---

const Transactions: React.FC<TransactionsProps> = ({ 
  transactions, 
  categories, 
  accounts, 
  initialFilters,
  onAddTransaction,
  onUpdateTransaction,
  onDeleteTransaction,
  filterYear
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('INCOME');
  
  // Filter States - Multi-Select
  const [selectedAccounts, setSelectedAccounts] = useState<AccountType[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<TransactionType[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearchTerm = useDeferredValue(searchTerm); // SMOOTH TYPING
  const [showArchived, setShowArchived] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [itemsPerPage, setItemsPerPage] = useState<number>(25);
  
  // Mobile specific states
  const [showFilters, setShowFilters] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false); 
  
  // Edit Mode State (Detail Modal)
  const [isEditingDetail, setIsEditingDetail] = useState(false);
  const [editDetailForm, setEditDetailForm] = useState<Transaction | null>(null);

  const [entries, setEntries] = useState<any[]>([{ 
    amount: '', 
    date: new Date().toISOString().split('T')[0],
    category: '',
    accountId: '',
    toAccountId: '',
    recipient: '',
    notes: '',
    receivedFromFinance: false
  }]);

  // Sync Initial Filters from Overview
  useEffect(() => {
    if (initialFilters.accounts) setSelectedAccounts(initialFilters.accounts);
    if (initialFilters.types) setSelectedTypes(initialFilters.types);
    
    // Auto-open filters if initial filters exist
    if ((initialFilters.accounts && initialFilters.accounts.length > 0) || (initialFilters.types && initialFilters.types.length > 0)) {
        setShowFilters(true);
    }
  }, [initialFilters]);

  // Reset Edit state when selection changes
  useEffect(() => {
      setIsEditingDetail(false);
      setEditDetailForm(null);
  }, [selectedTransaction]);

  const toggleAccountFilter = (acc: AccountType) => {
      setSelectedAccounts(prev => 
          prev.includes(acc) ? prev.filter(a => a !== acc) : [...prev, acc]
      );
  };

  const toggleTypeFilter = (type: TransactionType) => {
      setSelectedTypes(prev => 
          prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
      );
  };

  const handleAddEntry = () => {
    setEntries([...entries, { 
      amount: '', 
      date: new Date().toISOString().split('T')[0],
      category: '',
      accountId: '',
      toAccountId: '',
      recipient: '',
      notes: '',
      receivedFromFinance: false
    }]);
  };

  const handleRemoveEntry = (index: number) => {
    if (entries.length > 1) {
      setEntries(entries.filter((_, i) => i !== index));
    }
  };

  const updateEntry = (index: number, field: string, value: any) => {
    const newEntries = [...entries];
    newEntries[index] = { ...newEntries[index], [field]: value };
    setEntries(newEntries);
  };

  const validateAndSave = () => {
    // Validation logic...
    const batchToAdd: Omit<Transaction, 'id'>[] = [];

    entries.forEach(entry => {
        if (entry.amount && entry.date && entry.category && entry.accountId) {
            batchToAdd.push({
                date: entry.date,
                amount: Number(entry.amount),
                type: activeTab === 'INCOME' ? TransactionType.INCOME : activeTab === 'EXPENSE' ? TransactionType.EXPENSE : TransactionType.TRANSFER,
                category: entry.category,
                accountId: entry.accountId,
                toAccountId: activeTab === 'TRANSFER' ? entry.toAccountId : undefined,
                recipient: undefined, // Cleared out as requested
                notes: entry.notes, // Using notes primary
                isArchived: false,
                meta: { receivedFromFinance: entry.receivedFromFinance }
            });
        }
    });

    if (batchToAdd.length > 0) {
        onAddTransaction(batchToAdd);
        setEntries([{ 
            amount: '', date: new Date().toISOString().split('T')[0], category: '', accountId: '', toAccountId: '', recipient: '', notes: '', receivedFromFinance: false
        }]);
        setIsFormOpen(false); 
        alert('Transaction(s) saved successfully!');
    } else {
        alert('Please fill in required fields');
    }
  };

  const handleArchive = (id: string) => {
      onDeleteTransaction(id); 
      setSelectedTransaction(null);
  };

  const handleStartEditDetail = () => {
      if (selectedTransaction) {
          setEditDetailForm({ ...selectedTransaction });
          setIsEditingDetail(true);
      }
  };

  const handleSaveEditDetail = () => {
      if (editDetailForm) {
          onUpdateTransaction(editDetailForm);
          setSelectedTransaction(editDetailForm); // Update view
          setIsEditingDetail(false);
      }
  };

  const filteredList = useMemo(() => {
    return transactions
        .filter(t => showArchived ? true : !t.isArchived)
        .filter(t => new Date(t.date).getFullYear() === filterYear)
        // Multi-select Account Filter
        .filter(t => selectedAccounts.length === 0 || selectedAccounts.includes(t.accountId) || (t.toAccountId && selectedAccounts.includes(t.toAccountId)))
        // Multi-select Type Filter
        .filter(t => selectedTypes.length === 0 || selectedTypes.includes(t.type))
        .filter(t => 
          t.category.toLowerCase().includes(deferredSearchTerm.toLowerCase()) || 
          t.notes?.toLowerCase().includes(deferredSearchTerm.toLowerCase()) ||
          t.recipient?.toLowerCase().includes(deferredSearchTerm.toLowerCase())
        )
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, showArchived, filterYear, selectedAccounts, selectedTypes, deferredSearchTerm]);

  const displayedList = itemsPerPage === -1 ? filteredList : filteredList.slice(0, itemsPerPage);

  return (
    <div className="space-y-6">
      {/* Desktop Entry Form Card - Hidden on Mobile */}
      <div className="hidden md:block bg-white rounded-[2rem] shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden">
        <EntryForm 
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            entries={entries}
            handleRemoveEntry={handleRemoveEntry}
            handleAddEntry={handleAddEntry}
            updateEntry={updateEntry}
            validateAndSave={validateAndSave}
            categories={categories}
            accounts={accounts}
        />
      </div>

      {/* History Feed List */}
      <div className="bg-white rounded-[2rem] shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden">
        <div className="p-4 md:p-8 border-b border-gray-50 flex flex-col gap-4 bg-gray-50/30">
            
            {/* Top Toolbar */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                <div className="flex justify-between w-full xl:w-auto items-center">
                    <h3 className="font-black text-gray-900 text-lg md:text-xl tracking-tighter">History Feed</h3>
                    {/* Mobile Filter Toggle */}
                    <button 
                        onClick={() => setShowFilters(!showFilters)} 
                        className="md:hidden p-2 bg-white rounded-xl border border-gray-200 text-gray-500 shadow-sm"
                    >
                        <Filter size={20} />
                    </button>
                </div>
                
                {/* Search & Actions */}
                <div className="flex flex-col md:flex-row gap-2 w-full xl:w-auto">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input 
                            type="text" 
                            placeholder="Search..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-12 pr-6 py-3 bg-white border border-gray-100 rounded-2xl text-sm font-medium focus:outline-none focus:ring-4 focus:ring-primary/10 w-full shadow-sm"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowArchived(!showArchived)}
                            className={`flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all shadow-sm ${
                                showArchived ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-100 hover:bg-gray-50'
                            }`}
                        >
                            {showArchived ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                         <div className="relative h-[42px] md:h-auto min-w-[80px]">
                            <ListFilter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <select 
                                value={itemsPerPage}
                                onChange={(e) => setItemsPerPage(Number(e.target.value))}
                                className="pl-9 pr-4 h-full w-full bg-white border border-gray-100 rounded-2xl text-[10px] font-black uppercase tracking-widest focus:outline-none shadow-sm cursor-pointer appearance-none py-3"
                            >
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value={-1}>All</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filter Chips - Toggleable */}
            <div className={`flex flex-col gap-4 animate-in slide-in-from-top-2 duration-300 ${showFilters ? 'flex' : 'hidden md:flex'}`}>
                <div className="flex flex-wrap items-center gap-3">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mr-2">Type:</span>
                    {[TransactionType.INCOME, TransactionType.EXPENSE, TransactionType.TRANSFER].map(type => (
                        <button
                            key={type}
                            onClick={() => toggleTypeFilter(type)}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                                selectedTypes.includes(type)
                                ? 'bg-gray-900 text-white border-gray-900 shadow-md'
                                : 'bg-white text-gray-500 border-gray-100 hover:bg-gray-50'
                            }`}
                        >
                            {type}
                        </button>
                    ))}
                    {selectedTypes.length > 0 && <button onClick={() => setSelectedTypes([])} className="text-[10px] text-gray-400 hover:text-rose-500 px-2">Clear</button>}
                </div>

                 <div className="flex flex-wrap items-center gap-3">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mr-2">Account:</span>
                    {accounts.map(acc => (
                        <button
                            key={acc}
                            onClick={() => toggleAccountFilter(acc)}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                                selectedAccounts.includes(acc)
                                ? 'bg-gray-900 text-white border-gray-900 shadow-md'
                                : 'bg-white text-gray-500 border-gray-100 hover:bg-gray-50'
                            }`}
                        >
                            {SHORT_ACCOUNT_LABELS[acc] || acc}
                        </button>
                    ))}
                     {selectedAccounts.length > 0 && <button onClick={() => setSelectedAccounts([])} className="text-[10px] text-gray-400 hover:text-rose-500 px-2">Clear</button>}
                </div>
            </div>

        </div>
        
        {/* Render Memoized List */}
        <HistoryList 
            displayedList={displayedList} 
            onSelect={setSelectedTransaction} 
            showArchived={showArchived} 
        />
      </div>

      {/* Mobile Floating Action Button */}
      <button 
        onClick={() => setIsFormOpen(true)}
        className="md:hidden fixed bottom-24 right-6 w-14 h-14 bg-primary text-white rounded-full shadow-2xl shadow-primary/40 flex items-center justify-center z-50 active:scale-90 transition-transform"
      >
        <Plus size={28} />
      </button>

      {/* Mobile Form Modal */}
      {isFormOpen && (
          <div className="fixed inset-0 z-[100] bg-white animate-in slide-in-from-bottom duration-300 flex flex-col">
              <div className="flex justify-between items-center p-4 border-b border-gray-100">
                  <h3 className="font-black text-xl text-gray-900 tracking-tight">New Entry</h3>
                  <button onClick={() => setIsFormOpen(false)} className="p-2 bg-gray-100 rounded-full text-gray-500">
                      <X size={24} />
                  </button>
              </div>
              <div className="flex-1 overflow-y-auto bg-gray-50 pb-safe">
                   <EntryForm 
                        activeTab={activeTab}
                        setActiveTab={setActiveTab}
                        entries={entries}
                        handleRemoveEntry={handleRemoveEntry}
                        handleAddEntry={handleAddEntry}
                        updateEntry={updateEntry}
                        validateAndSave={validateAndSave}
                        categories={categories}
                        accounts={accounts}
                   />
              </div>
          </div>
      )}

      {/* Detail Modal */}
      {selectedTransaction && (
          <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-4 bg-gray-950/70 backdrop-blur-md animate-in fade-in duration-300">
              <div className="bg-white rounded-t-[2.5rem] md:rounded-[2.5rem] shadow-[0_35px_60px_-15px_rgba(0,0,0,0.5)] w-full max-w-xl overflow-hidden animate-in slide-in-from-bottom md:zoom-in-95 duration-300 max-h-[90vh] md:max-h-auto flex flex-col">
                  {/* Modal Header */}
                  <div className={`p-6 md:p-10 border-b border-gray-50 flex justify-between items-start shrink-0 ${
                      selectedTransaction.isArchived ? 'bg-gray-100' :
                      selectedTransaction.type === TransactionType.INCOME ? 'bg-emerald-50/50' :
                      selectedTransaction.type === TransactionType.EXPENSE ? 'bg-rose-50/50' : 'bg-blue-50/50'
                  }`}>
                      <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                             <span className="px-3 py-1 bg-white/80 rounded-full text-[9px] font-black uppercase tracking-widest text-gray-500 shadow-sm">Audit Certificate</span>
                             {selectedTransaction.isArchived && <span className="px-3 py-1 bg-gray-900 text-white text-[9px] font-black rounded-full uppercase tracking-widest">Locked Archive</span>}
                          </div>
                          <h3 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tighter leading-tight">{selectedTransaction.category}</h3>
                      </div>
                      <button onClick={() => setSelectedTransaction(null)} className="p-3 bg-white/80 hover:bg-white rounded-2xl transition-all text-gray-400 hover:text-gray-900 shadow-sm active:scale-90">
                          <X size={24} />
                      </button>
                  </div>

                  {/* Modal Content - Switch between View and Edit */}
                  <div className="p-6 md:p-10 space-y-6 md:space-y-8 overflow-y-auto no-scrollbar">
                      {isEditingDetail && editDetailForm ? (
                         // EDIT MODE
                         <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                             <div className="bg-yellow-50 p-4 rounded-2xl border border-yellow-100 flex items-center gap-2">
                                <Edit2 size={16} className="text-yellow-600"/>
                                <span className="text-xs font-bold text-yellow-700 uppercase tracking-wide">Editing Record</span>
                             </div>
                             
                             <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 mb-1 block uppercase tracking-widest">Date</label>
                                    <input type="date" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold outline-none" 
                                        value={editDetailForm.date} onChange={e => setEditDetailForm({...editDetailForm, date: e.target.value})} />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 mb-1 block uppercase tracking-widest">Amount</label>
                                    <input type="number" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold outline-none" 
                                        value={editDetailForm.amount} onChange={e => setEditDetailForm({...editDetailForm, amount: parseFloat(e.target.value)})} />
                                </div>
                             </div>

                             <div>
                                <label className="text-[10px] font-black text-gray-400 mb-1 block uppercase tracking-widest">Category</label>
                                <select className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold outline-none"
                                    value={editDetailForm.category} onChange={e => setEditDetailForm({...editDetailForm, category: e.target.value})}>
                                    {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                </select>
                             </div>

                             <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 mb-1 block uppercase tracking-widest">Account</label>
                                    <select className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold outline-none"
                                        value={editDetailForm.accountId} onChange={e => setEditDetailForm({...editDetailForm, accountId: e.target.value as any})}>
                                        {accounts.map(a => <option key={a} value={a}>{SHORT_ACCOUNT_LABELS[a as AccountType] || a}</option>)}
                                    </select>
                                </div>
                                {editDetailForm.type === TransactionType.TRANSFER && (
                                    <div>
                                        <label className="text-[10px] font-black text-gray-400 mb-1 block uppercase tracking-widest">Dest. Account</label>
                                        <select className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold outline-none"
                                            value={editDetailForm.toAccountId} onChange={e => setEditDetailForm({...editDetailForm, toAccountId: e.target.value as any})}>
                                            {accounts.map(a => <option key={a} value={a}>{SHORT_ACCOUNT_LABELS[a as AccountType] || a}</option>)}
                                        </select>
                                    </div>
                                )}
                             </div>

                             <div>
                                <label className="text-[10px] font-black text-gray-400 mb-1 block uppercase tracking-widest">Notes</label>
                                <textarea className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold outline-none" rows={3}
                                    value={editDetailForm.notes || ''} onChange={e => setEditDetailForm({...editDetailForm, notes: e.target.value})} />
                             </div>
                         </div>
                      ) : (
                        // VIEW MODE
                        <>
                            <div className="flex flex-col items-center justify-center py-6 md:py-8 bg-gray-50/50 rounded-[2rem] border border-gray-100 relative overflow-hidden">
                                <span className={`text-5xl md:text-6xl font-black tracking-tighter relative z-10 ${
                                    selectedTransaction.isArchived ? 'text-gray-400' :
                                    selectedTransaction.type === TransactionType.INCOME ? 'text-emerald-600' : 
                                    selectedTransaction.type === TransactionType.EXPENSE ? 'text-rose-600' : 'text-blue-600'
                                }`}>
                                    {selectedTransaction.type === TransactionType.EXPENSE ? '-' : ''}
                                    {formatCurrency(selectedTransaction.amount)}
                                </span>
                                <span className="text-[10px] font-black text-gray-400 mt-4 uppercase tracking-[0.2em] relative z-10">
                                    {selectedTransaction.isArchived ? 'ARCHIVED VALUATION' : 
                                     selectedTransaction.type === TransactionType.TRANSFER ? 'FUND TRANSFER' :
                                     `${selectedTransaction.type} SETTLEMENT`}
                                </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                                <div className="flex items-start gap-4 p-4 rounded-2xl bg-gray-50/30 border border-gray-50">
                                    <div className="p-3 bg-white rounded-xl text-primary shadow-sm"><Calendar size={20}/></div>
                                    <div>
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Fiscal Date</p>
                                        <p className="font-bold text-gray-900">{new Date(selectedTransaction.date).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4 p-4 rounded-2xl bg-gray-50/30 border border-gray-50">
                                    <div className="p-3 bg-white rounded-xl text-primary shadow-sm"><CreditCard size={20}/></div>
                                    <div>
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Source Account</p>
                                        <p className="font-bold text-gray-900">{SHORT_ACCOUNT_LABELS[selectedTransaction.accountId] || selectedTransaction.accountId}</p>
                                    </div>
                                </div>
                                {selectedTransaction.recipient && (
                                    <div className="flex items-start gap-4 p-4 rounded-2xl bg-gray-50/30 border border-gray-50">
                                        <div className="p-3 bg-white rounded-xl text-primary shadow-sm"><User size={20}/></div>
                                        <div>
                                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Counterparty</p>
                                            <p className="font-bold text-gray-900">{selectedTransaction.recipient}</p>
                                        </div>
                                    </div>
                                )}
                                
                                {selectedTransaction.type === TransactionType.TRANSFER && selectedTransaction.toAccountId && (
                                    <div className="flex items-start gap-4 p-4 rounded-2xl bg-gray-50/30 border border-gray-50">
                                        <div className="p-3 bg-white rounded-xl text-primary shadow-sm"><ArrowRight size={20}/></div>
                                        <div>
                                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Destination</p>
                                            <p className="font-bold text-gray-900">{SHORT_ACCOUNT_LABELS[selectedTransaction.toAccountId] || selectedTransaction.toAccountId}</p>
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-start gap-4 p-4 rounded-2xl bg-gray-50/30 border border-gray-50 md:col-span-2">
                                    <div className="p-3 bg-white rounded-xl text-primary shadow-sm"><FileText size={20}/></div>
                                    <div className="flex-1">
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Official Notes</p>
                                        <p className="font-medium text-gray-700 leading-relaxed text-sm italic">"{selectedTransaction.notes || 'No remarks provided for this entry.'}"</p>
                                    </div>
                                </div>
                            </div>
                        </>
                      )}
                  </div>

                  <div className="p-6 md:p-10 border-t border-gray-50 bg-gray-50/50 shrink-0">
                      {isEditingDetail ? (
                          <div className="flex gap-3">
                              <button onClick={() => setIsEditingDetail(false)} className="flex-1 py-4 bg-gray-200 text-gray-600 rounded-2xl font-bold uppercase text-xs tracking-widest">Cancel</button>
                              <button onClick={handleSaveEditDetail} className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-bold uppercase text-xs tracking-widest shadow-lg shadow-emerald-600/20">Save Changes</button>
                          </div>
                      ) : (
                        <div className="flex gap-3">
                            {!selectedTransaction.isArchived ? (
                                <>
                                    <button 
                                        onClick={handleStartEditDetail}
                                        className="flex-1 flex items-center justify-center gap-2 px-6 py-5 bg-white border border-gray-200 text-gray-600 text-xs font-black uppercase tracking-[0.1em] rounded-2xl hover:bg-gray-50 transition-all shadow-sm"
                                    >
                                        <Edit2 size={16} /> Edit Record
                                    </button>
                                    <button 
                                        onClick={() => handleArchive(selectedTransaction.id)}
                                        className="flex-1 flex items-center justify-center gap-2 px-6 py-5 bg-rose-50 border border-rose-100 text-rose-600 text-xs font-black uppercase tracking-[0.1em] rounded-2xl hover:bg-rose-100 hover:border-rose-200 transition-all shadow-sm"
                                    >
                                        <Archive size={16} /> Archive
                                    </button>
                                </>
                            ) : (
                                <div className="w-full p-5 bg-gray-900 rounded-[1.5rem] text-center">
                                    <p className="text-[10px] font-black text-white uppercase tracking-[0.3em] opacity-80 leading-relaxed mb-1">Static Archived Data</p>
                                    <p className="text-[9px] text-gray-400 font-bold italic">Restore this item from the Settings &gt; Archives menu if needed.</p>
                                </div>
                            )}
                        </div>
                      )}
                      
                      {!isEditingDetail && (
                        <button 
                            onClick={() => setSelectedTransaction(null)}
                            className="w-full mt-6 text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-gray-900 transition-colors"
                        >
                            Close View
                        </button>
                      )}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Transactions;