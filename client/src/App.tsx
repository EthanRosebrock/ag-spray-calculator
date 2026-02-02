import React, { useState } from 'react';
import CalculatorPage from './components/calculator/CalculatorPage';
import SettingsPage from './components/settings/SettingsPage';
import './index.css';

type View = 'calculator' | 'settings';

function App() {
  const [view, setView] = useState<View>('calculator');

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">AgriSpray Pro</h1>
              <p className="text-sm text-gray-500">Professional Spray Calculator</p>
            </div>

            <nav className="flex items-center gap-2">
              <button
                onClick={() => setView('calculator')}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  view === 'calculator'
                    ? 'bg-ag-green-100 text-ag-green-700'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Calculator
              </button>
              <button
                onClick={() => setView('settings')}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  view === 'settings'
                    ? 'bg-ag-green-100 text-ag-green-700'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Settings
              </button>
            </nav>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {view === 'calculator' ? <CalculatorPage /> : <SettingsPage />}
      </main>
    </div>
  );
}

export default App;
