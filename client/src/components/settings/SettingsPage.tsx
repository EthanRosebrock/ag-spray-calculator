import React, { useState, useEffect } from 'react';
import { Product, Applicator } from '../../types';
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
  syncAllFieldsToSupabase,
  getApplicators,
  saveApplicator,
  deleteApplicator,
} from '../../utils/storageService';
import ProductModal from './ProductModal';
import ContainerModal from './ContainerModal';
import { supabaseConfigured } from '../../utils/supabaseClient';

type Tab = 'location' | 'products' | 'containers' | 'applicators' | 'sync';

const SettingsPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>('location');

  const tabs: { key: Tab; label: string }[] = [
    { key: 'location', label: 'Farm Location' },
    { key: 'products', label: 'Products' },
    { key: 'containers', label: 'Containers' },
    { key: 'applicators', label: 'Applicators' },
    { key: 'sync', label: 'Data Sync' },
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
      {tab === 'applicators' && <ApplicatorsTab />}
      {tab === 'sync' && <DataSyncTab />}
    </div>
  );
};

// --- Location Tab ---
const LocationTab: React.FC = () => {
  const [farmLocation, setFarmLocation] = useState<LocationData>({
    latitude: 0, longitude: 0, city: '', state: '', county: '', timezone: '',
  });
  const [address, setAddress] = useState('');
  const [saved, setSaved] = useState(false);
  const [searchStatus, setSearchStatus] = useState<'idle' | 'searching' | 'error'>('idle');
  const [searchError, setSearchError] = useState('');
  const [geoStatus, setGeoStatus] = useState<'idle' | 'locating' | 'error'>('idle');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    LocationWeatherService.getFarmLocation().then((loc) => {
      setFarmLocation(loc);
      setLoading(false);
    });
  }, []);

  const saveFarmLocationAndUpdate = async (location: LocationData) => {
    setFarmLocation(location);
    await LocationWeatherService.setFarmLocation(location);
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
      await saveFarmLocationAndUpdate({
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
      await saveFarmLocationAndUpdate({
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

  if (loading) {
    return <div className="card"><p className="text-sm text-gray-500">Loading location...</p></div>;
  }

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
            <span className="font-medium">{farmLocation.city || '\u2014'}</span>
          </div>
          <div>
            <span className="block text-gray-500">State</span>
            <span className="font-medium">{farmLocation.state || '\u2014'}</span>
          </div>
          <div>
            <span className="block text-gray-500">County</span>
            <span className="font-medium">{farmLocation.county || '\u2014'}</span>
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
  const [products, setProducts] = useState<Product[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const reload = async () => {
    const p = await getProducts();
    setProducts(p);
  };

  useEffect(() => { reload(); }, []);

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
            onClick={async () => {
              await resetProducts();
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
                onClick={async () => {
                  await deleteProduct(p.id);
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

// --- Applicators Tab ---
const ApplicatorsTab: React.FC = () => {
  const [applicators, setApplicators] = useState<Applicator[]>([]);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const reload = async () => {
    const list = await getApplicators();
    setApplicators(list);
  };

  useEffect(() => { reload(); }, []);

  const handleAdd = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const applicator: Applicator = {
      id: Date.now().toString(),
      name: trimmed,
    };
    await saveApplicator(applicator);
    setNewName('');
    reload();
  };

  const handleAddKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAdd();
    }
  };

  const startEdit = (applicator: Applicator) => {
    setEditingId(applicator.id);
    setEditName(applicator.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  const handleSaveEdit = async (applicator: Applicator) => {
    const trimmed = editName.trim();
    if (!trimmed) return;
    await saveApplicator({ ...applicator, name: trimmed });
    setEditingId(null);
    setEditName('');
    reload();
  };

  const handleEditKeyDown = (e: React.KeyboardEvent, applicator: Applicator) => {
    if (e.key === 'Enter') {
      handleSaveEdit(applicator);
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  };

  const handleDelete = async (id: string) => {
    await deleteApplicator(id);
    reload();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Applicators</h2>
      </div>

      <div className="card">
        <p className="text-sm text-gray-600 mb-4">
          Manage the list of people who apply sprays. These will appear as options when creating spray records.
        </p>

        {/* Add new applicator */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            className="input-field flex-1"
            placeholder="Add applicator name..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={handleAddKeyDown}
          />
          <button
            onClick={handleAdd}
            disabled={!newName.trim()}
            className="btn-primary text-sm py-2 px-4"
          >
            + Add
          </button>
        </div>

        {/* List of applicators */}
        {applicators.length === 0 ? (
          <p className="text-sm text-gray-400">No applicators added yet.</p>
        ) : (
          <div className="space-y-2">
            {applicators.map((a) => (
              <div key={a.id} className="flex items-center justify-between bg-gray-50 p-3 rounded">
                {editingId === a.id ? (
                  <div className="flex-1 flex gap-2">
                    <input
                      type="text"
                      className="input-field flex-1 py-1"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => handleEditKeyDown(e, a)}
                      autoFocus
                    />
                    <button
                      onClick={() => handleSaveEdit(a)}
                      className="text-sm text-ag-green-600 hover:text-ag-green-800 font-medium"
                    >
                      Save
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="font-medium">{a.name}</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEdit(a)}
                        className="text-sm text-blue-600 hover:text-blue-800"
                      >
                        Edit
                      </button>
                      {!a.isDefault && (
                        <button
                          onClick={() => handleDelete(a.id)}
                          className="text-sm text-red-500 hover:text-red-700"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// --- Data Sync Tab ---
const DataSyncTab: React.FC = () => {
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [syncMessage, setSyncMessage] = useState('');

  const handleSyncFields = async () => {
    setSyncStatus('syncing');
    setSyncMessage('');

    const result = await syncAllFieldsToSupabase();

    if (result.success) {
      setSyncStatus('success');
      setSyncMessage(`Synced ${result.count} field${result.count === 1 ? '' : 's'} to cloud`);
      setTimeout(() => setSyncStatus('idle'), 3000);
    } else {
      setSyncStatus('error');
      setSyncMessage(result.error || 'Sync failed');
      setTimeout(() => setSyncStatus('idle'), 5000);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="text-xl font-semibold mb-4">Cloud Sync</h2>

        {!supabaseConfigured ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800">
              Cloud sync is not configured. Data is stored locally only.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Force sync all field data (including sub-fields) from this device to the cloud.
              Use this if fields or sub-fields are not appearing on other devices.
            </p>

            <div className="flex items-center gap-3">
              <button
                onClick={handleSyncFields}
                disabled={syncStatus === 'syncing'}
                className="btn-primary text-sm py-2 px-4"
              >
                {syncStatus === 'syncing' ? 'Syncing...' : 'Sync Fields to Cloud'}
              </button>

              {syncStatus === 'success' && (
                <span className="text-sm text-green-600">{syncMessage}</span>
              )}
              {syncStatus === 'error' && (
                <span className="text-sm text-red-600">{syncMessage}</span>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="card bg-gray-50">
        <h3 className="font-medium mb-2">How sync works</h3>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>Data is saved to this device first, then synced to the cloud</li>
          <li>Changes made on other devices will appear after refreshing the app</li>
          <li>If cloud sync fails, data remains safely stored on this device</li>
        </ul>
      </div>
    </div>
  );
};

export default SettingsPage;
