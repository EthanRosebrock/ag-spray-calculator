import React, { useState } from 'react';
import CalculatorPage from './components/calculator/CalculatorPage';
import WeatherPage from './components/weather/WeatherPage';
import RecordsPage from './components/records/RecordsPage';
import FieldsPage from './components/fields/FieldsPage';
import MapPage from './components/map/MapPage';
import SettingsPage from './components/settings/SettingsPage';
import './index.css';

type View = 'calculator' | 'weather' | 'records' | 'fields' | 'map' | 'settings';

const NAV_ITEMS: { key: View; label: string }[] = [
  { key: 'calculator', label: 'Calculator' },
  { key: 'weather', label: 'Weather' },
  { key: 'records', label: 'Records' },
  { key: 'fields', label: 'Fields' },
  { key: 'map', label: 'Map' },
  { key: 'settings', label: 'Settings' },
];

function App() {
  const [view, setView] = useState<View>('calculator');

  const renderPage = () => {
    switch (view) {
      case 'calculator':
        return <CalculatorPage />;
      case 'weather':
        return <WeatherPage />;
      case 'records':
        return <RecordsPage />;
      case 'fields':
        return <FieldsPage />;
      case 'map':
        return <MapPage />;
      case 'settings':
        return <SettingsPage />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">AgriSpray Pro</h1>
              <p className="text-sm text-gray-500">Professional Spray Calculator</p>
            </div>

            <nav className="flex items-center gap-1 flex-wrap">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.key}
                  onClick={() => setView(item.key)}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    view === item.key
                      ? 'bg-ag-green-100 text-ag-green-700'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      <main className={`container mx-auto px-4 py-8 ${view === 'map' ? 'max-w-full' : ''}`}>
        {renderPage()}
      </main>
    </div>
  );
}

export default App;
