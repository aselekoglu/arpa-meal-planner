import { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Bot, User, Loader2, Sparkles } from 'lucide-react';
import Markdown from 'react-markdown';
import { apiFetch } from '../lib/api';

interface Message {
  role: 'user' | 'model';
  text: string;
}

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'model',
      text: "Hello Bebü! I'm your meal planning assistant. Ask me about recipes, ingredients, or your weekly plan.",
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text: userMessage }]);
    setIsLoading(true);

    try {
      const res = await apiFetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Chat request failed');
      }
      setMessages((prev) => [...prev, { role: 'model', text: data.text || '' }]);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setMessages((prev) => [...prev, { role: 'model', text: `Error: ${message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-24 lg:bottom-8 right-6 lg:right-10 px-5 py-4 bg-gradient-to-br from-primary to-primary-container text-on-primary rounded-full shadow-[0_24px_48px_rgba(0,69,50,0.25)] flex items-center gap-2 transition-all z-40 hover:scale-105 active:scale-95 ${
          isOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100'
        }`}
      >
        <Sparkles className="w-5 h-5" />
        <span className="font-display font-bold text-sm hidden sm:inline">Bebü Bot</span>
      </button>

      <div
        className={`fixed bottom-24 lg:bottom-8 right-4 lg:right-10 w-[calc(100%-2rem)] max-w-sm bg-surface dark:bg-stone-900 rounded-[2rem] shadow-2xl border border-outline-variant/20 dark:border-stone-800 flex flex-col overflow-hidden transition-all duration-300 z-50 origin-bottom-right ${
          isOpen ? 'scale-100 opacity-100 h-[520px]' : 'scale-0 opacity-0 h-0'
        }`}
      >
        <div className="bg-gradient-to-br from-primary to-primary-container text-on-primary p-4 flex justify-between items-center">
          <div className="flex items-center gap-2 font-display font-bold">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <Bot className="w-4 h-4" />
            </div>
            Bebü Bot
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 rounded-full text-on-primary/80 hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-surface-container-low dark:bg-stone-950 thin-scrollbar">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  msg.role === 'user'
                    ? 'bg-primary-container/15 text-primary-container dark:bg-primary-fixed-dim/15 dark:text-primary-fixed-dim'
                    : 'bg-surface-container-high text-on-surface dark:bg-stone-800 dark:text-stone-200'
                }`}
              >
                {msg.role === 'user' ? (
                  <User className="w-4 h-4" />
                ) : (
                  <Bot className="w-4 h-4" />
                )}
              </div>
              <div
                className={`px-4 py-2.5 rounded-2xl max-w-[78%] text-sm ${
                  msg.role === 'user'
                    ? 'bg-primary-container text-on-primary rounded-tr-sm'
                    : 'bg-surface-container-lowest dark:bg-stone-900 border border-outline-variant/20 dark:border-stone-800 text-on-surface dark:text-stone-100 rounded-tl-sm'
                }`}
              >
                <div className="prose prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-surface-container-high dark:prose-invert dark:prose-pre:bg-stone-800/60 dark:prose-pre:text-stone-100">
                  <Markdown>{msg.text}</Markdown>
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-2.5">
              <div className="w-8 h-8 rounded-full bg-surface-container-high text-on-surface dark:bg-stone-800 dark:text-stone-200 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="px-4 py-3 rounded-2xl bg-surface-container-lowest dark:bg-stone-900 border border-outline-variant/20 dark:border-stone-800 rounded-tl-sm flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-outline" />
                <span className="text-sm text-on-surface-variant">Thinking…</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-3 bg-surface dark:bg-stone-900 border-t border-outline-variant/20 dark:border-stone-800">
          <div className="flex gap-2 relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about recipes, ingredients..."
              className="w-full bg-surface-container-low dark:bg-stone-800 border border-transparent focus:bg-surface-container-lowest dark:focus:bg-stone-900 focus:border-primary/30 focus:ring-2 focus:ring-primary/20 rounded-2xl px-4 py-2.5 pr-12 resize-none h-11 text-sm transition-all text-on-surface dark:text-stone-100 placeholder:text-outline"
              rows={1}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="absolute right-1.5 top-1.5 p-2 text-primary-container dark:text-primary-fixed-dim hover:bg-primary-container/10 rounded-xl disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
