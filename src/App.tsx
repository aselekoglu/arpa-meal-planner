import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { Utensils, Calendar, ShoppingCart, Moon, Sun, Users } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Planner from './pages/Planner';
import GroceryList from './pages/GroceryList';
import Chatbot from './components/Chatbot';

export default function App() {
  const [isDarkMode, setIsDarkMode] = useState(false);
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
  }, [isDarkMode]);

  const handleSaveFamily = () => {
    const code = familyCode.trim() || 'default';
    localStorage.setItem('familyId', code);
    setCurrentFamily(code);
    setIsFamilyModalOpen(false);
    window.location.reload(); // Reload to fetch data for new family
  };

  return (
    <Router>
      <div className="min-h-screen bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 font-sans flex flex-col transition-colors">
        <header className="bg-white dark:bg-stone-900 border-b border-stone-200 dark:border-stone-800 sticky top-0 z-10 transition-colors">
          <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-0 text-emerald-600 dark:text-emerald-500 font-semibold text-3xl">
              <div 
                className="w-16 h-16 bg-current transform -scale-x-100 rotate-12 -mr-4 z-10" 
                style={{ 
                  WebkitMaskImage: 'url(/arpa-icon.svg)', 
                  maskImage: 'url(/arpa-icon.svg)', 
                  WebkitMaskSize: 'contain', 
                  maskSize: 'contain',
                  WebkitMaskRepeat: 'no-repeat',
                  maskRepeat: 'no-repeat',
                  WebkitMaskPosition: 'center',
                  maskPosition: 'center'
                }} 
              />
              <span>ARPA: Meal Planner</span>
            </div>
            <nav className="flex items-center gap-6">
              <Link to="/" className="flex items-center gap-2 text-stone-600 dark:text-stone-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors font-medium">
                <Utensils className="w-4 h-4" />
                <span>Meals</span>
              </Link>
              <Link to="/planner" className="flex items-center gap-2 text-stone-600 dark:text-stone-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors font-medium">
                <Calendar className="w-4 h-4" />
                <span>Planner</span>
              </Link>
              <Link to="/grocery" className="flex items-center gap-2 text-stone-600 dark:text-stone-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors font-medium">
                <ShoppingCart className="w-4 h-4" />
                <span>Groceries</span>
              </Link>
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="p-2 text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100 transition-colors rounded-full hover:bg-stone-100 dark:hover:bg-stone-800"
              >
                {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              <button
                onClick={() => setIsFamilyModalOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 rounded-lg text-sm font-medium transition-colors border border-emerald-200 dark:border-emerald-800/50"
              >
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline">{currentFamily === 'default' ? 'Personal' : currentFamily}</span>
              </button>
            </nav>
          </div>
        </header>

        <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/planner" element={<Planner />} />
            <Route path="/grocery" element={<GroceryList />} />
          </Routes>
        </main>

        <Chatbot />
      </div>
      {/* Family Sync Modal */}
      {isFamilyModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-stone-900 rounded-2xl max-w-md w-full p-6 shadow-xl border border-stone-200 dark:border-stone-800">
            <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100 mb-2">Family Sync</h2>
            <p className="text-stone-500 dark:text-stone-400 mb-6 text-sm">
              Enter a shared family code to sync meals, planner, and grocery lists across devices. Leave blank for personal use.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Family Code
                </label>
                <input
                  type="text"
                  value={familyCode === 'default' ? '' : familyCode}
                  onChange={(e) => setFamilyCode(e.target.value)}
                  placeholder="e.g. smith-family-2024"
                  className="w-full px-4 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-stone-900 dark:text-stone-100"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setIsFamilyModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 rounded-xl font-medium hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveFamily}
                  className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium transition-colors"
                >
                  Save & Sync
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Router>
  );
}
