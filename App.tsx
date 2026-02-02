import React, { useState, useEffect, useCallback } from 'react';
import { LayoutDashboard, Receipt, Settings as SettingsIcon, PieChart, ChevronLeft, ChevronRight, Cloud, CloudOff, Loader2, Check } from 'lucide-react';
import { Transaction, Category, User, AccountType, TransactionType } from './types';
import { INITIAL_TRANSACTIONS, INITIAL_CATEGORIES, INITIAL_USERS } from './utils';
import { v4 as uuidv4 } from 'uuid';

import Overview from './components/Overview';
import Transactions from './components/Transactions';
import Reports from './components/Reports';
import Settings from './components/Settings';
import ChatAssistant from './components/ChatAssistant';

// Helper to load from storage or fallback
const loadState = <T,>(key: string, fallback: T): T => {
  const saved = localStorage.getItem(key);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to parse storage', e);
      return fallback;
    }
  }
  return fallback;
};

export interface TransactionFilters {
  accounts?: AccountType[];
  types?: TransactionType[];
}

function App() {
  // Cloud Configuration
  const [binId, setBinId] = useState<string>(() => localStorage.getItem('THESAURUS_BIN_ID') || '696a4288ae596e708fe088b1');
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem('THESAURUS_API_KEY') || '$2a$10$ND0zIcPdo58JCZimZAcwRO.hL596gLZ3bxo/F0Po4bcSu.b0nvjEa');
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  // App State
  const [transactions, setTransactions] = useState<Transaction[]>(() => 
    loadState('THESAURUS_TRANSACTIONS', INITIAL_TRANSACTIONS)
  );
  const [categories, setCategories] = useState<Category[]>(() => 
    loadState('THESAURUS_CATEGORIES', INITIAL_CATEGORIES)
  );
  const [users, setUsers] = useState<User[]>(() => 
    loadState('THESAURUS_USERS', INITIAL_USERS)
  );
  
  const [activeView, setActiveView] = useState<'OVERVIEW' | 'TRANSACTIONS' | 'REPORTS' | 'SETTINGS'>('OVERVIEW');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true); // Default to collapsed
  
  // Navigation Filters
  const [initialFilters, setInitialFilters] = useState<TransactionFilters>({});
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  // --- CLOUD SYNC LOGIC ---

  const saveToCloud = useCallback(async (newData?: { transactions?: Transaction[], categories?: Category[], users?: User[] }) => {
    if (!binId || !apiKey) return;
    
    setIsSyncing(true);
    const payload = {
        transactions: newData?.transactions || transactions,
        categories: newData?.categories || categories,
        users: newData?.users || users
    };

    try {
        await fetch(`https://api.jsonbin.io/v3/b/${binId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Master-Key': apiKey
            },
            body: JSON.stringify(payload)
        });
        setLastSyncTime(new Date());
    } catch (error) {
        console.error("Cloud Sync Failed", error);
        alert("Failed to sync with Cloud. Check your internet or API credentials.");
    } finally {
        setIsSyncing(false);
    }
  }, [binId, apiKey, transactions, categories, users]);

  const loadFromCloud = useCallback(async () => {
      if (!binId || !apiKey) return;
      setIsSyncing(true);
      try {
          const res = await fetch(`https://api.jsonbin.io/v3/b/${binId}/latest`, {
              headers: {
                  'X-Master-Key': apiKey
              }
          });
          if (!res.ok) throw new Error("Failed to fetch");
          const data = await res.json();
          const record = data.record;

          if (record.transactions) setTransactions(record.transactions);
          if (record.categories) setCategories(record.categories);
          if (record.users) setUsers(record.users);
          
          setLastSyncTime(new Date());
      } catch (error) {
          console.error("Load Failed", error);
          // Don't alert on auto-load to avoid annoying user, just log
      } finally {
          setIsSyncing(false);
      }
  }, [binId, apiKey]);

  // Initial Load from Cloud if credentials exist
  useEffect(() => {
    if (binId && apiKey) {
        loadFromCloud();
    }
  }, []); // Run once on mount

  // Local Persistence & Auto-Save Trigger
  useEffect(() => {
    localStorage.setItem('THESAURUS_TRANSACTIONS', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('THESAURUS_CATEGORIES', JSON.stringify(categories));
  }, [categories]);
  
  useEffect(() => {
    localStorage.setItem('THESAURUS_USERS', JSON.stringify(users));
  }, [users]);

  // Update Credentials
  const updateCloudConfig = (newBinId: string, newApiKey: string) => {
      setBinId(newBinId);
      setApiKey(newApiKey);
      localStorage.setItem('THESAURUS_BIN_ID', newBinId);
      localStorage.setItem('THESAURUS_API_KEY', newApiKey);
      if (newBinId && newApiKey) {
          setTimeout(() => loadFromCloud(), 100); // Trigger load after set
      }
  };

  // --- ACTIONS ---

  const handleNavigateToTransactions = (filters: TransactionFilters) => {
    setInitialFilters(filters);
    setActiveView('TRANSACTIONS');
  };

  const addTransaction = (t: Omit<Transaction, 'id'> | Omit<Transaction, 'id'>[]) => {
    const items = Array.isArray(t) ? t : [t];
    const newItems = items.map(item => ({ ...item, id: uuidv4() }));
    const newTransactions = [...newItems, ...transactions];
    setTransactions(newTransactions);
    saveToCloud({ transactions: newTransactions }); // Sync
  };

  const updateTransaction = (updatedT: Transaction | Transaction[]) => {
    let newTransactions;
    if (Array.isArray(updatedT)) {
        const updatesMap = new Map(updatedT.map(t => [t.id, t]));
        newTransactions = transactions.map(t => updatesMap.has(t.id) ? updatesMap.get(t.id)! : t);
    } else {
        newTransactions = transactions.map(t => t.id === updatedT.id ? updatedT : t);
    }
    setTransactions(newTransactions);
    saveToCloud({ transactions: newTransactions }); // Sync
  };

  const deleteTransaction = (id: string) => {
    const newTransactions = transactions.map(t => t.id === id ? { ...t, isArchived: true } : t);
    setTransactions(newTransactions);
    saveToCloud({ transactions: newTransactions }); // Sync
  };

  const permanentlyDeleteTransaction = (ids: string | string[]) => {
    const idArray = Array.isArray(ids) ? ids : [ids];
    const newTransactions = transactions.filter(t => !idArray.includes(t.id));
    setTransactions(newTransactions);
    saveToCloud({ transactions: newTransactions }); // Sync
  };

  const restoreTransaction = (ids: string | string[]) => {
    const idArray = Array.isArray(ids) ? ids : [ids];
    const newTransactions = transactions.map(t => idArray.includes(t.id) ? { ...t, isArchived: false } : t);
    setTransactions(newTransactions);
    saveToCloud({ transactions: newTransactions }); // Sync
  };

  const addCategory = (c: Category) => {
    const newCats = [...categories, c];
    setCategories(newCats);
    saveToCloud({ categories: newCats });
  };

  const editCategory = (updatedCategory: Category) => {
    const oldCat = categories.find(c => c.id === updatedCategory.id);
    let newTransactions = transactions;
    if (oldCat && oldCat.name !== updatedCategory.name) {
        newTransactions = transactions.map(t => t.category === oldCat.name ? { ...t, category: updatedCategory.name } : t);
        setTransactions(newTransactions);
    }
    const newCats = categories.map(c => c.id === updatedCategory.id ? updatedCategory : c);
    setCategories(newCats);
    saveToCloud({ categories: newCats, transactions: newTransactions });
  };

  const deleteCategory = (id: string) => {
    const newCats = categories.filter(c => c.id !== id);
    setCategories(newCats);
    saveToCloud({ categories: newCats });
  };

  const handleUserAction = (action: 'ADD' | 'UPDATE' | 'DELETE', user: User) => {
      let newUsers = [...users];
      if (action === 'ADD') {
          newUsers.push({ ...user, id: uuidv4() });
      } else if (action === 'UPDATE') {
          newUsers = newUsers.map(u => u.id === user.id ? user : u);
      } else if (action === 'DELETE') {
          // Soft delete or disable
          newUsers = newUsers.map(u => u.id === user.id ? { ...u, status: 'DISABLED' } : u);
      }
      setUsers(newUsers);
      saveToCloud({ users: newUsers });
  };

  const handleImportData = (data: { transactions: Transaction[], categories: Category[], users: User[] }) => {
    if (window.confirm('WARNING: Importing data will overwrite your current database. This cannot be undone. Are you sure?')) {
        try {
            if (data.transactions && Array.isArray(data.transactions)) setTransactions(data.transactions);
            if (data.categories && Array.isArray(data.categories)) setCategories(data.categories);
            if (data.users && Array.isArray(data.users)) setUsers(data.users);
            saveToCloud(data); // Sync immediately
            alert('Database restored successfully!');
        } catch (error) {
            console.error(error);
            alert('Failed to import data. The file format appears invalid.');
        }
    }
  };

  const navItems = [
    { id: 'OVERVIEW', label: 'Overview', icon: LayoutDashboard },
    { id: 'TRANSACTIONS', label: 'Transactions', icon: Receipt },
    { id: 'REPORTS', label: 'Reports', icon: PieChart },
    { id: 'SETTINGS', label: 'Settings', icon: SettingsIcon },
  ];

  return (
    <div className="flex min-h-screen bg-gray-50 font-sans text-slate-900">
      
      {/* Sidebar (Desktop & Tablet) */}
      <aside 
        className={`hidden md:flex flex-col bg-white border-r border-gray-200 fixed h-full z-20 transition-all duration-300 ease-in-out shadow-sm ${
          isSidebarCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        <div className="p-4 border-b border-gray-100 flex items-center justify-between h-16">
          {!isSidebarCollapsed && (
            <div className="animate-in fade-in slide-in-from-left-2 duration-300">
              <h1 className="text-lg font-black text-primary leading-tight tracking-tighter uppercase">Thesaurus</h1>
            </div>
          )}
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="p-2 hover:bg-gray-100 rounded-xl text-gray-400 transition-all mx-auto active:scale-90"
          >
            {isSidebarCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-2 mt-4">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id as any)}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-2xl transition-all group relative ${
                activeView === item.id 
                  ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                  : 'text-gray-400 hover:bg-gray-50 hover:text-primary'
              }`}
            >
              <item.icon size={22} className="min-w-[22px]" />
              {!isSidebarCollapsed && (
                <span className="font-bold text-sm tracking-tight animate-in fade-in slide-in-from-left-2 duration-200">
                  {item.label}
                </span>
              )}
            </button>
          ))}
        </nav>
        
        {!isSidebarCollapsed && (
          <div className="p-6 border-t border-gray-100 animate-in fade-in duration-500 space-y-2">
            <div className={`p-3 rounded-xl flex items-center gap-3 transition-colors duration-300 ${
              !binId ? 'bg-gray-100 text-gray-500' :
              isSyncing ? 'bg-blue-50 text-blue-700' :
              'bg-emerald-50 text-emerald-700'
            }`}>
                {isSyncing ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : !binId ? (
                  <CloudOff size={18} />
                ) : (
                  <div className="relative">
                    <Cloud size={18} />
                    <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5">
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                    </div>
                  </div>
                )}
                
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-widest leading-none truncate">
                    {!binId ? 'Offline' : isSyncing ? 'Syncing...' : 'Synced'}
                  </p>
                  {binId && !isSyncing && lastSyncTime && (
                    <p className="text-[9px] font-bold opacity-70 mt-1 truncate">
                      {lastSyncTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </p>
                  )}
                  {binId && !isSyncing && !lastSyncTime && (
                    <p className="text-[9px] font-bold opacity-70 mt-1 truncate">Ready</p>
                  )}
                </div>
            </div>
            <div className="bg-gray-50 p-4 rounded-2xl text-center">
              <p className="text-[10px] text-gray-400 font-black uppercase tracking-[0.2em] leading-none">The Privy Closet</p>
              <p className="text-[8px] text-gray-300 mt-1 font-bold">V2.1 • Security</p>
            </div>
          </div>
        )}
      </aside>

      {/* Mobile Top Header */}
      <div className="md:hidden fixed top-0 w-full bg-white/80 backdrop-blur-md border-b border-gray-200 z-30 flex justify-between items-center px-4 py-3 h-14 shadow-sm">
         <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-black text-xs">TH</div>
            <div className="flex flex-col">
              <h1 className="text-sm font-black text-gray-900 leading-none tracking-tight uppercase">Thesaurus</h1>
              <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Finance App</span>
            </div>
         </div>
         <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all border ${
            !binId ? 'bg-gray-50 border-gray-100 text-gray-400' :
            isSyncing ? 'bg-blue-50 border-blue-100 text-blue-600' :
            'bg-emerald-50 border-emerald-100 text-emerald-600'
         }`}>
            {isSyncing ? <Loader2 size={14} className="animate-spin"/> : !binId ? <CloudOff size={14} /> : <Check size={14} strokeWidth={3} />}
            <span className="text-[10px] font-black uppercase tracking-widest">
              {isSyncing ? 'Syncing' : !binId ? 'Offline' : 'Synced'}
            </span>
         </div>
      </div>

      {/* Bottom Navigation Bar (Mobile) */}
      <div className="md:hidden fixed bottom-0 w-full bg-white border-t border-gray-200 z-40 pb-safe">
        <div className="flex justify-around items-center h-16 px-2">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id as any)}
              className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-all active:scale-95 ${
                activeView === item.id 
                  ? 'text-primary' 
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <div className={`p-1.5 rounded-xl transition-all ${activeView === item.id ? 'bg-primary/10' : ''}`}>
                <item.icon size={20} strokeWidth={activeView === item.id ? 2.5 : 2} />
              </div>
              <span className={`text-[9px] font-black uppercase tracking-widest ${activeView === item.id ? 'text-primary' : 'text-gray-400'}`}>
                {item.label.replace('Generate ', '')}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <main 
        className={`flex-1 transition-all duration-300 ease-in-out ${
          isSidebarCollapsed ? 'md:ml-20' : 'md:ml-64'
        } p-4 md:p-8 pt-20 md:pt-8 pb-24 md:pb-8 min-h-screen`}
      >
        <div className="max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className={activeView === 'OVERVIEW' ? 'block' : 'hidden'}>
            <Overview 
                transactions={transactions} 
                onNavigate={handleNavigateToTransactions} 
                selectedYear={selectedYear}
                onYearChange={setSelectedYear}
            />
          </div>
          
          <div className={activeView === 'TRANSACTIONS' ? 'block' : 'hidden'}>
            <Transactions 
                transactions={transactions}
                categories={categories}
                accounts={[AccountType.MOMO, AccountType.CASH, AccountType.OTHER]}
                initialFilters={initialFilters}
                onAddTransaction={addTransaction}
                onUpdateTransaction={updateTransaction}
                onDeleteTransaction={deleteTransaction}
                filterYear={selectedYear}
            />
          </div>

          <div className={activeView === 'REPORTS' ? 'block' : 'hidden'}>
             <Reports 
                transactions={transactions}
                users={users}
                onAddTransaction={addTransaction}
                financeRep={users.find(u => u.role === 'FINANCE_REP')}
             />
          </div>

          <div className={activeView === 'SETTINGS' ? 'block' : 'hidden'}>
             <Settings 
                transactions={transactions}
                categories={categories}
                users={users}
                archivedTransactions={transactions.filter(t => t.isArchived)}
                onAddCategory={addCategory}
                onEditCategory={editCategory}
                onDeleteCategory={deleteCategory}
                onRestoreTransaction={restoreTransaction}
                onPermanentlyDelete={permanentlyDeleteTransaction}
                onUpdateTransaction={updateTransaction}
                onImportData={handleImportData}
                cloudConfig={{ binId, apiKey }}
                onUpdateCloudConfig={updateCloudConfig}
                onUserAction={handleUserAction}
             />
          </div>
        </div>
      </main>

      {/* GLOBAL CHAT ASSISTANT */}
      <ChatAssistant 
          transactions={transactions} 
          categories={categories} 
          onAddTransaction={addTransaction}
      />

    </div>
  );
}

export default App;