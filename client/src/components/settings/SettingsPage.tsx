import React, { useState, useEffect } from 'react';
import { Product } from '../../types';
import { ContainerType } from '../../utils/containerCalculations';
import { LocationWeatherService, LocationData, FieldLocation } from '../../utils/weatherService';
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
  const [fieldLocations, setFieldLocations] = useState<FieldLocation[]>([]);
  const [showAddField, setShowAddField] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setFieldLocations(LocationWeatherService.getFieldLocations());
  }, []);

  const updateFarmLocation = () => {
    LocationWeatherService.setFarmLocation(farmLocation);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const addFieldLocation = (field: FieldLocation) => {
    LocationWeatherService.addFieldLocation(field);
    setFieldLocations(LocationWeatherService.getFieldLocations());
    setShowAddField(false);
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="text-xl font-semibold mb-4">Farm Headquarters</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Latitude</label>
            <input
              type="number"
              step="0.0001"
              className="input-field"
              value={farmLocation.latitude}
              onChange={(e) =>
                setFarmLocation({ ...farmLocation, latitude: parseFloat(e.target.value) })
              }
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Longitude</label>
            <input
              type="number"
              step="0.0001"
              className="input-field"
              value={farmLocation.longitude}
              onChange={(e) =>
                setFarmLocation({ ...farmLocation, longitude: parseFloat(e.target.value) })
              }
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
            <input
              type="text"
              className="input-field"
              value={farmLocation.city}
              onChange={(e) => setFarmLocation({ ...farmLocation, city: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">County</label>
            <input
              type="text"
              className="input-field"
              value={farmLocation.county}
              onChange={(e) => setFarmLocation({ ...farmLocation, county: e.target.value })}
            />
          </div>
        </div>
        <div className="flex items-center gap-3 mt-4">
          <button onClick={updateFarmLocation} className="btn-primary">
            Update Farm Location
          </button>
          {saved && <span className="text-sm text-green-600">Saved!</span>}
        </div>
      </div>

      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Field Locations</h2>
          <button onClick={() => setShowAddField(true)} className="btn-secondary text-sm py-2 px-4">
            + Add Field
          </button>
        </div>

        {fieldLocations.length === 0 ? (
          <p className="text-center py-6 text-gray-500 text-sm">
            No field locations configured
          </p>
        ) : (
          <div className="space-y-3">
            {fieldLocations.map((f) => (
              <div key={f.id} className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold">{f.name}</h3>
                <p className="text-sm text-gray-600">
                  {f.latitude.toFixed(4)}, {f.longitude.toFixed(4)} &middot; {f.elevation}ft
                  {f.microclimate && (
                    <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">
                      {f.microclimate}
                    </span>
                  )}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAddField && (
        <AddFieldModal
          onAdd={addFieldLocation}
          onClose={() => setShowAddField(false)}
        />
      )}
    </div>
  );
};

// --- Add Field Modal (reuse from LocationSettings) ---
interface AddFieldModalProps {
  onAdd: (field: FieldLocation) => void;
  onClose: () => void;
}

const AddFieldModal: React.FC<AddFieldModalProps> = ({ onAdd, onClose }) => {
  const [field, setField] = useState<Partial<FieldLocation>>({
    name: '',
    latitude: 0,
    longitude: 0,
    elevation: 700,
    microclimate: undefined,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!field.name || !field.latitude || !field.longitude) return;
    onAdd({
      id: Date.now().toString(),
      name: field.name,
      latitude: field.latitude,
      longitude: field.longitude,
      elevation: field.elevation || 700,
      microclimate: field.microclimate,
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h2 className="text-xl font-semibold mb-4">Add Field Location</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Field Name</label>
            <input
              type="text"
              className="input-field"
              value={field.name || ''}
              onChange={(e) => setField({ ...field, name: e.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Latitude</label>
              <input
                type="number"
                step="0.0001"
                className="input-field"
                value={field.latitude || ''}
                onChange={(e) => setField({ ...field, latitude: parseFloat(e.target.value) })}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Longitude</label>
              <input
                type="number"
                step="0.0001"
                className="input-field"
                value={field.longitude || ''}
                onChange={(e) => setField({ ...field, longitude: parseFloat(e.target.value) })}
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Microclimate (Optional)
            </label>
            <select
              className="input-field"
              value={field.microclimate || ''}
              onChange={(e) =>
                setField({ ...field, microclimate: e.target.value || undefined })
              }
            >
              <option value="">Standard</option>
              <option value="sheltered">Sheltered</option>
              <option value="exposed">Exposed</option>
              <option value="valley">Valley</option>
              <option value="hilltop">Hilltop</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" className="btn-primary flex-1">
              Add Field
            </button>
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
          </div>
        </form>
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
