import React, { useState } from 'react';
import { User } from '../types';
import { Shield, ArrowRight, Eye, EyeOff, Loader2 } from 'lucide-react';
import { hashAccessCode } from '../utils';

interface LoginProps {
  users: User[];
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ users, onLogin }) => {
  const [accessCode, setAccessCode] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!accessCode.trim()) {
      setError('Please enter a numerical access code.');
      return;
    }

    setIsLoading(true);
    try {
      const hashedInput = await hashAccessCode(accessCode);
      const matchedUser = users.find(u => u.accessCode === hashedInput && u.status === 'ACTIVE');
      if (matchedUser) {
        onLogin(matchedUser);
      } else {
        setError('Invalid access code or account disabled.');
      }
    } catch (err) {
      setError('Error authenticating. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white p-8 rounded-[2.5rem] shadow-xl shadow-gray-200/50 border border-gray-100 flex flex-col items-center">
        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-6 text-primary">
          <Shield size={32} />
        </div>
        <h1 className="text-xl sm:text-2xl font-black text-gray-900 mb-2 uppercase tracking-tight text-center">CM finance (Thesaurus)</h1>
        <p className="text-sm font-bold text-gray-400 mb-8 uppercase tracking-widest text-center">Authorized Access Only</p>

        <form onSubmit={handleLogin} className="w-full space-y-4">
          <div>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"}
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Provide access code"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value.replace(/\D/g, ''))}
                className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-center text-lg font-black tracking-[0.2em] outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all placeholder:text-gray-400 placeholder:text-sm placeholder:tracking-widest placeholder:uppercase placeholder:font-bold"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {error && <p className="text-rose-500 text-xs font-bold text-center mt-3">{error}</p>}
          </div>

          <button 
            type="submit"
            disabled={isLoading}
            className="w-full py-4 bg-primary text-white rounded-2xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-teal-800 transition-all active:scale-95 shadow-lg shadow-primary/20 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <>Authenticate <ArrowRight size={16} /></>}
          </button>
        </form>

        <p className="text-[10px] text-gray-300 font-bold mt-8 uppercase tracking-widest text-center leading-relaxed">
           For authorized personnel only.<br />Contact IT for access.
        </p>
      </div>
    </div>
  );
};

export default Login;
