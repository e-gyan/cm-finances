import React, { useState, useEffect, useDeferredValue, useMemo } from 'react';
import { Category, User, Transaction, AccountType, TransactionType } from '../types';
import { Trash2, Plus, RefreshCw, Archive, Search, FileText, Edit2, Check, X, AlertTriangle, Database, Download, Upload, Cloud, Lock, Key, Shield, UserPlus, Power, Eye, EyeOff, Smartphone, BookOpen, Map, Activity, GitMerge, Share2, Layers, ShieldCheck, LayoutTemplate, Lightbulb, Users, ArrowRight, MousePointerClick, Zap, Square, CheckSquare } from 'lucide-react';
import { formatCurrency, hashAccessCode } from '../utils';

interface SettingsProps {
  transactions: Transaction[];
  categories: Category[];
  users: User[];
  archivedTransactions: Transaction[];
  onAddCategory: (c: Category) => void;
  onEditCategory: (c: Category) => void;
  onDeleteCategory: (id: string) => void;
  onRestoreTransaction: (ids: string | string[]) => void;
  onPermanentlyDelete: (ids: string | string[]) => void;
  onUpdateTransaction: (t: Transaction | Transaction[]) => void;
  onImportData: (data: { transactions: Transaction[], categories: Category[], users: User[] }) => void;
  cloudConfig: { binId: string; apiKey: string };
  onUpdateCloudConfig: (binId: string, apiKey: string) => void;
  onUserAction: (action: 'ADD' | 'UPDATE' | 'DELETE', user: User) => void;
  currentUser: User | null;
}

const ADMIN_PIN = '1234';

