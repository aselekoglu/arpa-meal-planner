import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Calendar,
  ShoppingBasket,
  Boxes,
  Settings as SettingsIcon,
  Bell,
  Moon,
  Sun,
  Users,
  Sparkles,
  Search,
  X,
} from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Planner from './pages/Planner';
import GroceryList from './pages/GroceryList';
import Chatbot from './components/Chatbot';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/planner', label: 'Planner', icon: Calendar },
  { to: '/grocery', label: 'Grocery List', icon: ShoppingBasket },
  { to: '/pantry', label: 'Pantry', icon: Boxes },
];

function PageTitle() {
  const location = useLocation();
  const map: Record<string, string> = {
    '/': 'Dashboard',
    '/planner': 'Weekly Planner',
    '/grocery': 'Grocery List',
    '/pantry': 'Pantry Inventory',
  };
  return <>{map[location.pathname] ?? 'ARPA: Meal Planner'}</>;
}

export default function App() {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    if (saved === 'true') return true;
    if (saved === 'false') return false;
    return false;
  });
  const [isFamilyModalOpen, setIsFamilyModalOpen] = useState(false);
  const [familyCode, setFamilyCode] = useState('');
  const [currentFamily, setCurrentFamily] = useState('default');

  useEffect(() => {
    const savedFamily = localStorage.getItem('familyId');
    if (savedFamily) {
      setCurrentFamily(savedFamily);
      setFamilyCode(savedFamily);
    }
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', String(isDarkMode));
  }, [isDarkMode]);

  const handleSaveFamily = () => {
    const code = familyCode.trim() || 'default';
    localStorage.setItem('familyId', code);
    setCurrentFamily(code);
    setIsFamilyModalOpen(false);
    window.location.reload();
  };

  return (
    <Router>
      <div className="min-h-screen bg-surface dark:bg-stone-950 text-on-surface dark:text-stone-100 font-sans antialiased">
        <div className="flex min-h-screen">
          {/* Desktop sidebar */}
          <aside className="hidden lg:flex w-72 flex-col bg-surface-container-low dark:bg-stone-900 px-6 py-8 gap-8 fixed inset-y-0 left-0 z-30">
            <div className="flex items-center gap-3 px-2">
              <div
                className="w-10 h-10 bg-primary-container dark:bg-primary-fixed-dim transform -scale-x-100 rotate-12 -mr-1"
                style={{
                  WebkitMaskImage: 'url(/arpa-icon.svg)',
                  maskImage: 'url(/arpa-icon.svg)',
                  WebkitMaskSize: 'contain',
                  maskSize: 'contain',
                  WebkitMaskRepeat: 'no-repeat',
                  maskRepeat: 'no-repeat',
                  WebkitMaskPosition: 'center',
                  maskPosition: 'center',
                }}
              />
              <div className="flex flex-col leading-none">
                <span className="font-display text-2xl font-extrabold tracking-tighter text-primary-container dark:text-primary-fixed-dim">
                  ARPA
                </span>
                <span className="mt-1 text-[10px] uppercase tracking-[0.18em] text-outline dark:text-stone-400 font-bold">
                  Meal Planner
                </span>
              </div>
            </div>

            <nav className="flex flex-col gap-1">
              {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-5 py-3 rounded-full font-display text-sm transition-all active:scale-[0.98] ${
                      isActive
                        ? 'bg-primary-container text-on-primary shadow-sm font-semibold'
                        : 'text-on-surface-variant dark:text-stone-400 font-medium hover:bg-surface-container-high/60 dark:hover:bg-stone-800/60 hover:text-on-surface dark:hover:text-stone-100'
                    }`
                  }
                >
                  <Icon className="w-5 h-5" />
                  {label}
                </NavLink>
              ))}
            </nav>

            <div className="mt-auto flex flex-col gap-3">
              <button
                onClick={() => setIsFamilyModalOpen(true)}
                className="w-full flex items-center justify-between px-4 py-3 bg-surface-container-lowest dark:bg-stone-800 border border-outline-variant/30 dark:border-stone-700 rounded-full text-sm font-medium text-on-surface dark:text-stone-200"
              >
                <span className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Family Sync
                </span>
                <span className="text-xs text-outline dark:text-stone-400 truncate max-w-24">
                  {currentFamily === 'default' ? 'Personal' : currentFamily}
                </span>
              </button>
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="w-full flex items-center gap-2 px-4 py-3 bg-surface-container-lowest dark:bg-stone-800 border border-outline-variant/30 dark:border-stone-700 rounded-full text-sm font-medium text-on-surface dark:text-stone-200"
              >
                {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                {isDarkMode ? 'Light mode' : 'Dark mode'}
              </button>
            </div>
          </aside>

          {/* Main column */}
          <div className="flex-1 flex flex-col lg:ml-72">
            {/* Desktop top bar */}
            <header className="hidden lg:flex sticky top-0 z-20 h-20 items-center px-10 bg-surface/80 dark:bg-stone-950/80 backdrop-blur-xl">
              <div className="flex-1 max-w-xl">
                <div className="relative">
                  <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-outline" />
                  <input
                    type="text"
                    placeholder="Search recipes, ingredients..."
                    className="w-full pl-12 pr-4 py-2.5 bg-surface-container-low dark:bg-stone-900 border border-transparent focus:border-primary/30 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary/15 text-on-surface dark:text-stone-100 placeholder:text-outline"
                  />
                </div>
              </div>
              <div className="ml-auto flex items-center gap-3">
                <button
                  className="p-2.5 rounded-full text-on-surface-variant hover:bg-surface-container-high transition-colors"
                  aria-label="Notifications"
                >
                  <Bell className="w-5 h-5" />
                </button>
                <div className="h-8 w-px bg-outline-variant/40" />
                <span className="hidden xl:inline text-sm font-display font-semibold text-on-surface">
                  Chef
                </span>
                <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-display font-bold ring-2 ring-surface-container-low">
                  A
                </div>
              </div>
            </header>

            {/* Mobile top bar */}
            <header className="lg:hidden bg-surface dark:bg-stone-950 sticky top-0 z-20">
              <div className="px-5 h-16 flex items-center justify-between">
                <div className="flex items-center gap-2 text-primary-container dark:text-primary-fixed-dim">
                  <div
                    className="w-9 h-9 bg-current transform -scale-x-100 rotate-12"
                    style={{
                      WebkitMaskImage: 'url(/arpa-icon.svg)',
                      maskImage: 'url(/arpa-icon.svg)',
                      WebkitMaskSize: 'contain',
                      maskSize: 'contain',
                      WebkitMaskRepeat: 'no-repeat',
                      maskRepeat: 'no-repeat',
                      WebkitMaskPosition: 'center',
                      maskPosition: 'center',
                    }}
                  />
                  <div className="flex flex-col leading-none">
                    <span className="font-display text-lg font-extrabold tracking-tighter">ARPA</span>
                    <span className="text-[9px] uppercase tracking-widest text-outline font-bold mt-0.5">
                      <PageTitle />
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsFamilyModalOpen(true)}
                    className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container-high"
                    aria-label="Family sync"
                  >
                    <Users className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setIsDarkMode(!isDarkMode)}
                    className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container-high"
                    aria-label="Toggle theme"
                  >
                    {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </header>

            <main className="flex-1 px-5 lg:px-10 py-6 lg:py-8 max-w-[1600px] w-full mx-auto pb-28 lg:pb-12">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/planner" element={<Planner />} />
                <Route path="/grocery" element={<GroceryList />} />
                <Route path="/pantry" element={<GroceryList initialTab="pantry" />} />
              </Routes>
            </main>

            {/* Mobile bottom navigation */}
            <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-surface-container-low/95 dark:bg-stone-900/95 backdrop-blur-xl border-t border-outline-variant/30 dark:border-stone-800 px-3 py-2 z-30">
              <div className="grid grid-cols-5 gap-1">
                <NavLink
                  to="/"
                  end
                  className={({ isActive }) =>
                    `flex flex-col items-center gap-1 py-2 rounded-2xl text-[11px] font-medium transition-colors ${
                      isActive
                        ? 'text-primary-container dark:text-primary-fixed-dim'
                        : 'text-outline dark:text-stone-400'
                    }`
                  }
                >
                  <LayoutDashboard className="w-5 h-5" />
                  Home
                </NavLink>
                <NavLink
                  to="/planner"
                  className={({ isActive }) =>
                    `flex flex-col items-center gap-1 py-2 rounded-2xl text-[11px] font-medium transition-colors ${
                      isActive
                        ? 'text-primary-container dark:text-primary-fixed-dim'
                        : 'text-outline dark:text-stone-400'
                    }`
                  }
                >
                  <Calendar className="w-5 h-5" />
                  Planner
                </NavLink>
                <NavLink
                  to="/grocery"
                  className={({ isActive }) =>
                    `flex flex-col items-center gap-1 py-2 rounded-2xl text-[11px] font-medium transition-colors ${
                      isActive
                        ? 'text-primary-container dark:text-primary-fixed-dim'
                        : 'text-outline dark:text-stone-400'
                    }`
                  }
                >
                  <ShoppingBasket className="w-5 h-5" />
                  Grocery
                </NavLink>
                <NavLink
                  to="/pantry"
                  className={({ isActive }) =>
                    `flex flex-col items-center gap-1 py-2 rounded-2xl text-[11px] font-medium transition-colors ${
                      isActive
                        ? 'text-primary-container dark:text-primary-fixed-dim'
                        : 'text-outline dark:text-stone-400'
                    }`
                  }
                >
                  <Boxes className="w-5 h-5" />
                  Pantry
                </NavLink>
                <button
                  onClick={() => setIsFamilyModalOpen(true)}
                  className="flex flex-col items-center gap-1 py-2 rounded-2xl text-[11px] font-medium text-outline dark:text-stone-400"
                >
                  <SettingsIcon className="w-5 h-5" />
                  Settings
                </button>
              </div>
            </nav>
          </div>
        </div>

        <Chatbot />

        {/* Family Sync Modal */}
        {isFamilyModalOpen && (
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            onClick={() => setIsFamilyModalOpen(false)}
          >
            <div
              className="bg-surface-container-lowest dark:bg-stone-900 rounded-[2rem] max-w-md w-full p-7 shadow-xl border border-outline-variant/30 dark:border-stone-800"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary-container/10 text-primary-container flex items-center justify-center">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <h2 className="text-2xl font-display font-extrabold tracking-tight text-on-surface dark:text-stone-100">
                    Family Sync
                  </h2>
                </div>
                <button
                  onClick={() => setIsFamilyModalOpen(false)}
                  className="p-1 rounded-full text-outline hover:bg-surface-container-high"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-on-surface-variant dark:text-stone-400 mb-6 text-sm">
                Enter a shared family code to sync meals, planner, and grocery lists across devices. Leave blank for personal use.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-display font-bold uppercase tracking-widest text-outline mb-2">
                    Family Code
                  </label>
                  <input
                    type="text"
                    value={familyCode === 'default' ? '' : familyCode}
                    onChange={(e) => setFamilyCode(e.target.value)}
                    placeholder="e.g. smith-family-2024"
                    className="w-full px-4 py-3 bg-surface-container-low dark:bg-stone-800 border border-outline-variant/40 dark:border-stone-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 text-on-surface dark:text-stone-100 placeholder:text-outline"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setIsFamilyModalOpen(false)}
                    className="flex-1 px-4 py-3 border border-outline-variant/50 dark:border-stone-700 text-on-surface dark:text-stone-300 rounded-full font-display font-semibold text-sm hover:bg-surface-container-low dark:hover:bg-stone-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveFamily}
                    className="flex-1 px-4 py-3 bg-gradient-to-br from-primary to-primary-container text-on-primary rounded-full font-display font-semibold text-sm transition-opacity hover:opacity-90"
                  >
                    Save & Sync
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Router>
  );
}
