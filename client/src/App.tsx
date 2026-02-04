import React, { useState, useEffect } from 'react';
import CalculatorPage from './components/calculator/CalculatorPage';
import WeatherPage from './components/weather/WeatherPage';
import RecordsPage from './components/records/RecordsPage';
import FieldsPage from './components/fields/FieldsPage';
import MapPage from './components/map/MapPage';
import SettingsPage from './components/settings/SettingsPage';
import { migrateLocalStorageToSupabase } from './utils/storageService';
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

  useEffect(() => {
    migrateLocalStorageToSupabase().then((didMigrate) => {
      if (didMigrate) {
        console.log('Migrated localStorage data to Supabase');
        window.location.reload();
      }
    });
  }, []);

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
    <div className="bg-gray-50 flex flex-col h-screen" style={{ height: '100dvh' }}>
      <header className="bg-white shadow-sm border-b flex-shrink-0">
        <div className="flex items-center px-3 py-2 sm:px-4 sm:py-3 gap-3">
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 flex-shrink-0">AgriSpray</h1>
          <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar flex-1 justify-end">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.key}
                onClick={() => setView(item.key)}
                className={`px-2.5 py-1.5 rounded text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
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
      </header>

      <main className={`flex-1 min-h-0 ${view === 'map' ? '' : 'container mx-auto px-4 py-4 sm:py-8 overflow-y-auto'}`}>
        {renderPage()}
      </main>
    </div>
  );
}

export default App;
