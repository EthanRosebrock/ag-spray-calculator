import React, { useState, useEffect, createContext, useContext } from 'react';
import CalculatorPage from './components/calculator/CalculatorPage';
import WeatherPage from './components/weather/WeatherPage';
import RecordsPage from './components/records/RecordsPage';
import FieldsPage from './components/fields/FieldsPage';
import MapPage from './components/map/MapPage';
import SettingsPage from './components/settings/SettingsPage';
import { migrateLocalStorageToSupabase, getCropYear, saveCropYear } from './utils/storageService';
import { checkSupabaseHealth, supabaseConfigured } from './utils/supabaseClient';
import './index.css';

// Crop Year Context
interface CropYearContextType {
  cropYear: string;
  setCropYear: (year: string) => void;
}

const CropYearContext = createContext<CropYearContextType>({
  cropYear: new Date().getFullYear().toString(),
  setCropYear: () => {},
});

export const useCropYear = () => useContext(CropYearContext);

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
  const [ready, setReady] = useState(false);
  const [syncWarning, setSyncWarning] = useState('');
  const [cropYear, setCropYearState] = useState<string>(() => getCropYear());

  // Generate year options: current year +/- 1
  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear - 1, currentYear, currentYear + 1];

  const setCropYear = (year: string) => {
    setCropYearState(year);
    saveCropYear(year);
  };

  useEffect(() => {
    const init = async () => {
      // Check Supabase connectivity
      if (supabaseConfigured) {
        const health = await checkSupabaseHealth();
        if (!health.ok) {
          console.error('Supabase sync unavailable:', health.error);
          setSyncWarning(`Cloud sync unavailable: ${health.error || 'unknown error'}`);
        } else {
          console.log('Supabase connected successfully');
        }
      }

      // Run migration if needed
      try {
        const didMigrate = await migrateLocalStorageToSupabase();
        if (didMigrate) {
          console.log('Migrated localStorage data to Supabase');
        }
      } catch (err) {
        console.error('Migration failed:', err);
      }

      setReady(true);
    };
    init();
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
    <CropYearContext.Provider value={{ cropYear, setCropYear }}>
    <div className="bg-gray-50 flex flex-col h-screen" style={{ height: '100dvh' }}>
      <header className="bg-white shadow-sm border-b flex-shrink-0">
        <div className="flex items-center px-3 py-2 sm:px-4 sm:py-3 gap-3">
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 flex-shrink-0">AgriSpray</h1>
          <select
            value={cropYear}
            onChange={(e) => setCropYear(e.target.value)}
            className="text-sm border border-gray-300 rounded px-2 py-1 bg-white text-gray-700 focus:ring-1 focus:ring-ag-green-500 focus:border-ag-green-500 flex-shrink-0"
            title="Crop Year"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y.toString()}>{y}</option>
            ))}
          </select>
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

      {syncWarning && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 text-sm text-yellow-800 flex items-center justify-between flex-shrink-0">
          <span>{syncWarning}</span>
          <button onClick={() => setSyncWarning('')} className="text-yellow-600 hover:text-yellow-800 ml-4 font-medium">Dismiss</button>
        </div>
      )}

      <main className={`flex-1 min-h-0 ${view === 'map' ? '' : 'container mx-auto px-4 py-4 sm:py-8 overflow-y-auto'}`}>
        {ready ? renderPage() : (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500">Loading...</p>
          </div>
        )}
      </main>
    </div>
    </CropYearContext.Provider>
  );
}

export default App;
