import React, { useState } from 'react';
import { Product } from '../../types';
import { saveProduct } from '../../utils/storageService';

interface ProductModalProps {
  product?: Product | null;
  onSave: (product: Product) => void;
  onClose: () => void;
}

const ProductModal: React.FC<ProductModalProps> = ({ product, onSave, onClose }) => {
  const [name, setName] = useState(product?.name || '');
  const [type, setType] = useState<'liquid' | 'dry'>(product?.type || 'liquid');
  const [unit, setUnit] = useState(product?.unit || 'oz/acre');
  const [defaultRate, setDefaultRate] = useState(product?.defaultRate || 0);
  const [mixingOrder, setMixingOrder] = useState(product?.mixingOrder || 2);
  const [pHSensitive, setPHSensitive] = useState(product?.pHSensitive || false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || defaultRate <= 0) return;

    const saved: Product = {
      id: product?.id || `custom-${Date.now()}`,
      name: name.trim(),
      type,
      unit,
      defaultRate,
      mixingOrder,
      pHSensitive,
      isCustom: true,
    };

    saveProduct(saved);
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                className="input-field"
                value={type}
                onChange={(e) => setType(e.target.value as 'liquid' | 'dry')}
              >
                <option value="liquid">Liquid</option>
                <option value="dry">Dry</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
              <select
                className="input-field"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              >
                <option value="oz/acre">oz/acre</option>
                <option value="pt/acre">pt/acre</option>
                <option value="qt/acre">qt/acre</option>
                <option value="gal/acre">gal/acre</option>
                <option value="lbs/acre">lbs/acre</option>
              </select>
            </div>
          </div>

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
