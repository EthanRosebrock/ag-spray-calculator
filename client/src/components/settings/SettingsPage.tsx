import React, { useState } from 'react';
import { Product } from '../../types';
import { ContainerType } from '../../utils/containerCalculations';
import { LocationWeatherService, LocationData, getCurrentPosition, geocodeAddress } from '../../utils/weatherService';
import {
  getProducts,
  deleteProduct,
  resetProducts,
  getContainers,
  deleteContainer,
  toggleContainerAvailability,
  resetContainers,
  saveContainer,
} from '../../utils/storageService';
import ProductModal from './ProductModal';
import ContainerModal from './ContainerModal';

type Tab = 'location' | 'products' | 'containers';

const SettingsPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>('location');

  const tabs: { key: Tab; label: string }[] = [
    { key: 'location', label: 'Farm Location' },
    { key: 'products', label: 'Products' },
    { key: 'containers', label: 'Containers' },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Tab bar */}
      <div className="flex border-b border-gray-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? 'border-ag-green-500 text-ag-green-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'location' && <LocationTab />}
      {tab === 'products' && <ProductsTab />}
      {tab === 'containers' && <ContainersTab />}
    </div>
  );
};

// --- Location Tab ---
const LocationTab: React.FC = () => {
  const [farmLocation, setFarmLocation] = useState<LocationData>(
    LocationWeatherService.getFarmLocation()
  );
  const [address, setAddress] = useState('');
  const [saved, setSaved] = useState(false);
  const [searchStatus, setSearchStatus] = useState<'idle' | 'searching' | 'error'>('idle');
  const [searchError, setSearchError] = useState('');
  const [geoStatus, setGeoStatus] = useState<'idle' | 'locating' | 'error'>('idle');

  const saveFarmLocation = (location: LocationData) => {
    setFarmLocation(location);
    LocationWeatherService.setFarmLocation(location);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleAddressLookup = async () => {
    const trimmed = address.trim();
    if (!trimmed) return;

    setSearchStatus('searching');
    setSearchError('');
    setSaved(false);

    try {
      const result = await geocodeAddress(trimmed);
      saveFarmLocation({
        latitude: result.latitude,
        longitude: result.longitude,
        city: result.city,
        state: result.state,
        county: result.county,
        timezone: farmLocation.timezone,
      });
      setSearchStatus('idle');
    } catch (err: any) {
      setSearchStatus('error');
      setSearchError(err.message || 'Geocoding failed');
      setTimeout(() => setSearchStatus('idle'), 4000);
    }
  };

  const handleAddressKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddressLookup();
    }
  };

  const useCurrentLocation = async () => {
    setGeoStatus('locating');
    setSaved(false);
    const pos = await getCurrentPosition();
    if (pos) {
      saveFarmLocation({
        ...farmLocation,
        latitude: +pos.latitude.toFixed(4),
        longitude: +pos.longitude.toFixed(4),
      });
      setGeoStatus('idle');
    } else {
      setGeoStatus('error');
      setTimeout(() => setGeoStatus('idle'), 3000);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="text-xl font-semibold mb-4">Farm Headquarters</h2>

        {/* Address search */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Address Search
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              className="input-field flex-1"
              placeholder="e.g. 123 Main St, Defiance, OH or 43512"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onKeyDown={handleAddressKeyDown}
              disabled={searchStatus === 'searching'}
            />
            <button
              onClick={handleAddressLookup}
              disabled={searchStatus === 'searching' || !address.trim()}
              className="btn-primary whitespace-nowrap"
            >
              {searchStatus === 'searching' ? 'Searching...' : 'Look Up'}
            </button>
          </div>
          {searchStatus === 'error' && searchError && (
            <p className="text-sm text-red-600 mt-1">{searchError}</p>
          )}
        </div>

        {/* Resolved location (read-only) */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="block text-gray-500">Latitude</span>
            <span className="font-medium">{farmLocation.latitude}</span>
          </div>
          <div>
            <span className="block text-gray-500">Longitude</span>
            <span className="font-medium">{farmLocation.longitude}</span>
          </div>
          <div>
            <span className="block text-gray-500">City</span>
            <span className="font-medium">{farmLocation.city || '—'}</span>
          </div>
          <div>
            <span className="block text-gray-500">State</span>
            <span className="font-medium">{farmLocation.state || '—'}</span>
          </div>
          <div>
            <span className="block text-gray-500">County</span>
            <span className="font-medium">{farmLocation.county || '—'}</span>
          </div>
        </div>

        {/* GPS + status */}
        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={useCurrentLocation}
            disabled={geoStatus === 'locating'}
            className="btn-secondary text-sm py-2 px-4"
          >
            {geoStatus === 'locating' ? 'Locating...' : 'Use Current Location'}
          </button>
          {saved && <span className="text-sm text-green-600">Saved!</span>}
          {geoStatus === 'error' && (
            <span className="text-sm text-red-600">Location access denied or unavailable</span>
          )}
        </div>
      </div>

      <div className="card bg-gray-50">
        <p className="text-sm text-gray-500">
          Field locations are now managed in the <strong>Fields</strong> tab.
        </p>
      </div>
    </div>
  );
};

// --- Products Tab ---
const ProductsTab: React.FC = () => {
  const [products, setProducts] = useState<Product[]>(() => getProducts());
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const reload = () => setProducts(getProducts());

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Product Library</h2>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setEditingProduct(null);
              setShowModal(true);
            }}
            className="btn-primary text-sm py-2 px-4"
          >
            + Add Product
          </button>
          <button
            onClick={() => {
              resetProducts();
              reload();
            }}
            className="btn-secondary text-sm py-2 px-4"
          >
            Reset to Defaults
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {products.map((p) => (
          <div key={p.id} className="card flex justify-between items-center">
            <div>
              <h3 className="font-semibold">
                {p.name}
                {p.isCustom && (
                  <span className="ml-2 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                    custom
                  </span>
                )}
              </h3>
              <p className="text-sm text-gray-600">
                {p.defaultRate} {p.unit} &middot; {p.type} &middot; Order: {p.mixingOrder}
                {p.pHSensitive && ' &middot; pH sensitive'}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setEditingProduct(p);
                  setShowModal(true);
                }}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Edit
              </button>
              <button
                onClick={() => {
                  deleteProduct(p.id);
                  reload();
                }}
                className="text-sm text-red-500 hover:text-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <ProductModal
          product={editingProduct}
          onSave={() => {
            reload();
            setShowModal(false);
            setEditingProduct(null);
          }}
          onClose={() => {
            setShowModal(false);
            setEditingProduct(null);
          }}
        />
      )}
    </div>
  );
};

