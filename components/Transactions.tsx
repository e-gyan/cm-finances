import React, { useState, useEffect, useDeferredValue, useMemo } from 'react';
import { Transaction, TransactionType, AccountType, Category } from '../types';
import { formatCurrency } from '../utils';
import { Search, Plus, Save, X, Archive, ArrowRight, Calendar, CreditCard, User, FileText, ChevronRight, Eye, EyeOff, ListFilter, Filter, Edit2, Check, ArrowRightLeft, Download, TrendingUp, TrendingDown, Wallet, Cloud, Loader2 } from 'lucide-react';
import { TransactionFilters } from '../App';
import * as XLSX from 'xlsx';
import { googleSignIn, getAccessToken } from '../auth';
import { uploadExcelToDrive } from '../driveSync';

interface TransactionsProps {
  transactions: Transaction[];
  categories: Category[];
  accounts: AccountType[];
  initialFilters: TransactionFilters;
  onAddTransaction: (t: Omit<Transaction, 'id'> | Omit<Transaction, 'id'>[]) => void;
  onUpdateTransaction: (t: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
  filterYear: number;
  canEdit?: boolean;
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
                className={`p-3 md:px-8 md:py-5 flex items-start gap-3 md:gap-6 transition-all cursor-pointer hover:bg-gray-50 active:bg-gray-100 group ${t.isArchived ? 'opacity-60 bg-gray-50/50 grayscale-[0.5]' : ''}`}
            >
                {/* Date Box - Compact */}
                <div className={`shrink-0 flex flex-col items-center justify-center w-11 h-11 md:w-14 md:h-14 rounded-[0.8rem] md:rounded-2xl border border-gray-100 ${t.isArchived ? 'bg-gray-200' : 'bg-white shadow-sm'}`}>
                    <span className="text-[8px] md:text-[9px] font-black text-gray-400 uppercase leading-none">{new Date(t.date).toLocaleString('default', { month: 'short' }).toUpperCase()}</span>
                    <span className="text-base md:text-xl font-black text-gray-900 leading-none mt-0.5">{new Date(t.date).getDate()}</span>
                </div>

                {/* Content Area - Stacked for Mobile, Row for Desktop */}
                <div className="flex-1 min-w-0 py-0.5">
                    {/* Top Row: Title & Amount */}
                    <div className="flex justify-between items-start mb-0.5 md:mb-1">
                        <h4 className={`font-bold text-[13px] md:text-base truncate pr-2 leading-tight ${t.isArchived ? 'text-gray-500' : 'text-gray-900'}`}>
                            {t.category}
                        </h4>
                        <span className={`text-[13px] md:text-lg font-black tracking-tight whitespace-nowrap mt-[1px] md:mt-0 ${
                            t.isArchived ? 'text-gray-400' :
                            t.type === TransactionType.INCOME ? 'text-emerald-600' : 
                            t.type === TransactionType.EXPENSE ? 'text-rose-600' : 'text-blue-600'
                        }`}>
                            {t.type === TransactionType.EXPENSE ? '-' : ''}{formatCurrency(t.amount)}
                        </span>
                    </div>

                    {/* Bottom Row: Metadata Tags */}
                    <div className="flex flex-wrap items-center gap-1 md:gap-2 text-[9px] md:text-xs">
                        {/* Type Badge */}
                        <span className={`px-1.5 py-[2px] rounded font-black uppercase tracking-wider ${
                             t.type === TransactionType.INCOME ? 'bg-emerald-50 text-emerald-700' :
                             t.type === TransactionType.EXPENSE ? 'bg-rose-50 text-rose-700' : 'bg-blue-50 text-blue-700'
                        }`}>
                            {t.type === TransactionType.TRANSFER ? 'TRANS' : t.type}
                        </span>

                        {/* Account Badge */}
                        <span className="px-1.5 py-[2px] rounded bg-gray-100 text-gray-500 font-bold uppercase tracking-wider truncate max-w-[80px] md:max-w-[100px]">
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
              className={`flex-1 flex-grow sm:flex-grow-0 px-1 sm:px-4 py-4 md:py-6 text-[10px] md:text-sm font-black tracking-widest transition-all outline-none relative uppercase ${
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

        <div className="p-4 md:p-10">
          <div className="space-y-6">
            {entries.map((entry: any, index: number) => (
              <div key={index} className="relative p-5 md:p-8 bg-gray-50/50 rounded-3xl border border-gray-200 space-y-4 md:space-y-6 shadow-inner group transition-all hover:bg-white hover:shadow-lg">
                {entries.length > 1 && (
                    <button onClick={() => handleRemoveEntry(index)} className="absolute top-2 right-2 md:top-4 md:right-4 text-gray-300 hover:text-rose-500 z-10 p-2 bg-white rounded-2xl shadow-sm border border-gray-100">
                        <X size={16} />
                    </button>
                )}
                
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 mb-2 uppercase tracking-widest">Entry Date</label>
                    <input 
                        type="date" 
                        value={entry.date}
                        onChange={(e) => updateEntry(index, 'date', e.target.value)}
                        className="w-full rounded-2xl border-gray-100 shadow-sm focus:ring-4 focus:ring-primary/10 focus:border-primary p-4 border text-sm font-bold outline-none bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 mb-2 uppercase tracking-widest">GHC Amount</label>
                    <input 
                        type="number" 
                        placeholder="0.00"
                        value={entry.amount}
                        onChange={(e) => updateEntry(index, 'amount', e.target.value)}
                        className="w-full rounded-2xl border-gray-100 shadow-sm focus:ring-4 focus:ring-primary/10 focus:border-primary p-4 border text-sm font-bold outline-none transition-shadow duration-200 bg-white"
                    />
                  </div>
                  
                  <div className="sm:col-span-2">
                      <label className="block text-[10px] font-black text-gray-400 mb-2 uppercase tracking-widest">Classification</label>
                      <select 
                          value={entry.category}
                          onChange={(e) => updateEntry(index, 'category', e.target.value)}
                          className="w-full rounded-2xl border-gray-100 shadow-sm focus:ring-4 focus:ring-primary/10 focus:border-primary p-4 border text-sm font-bold outline-none bg-white cursor-pointer"
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
                       <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                           <div>
                                <label className="block text-[10px] font-black text-blue-500 mb-2 uppercase tracking-widest">From (Source)</label>
                                <select 
                                    value={entry.accountId}
                                    onChange={(e) => updateEntry(index, 'accountId', e.target.value)}
                                    className="w-full rounded-2xl border-gray-100 shadow-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 p-4 border text-sm font-bold outline-none bg-white cursor-pointer"
                                >
                                    <option value="">Select Account...</option>
                                    {accounts.map((a: string) => <option key={a} value={a}>{SHORT_ACCOUNT_LABELS[a as AccountType] || a}</option>)}
                                </select>
                           </div>
                           <div className="relative mt-0">
                                <label className="block text-[10px] font-black text-blue-500 mb-2 uppercase tracking-widest">To (Destination)</label>
                                <select 
                                    value={entry.toAccountId}
                                    onChange={(e) => updateEntry(index, 'toAccountId', e.target.value)}
                                    className="w-full rounded-2xl border-gray-100 shadow-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 p-4 border text-sm font-bold outline-none bg-white cursor-pointer"
                                >
                                    <option value="">Select Account...</option>
                                    {accounts.map((a: string) => <option key={a} value={a}>{SHORT_ACCOUNT_LABELS[a as AccountType] || a}</option>)}
                                </select>
                           </div>
                           <div className="md:col-span-2">
                                <label className="block text-[10px] font-black text-blue-500 mb-2 uppercase tracking-widest">Transfer Notes</label>
                                <input
                                    type="text"
                                    placeholder="Reason for transfer..."
                                    value={entry.notes}
                                    onChange={(e) => updateEntry(index, 'notes', e.target.value)}
                                    className="w-full rounded-2xl border-gray-100 shadow-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 p-4 border text-sm font-bold outline-none bg-white"
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
                                    className="w-full rounded-2xl border-gray-100 shadow-sm focus:ring-4 focus:ring-primary/10 focus:border-primary p-4 border text-sm font-bold outline-none bg-white cursor-pointer"
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
                                    className="w-full rounded-2xl border-gray-100 shadow-sm focus:ring-4 focus:ring-primary/10 focus:border-primary p-4 border text-sm font-bold outline-none transition-shadow duration-200"
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
  filterYear,
  canEdit = false
}) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('INCOME');
  
  // Filter States - Multi-Select
  const [selectedAccounts, setSelectedAccounts] = useState<AccountType[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<TransactionType[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearchTerm = useDeferredValue(searchTerm); // SMOOTH TYPING
  const [showArchived, setShowArchived] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [itemsPerPage, setItemsPerPage] = useState<number>(25);

  // Edit Mode State (Detail Modal)
  const [isEditingDetail, setIsEditingDetail] = useState(false);
  const [editDetailForm, setEditDetailForm] = useState<Transaction | null>(null);
  
  // Google Drive Sync State
  const [isDriveSyncing, setIsDriveSyncing] = useState(false);
  const [driveAutoSyncEnabled, setDriveAutoSyncEnabled] = useState<boolean>(() => localStorage.getItem('DRIVE_AUTO_SYNC') === 'true');
  const [needsAuth, setNeedsAuth] = useState(false);

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

  const exportToExcel = () => {
    const workbook = generateWorkbook();
    XLSX.writeFile(workbook, `${filterYear}-finance-records.xlsx`);
  };

  const generateWorkbook = () => {
    const headers = ['Date', 'Type', 'Category', 'Amount', 'Account', 'Destination Account', 'Notes'];
    const rows = filteredList.map(t => [
      t.date,
      t.type,
      t.category,
      t.type === TransactionType.EXPENSE ? -t.amount : t.amount,
      SHORT_ACCOUNT_LABELS[t.accountId] || t.accountId,
      t.toAccountId ? (SHORT_ACCOUNT_LABELS[t.toAccountId] || t.toAccountId) : '',
      t.notes || ''
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Transactions");
    return workbook;
  };

  const syncToDrive = async (isAuto: boolean = false) => {
    if (!isAuto) {
      const confirmed = window.confirm(
        `Are you sure you want to sync to Google Drive? This will overwrite the existing "${filterYear}-finance-records.xlsx" file in the "church-related > Others" folder. Proceed?`
      );
      if (!confirmed) return;
    }

    try {
      setIsDriveSyncing(true);
      let token = await getAccessToken();
      if (!token) {
        setNeedsAuth(true);
        if (!isAuto) {
           const result = await googleSignIn();
           token = result?.accessToken || null;
           setNeedsAuth(false);
        } else {
           // Skip auto-sync if we don't have token
           return;
        }
      }
      
      if (!token) return;

      const workbook = generateWorkbook();
      const arrayBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      await uploadExcelToDrive(`${filterYear}-finance-records.xlsx`, arrayBuffer);
      if (!isAuto) alert("Successfully synced to Google Drive!");
    } catch (err: any) {
      console.error(err);
      if (!isAuto) alert(`Drive Sync Failed: ${err.message}`);
    } finally {
      setIsDriveSyncing(false);
    }
  };

  const toggleAutoSync = () => {
    const newVal = !driveAutoSyncEnabled;
    if (newVal) {
      const confirmed = window.confirm(
        `Enable Auto-Sync? This will automatically overwrite "${filterYear}-finance-records.xlsx" in your Google Drive ("church-related > Others") whenever you add, edit, or delete a transaction. Do you agree to these overwrites?`
      );
      if (!confirmed) return;
      
      // Check auth before enabling
      getAccessToken().then(token => {
         if (!token) {
            googleSignIn().then(result => {
                if (result) {
                   setDriveAutoSyncEnabled(true);
                   localStorage.setItem('DRIVE_AUTO_SYNC', 'true');
                   syncToDrive(true);
                }
            });
         } else {
            setDriveAutoSyncEnabled(true);
            localStorage.setItem('DRIVE_AUTO_SYNC', 'true');
            syncToDrive(true);
         }
      });
    } else {
       setDriveAutoSyncEnabled(false);
       localStorage.setItem('DRIVE_AUTO_SYNC', 'false');
    }
  };

  // Trigger Drive Sync on changes if auto-sync is on
  useEffect(() => {
    if (driveAutoSyncEnabled && transactions.length > 0) {
      // Debounce logic
      const timer = setTimeout(() => {
        syncToDrive(true);
      }, 5000); // 5 seconds after modifications stop
      return () => clearTimeout(timer);
    }
  }, [transactions, driveAutoSyncEnabled]);

  const totals = useMemo(() => {
    return filteredList.reduce((acc, t) => {
      if (t.type === TransactionType.INCOME) acc.income += t.amount;
      if (t.type === TransactionType.EXPENSE) acc.expense += t.amount;
      if (t.type === TransactionType.TRANSFER) {
        // transfers don't affect net PL from a system standpoint unless we want them to, but usually they are 0 sum.
      }
      return acc;
    }, { income: 0, expense: 0 });
  }, [filteredList]);

  return (
    <div className="flex flex-col flex-1 h-full min-h-0 gap-4">
      {/* Detail/Entry Modals */}
      {isFormOpen && canEdit && (
          <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-4 bg-gray-950/70 backdrop-blur-md animate-in fade-in duration-300">
              <div className="bg-white rounded-t-[2.5rem] md:rounded-[2.5rem] shadow-[0_35px_60px_-15px_rgba(0,0,0,0.5)] w-full max-w-3xl overflow-hidden animate-in slide-in-from-bottom md:zoom-in-95 duration-300 max-h-[90vh] flex flex-col">
                  <div className="p-4 md:p-6 border-b border-gray-50 flex justify-between items-center shrink-0">
                      <h3 className="font-black text-gray-900 text-lg uppercase tracking-widest text-[10px]">New Transaction</h3>
                      <button onClick={() => setIsFormOpen(false)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-xl transition-all">
                          <X size={20} />
                      </button>
                  </div>
                  <div className="overflow-y-auto no-scrollbar">
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
          </div>
      )}

      {/* Summary Cards */}
      <div className="flex flex-col md:grid md:grid-cols-3 gap-3 md:gap-4 shrink-0 pb-2">
        <div className="bg-emerald-50/80 p-4 md:p-5 rounded-[1.5rem] md:rounded-[2rem] border border-emerald-100 flex items-center gap-4 justify-between shadow-sm w-full transition-transform active:scale-[0.98]">
          <div>
            <p className="text-emerald-700 font-black text-[10px] uppercase tracking-widest opacity-80">Filtered Income</p>
            <p className="text-2xl md:text-3xl font-black text-emerald-900 mt-1 tracking-tighter">{formatCurrency(totals.income)}</p>
          </div>
          <div className="p-3 bg-white rounded-[1rem] md:rounded-[1.25rem] text-emerald-600 shadow-sm shrink-0">
            <TrendingUp size={20} />
          </div>
        </div>
        <div className="bg-rose-50/80 p-4 md:p-5 rounded-[1.5rem] md:rounded-[2rem] border border-rose-100 flex items-center gap-4 justify-between shadow-sm w-full transition-transform active:scale-[0.98]">
          <div>
            <p className="text-rose-700 font-black text-[10px] uppercase tracking-widest opacity-80">Filtered Expenses</p>
            <p className="text-2xl md:text-3xl font-black text-rose-900 mt-1 tracking-tighter">{formatCurrency(totals.expense)}</p>
          </div>
          <div className="p-3 bg-white rounded-[1rem] md:rounded-[1.25rem] text-rose-600 shadow-sm shrink-0">
            <TrendingDown size={20} />
          </div>
        </div>
        <div className="bg-blue-50/80 p-4 md:p-5 rounded-[1.5rem] md:rounded-[2rem] border border-blue-100 flex items-center gap-4 justify-between shadow-sm w-full transition-transform active:scale-[0.98]">
          <div>
            <p className="text-blue-700 font-black text-[10px] uppercase tracking-widest opacity-80">Net Balance</p>
            <p className={`text-2xl md:text-3xl font-black text-blue-900 mt-1 tracking-tighter ${totals.income - totals.expense >= 0 ? "text-primary" : "text-rose-600"}`}>{formatCurrency(totals.income - totals.expense)}</p>
          </div>
          <div className="p-3 bg-white rounded-[1rem] md:rounded-[1.25rem] text-blue-600 shadow-sm shrink-0">
            <Wallet size={20} />
          </div>
        </div>
      </div>

      {/* History Feed List in a restricted height container */}
      <div className="flex flex-col flex-1 bg-white rounded-t-[2.5rem] md:rounded-[2.5rem] shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] md:shadow-xl md:shadow-gray-200/50 border border-gray-100 overflow-hidden min-h-0 relative z-10 -mt-2 md:mt-0 pt-2 md:pt-0">
        <div className="shrink-0 p-5 md:p-8 border-b border-gray-50 flex flex-col gap-5 bg-white">
            
            {/* Header Title hidden on mobile to save space, visible on desktop */}
            <div className="hidden md:flex justify-between w-full items-center mb-2">
                <h3 className="font-black text-gray-900 text-xl tracking-tighter">Transaction History Dashboard</h3>
            </div>
            
            {/* Re-engineered Filter & Actions Area */}
            <div className="flex flex-col gap-4">
                {/* Search Bar - Full Width with clean pill design */}
                <div className="relative w-full">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input 
                        type="text" 
                        placeholder="Search by category, note, or recipient..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-11 pr-5 py-3.5 bg-gray-50/80 border border-gray-100 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-white w-full transition-all text-gray-800 placeholder-gray-400"
                    />
                </div>
                
                {/* Action Row - Wraps on Mobile */}
                <div className="flex flex-wrap items-center gap-2 pb-2">
                    <button
                        onClick={exportToExcel}
                        className="grow md:grow-0 shrink-0 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 transition-all shadow-sm active:scale-95"
                    >
                        <Download size={14} /> <span>Get XLSX</span>
                    </button>
                    
                    <button
                        onClick={() => syncToDrive(false)}
                        disabled={isDriveSyncing}
                        className={`grow md:grow-0 shrink-0 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-50 transition-all shadow-sm active:scale-95 ${isDriveSyncing ? 'text-blue-400 opacity-80' : 'text-blue-600'}`}
                    >
                        {isDriveSyncing ? <Loader2 size={14} className="animate-spin" /> : <Cloud size={14} />}
                        <span>{isDriveSyncing ? 'Syncing...' : 'Drive Sync'}</span>
                    </button>
                    
                    <button
                        onClick={toggleAutoSync}
                        className={`grow md:grow-0 shrink-0 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm active:scale-95 ${driveAutoSyncEnabled ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}
                    >
                        {driveAutoSyncEnabled ? <Check size={14} className="text-emerald-500" /> : <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-300" />}
                        <span>Auto-Sync</span>
                    </button>

                    <div className="w-px h-5 bg-gray-200 shrink-0 mx-1 hidden md:block"></div>

                    <button
                        onClick={() => setShowArchived(!showArchived)}
                        className={`grow md:grow-0 shrink-0 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm active:scale-95 ${
                            showArchived ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border border-gray-200'
                        }`}
                    >
                        {showArchived ? <EyeOff size={14} /> : <Eye size={14} />}
                        <span>Archived</span>
                    </button>
                    
                    <div className="relative shrink-0 grow md:grow-0 min-w-[120px] md:min-w-[70px]">
                        <ListFilter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                        <select 
                            value={itemsPerPage}
                            onChange={(e) => setItemsPerPage(Number(e.target.value))}
                            className="pl-8 pr-3 h-[38px] w-full bg-white border border-gray-200 text-gray-600 rounded-xl text-[10px] font-black uppercase tracking-widest focus:outline-none shadow-sm cursor-pointer appearance-none transition-all active:scale-95"
                        >
                            <option value={25}>25 items</option>
                            <option value={50}>50 items</option>
                            <option value={-1}>All items</option>
                        </select>
                    </div>
                </div>

                {/* Filter Chips Layer */}
                <div className="flex flex-col gap-2.5">
                    {/* Types */}
                    <div className="flex flex-wrap items-center gap-2 pb-1">
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest mr-1 shrink-0">Type:</span>
                        {[TransactionType.INCOME, TransactionType.EXPENSE, TransactionType.TRANSFER].map(type => (
                            <button
                                key={type}
                                onClick={() => toggleTypeFilter(type)}
                                className={`grow snap-start shrink-0 px-3.5 py-1.5 rounded-lg text-[9px] md:text-[10px] font-black uppercase tracking-widest border transition-all ${
                                    selectedTypes.includes(type)
                                    ? 'bg-gray-800 text-white border-gray-800 shadow-md ring-2 ring-gray-200 ring-offset-1'
                                    : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                                }`}
                            >
                                {type}
                            </button>
                        ))}
                        {selectedTypes.length > 0 && <button onClick={() => setSelectedTypes([])} className="text-[9px] shrink-0 font-bold text-gray-400 hover:text-rose-500 px-2 transition-all">Clear</button>}
                    </div>

                    {/* Accounts */}
                    <div className="flex flex-wrap items-center gap-2 pb-1">
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest mr-1 shrink-0">Acc:</span>
                        {accounts.map(acc => (
                            <button
                                key={acc}
                                onClick={() => toggleAccountFilter(acc)}
                                className={`grow snap-start shrink-0 px-3.5 py-1.5 rounded-lg text-[9px] md:text-[10px] font-black uppercase tracking-widest border transition-all ${
                                    selectedAccounts.includes(acc)
                                    ? 'bg-gray-800 text-white border-gray-800 shadow-md ring-2 ring-gray-200 ring-offset-1'
                                    : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                                }`}
                            >
                                {SHORT_ACCOUNT_LABELS[acc as AccountType] || acc}
                            </button>
                        ))}
                         {selectedAccounts.length > 0 && <button onClick={() => setSelectedAccounts([])} className="text-[9px] shrink-0 font-bold text-gray-400 hover:text-rose-500 px-2 transition-all">Clear</button>}
                    </div>
                </div>
            </div>
        </div>
        
        {/* Render Memoized List, scrolling area */}
        <div className="flex-1 overflow-y-auto no-scrollbar min-h-0 relative bg-gray-50/30">
            <HistoryList 
                displayedList={displayedList} 
                onSelect={setSelectedTransaction} 
                showArchived={showArchived} 
            />
        </div>
      </div>

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
                          <div className="flex flex-col sm:flex-row gap-3">
                              <button onClick={() => setIsEditingDetail(false)} className="w-full sm:flex-1 py-4 bg-gray-200 text-gray-600 rounded-2xl font-bold uppercase text-xs tracking-widest">Cancel</button>
                              <button onClick={handleSaveEditDetail} className="w-full sm:flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-bold uppercase text-xs tracking-widest shadow-lg shadow-emerald-600/20">Save Changes</button>
                          </div>
                      ) : (
                        <div className="flex flex-col sm:flex-row gap-3">
                            {!selectedTransaction.isArchived ? (
                                <>
                                    {canEdit && (
                                      <>
                                        <button 
                                            onClick={handleStartEditDetail}
                                            className="w-full sm:flex-1 flex items-center justify-center gap-2 px-6 py-5 bg-white border border-gray-200 text-gray-600 text-xs font-black uppercase tracking-[0.1em] rounded-2xl hover:bg-gray-50 transition-all shadow-sm"
                                        >
                                            <Edit2 size={16} /> Edit Record
                                        </button>
                                        <button 
                                            onClick={() => handleArchive(selectedTransaction.id)}
                                            className="w-full sm:flex-1 flex items-center justify-center gap-2 px-6 py-5 bg-rose-50 border border-rose-100 text-rose-600 text-xs font-black uppercase tracking-[0.1em] rounded-2xl hover:bg-rose-100 hover:border-rose-200 transition-all shadow-sm"
                                        >
                                            <Archive size={16} /> Archive
                                        </button>
                                      </>
                                    )}
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
      {/* FAB (Floating Action Button) for Mobile & Desktop */}
      {canEdit && !isFormOpen && (
          <button
              onClick={() => setIsFormOpen(true)}
              className="fixed bottom-24 right-4 md:bottom-8 md:right-8 z-50 bg-primary text-white w-14 h-14 md:w-16 md:h-16 rounded-[1.25rem] md:rounded-[1.5rem] flex items-center justify-center shadow-lg shadow-primary/30 hover:scale-105 active:scale-95 hover:bg-teal-700 hover:shadow-xl hover:shadow-primary/40 transition-all duration-300 pointer-events-auto"
          >
              <Plus size={24} className="md:w-7 md:h-7" />
          </button>
      )}

    </div>
  );
};

export default Transactions;