const Settings: React.FC<SettingsProps> = ({ 
  transactions,
  categories, 
  users, 
  archivedTransactions, 
  onAddCategory, 
  onEditCategory,
  onDeleteCategory,
  onRestoreTransaction,
  onPermanentlyDelete,
  onUpdateTransaction,
  onImportData,
  cloudConfig,
  onUpdateCloudConfig,
  onUserAction,
  currentUser
}) => {
  const [activeSection, setActiveSection] = useState<'CATEGORIES' | 'USERS' | 'ARCHIVE' | 'CLOUD' | 'DOCS' | 'PORTFOLIO'>('CATEGORIES');
  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState<'INCOME' | 'EXPENSE' | 'BOTH'>('EXPENSE');
  
  const [archiveSearch, setArchiveSearch] = useState('');
  const deferredArchiveSearch = useDeferredValue(archiveSearch); // SMOOTH TYPING

  // Archive Selection & Editing
  const [selectedArchiveIds, setSelectedArchiveIds] = useState<Set<string>>(new Set());
  const [isArchiveEditing, setIsArchiveEditing] = useState(false);
  const [isBulkEditing, setIsBulkEditing] = useState(false);
  const [archiveEditForm, setArchiveEditForm] = useState<Transaction | null>(null);
  const [bulkEditForm, setBulkEditForm] = useState<{ category: string, accountId: string, notes: string }>({ category: '', accountId: '', notes: '' });

  // Cloud Config State
  const [tempBinId, setTempBinId] = useState(cloudConfig.binId);
  const [tempApiKey, setTempApiKey] = useState(cloudConfig.apiKey);
  const [isCloudUnlocked, setIsCloudUnlocked] = useState(false);
  const [adminPinInput, setAdminPinInput] = useState('');

  // User Management State
  const [isUserEditing, setIsUserEditing] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState<Partial<User>>({
      name: '', email: '', phone: '', role: 'VIEWER', status: 'ACTIVE', momoNumber: '', accessCode: '', permissions: []
  });

  // Category Editing state
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [editCatType, setEditCatType] = useState<'INCOME' | 'EXPENSE' | 'BOTH'>('EXPENSE');

  // Transaction Editing State
  const [editingTransId, setEditingTransId] = useState<string | null>(null);
  const [editTransData, setEditTransData] = useState<Transaction | null>(null);

  useEffect(() => {
      // Sync props to temp state when unlocked
      if (isCloudUnlocked) {
          setTempBinId(cloudConfig.binId);
          setTempApiKey(cloudConfig.apiKey);
      }
  }, [cloudConfig, isCloudUnlocked]);

  // Clear selection when search changes or tab changes
  useEffect(() => {
      setSelectedArchiveIds(new Set());
  }, [activeSection, deferredArchiveSearch]);

  const handleAddCategory = () => {
    if (!newCatName) return;
    onAddCategory({
        id: Math.random().toString(36).substr(2, 9),
        name: newCatName,
        type: newCatType
    });
    setNewCatName('');
  };

  const startEditingCat = (cat: Category) => {
    setEditingCatId(cat.id);
    setEditCatName(cat.name);
    setEditCatType(cat.type);
  };

  const cancelEditingCat = () => {
    setEditingCatId(null);
    setEditCatName('');
    setEditCatType('EXPENSE');
  };

  const saveEditingCat = () => {
    if (editingCatId && editCatName) {
      onEditCategory({
        id: editingCatId,
        name: editCatName,
        type: editCatType
      });
      cancelEditingCat();
    }
  };

  // Archive Selection Handlers
  const toggleSelectArchive = (id: string) => {
      const newSet = new Set(selectedArchiveIds);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setSelectedArchiveIds(newSet);
  };

  const toggleSelectAll = (filteredItems: Transaction[]) => {
      if (selectedArchiveIds.size === filteredItems.length && filteredItems.length > 0) {
          setSelectedArchiveIds(new Set());
      } else {
          setSelectedArchiveIds(new Set(filteredItems.map(t => t.id)));
      }
  };

  // Archive Edit Handlers (Single & Bulk)
  const handleEditArchive = (t: Transaction) => {
      setArchiveEditForm({...t});
      setIsArchiveEditing(true);
      setIsBulkEditing(false);
  };

  const handleBulkEditStart = () => {
      setBulkEditForm({ category: '', accountId: '', notes: '' });
      setIsBulkEditing(true);
      setIsArchiveEditing(true);
  };

  const handleSaveArchiveEdit = () => {
      if (isBulkEditing) {
          const updates = archivedTransactions
              .filter(t => selectedArchiveIds.has(t.id))
              .map(t => ({
                  ...t,
                  category: bulkEditForm.category || t.category,
                  accountId: bulkEditForm.accountId ? (bulkEditForm.accountId as AccountType) : t.accountId,
                  notes: bulkEditForm.notes ? t.notes + ' ' + bulkEditForm.notes : t.notes
              }));
          onUpdateTransaction(updates);
      } else if (archiveEditForm) {
          onUpdateTransaction(archiveEditForm);
      }
      setIsArchiveEditing(false);
      setIsBulkEditing(false);
      setArchiveEditForm(null);
      setSelectedArchiveIds(new Set());
  };

  // Security & Cloud Logic
  const handleUnlockCloud = () => {
      if (adminPinInput === ADMIN_PIN) {
          setIsCloudUnlocked(true);
          setAdminPinInput('');
      } else {
          alert('Incorrect PIN');
      }
  };

  const handleSaveCloudConfig = () => {
      onUpdateCloudConfig(tempBinId, tempApiKey);
      setIsCloudUnlocked(false);
      alert('Credentials saved securely.');
  };

  // User Management Logic
  const handleOpenUserForm = (user?: User) => {
    if (!isCloudUnlocked) {
        const pin = prompt("Enter Admin PIN to manage users:");
        if (pin !== ADMIN_PIN) {
            alert("Access Denied");
            return;
        }
        setIsCloudUnlocked(true); // Temporarily unlock session for management
    }
    
    if (user) {
        setSelectedUser(user);
        setUserForm({ ...user, accessCode: '' });
    } else {
        setSelectedUser(null);
        setUserForm({ name: '', email: '', phone: '', role: 'VIEWER', status: 'ACTIVE', momoNumber: '', accessCode: '', permissions: [] });
    }
    setIsUserEditing(true);
  };

  const handleSaveUser = async () => {
      if (!userForm.name || !userForm.role) return;
      
      const userToSave = { ...userForm };
      
      if (userForm.accessCode) {
          userToSave.accessCode = await hashAccessCode(userForm.accessCode);
      } else if (selectedUser) {
          userToSave.accessCode = selectedUser.accessCode;
      }
      
      if (selectedUser) {
          onUserAction('UPDATE', { ...selectedUser, ...userToSave } as User);
      } else {
          // UUID generation handles id if not present, but let's give it one or let App.tsx handle
          onUserAction('ADD', userToSave as User);
      }
      setIsUserEditing(false);
      setSelectedUser(null);
  };

  const handleExportData = () => {
      const dataStr = JSON.stringify({ transactions, categories, users }, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `cm-finance_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
          try {
              const result = event.target?.result as string;
              const parsed = JSON.parse(result);
              onImportData(parsed);
          } catch (err) {
              console.error(err);
              alert('Invalid file format. Please upload a valid Thesaurus backup file.');
          }
      };
      reader.readAsText(file);
      e.target.value = '';
  };

  const navItems = [
      { id: 'CATEGORIES', label: 'Categories' },
      ...(currentUser?.role === 'ADMIN' ? [{ id: 'USERS', label: 'Users' }] : []),
      { id: 'ARCHIVE', label: 'Archives' },
      { id: 'CLOUD', label: 'Cloud Sync' },
      { id: 'DOCS', label: 'System Manual' },
      { id: 'PORTFOLIO', label: 'Product Case Study' },
  ];

  const filteredArchive = useMemo(() => {
    return archivedTransactions.filter(t => 
        t.category.toLowerCase().includes(deferredArchiveSearch.toLowerCase()) || 
        t.notes?.toLowerCase().includes(deferredArchiveSearch.toLowerCase())
    ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [archivedTransactions, deferredArchiveSearch]);

  return (
    <div className="bg-white rounded-[2rem] shadow-xl shadow-gray-200/50 border border-gray-100 min-h-0 md:min-h-[600px] flex flex-col md:flex-row overflow-hidden">
      {/* Sidebar Navigation */}
      <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-gray-100 bg-gray-50/50 sticky top-0 z-10 md:static">
        <div className="p-8 hidden md:block">
            <h2 className="text-xl font-black text-gray-900 tracking-tighter uppercase">Vault Settings</h2>
            <p className="text-[9px] font-black text-gray-400 mt-1 uppercase tracking-widest">Configuration Panel</p>
        </div>
        <div className="flex md:flex-col flex-wrap justify-center p-3 md:p-4 md:pt-0 gap-2 bg-gray-50/50 backdrop-blur-sm">
            {navItems.map(item => (
                <button 
                    key={item.id}
                    onClick={() => setActiveSection(item.id as any)}
                    className={`min-w-[45%] md:w-full text-center md:text-left px-5 py-4 rounded-2xl transition-all text-xs font-black uppercase tracking-widest whitespace-nowrap ${
                        activeSection === item.id 
                        ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                        : 'text-gray-500 hover:bg-white hover:shadow-sm'
                    }`}
                >
                    {item.label}
                </button>
            ))}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 p-4 md:p-10 max-h-[calc(100vh-100px)] overflow-y-auto custom-scrollbar">
        
        {/* --- CATEGORIES SECTION --- */}
        {activeSection === 'CATEGORIES' && (
            <div className="space-y-8 animate-in fade-in duration-500">
                <div className="flex justify-between items-end border-b border-gray-100 pb-4">
                    <div>
                        <h3 className="text-xl md:text-2xl font-black text-gray-900 tracking-tighter uppercase">Classification Matrix</h3>
                        <p className="text-xs md:text-sm font-medium text-gray-400 mt-1">Manage financial categories and tagging.</p>
                    </div>
                </div>
                
                <div className="flex flex-col xl:flex-row gap-4 items-stretch xl:items-end bg-gray-50 p-6 rounded-[2rem] border border-gray-200 shadow-inner">
                    <div className="flex-1">
                        <label className="text-[10px] font-black text-gray-400 mb-2 block uppercase tracking-widest">New Category Name</label>
                        <input 
                            type="text" 
                            className="w-full p-4 border border-gray-100 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-primary/10 outline-none shadow-sm" 
                            value={newCatName}
                            onChange={(e) => setNewCatName(e.target.value)}
                            placeholder="e.g. Outreach Support"
                        />
                    </div>
                    <div className="w-full xl:w-48">
                         <label className="text-[10px] font-black text-gray-400 mb-2 block uppercase tracking-widest">Accounting Type</label>
                         <select 
                            className="w-full p-4 border border-gray-100 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-primary/10 outline-none shadow-sm bg-white cursor-pointer"
                            value={newCatType}
                            onChange={(e) => setNewCatType(e.target.value as any)}
                        >
                            <option value="EXPENSE">EXPENSE ONLY</option>
                            <option value="INCOME">INCOME ONLY</option>
                            <option value="BOTH">DUAL MODALITY</option>
                         </select>
                    </div>
                    <button 
                        onClick={handleAddCategory}
                        className="bg-primary text-white p-4 rounded-2xl hover:bg-teal-800 transition-all shadow-xl shadow-primary/20 flex justify-center items-center active:scale-95"
                    >
                        <Plus size={24} />
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {categories.map(cat => (
                        <div key={cat.id} className="flex justify-between items-center p-5 border border-gray-100 rounded-2xl hover:bg-gray-50 transition-all bg-white shadow-sm group min-h-[88px]">
                            {editingCatId === cat.id ? (
                                <div className="flex flex-col md:flex-row flex-1 items-stretch md:items-center gap-3 animate-in fade-in duration-200 w-full">
                                    <input 
                                        type="text" 
                                        value={editCatName}
                                        onChange={(e) => setEditCatName(e.target.value)}
                                        className="flex-1 p-3 md:p-2 border border-gray-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none"
                                        autoFocus
                                        placeholder="Category Name"
                                    />
                                    <select 
                                        value={editCatType}
                                        onChange={(e) => setEditCatType(e.target.value as any)}
                                        className="p-3 md:p-2 border border-gray-200 rounded-xl text-xs font-black uppercase tracking-widest bg-white outline-none focus:ring-2 focus:ring-primary/20"
                                    >
                                        <option value="EXPENSE">EXPENSE</option>
                                        <option value="INCOME">INCOME</option>
                                        <option value="BOTH">BOTH</option>
                                    </select>
                                    <div className="flex gap-2 justify-end">
                                        <button onClick={saveEditingCat} className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-colors">
                                            <Check size={18} />
                                        </button>
                                        <button onClick={cancelEditingCat} className="p-2 bg-gray-50 text-gray-400 rounded-xl hover:bg-gray-100 transition-colors">
                                            <X size={18} />
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div>
                                        <span className="font-bold text-gray-800 block text-sm">{cat.name}</span>
                                        <span className={`text-[9px] px-2 py-0.5 rounded-lg uppercase font-black tracking-widest mt-1 inline-block ${
                                            cat.type === 'INCOME' ? 'bg-emerald-100 text-emerald-800' :
                                            cat.type === 'EXPENSE' ? 'bg-rose-100 text-rose-800' : 'bg-blue-100 text-blue-800'
                                        }`}>{cat.type}</span>
                                    </div>
                                    <div className="flex items-center gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => startEditingCat(cat)} className="text-gray-400 hover:text-primary p-2 hover:bg-primary/5 rounded-xl transition-all">
                                            <Edit2 size={18} />
                                        </button>
                                        <button onClick={() => onDeleteCategory(cat.id)} className="text-gray-400 hover:text-rose-600 p-2 hover:bg-rose-50 rounded-xl transition-all">
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* ... (USERS section included below to maintain file structure) ... */}
        {activeSection === 'USERS' && (
             <div className="space-y-8 animate-in fade-in duration-500">
                 <div className="flex justify-between items-end border-b border-gray-100 pb-4">
                    <div>
                        <h3 className="text-xl md:text-2xl font-black text-gray-900 tracking-tighter uppercase">Personnel Directory</h3>
                        <p className="text-xs md:text-sm font-medium text-gray-400 mt-1">Authorized ministry finance representatives.</p>
                    </div>
                    <button 
                        onClick={() => handleOpenUserForm()}
                        className="flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-800 transition-all shadow-lg active:scale-95"
                    >
                        <UserPlus size={16} /> Add User
                    </button>
                 </div>
                 
                 {isUserEditing ? (
                     <div className="bg-gray-50 p-6 rounded-[2rem] border border-gray-200 animate-in slide-in-from-right duration-300">
                         <h4 className="font-black text-gray-900 uppercase tracking-widest text-sm mb-6">{selectedUser ? 'Edit User' : 'New User'}</h4>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                             <div>
                                 <label className="text-[10px] font-black text-gray-400 mb-2 block uppercase tracking-widest">Full Name</label>
                                 <input className="w-full p-4 border border-gray-100 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-primary/10 outline-none bg-white" 
                                    value={userForm.name} onChange={e => setUserForm({...userForm, name: e.target.value})} placeholder="John Doe" />
                             </div>
                             <div>
                                 <label className="text-[10px] font-black text-gray-400 mb-2 block uppercase tracking-widest">Email</label>
                                 <input className="w-full p-4 border border-gray-100 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-primary/10 outline-none bg-white" 
                                    value={userForm.email} onChange={e => setUserForm({...userForm, email: e.target.value})} placeholder="john@example.com" />
                             </div>
                             <div>
                                 <label className="text-[10px] font-black text-gray-400 mb-2 block uppercase tracking-widest">Phone</label>
                                 <input className="w-full p-4 border border-gray-100 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-primary/10 outline-none bg-white" 
                                    value={userForm.phone} onChange={e => setUserForm({...userForm, phone: e.target.value})} placeholder="024..." />
                             </div>
                             <div>
                                 <label className="text-[10px] font-black text-gray-400 mb-2 block uppercase tracking-widest">MoMo Number (Beneficiary)</label>
                                 <input className="w-full p-4 border border-gray-100 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-primary/10 outline-none bg-white" 
                                    value={userForm.momoNumber || ''} onChange={e => setUserForm({...userForm, momoNumber: e.target.value})} placeholder="024..." />
                             </div>
                             <div>
                                 <label className="text-[10px] font-black text-gray-400 mb-2 block uppercase tracking-widest">System Role</label>
                                 <select className="w-full p-4 border border-gray-100 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-primary/10 outline-none bg-white cursor-pointer"
                                     value={userForm.role} onChange={e => setUserForm({...userForm, role: e.target.value as any})}>
                                     <option value="VIEWER">VIEWER (Read Only)</option>
                                     <option value="FINANCE_REP">FINANCE REP (Editor)</option>
                                     <option value="ADMIN">ADMINISTRATOR (Full Access)</option>
                                 </select>
                             </div>
                             <div>
                                 <label className="text-[10px] font-black text-gray-400 mb-2 block uppercase tracking-widest">Login Access Code</label>
                                 <input className="w-full p-4 border border-gray-100 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-primary/10 outline-none bg-white placeholder:text-gray-400 placeholder:text-[10px] placeholder:tracking-widest placeholder:uppercase" 
                                    type="text" inputMode="numeric" pattern="[0-9]*"
                                    value={userForm.accessCode || ''} onChange={e => setUserForm({...userForm, accessCode: e.target.value.replace(/\D/g, '')})} placeholder={selectedUser ? "Leave blank to keep existing" : "Provide access code"} />
                             </div>
                         </div>
                         
                         {userForm.role !== 'ADMIN' && (
                             <div className="mb-6 bg-white p-4 rounded-2xl border border-gray-100">
                                 <label className="text-[10px] font-black text-gray-400 mb-4 block uppercase tracking-widest">App Component Permissions</label>
                                 <div className="flex flex-wrap gap-3">
                                     {[
                                         { id: 'VIEW_OVERVIEW', label: 'Overview' },
                                         { id: 'VIEW_TRANSACTIONS', label: 'Transactions (View)' },
                                         { id: 'EDIT_TRANSACTIONS', label: 'Transactions (Edit)' },
                                         { id: 'VIEW_REPORTS', label: 'Reports' },
                                         { id: 'VIEW_SETTINGS', label: 'Settings' }
                                     ].map(perm => (
                                         <button 
                                             key={perm.id}
                                             onClick={() => {
                                                 const perms = userForm.permissions || [];
                                                 if (perms.includes(perm.id as any)) {
                                                     setUserForm({...userForm, permissions: perms.filter(p => p !== perm.id as any)});
                                                 } else {
                                                     setUserForm({...userForm, permissions: [...perms, perm.id as any]});
                                                 }
                                             }}
                                             className={`px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border ${userForm.permissions?.includes(perm.id as any) ? 'bg-primary/10 text-primary border-primary/20' : 'bg-gray-50 text-gray-400 border-gray-100 hover:bg-gray-100'}`}
                                         >
                                             {userForm.permissions?.includes(perm.id as any) && <Check size={12} className="inline mr-1" />}
                                             {perm.label}
                                         </button>
                                     ))}
                                 </div>
                             </div>
                         )}

                         <div className="flex justify-end gap-3 mt-4">
                             <button onClick={() => setIsUserEditing(false)} className="px-6 py-3 rounded-2xl bg-gray-100 text-gray-500 font-bold hover:bg-gray-200">Cancel</button>
                             <button onClick={handleSaveUser} className="px-6 py-3 rounded-2xl bg-primary text-white font-bold hover:bg-teal-800 shadow-lg">Save User</button>
                         </div>
                     </div>
                 ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {users.map(user => (
                            <div key={user.id} className={`p-6 border rounded-[2rem] flex items-center justify-between shadow-sm transition-all ${user.status === 'DISABLED' ? 'bg-gray-100 border-gray-200 opacity-75' : 'bg-white border-gray-100'}`}>
                                <div className="flex items-center gap-4">
                                    <div className={`h-14 w-14 rounded-2xl flex items-center justify-center font-black text-xl ${user.status === 'DISABLED' ? 'bg-gray-200 text-gray-400' : 'bg-primary/10 text-primary'}`}>
                                        {user.name.charAt(0)}
                                    </div>
                                    <div>
                                        <p className="font-black text-gray-900 tracking-tight flex items-center gap-2">
                                            {user.name} 
                                            {user.status === 'DISABLED' && <span className="text-[8px] bg-gray-200 text-gray-500 px-2 py-0.5 rounded-md uppercase tracking-widest">Disabled</span>}
                                        </p>
                                        <p className="text-xs text-gray-500 font-medium">{user.email}</p>
                                        <div className="flex gap-2 mt-1">
                                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{user.role}</p>
                                            {user.momoNumber && <span className="flex items-center gap-1 text-[9px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded font-bold"><Smartphone size={10} /> {user.momoNumber}</span>}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => handleOpenUserForm(user)} className="p-3 hover:bg-gray-100 rounded-xl text-gray-400 hover:text-gray-900 transition-colors">
                                        <Edit2 size={18} />
                                    </button>
                                    <button 
                                        onClick={() => onUserAction(user.status === 'ACTIVE' ? 'DELETE' : 'UPDATE', { ...user, status: user.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE' })}
                                        className={`p-3 rounded-xl transition-colors ${user.status === 'ACTIVE' ? 'hover:bg-rose-50 text-gray-400 hover:text-rose-500' : 'hover:bg-emerald-50 text-gray-400 hover:text-emerald-500'}`}
                                        title={user.status === 'ACTIVE' ? "Disable User" : "Enable User"}
                                    >
                                        {user.status === 'ACTIVE' ? <Trash2 size={18} /> : <Check size={18} />}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                 )}
             </div>
        )}

        {activeSection === 'ARCHIVE' && (
             <div className="space-y-6 animate-in fade-in duration-500">
                 <div className="flex flex-col gap-4">
                    <div className="flex justify-between items-center border-b border-gray-100 pb-4">
                         <div>
                            <h3 className="text-xl md:text-2xl font-black text-gray-900 tracking-tighter uppercase">Archived Records</h3>
                            <p className="text-xs md:text-sm font-medium text-gray-400 mt-1">View, restore, or modify soft-deleted transactions.</p>
                         </div>
                    </div>
                    
                    <div className="flex gap-3">
                         <div className="relative flex-1">
                             <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                             <input 
                                 type="text" 
                                 placeholder="Search archives..."
                                 value={archiveSearch}
                                 onChange={(e) => setArchiveSearch(e.target.value)}
                                 className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-primary/10"
                             />
                         </div>
                         {/* Bulk Action Bar - Appears when items are selected */}
                         {selectedArchiveIds.size > 0 && (
                             <div className="flex items-center gap-2 animate-in slide-in-from-right duration-300">
                                 <button onClick={handleBulkEditStart} className="px-4 py-3 bg-blue-50 text-blue-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-100 transition-colors whitespace-nowrap">
                                    <Edit2 size={16} className="inline mr-2 mb-0.5" /> Edit ({selectedArchiveIds.size})
                                 </button>
                                 <button onClick={() => { if(confirm(`Restore ${selectedArchiveIds.size} items?`)) { onRestoreTransaction(Array.from(selectedArchiveIds)); setSelectedArchiveIds(new Set()); } }} className="px-4 py-3 bg-emerald-50 text-emerald-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-colors whitespace-nowrap">
                                    <RefreshCw size={16} className="inline mr-2 mb-0.5" /> Restore ({selectedArchiveIds.size})
                                 </button>
                                 <button onClick={() => { if(confirm(`PERMANENTLY DELETE ${selectedArchiveIds.size} items? This cannot be undone.`)) { onPermanentlyDelete(Array.from(selectedArchiveIds)); setSelectedArchiveIds(new Set()); } }} className="px-4 py-3 bg-rose-50 text-rose-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-100 transition-colors whitespace-nowrap">
                                    <Trash2 size={16} className="inline mr-2 mb-0.5" /> Delete ({selectedArchiveIds.size})
                                 </button>
                             </div>
                         )}
                    </div>
                 </div>

                 {filteredArchive.length === 0 ? (
                     <div className="py-20 flex flex-col items-center justify-center text-gray-400">
                         <Archive size={48} className="mb-4 text-gray-200" />
                         <p className="text-sm font-bold">No archived items found.</p>
                     </div>
                 ) : (
                     <div className="space-y-4">
                         {/* Select All Header */}
                         <div className="flex items-center gap-4 px-4 py-2 border-b border-gray-100">
                             <button onClick={() => toggleSelectAll(filteredArchive)} className="text-gray-400 hover:text-primary transition-colors">
                                 {selectedArchiveIds.size === filteredArchive.length && filteredArchive.length > 0 ? <CheckSquare size={20} className="text-primary"/> : <Square size={20} />}
                             </button>
                             <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Select All {filteredArchive.length > 0 && `(${filteredArchive.length})`}</span>
                         </div>

                         {filteredArchive.map(t => (
                             <div key={t.id} className={`p-4 rounded-2xl border flex flex-col md:flex-row items-center justify-between gap-4 group transition-all cursor-pointer ${selectedArchiveIds.has(t.id) ? 'bg-primary/5 border-primary/20' : 'bg-gray-50 border-gray-100 hover:bg-white hover:shadow-md'}`}
                                  onClick={() => toggleSelectArchive(t.id)}
                             >
                                 <div className="flex items-center gap-4 flex-1 w-full">
                                     <div onClick={(e) => { e.stopPropagation(); toggleSelectArchive(t.id); }} className="text-gray-300 hover:text-primary cursor-pointer">
                                         {selectedArchiveIds.has(t.id) ? <CheckSquare size={24} className="text-primary" /> : <Square size={24} />}
                                     </div>
                                     <div className="bg-gray-200 p-3 rounded-xl min-w-[50px] text-center">
                                         <p className="text-[10px] font-black text-gray-500 uppercase">{new Date(t.date).toLocaleString('default', {month:'short'})}</p>
                                         <p className="text-lg font-black text-gray-700 leading-none">{new Date(t.date).getDate()}</p>
                                     </div>
                                     <div className="flex-1 min-w-0">
                                         <h4 className="font-bold text-gray-800 text-sm truncate">{t.category}</h4>
                                         <div className="flex items-center gap-2 mt-1">
                                             <span className="text-[9px] font-black uppercase tracking-widest text-gray-400 bg-gray-200 px-2 py-0.5 rounded-md">{t.type}</span>
                                             <span className="text-[10px] text-gray-500 truncate">{t.accountId}</span>
                                         </div>
                                         {t.notes && <p className="text-[10px] text-gray-400 italic mt-1 line-clamp-1">{t.notes}</p>}
                                     </div>
                                 </div>
                                 
                                 <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                                     <p className="font-black text-gray-500 text-lg">{formatCurrency(t.amount)}</p>
                                     <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                                         <button onClick={() => handleEditArchive(t)} className="p-2 bg-white border border-gray-200 text-blue-600 rounded-xl hover:bg-blue-50 transition-colors" title="Edit Record">
                                             <Edit2 size={16} />
                                         </button>
                                         <button onClick={() => onRestoreTransaction(t.id)} className="p-2 bg-white border border-gray-200 text-emerald-600 rounded-xl hover:bg-emerald-50 transition-colors" title="Restore">
                                             <RefreshCw size={16} />
                                         </button>
                                         <button onClick={() => { if(confirm('WARNING: Permanently delete this record?')) onPermanentlyDelete(t.id) }} className="p-2 bg-white border border-gray-200 text-rose-600 rounded-xl hover:bg-rose-50 transition-colors" title="Delete Forever">
                                             <Trash2 size={16} />
                                         </button>
                                     </div>
                                 </div>
                             </div>
                         ))}
                     </div>
                 )}
             </div>
        )}

        {/* Universal Archive Edit Modal (Handles both Single and Bulk) */}
        {isArchiveEditing && (archiveEditForm || isBulkEditing) && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white rounded-[2rem] p-6 md:p-8 w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight">
                            {isBulkEditing ? `Bulk Edit (${selectedArchiveIds.size} items)` : 'Modify Archived Record'}
                        </h3>
                        <button onClick={() => { setIsArchiveEditing(false); setIsBulkEditing(false); }} className="p-2 bg-gray-50 rounded-full text-gray-400 hover:text-gray-900"><X size={20}/></button>
                    </div>
                    <div className="space-y-4">
                        {!isBulkEditing && archiveEditForm && (
                             <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 mb-1 block uppercase tracking-widest">Date</label>
                                    <input type="date" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold outline-none" 
                                        value={archiveEditForm.date} onChange={e => setArchiveEditForm({...archiveEditForm, date: e.target.value})} />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 mb-1 block uppercase tracking-widest">Amount</label>
                                    <input type="number" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold outline-none" 
                                        value={archiveEditForm.amount} onChange={e => setArchiveEditForm({...archiveEditForm, amount: parseFloat(e.target.value)})} />
                                </div>
                             </div>
                        )}

                        <div>
                            <label className="text-[10px] font-black text-gray-400 mb-1 block uppercase tracking-widest">Category {isBulkEditing && '(Optional)'}</label>
                            <select className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold outline-none"
                                value={isBulkEditing ? bulkEditForm.category : archiveEditForm?.category} 
                                onChange={e => isBulkEditing ? setBulkEditForm({...bulkEditForm, category: e.target.value}) : setArchiveEditForm({...archiveEditForm!, category: e.target.value})}>
                                {isBulkEditing && <option value="">(Keep Original)</option>}
                                {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                            </select>
                        </div>

                         <div>
                            <label className="text-[10px] font-black text-gray-400 mb-1 block uppercase tracking-widest">Account {isBulkEditing && '(Optional)'}</label>
                            <select className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold outline-none"
                                value={isBulkEditing ? bulkEditForm.accountId : archiveEditForm?.accountId} 
                                onChange={e => isBulkEditing ? setBulkEditForm({...bulkEditForm, accountId: e.target.value}) : setArchiveEditForm({...archiveEditForm!, accountId: e.target.value as AccountType})}>
                                {isBulkEditing && <option value="">(Keep Original)</option>}
                                {[AccountType.CASH, AccountType.MOMO, AccountType.OTHER].map(a => <option key={a} value={a}>{a}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="text-[10px] font-black text-gray-400 mb-1 block uppercase tracking-widest">Notes {isBulkEditing && '(Appends to existing)'}</label>
                            <textarea className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold outline-none" rows={3}
                                value={isBulkEditing ? bulkEditForm.notes : archiveEditForm?.notes || ''} 
                                onChange={e => isBulkEditing ? setBulkEditForm({...bulkEditForm, notes: e.target.value}) : setArchiveEditForm({...archiveEditForm!, notes: e.target.value})} 
                            />
                        </div>
                        
                        <button onClick={handleSaveArchiveEdit} className="w-full py-4 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-700 shadow-lg mt-4">
                            {isBulkEditing ? 'Apply Changes to Selected' : 'Save Changes'}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {activeSection === 'CLOUD' && (
            <div className="space-y-8 animate-in fade-in duration-500">
                <div className="flex justify-between items-end border-b border-gray-100 pb-4">
                    <div>
                        <h3 className="text-xl md:text-2xl font-black text-gray-900 tracking-tighter uppercase">Cloud Integration</h3>
                        <p className="text-xs md:text-sm font-medium text-gray-400 mt-1">Manage remote synchronization via JSONBin.io.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* JSONBin Config Card */}
                    <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-xl shadow-gray-200/50 flex flex-col h-full relative overflow-hidden">
                        <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mb-6">
                            <Cloud size={24} />
                        </div>
                        <h4 className="text-xl font-black text-gray-900 tracking-tight mb-4">JSONBin Credentials</h4>
                        
                        {/* Lock Overlay */}
                        {!isCloudUnlocked && cloudConfig.apiKey && (
                            <div className="absolute inset-0 bg-white/90 backdrop-blur-sm z-20 flex flex-col items-center justify-center text-center p-8">
                                <div className="p-4 bg-gray-50 rounded-full mb-4">
                                    <Shield size={32} className="text-emerald-600" />
                                </div>
                                <h5 className="font-black text-lg text-gray-900 uppercase tracking-tight mb-2">Secure Vault</h5>
                                <p className="text-xs text-gray-500 mb-6 max-w-[200px]">Credentials are masked for security. Enter Admin PIN to view or edit.</p>
                                <div className="flex gap-2">
                                    <input 
                                        type="password" 
                                        placeholder="PIN" 
                                        className="w-20 p-3 bg-gray-50 border border-gray-200 rounded-xl text-center font-bold tracking-widest focus:outline-none focus:ring-4 focus:ring-emerald-500/10"
                                        maxLength={4}
                                        value={adminPinInput}
                                        onChange={(e) => setAdminPinInput(e.target.value)}
                                    />
                                    <button onClick={handleUnlockCloud} className="px-6 py-3 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-700 transition-all">Unlock</button>
                                </div>
                            </div>
                        )}

                        <div className="space-y-4 flex-1">
                            <div>
                                <label className="flex items-center gap-2 text-[10px] font-black text-gray-400 mb-2 uppercase tracking-widest"><Lock size={12}/> Bin ID</label>
                                <input 
                                    type={isCloudUnlocked ? "text" : "password"}
                                    disabled={!isCloudUnlocked && !!cloudConfig.binId}
                                    className="w-full p-4 border border-gray-100 rounded-2xl text-xs font-bold focus:ring-4 focus:ring-primary/10 outline-none shadow-sm font-mono disabled:bg-gray-50 disabled:text-gray-400" 
                                    value={isCloudUnlocked ? tempBinId : (cloudConfig.binId ? '••••••••••••••••' : tempBinId)}
                                    onChange={(e) => setTempBinId(e.target.value)}
                                    placeholder="67a21..."
                                    autoComplete="off"
                                />
                            </div>
                            <div>
                                <label className="flex items-center gap-2 text-[10px] font-black text-gray-400 mb-2 uppercase tracking-widest"><Key size={12}/> X-Master-Key</label>
                                <input 
                                    type="password" 
                                    disabled={!isCloudUnlocked && !!cloudConfig.apiKey}
                                    className="w-full p-4 border border-gray-100 rounded-2xl text-xs font-bold focus:ring-4 focus:ring-primary/10 outline-none shadow-sm font-mono disabled:bg-gray-50 disabled:text-gray-400" 
                                    value={isCloudUnlocked ? tempApiKey : (cloudConfig.apiKey ? '••••••••••••••••••••••••••••••••' : tempApiKey)}
                                    onChange={(e) => setTempApiKey(e.target.value)}
                                    placeholder="$2b$10..."
                                    autoComplete="off"
                                />
                            </div>
                        </div>
                        <button 
                            onClick={handleSaveCloudConfig}
                            disabled={!isCloudUnlocked && !!cloudConfig.apiKey}
                            className="w-full mt-8 py-4 bg-primary text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-teal-800 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Cloud size={16} /> {cloudConfig.apiKey ? 'Update Credentials' : 'Connect & Sync'}
                        </button>
                    </div>

                    {/* Manual Backup Card */}
                    <div className="bg-gray-50 p-8 rounded-[2.5rem] border border-gray-200 flex flex-col h-full">
                        <div>
                            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-gray-400 mb-6 shadow-sm border border-gray-100">
                                <Database size={24} />
                            </div>
                            <h4 className="text-xl font-black text-gray-900 tracking-tight mb-2">Manual File Backup</h4>
                            <p className="text-xs text-gray-500 leading-relaxed mb-6">
                                If cloud sync is unavailable, you can manually export your data to a JSON file or restore from a previous file.
                            </p>
                        </div>
                        <div className="space-y-4 mt-auto">
                             <button 
                                onClick={handleExportData}
                                className="w-full py-4 bg-white border border-gray-200 text-gray-700 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-gray-50 transition-all flex items-center justify-center gap-3 shadow-sm"
                            >
                                <Download size={16} /> Download File
                            </button>
                             <div className="relative">
                                 <input 
                                    type="file" 
                                    accept=".json"
                                    onChange={handleImportFile}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                 />
                                 <button className="w-full py-4 bg-white border border-gray-200 text-gray-700 rounded-2xl text-xs font-black uppercase tracking-widest hover:border-gray-300 hover:bg-gray-50 transition-all flex items-center justify-center gap-3 shadow-sm">
                                    <Upload size={16} /> Restore from File
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* --- SYSTEM DOCS (MANUAL) --- */}
        {activeSection === 'DOCS' && (
            <div className="space-y-8 animate-in fade-in duration-500 max-w-4xl mx-auto">
                <div className="flex items-center gap-4 border-b border-gray-100 pb-6">
                    <div className="p-4 bg-primary/5 rounded-2xl text-primary">
                        <BookOpen size={32} />
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-gray-900 tracking-tighter uppercase">System Specification & User Manual</h3>
                        <p className="text-sm font-medium text-gray-400 mt-1">Comprehensive guide to system architecture and user workflows.</p>
                    </div>
                </div>

                {/* 1. System Overview */}
                <div className="bg-gray-50 p-8 rounded-[2.5rem] border border-gray-100">
                    <h4 className="flex items-center gap-2 text-sm font-black text-gray-900 uppercase tracking-widest mb-4">
                        <Activity size={16} className="text-primary"/> 1. System Overview
                    </h4>
                    <p className="text-gray-600 text-sm leading-relaxed mb-4">
                        The <strong>Thesaurus CM Finance App</strong> is a bespoke Progressive Web Application (PWA) designed to digitize the Children's Ministry financial operations. It replaces Excel-based workflows with a secure, real-time ledger system that handles income tracking, expense management, and automated reporting.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                        <div className="bg-white p-4 rounded-2xl border border-gray-100">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Architecture</span>
                            <span className="font-bold text-gray-800 text-sm">React 19 + TypeScript (Frontend)</span>
                        </div>
                        <div className="bg-white p-4 rounded-2xl border border-gray-100">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Storage Strategy</span>
                            <span className="font-bold text-gray-800 text-sm">Hybrid: LocalStorage + JSONBin Cloud Sync</span>
                        </div>
                    </div>
                </div>

                {/* 2. Core Modules */}
                <div className="space-y-6">
                     <h4 className="flex items-center gap-2 text-sm font-black text-gray-900 uppercase tracking-widest px-2">
                        <Layers size={16} className="text-primary"/> 2. Core Functional Modules
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="p-6 border border-gray-200 rounded-[2rem] hover:border-primary/30 transition-colors group">
                            <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-4 group-hover:bg-emerald-100 transition-colors"><Map size={20}/></div>
                            <h5 className="font-bold text-gray-900 mb-2">Dashboard (Overview)</h5>
                            <ul className="text-xs text-gray-500 space-y-2 list-disc pl-4">
                                <li>Real-time visualization of Income vs. Expenses.</li>
                                <li>Net Balance calculation across fiscal periods.</li>
                                <li>Account-specific breakdowns (Cash vs. MoMo).</li>
                            </ul>
                        </div>

                        <div className="p-6 border border-gray-200 rounded-[2rem] hover:border-primary/30 transition-colors group">
                            <div className="w-10 h-10 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center mb-4 group-hover:bg-rose-100 transition-colors"><FileText size={20}/></div>
                            <h5 className="font-bold text-gray-900 mb-2">Ledger (Transactions)</h5>
                            <ul className="text-xs text-gray-500 space-y-2 list-disc pl-4">
                                <li><strong>Batch Entry System:</strong> Add multiple records simultaneously.</li>
                                <li><strong>Classification:</strong> Smart categorization (Income/Expense/Transfer).</li>
                                <li><strong>Audit Trail:</strong> View, Edit, and Archive capabilities with soft-delete safety.</li>
                            </ul>
                        </div>

                        <div className="p-6 border border-gray-200 rounded-[2rem] hover:border-primary/30 transition-colors group">
                             <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-4 group-hover:bg-blue-100 transition-colors"><GitMerge size={20}/></div>
                            <h5 className="font-bold text-gray-900 mb-2">Reporting & Reconciliation</h5>
                            <ul className="text-xs text-gray-500 space-y-2 list-disc pl-4">
                                <li><strong>Weekly Analysis:</strong> Specialized view for Sunday Offerings vs. Weekly Expenses.</li>
                                <li><strong>Auto-Reconciliation:</strong> Logic to handle Surplus (Transfer to Finance) vs. Deficit (Request from Finance).</li>
                                <li><strong>WhatsApp Integration:</strong> One-click generation of formatted financial reports.</li>
                            </ul>
                        </div>
                        
                         <div className="p-6 border border-gray-200 rounded-[2rem] hover:border-primary/30 transition-colors group">
                             <div className="w-10 h-10 bg-violet-50 text-violet-600 rounded-xl flex items-center justify-center mb-4 group-hover:bg-violet-100 transition-colors"><ShieldCheck size={20}/></div>
                            <h5 className="font-bold text-gray-900 mb-2">Admin & Security</h5>
                            <ul className="text-xs text-gray-500 space-y-2 list-disc pl-4">
                                <li><strong>Cloud Sync:</strong> Encrypted JSON storage via JSONBin.io.</li>
                                <li><strong>User Management:</strong> Role-based access control (Admin, Finance Rep, Viewer).</li>
                                <li><strong>Archives:</strong> Recovery system for deleted records.</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* 3. The "Sunday Flow" User Journey */}
                <div className="bg-gray-900 text-white p-8 rounded-[2.5rem] shadow-2xl">
                    <h4 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest mb-6 text-emerald-400">
                        <Activity size={16}/> 3. The "Sunday Flow" User Journey
                    </h4>
                    
                    <div className="space-y-8 relative before:absolute before:left-4 before:top-4 before:bottom-4 before:w-0.5 before:bg-gray-700">
                        <div className="relative pl-12">
                            <div className="absolute left-0 top-0 w-8 h-8 bg-gray-800 border-2 border-emerald-500 rounded-full flex items-center justify-center text-xs font-bold">1</div>
                            <h5 className="font-bold text-lg mb-1">Data Entry</h5>
                            <p className="text-xs text-gray-400 leading-relaxed">
                                Log <strong>Sunday Offerings</strong> (Cash & MoMo) via the Transactions tab. Input expected weekly expenses (Snacks, Transport, etc.).
                            </p>
                        </div>

                        <div className="relative pl-12">
                            <div className="absolute left-0 top-0 w-8 h-8 bg-gray-800 border-2 border-emerald-500 rounded-full flex items-center justify-center text-xs font-bold">2</div>
                            <h5 className="font-bold text-lg mb-1">Review Weekly Report</h5>
                            <p className="text-xs text-gray-400 leading-relaxed">
                                Navigate to the <strong>Reports</strong> tab. The system aggregates all entries for the week, calculating Total Income, Total Expense, and the critical <strong>Cash Balance</strong>.
                            </p>
                        </div>

                        <div className="relative pl-12">
                            <div className="absolute left-0 top-0 w-8 h-8 bg-gray-800 border-2 border-emerald-500 rounded-full flex items-center justify-center text-xs font-bold">3</div>
                            <h5 className="font-bold text-lg mb-1">Reconciliation Decision</h5>
                            <p className="text-xs text-gray-400 leading-relaxed mb-3">The system automatically detects the financial position:</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="bg-gray-800 p-3 rounded-xl border border-gray-700">
                                    <span className="text-emerald-400 text-[10px] font-black uppercase block mb-1">Scenario A: Surplus</span>
                                    <p className="text-[10px] text-gray-300">Cash Balance &gt; 0. Action: Initiate Transfer transaction moving excess Cash to MoMo (Finance).</p>
                                </div>
                                <div className="bg-gray-800 p-3 rounded-xl border border-gray-700">
                                    <span className="text-rose-400 text-[10px] font-black uppercase block mb-1">Scenario B: Deficit</span>
                                    <p className="text-[10px] text-gray-300">Cash Balance &lt; 0. Action: System flags need for top-up. Create Transfer from MoMo to Cash.</p>
                                </div>
                            </div>
                        </div>

                        <div className="relative pl-12">
                            <div className="absolute left-0 top-0 w-8 h-8 bg-gray-800 border-2 border-emerald-500 rounded-full flex items-center justify-center text-xs font-bold">4</div>
                            <h5 className="font-bold text-lg mb-1">Communication</h5>
                            <p className="text-xs text-gray-400 leading-relaxed">
                                Click <strong>Share on WhatsApp</strong>. 
                                If in Deficit, the app auto-generates a formal request message to the Finance Rep including the beneficiary details. 
                                If in Surplus, it generates a standard financial report.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="text-center pt-8 border-t border-gray-100">
                    <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.3em]">Thesaurus System V2.1 • Internal Use Only</p>
                </div>
            </div>
        )}

        {/* --- PORTFOLIO CASE STUDY --- */}
        {activeSection === 'PORTFOLIO' && (
            <div className="max-w-5xl mx-auto space-y-12 animate-in fade-in duration-700">
                {/* Hero */}
                <div className="text-center py-10 border-b border-gray-100">
                     <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-full mb-6">
                        <LayoutTemplate size={16} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Product Case Study</span>
                     </div>
                     <h1 className="text-4xl md:text-6xl font-black text-gray-900 tracking-tighter mb-4">Thesaurus CM Finance</h1>
                     <p className="text-lg text-gray-500 max-w-2xl mx-auto font-medium">
                         Digitizing the financial operations of the Children's Ministry with a focus on accountability, speed, and automated reporting.
                     </p>
                </div>

                {/* Problem & Solution */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-xl shadow-gray-200/40 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-5">
                            <AlertTriangle size={120} />
                        </div>
                        <h3 className="flex items-center gap-3 text-lg font-black uppercase tracking-wide text-rose-600 mb-4">
                            <div className="p-2 bg-rose-50 rounded-lg"><AlertTriangle size={20}/></div>
                            The Problem
                        </h3>
                        <p className="text-gray-600 leading-relaxed text-sm mb-4">
                            The Ministry previously relied on <strong>manual Excel sheets</strong> and loose notes to track Sunday offerings and expenses. This led to:
                        </p>
                        <ul className="space-y-3">
                            <li className="flex items-center gap-3 text-sm font-bold text-gray-700">
                                <div className="w-1.5 h-1.5 rounded-full bg-rose-400" /> Calculating errors in weekly cash balancing.
                            </li>
                            <li className="flex items-center gap-3 text-sm font-bold text-gray-700">
                                <div className="w-1.5 h-1.5 rounded-full bg-rose-400" /> Lack of real-time visibility for the Finance Director.
                            </li>
                            <li className="flex items-center gap-3 text-sm font-bold text-gray-700">
                                <div className="w-1.5 h-1.5 rounded-full bg-rose-400" /> Delayed reporting due to manual formatting for WhatsApp.
                            </li>
                        </ul>
                     </div>

                     <div className="bg-gray-900 p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden text-white">
                        <div className="absolute top-0 right-0 p-8 opacity-10">
                            <Lightbulb size={120} />
                        </div>
                        <h3 className="flex items-center gap-3 text-lg font-black uppercase tracking-wide text-emerald-400 mb-4">
                            <div className="p-2 bg-white/10 rounded-lg"><Lightbulb size={20}/></div>
                            The Solution
                        </h3>
                        <p className="text-gray-300 leading-relaxed text-sm mb-4">
                            A <strong>Progressive Web App (PWA)</strong> tailored for mobile usage, ensuring volunteers can input data instantly.
                        </p>
                        <div className="grid grid-cols-2 gap-4 mt-6">
                            <div className="bg-white/10 p-4 rounded-2xl border border-white/5">
                                <div className="text-2xl font-black text-emerald-400 mb-1">100%</div>
                                <div className="text-[10px] uppercase tracking-widest text-gray-400">Paperless</div>
                            </div>
                            <div className="bg-white/10 p-4 rounded-2xl border border-white/5">
                                <div className="text-2xl font-black text-emerald-400 mb-1">&lt; 2min</div>
                                <div className="text-[10px] uppercase tracking-widest text-gray-400">Reporting Time</div>
                            </div>
                        </div>
                     </div>
                </div>

                {/* VISUAL GALLERY (Mockups) */}
                <div className="bg-gray-50 py-12 px-6 rounded-[3rem] border border-gray-200">
                    <div className="text-center mb-10">
                        <h3 className="text-2xl font-black text-gray-900 uppercase tracking-tight">Interface Design</h3>
                        <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-2">Core User Experience Screens</p>
                    </div>

                    <div className="flex flex-wrap justify-center gap-8">
                        {/* Screen 1: Dashboard */}
                        <div className="w-[260px] h-[520px] bg-white rounded-[2.5rem] border-8 border-gray-800 shadow-2xl overflow-hidden relative flex flex-col">
                             <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-gray-800 rounded-b-xl z-20"></div>
                             <div className="bg-gray-50 p-4 flex-1 flex flex-col gap-3 pt-10">
                                 <div className="h-8 w-24 bg-gray-200 rounded-full mb-2"></div>
                                 <div className="h-32 bg-emerald-100 rounded-3xl w-full"></div>
                                 <div className="grid grid-cols-2 gap-2">
                                     <div className="h-24 bg-rose-50 rounded-2xl"></div>
                                     <div className="h-24 bg-blue-50 rounded-2xl"></div>
                                 </div>
                                 <div className="h-40 bg-white border border-gray-100 rounded-3xl mt-2 p-2">
                                     <div className="h-full w-full bg-gray-100 rounded-xl opacity-50"></div>
                                 </div>
                             </div>
                             <div className="absolute bottom-4 left-0 right-0 text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">Overview</div>
                        </div>

                        {/* Screen 2: Batch Entry */}
                        <div className="w-[260px] h-[520px] bg-white rounded-[2.5rem] border-8 border-gray-800 shadow-2xl overflow-hidden relative flex flex-col">
                             <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-gray-800 rounded-b-xl z-20"></div>
                             <div className="bg-gray-50 p-4 flex-1 flex flex-col gap-3 pt-10">
                                 <div className="flex justify-between mb-2">
                                     <div className="h-6 w-16 bg-emerald-500 rounded-full"></div>
                                     <div className="h-6 w-16 bg-gray-200 rounded-full"></div>
                                     <div className="h-6 w-16 bg-gray-200 rounded-full"></div>
                                 </div>
                                 <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-200 space-y-2">
                                     <div className="h-8 bg-gray-50 rounded-lg w-full"></div>
                                     <div className="h-8 bg-gray-50 rounded-lg w-full"></div>
                                     <div className="h-8 bg-gray-50 rounded-lg w-full"></div>
                                 </div>
                                 <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-200 space-y-2 opacity-50">
                                     <div className="h-8 bg-gray-50 rounded-lg w-full"></div>
                                 </div>
                                 <div className="mt-auto h-12 bg-emerald-600 rounded-xl w-full"></div>
                             </div>
                             <div className="absolute bottom-4 left-0 right-0 text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">Batch Ledger</div>
                        </div>

                         {/* Screen 3: Reports */}
                        <div className="w-[260px] h-[520px] bg-white rounded-[2.5rem] border-8 border-gray-800 shadow-2xl overflow-hidden relative flex flex-col">
                             <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-gray-800 rounded-b-xl z-20"></div>
                             <div className="bg-gray-50 p-4 flex-1 flex flex-col gap-3 pt-10">
                                 <div className="h-6 w-32 bg-gray-200 rounded-md mb-2"></div>
                                 <div className="h-20 bg-gray-900 rounded-2xl w-full flex items-center justify-center">
                                     <div className="h-8 w-8 rounded-full border-2 border-emerald-500"></div>
                                 </div>
                                 <div className="space-y-2">
                                     <div className="h-10 bg-white border border-gray-200 rounded-xl w-full"></div>
                                     <div className="h-10 bg-white border border-gray-200 rounded-xl w-full"></div>
                                 </div>
                                 <div className="mt-auto h-12 bg-[#25D366] rounded-xl w-full flex items-center justify-center text-white text-[10px] font-black uppercase">Share Report</div>
                             </div>
                             <div className="absolute bottom-4 left-0 right-0 text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">Reconciliation</div>
                        </div>
                    </div>
                </div>

                {/* User Flow Map */}
                <div>
                     <h3 className="text-2xl font-black text-gray-900 uppercase tracking-tight mb-8">Sunday Operations Flow</h3>
                     <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {[
                            { icon: Users, title: 'Collection', desc: 'Ushers collect offerings & take attendance.' },
                            { icon: MousePointerClick, title: 'Batch Input', desc: 'Finance Rep logs total cash & momo into app.' },
                            { icon: Zap, title: 'Auto-Calc', desc: 'System calculates balance & flags deficit/surplus.' },
                            { icon: Share2, title: 'Broadcast', desc: 'One-click WhatsApp report sent to Director.' },
                        ].map((step, i) => (
                            <div key={i} className="relative p-6 bg-white border border-gray-200 rounded-[2rem] hover:border-primary/50 transition-colors group">
                                <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 group-hover:bg-primary group-hover:text-white transition-all mb-4">
                                    <step.icon size={20} />
                                </div>
                                <h4 className="font-bold text-gray-900 mb-2">{step.title}</h4>
                                <p className="text-xs text-gray-500 leading-relaxed">{step.desc}</p>
                                {i < 3 && <ArrowRight className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 text-gray-300 z-10 bg-white rounded-full p-0.5" size={20} />}
                            </div>
                        ))}
                     </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default Settings;