// --- Containers Tab ---
const ContainersTab: React.FC = () => {
  const [containers, setContainers] = useState<ContainerType[]>(() => getContainers());
  const [showModal, setShowModal] = useState(false);
  const [editingContainer, setEditingContainer] = useState<ContainerType | null>(null);

  const reload = () => setContainers(getContainers());

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Container Sizes</h2>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setEditingContainer(null);
              setShowModal(true);
            }}
            className="btn-primary text-sm py-2 px-4"
          >
            + Add Container
          </button>
          <button
            onClick={() => {
              resetContainers();
              reload();
            }}
            className="btn-secondary text-sm py-2 px-4"
          >
            Reset to Defaults
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {containers.map((c) => (
          <div key={c.id} className="card flex justify-between items-center">
            <div>
              <h3 className="font-semibold">{c.name}</h3>
              <p className="text-sm text-gray-600">
                {c.size} {c.unit} &middot; {c.productType}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  toggleContainerAvailability(c.id);
                  reload();
                }}
                className={`text-xs px-2 py-1 rounded ${
                  c.available
                    ? 'bg-ag-green-50 text-ag-green-700'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {c.available ? 'Available' : 'Disabled'}
              </button>
              <button
                onClick={() => {
                  setEditingContainer(c);
                  setShowModal(true);
                }}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Edit
              </button>
              <button
                onClick={() => {
                  deleteContainer(c.id);
                  reload();
                }}
                className="text-sm text-red-500 hover:text-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <ContainerModal
          container={editingContainer}
          onSave={(c) => {
            saveContainer(c);
            reload();
            setShowModal(false);
            setEditingContainer(null);
          }}
          onClose={() => {
            setShowModal(false);
            setEditingContainer(null);
          }}
        />
      )}
    </div>
  );
};

export default SettingsPage;
