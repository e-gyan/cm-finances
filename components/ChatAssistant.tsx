import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Type, FunctionDeclaration, Schema } from "@google/genai";
import { MessageCircle, X, Send, Sparkles, Loader2, Bot } from 'lucide-react';
import { Transaction, Category, TransactionType, AccountType } from '../types';

interface ChatAssistantProps {
  transactions: Transaction[];
  categories: Category[];
  onAddTransaction: (t: Omit<Transaction, 'id'> | Omit<Transaction, 'id'>[]) => void;
}

interface Message {
  role: 'user' | 'model';
  text: string;
}

const ChatAssistant: React.FC<ChatAssistantProps> = ({ transactions, categories, onAddTransaction }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: 'Hello! I am your Thesaurus finance assistant. I can help you add transactions or analyze your spending. Try saying "Added 50ghc offering cash" or "How much did we spend on snacks?"' }
  ]);
  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  // Define Tools
  const addTransactionTool: FunctionDeclaration = {
    name: 'addTransaction',
    description: 'Add a new financial transaction (Income, Expense, or Transfer) to the ledger.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        type: { type: Type.STRING, enum: ['INCOME', 'EXPENSE', 'TRANSFER'], description: 'The type of transaction.' },
        amount: { type: Type.NUMBER, description: 'The amount in GHS.' },
        category: { type: Type.STRING, description: 'The category name (e.g., Snacks, Offerings).' },
        accountId: { type: Type.STRING, enum: [AccountType.CASH, AccountType.MOMO, AccountType.OTHER], description: 'The account used.' },
        notes: { type: Type.STRING, description: 'Description or recipient name.' }
      },
      required: ['type', 'amount', 'category', 'accountId']
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    const userMsg = inputText;
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setInputText('');
    setIsThinking(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      // Construct a context-aware system instruction
      const categoryList = categories.map(c => c.name).join(', ');
      const systemInstruction = `
        You are an intelligent accounting assistant for a church children's ministry app called "Thesaurus".
        Current Date: ${new Date().toLocaleDateString()}.
        
        Available Categories: ${categoryList}.
        Available Accounts: ${Object.values(AccountType).join(', ')}.
        
        Rules:
        1. If the user wants to add data, use the 'addTransaction' tool. Infer the category from the input if possible.
        2. If the user asks about data (e.g. "How much spent on snacks?"), realize you don't have read access to the database in real-time tools yet, but you can answer based on general knowledge or politely explain you can only Add records currently.
        3. Be concise and friendly.
      `;

      const model = ai.models.getGenerativeModel({
        model: 'gemini-3-pro-preview',
        systemInstruction: systemInstruction,
        tools: [{ functionDeclarations: [addTransactionTool] }]
      });

      // Simple chat history management (last 10 messages)
      const chatHistory = messages.slice(-10).map(m => ({
          role: m.role,
          parts: [{ text: m.text }]
      }));

      const chat = model.startChat({
        history: chatHistory
      });

      const result = await chat.sendMessage(userMsg);
      const response = await result.response;
      
      // Handle Function Calls
      const call = response.functionCalls()?.[0];
      
      if (call) {
         if (call.name === 'addTransaction') {
             const args = call.args as any;
             
             // Execute action
             onAddTransaction({
                 date: new Date().toISOString().split('T')[0],
                 type: args.type as TransactionType,
                 amount: args.amount,
                 category: args.category,
                 accountId: args.accountId as AccountType,
                 notes: args.notes || 'Added via AI Chat',
                 isArchived: false
             });

             // Send success back to model to generate confirmation text
             const functionResponse = await chat.sendMessage([{
                functionResponse: {
                    name: 'addTransaction',
                    response: { result: 'Transaction successfully added to the database.' }
                }
             }]);
             
             setMessages(prev => [...prev, { role: 'model', text: functionResponse.response.text() }]);
         }
      } else {
          setMessages(prev => [...prev, { role: 'model', text: response.text() }]);
      }

    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'model', text: "I'm having trouble connecting to Gemini right now. Please ensure your API_KEY is configured." }]);
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 md:right-10 z-50 p-4 rounded-full shadow-2xl transition-all active:scale-90 ${
            isOpen ? 'bg-rose-500 text-white rotate-90' : 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white'
        }`}
      >
        {isOpen ? <X size={24} /> : <Sparkles size={24} />}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-4 md:right-10 w-[90vw] md:w-[400px] h-[500px] bg-white rounded-[2rem] shadow-2xl border border-gray-100 z-50 flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-violet-600 to-indigo-600 text-white flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl backdrop-blur-md">
                    <Bot size={20} />
                </div>
                <div>
                    <h3 className="font-black text-sm uppercase tracking-widest">Gemini Assistant</h3>
                    <p className="text-[10px] opacity-80 font-medium">Powered by Google AI</p>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] p-3 rounded-2xl text-sm font-medium leading-relaxed ${
                            msg.role === 'user' 
                            ? 'bg-indigo-600 text-white rounded-br-none' 
                            : 'bg-white border border-gray-200 text-gray-700 rounded-bl-none shadow-sm'
                        }`}>
                            {msg.text}
                        </div>
                    </div>
                ))}
                {isThinking && (
                    <div className="flex justify-start">
                        <div className="bg-white border border-gray-200 p-3 rounded-2xl rounded-bl-none shadow-sm flex items-center gap-2">
                             <Loader2 size={14} className="animate-spin text-indigo-600"/>
                             <span className="text-xs font-bold text-gray-400">Thinking...</span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 bg-white border-t border-gray-100 flex gap-2">
                <input 
                    type="text" 
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Ask specific questions or add records..."
                    className="flex-1 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
                <button 
                    onClick={handleSendMessage}
                    disabled={isThinking || !inputText.trim()}
                    className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    <Send size={18} />
                </button>
            </div>
        </div>
      )}
    </>
  );
};

export default ChatAssistant;
