import React, { useState } from 'react';
import { Product, ProductType, MeasurementUnit, RateBasis } from '../../types';
import { saveProduct, getContainers } from '../../utils/storageService';
import { getUnitsForProductType, formatUnitDisplay, parseLegacyUnit, getBaseDisplayUnit, getContainerCategory } from '../../utils/unitConstants';

interface ProductModalProps {
  product?: Product | null;
  onSave: (product: Product) => void;
  onClose: () => void;
}

function initMeasurementUnit(product?: Product | null): MeasurementUnit {
  if (product?.measurementUnit) return product.measurementUnit;
  if (product?.unit) return parseLegacyUnit(product.unit).measurementUnit;
  return 'fl_oz';
}

function initRateBasis(product?: Product | null): RateBasis {
  if (product?.rateBasis) return product.rateBasis;
  if (product?.unit) return parseLegacyUnit(product.unit).rateBasis;
  return 'per_acre';
}

function initProductType(product?: Product | null): ProductType {
  if (product?.type) return product.type;
  return 'liquid';
}

const ProductModal: React.FC<ProductModalProps> = ({ product, onSave, onClose }) => {
  const [name, setName] = useState(product?.name || '');
  const [type, setType] = useState<ProductType>(initProductType(product));
  const [measurementUnit, setMeasurementUnit] = useState<MeasurementUnit>(initMeasurementUnit(product));
  const [rateBasis, setRateBasis] = useState<RateBasis>(initRateBasis(product));
  const [defaultRate, setDefaultRate] = useState(product?.defaultRate || 0);
  const [mixingOrder, setMixingOrder] = useState(product?.mixingOrder || 2);
  const [pHSensitive, setPHSensitive] = useState(product?.pHSensitive || false);
  const [packageSize, setPackageSize] = useState(product?.packageSize || 0);
  const [preferredContainers, setPreferredContainers] = useState<string[]>(
    product?.preferredContainers || []
  );

  const allContainers = getContainers();
  const availableUnits = getUnitsForProductType(type);
  const baseUnit = getBaseDisplayUnit(measurementUnit);

  // Filter containers to those matching the product's container category
  const containerCategory = type === 'bulk'
    ? getContainerCategory(measurementUnit)
    : type === 'dry' ? 'dry' : 'liquid';
  const relevantContainers = allContainers.filter(
    (c) => c.productType === containerCategory && c.available
  );

  const toggleContainer = (id: string) => {
    setPreferredContainers((prev) =>
      prev.includes(id) ? prev.filter((cid) => cid !== id) : [...prev, id]
    );
  };

  const handleTypeChange = (newType: ProductType) => {
    setType(newType);
    // Reset measurement unit to first available for the new type
    const units = getUnitsForProductType(newType);
    if (!units.some((u) => u.value === measurementUnit)) {
      setMeasurementUnit(units[0].value);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || defaultRate <= 0) return;

    const unitDisplay = formatUnitDisplay(measurementUnit, rateBasis);

    const saved: Product = {
      id: product?.id || `custom-${Date.now()}`,
      name: name.trim(),
      type,
      unit: unitDisplay,
      defaultRate,
      mixingOrder,
      pHSensitive,
      isCustom: true,
      measurementUnit,
      rateBasis,
      ...(packageSize > 0 ? { packageSize } : {}),
      ...(preferredContainers.length > 0 ? { preferredContainers } : {}),
    };

    await saveProduct(saved);
    onSave(saved);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h2 className="text-xl font-semibold mb-4">
          {product ? 'Edit Product' : 'Add Product'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              className="input-field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Product Type</label>
              <select
                className="input-field"
                value={type}
                onChange={(e) => handleTypeChange(e.target.value as ProductType)}
              >
                <option value="liquid">Liquid</option>
                <option value="dry">Dry</option>
                <option value="bulk">Bulk</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
              <select
                className="input-field"
                value={measurementUnit}
                onChange={(e) => setMeasurementUnit(e.target.value as MeasurementUnit)}
              >
                {availableUnits.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rate Basis</label>
              <select
                className="input-field"
                value={rateBasis}
                onChange={(e) => setRateBasis(e.target.value as RateBasis)}
              >
                <option value="per_acre">per acre</option>
                <option value="per_100_gal">per 100 gal water</option>
              </select>
            </div>
          </div>

          {rateBasis === 'per_100_gal' && (
            <p className="text-xs text-amber-600 -mt-2">
              Calculated based on total carrier water volume
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Default Rate
              </label>
              <input
                type="number"
                className="input-field"
                value={defaultRate || ''}
                onChange={(e) => setDefaultRate(parseFloat(e.target.value) || 0)}
                step="0.1"
                min="0"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mixing Order
              </label>
              <input
                type="number"
                className="input-field"
                value={mixingOrder}
                onChange={(e) => setMixingOrder(parseInt(e.target.value) || 1)}
                min="1"
                max="10"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Package Size ({baseUnit})
            </label>
            <input
              type="number"
              className="input-field"
              value={packageSize || ''}
              onChange={(e) => setPackageSize(parseFloat(e.target.value) || 0)}
              step="0.1"
              min="0"
              placeholder="Optional"
            />
            <p className="text-xs text-gray-500 mt-1">
              Leave empty if not sold in fixed packages
            </p>
          </div>

          {relevantContainers.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Containers
              </label>
              <div className="space-y-1 max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-2">
                {relevantContainers.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferredContainers.includes(c.id)}
                      onChange={() => toggleContainer(c.id)}
                    />
                    {c.name}
                    <span className="text-xs text-gray-400">({c.size} {c.unit})</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {preferredContainers.length === 0
                  ? 'All containers used — select to limit'
                  : `${preferredContainers.length} selected`}
              </p>
            </div>
          )}

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={pHSensitive}
              onChange={(e) => setPHSensitive(e.target.checked)}
            />
            pH Sensitive
          </label>

          <div className="flex gap-3 pt-2">
            <button type="submit" className="btn-primary flex-1">
              {product ? 'Update' : 'Add'} Product
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

export default ProductModal;
