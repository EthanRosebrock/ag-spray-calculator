import React, { useState } from 'react';
import { ContainerType } from '../../utils/containerCalculations';

interface ContainerModalProps {
  container?: ContainerType | null;
  onSave: (container: ContainerType) => void;
  onClose: () => void;
}

const ContainerModal: React.FC<ContainerModalProps> = ({ container, onSave, onClose }) => {
  const [name, setName] = useState(container?.name || '');
  const [size, setSize] = useState(container?.size || 0);
  const [unit, setUnit] = useState(container?.unit || 'gal');
  const [productType, setProductType] = useState<'liquid' | 'dry' | 'granular'>(
    container?.productType || 'liquid'
  );
  const [available, setAvailable] = useState(container?.available ?? true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || size <= 0) return;

    onSave({
      id: container?.id || `custom-container-${Date.now()}`,
      name: name.trim(),
      size,
      unit,
      productType,
      available,
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h2 className="text-xl font-semibold mb-4">
          {container ? 'Edit Container' : 'Add Container'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              className="input-field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., 2.5 gal jug"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Size</label>
              <input
                type="number"
                className="input-field"
                value={size || ''}
                onChange={(e) => setSize(parseFloat(e.target.value) || 0)}
                step="0.1"
                min="0"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
              <select
                className="input-field"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              >
                <option value="gal">gal</option>
                <option value="qt">qt</option>
                <option value="oz">oz</option>
                <option value="lb">lb</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Product Type
            </label>
            <select
              className="input-field"
              value={productType}
              onChange={(e) =>
                setProductType(e.target.value as 'liquid' | 'dry' | 'granular')
              }
            >
              <option value="liquid">Liquid</option>
              <option value="dry">Dry</option>
              <option value="granular">Granular</option>
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={available}
              onChange={(e) => setAvailable(e.target.checked)}
            />
            Available
          </label>

          <div className="flex gap-3 pt-2">
            <button type="submit" className="btn-primary flex-1">
              {container ? 'Update' : 'Add'} Container
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

export default ContainerModal;
