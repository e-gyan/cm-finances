import React, { useState, useEffect, useDeferredValue, useMemo } from 'react';
import { Category, User, Transaction, AccountType, TransactionType } from '../types';
import { Trash2, Plus, RefreshCw, Archive, Search, FileText, Edit2, Check, X, AlertTriangle, Database, Download, Upload, Cloud, Lock, Key, Shield, UserPlus, Power, Eye, EyeOff, Smartphone } from 'lucide-react';
import { formatCurrency } from '../utils';

interface SettingsProps {
  transactions: Transaction[];
  categories: Category[];
  users: User[];
  archivedTransactions: Transaction[];
  onAddCategory: (c: Category) => void;
  onEditCategory: (c: Category) => void;
  onDeleteCategory: (id: string) => void;
  onRestoreTransaction: (id: string) => void;
  onPermanentlyDelete: (id: string) => void;
  onUpdateTransaction: (t: Transaction) => void;
  onImportData: (data: { transactions: Transaction[], categories: Category[], users: User[] }) => void;
  cloudConfig: { binId: string; apiKey: string };
  onUpdateCloudConfig: (binId: string, apiKey: string) => void;
  onUserAction: (action: 'ADD' | 'UPDATE' | 'DELETE', user: User) => void;
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
  onUserAction
}) => {
  const [activeSection, setActiveSection] = useState<'CATEGORIES' | 'USERS' | 'ARCHIVE' | 'CLOUD'>('CATEGORIES');
  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState<'INCOME' | 'EXPENSE' | 'BOTH'>('EXPENSE');
  
  const [archiveSearch, setArchiveSearch] = useState('');
  const deferredArchiveSearch = useDeferredValue(archiveSearch); // SMOOTH TYPING

  // Archive Editing
  const [isArchiveEditing, setIsArchiveEditing] = useState(false);
  const [archiveEditForm, setArchiveEditForm] = useState<Transaction | null>(null);

  // Cloud Config State
  const [tempBinId, setTempBinId] = useState(cloudConfig.binId);
  const [tempApiKey, setTempApiKey] = useState(cloudConfig.apiKey);
  const [isCloudUnlocked, setIsCloudUnlocked] = useState(false);
  const [adminPinInput, setAdminPinInput] = useState('');

  // User Management State
  const [isUserEditing, setIsUserEditing] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState<Partial<User>>({
      name: '', email: '', phone: '', role: 'VIEWER', status: 'ACTIVE', momoNumber: ''
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

  // Archive Edit Handlers
  const handleEditArchive = (t: Transaction) => {
      setArchiveEditForm({...t});
      setIsArchiveEditing(true);
  };

  const handleSaveArchiveEdit = () => {
      if(archiveEditForm) {
          onUpdateTransaction(archiveEditForm);
          setIsArchiveEditing(false);
          setArchiveEditForm(null);
      }
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
        setUserForm(user);
    } else {
        setSelectedUser(null);
        setUserForm({ name: '', email: '', phone: '', role: 'VIEWER', status: 'ACTIVE', momoNumber: '' });
    }
    setIsUserEditing(true);
  };

  const handleSaveUser = () => {
      if (!userForm.name || !userForm.role) return;
      
      if (selectedUser) {
          onUserAction('UPDATE', { ...selectedUser, ...userForm } as User);
      } else {
          onUserAction('ADD', userForm as User);
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
      { id: 'USERS', label: 'Users' },
      { id: 'ARCHIVE', label: 'Archives' },
      { id: 'CLOUD', label: 'Cloud Sync' },
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
      <div className="flex-1 p-4 md:p-10">
        
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

        {/* --- USERS SECTION --- */}
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
                         </div>
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

        {/* --- ARCHIVE SECTION --- */}
        {activeSection === 'ARCHIVE' && (
             <div className="space-y-8 animate-in fade-in duration-500">
                 <div className="flex flex-col md:flex-row justify-between items-end border-b border-gray-100 pb-4 gap-4">
                    <div>
                        <h3 className="text-xl md:text-2xl font-black text-gray-900 tracking-tighter uppercase">Archived Records</h3>
                        <p className="text-xs md:text-sm font-medium text-gray-400 mt-1">View, restore, or modify soft-deleted transactions.</p>
                    </div>
                     <div className="relative w-full md:w-64">
                         <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                         <input 
                             type="text" 
                             placeholder="Search archives..."
                             value={archiveSearch}
                             onChange={(e) => setArchiveSearch(e.target.value)}
                             className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-primary/10"
                         />
                     </div>
                 </div>

                 {filteredArchive.length === 0 ? (
                     <div className="py-20 flex flex-col items-center justify-center text-gray-400">
                         <Archive size={48} className="mb-4 text-gray-200" />
                         <p className="text-sm font-bold">No archived items found.</p>
                     </div>
                 ) : (
                     <div className="space-y-4">
                         {filteredArchive.map(t => (
                             <div key={t.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex flex-col md:flex-row items-center justify-between gap-4 group hover:bg-white hover:shadow-md transition-all">
                                 <div className="flex items-center gap-4 flex-1 w-full">
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
                                     <div className="flex gap-2">
                                         <button onClick={() => handleEditArchive(t)} className="p-2 bg-white border border-gray-200 text-blue-600 rounded-xl hover:bg-blue-50 transition-colors" title="Edit Record">
                                             <Edit2 size={16} />
                                         </button>
                                         <button onClick={() => onRestoreTransaction(t.id)} className="p-2 bg-white border border-gray-200 text-emerald-600 rounded-xl hover:bg-emerald-50 transition-colors" title="Restore">
                                             <RefreshCw size={16} />
                                         </button>
                                         <button onClick={() => { if(confirm('Permanently delete this record?')) onPermanentlyDelete(t.id) }} className="p-2 bg-white border border-gray-200 text-rose-600 rounded-xl hover:bg-rose-50 transition-colors" title="Delete Forever">
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

        {/* --- ARCHIVE EDIT MODAL --- */}
        {isArchiveEditing && archiveEditForm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white rounded-[2rem] p-6 md:p-8 w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight">Modify Archived Record</h3>
                        <button onClick={() => setIsArchiveEditing(false)} className="p-2 bg-gray-50 rounded-full text-gray-400 hover:text-gray-900"><X size={20}/></button>
                    </div>
                    <div className="space-y-4">
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
                        <div>
                            <label className="text-[10px] font-black text-gray-400 mb-1 block uppercase tracking-widest">Category</label>
                            <select className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold outline-none"
                                value={archiveEditForm.category} onChange={e => setArchiveEditForm({...archiveEditForm, category: e.target.value})}>
                                {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-gray-400 mb-1 block uppercase tracking-widest">Notes</label>
                            <textarea className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold outline-none" rows={3}
                                value={archiveEditForm.notes || ''} onChange={e => setArchiveEditForm({...archiveEditForm, notes: e.target.value})} />
                        </div>
                        <button onClick={handleSaveArchiveEdit} className="w-full py-4 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-700 shadow-lg mt-4">
                            Save Changes to Archive
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* ... Cloud Section ... */}
        {activeSection === 'CLOUD' && (
            <div className="space-y-8 animate-in fade-in duration-500">
                {/* ... existing cloud logic ... */}
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
      </div>
    </div>
  );
};

export default Settings;