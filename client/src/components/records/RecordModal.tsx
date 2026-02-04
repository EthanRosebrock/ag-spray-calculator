import React, { useState, useEffect } from 'react';
import { SprayRecord, SprayRecordProduct, Field } from '../../types';
import { getFields } from '../../utils/storageService';

interface RecordModalProps {
  /** Pre-filled data from calculator (partial record) */
  prefill?: Partial<SprayRecord>;
  onSave: (record: SprayRecord) => void;
  onClose: () => void;
}

const RecordModal: React.FC<RecordModalProps> = ({ prefill, onSave, onClose }) => {
  const [fields, setFields] = useState<Field[]>([]);
  const [date, setDate] = useState(prefill?.date || new Date().toISOString().split('T')[0]);
  const [selectedFieldIds, setSelectedFieldIds] = useState<string[]>(
    prefill?.fieldIds || (prefill?.fieldId ? [prefill.fieldId] : [])
  );
  const [manualFieldName, setManualFieldName] = useState(
    prefill?.fieldIds?.length || prefill?.fieldId ? '' : (prefill?.fieldName || '')
  );
  const [operator, setOperator] = useState(prefill?.operator || '');
  const [tankSize, setTankSize] = useState(prefill?.tankSize || 300);
  const [carrierRate, setCarrierRate] = useState(prefill?.carrierRate || 20);
  const [acres, setAcres] = useState(prefill?.acres || 0);
  const [notes, setNotes] = useState(prefill?.notes || '');
  const [products, setProducts] = useState<SprayRecordProduct[]>(prefill?.products || []);

  useEffect(() => {
    getFields().then(setFields);
  }, []);

  const toggleField = (id: string) => {
    setSelectedFieldIds((prev) => {
      const next = prev.includes(id) ? prev.filter((fid) => fid !== id) : [...prev, id];
      // Auto-sum acres from selected fields
      const totalAcres = next.reduce((sum, fid) => {
        const f = fields.find((field) => field.id === fid);
        return sum + (f?.acres || 0);
      }, 0);
      setAcres(Math.round(totalAcres * 10) / 10);
      return next;
    });
  };

  const addProduct = () => {
    setProducts([
      ...products,
      { productName: '', rate: 0, unit: '', rateBasis: 'per_acre', totalAmount: 0 },
    ]);
  };

  const updateProduct = (index: number, updates: Partial<SprayRecordProduct>) => {
    setProducts((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], ...updates };
      return updated;
    });
  };

  const removeProduct = (index: number) => {
    setProducts((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const selectedNames = selectedFieldIds
      .map((id) => fields.find((f) => f.id === id)?.name)
      .filter(Boolean) as string[];

    const displayName = selectedNames.length > 0
      ? selectedNames.join(', ')
      : manualFieldName;

    if (!displayName || !date) return;

    const record: SprayRecord = {
      id: Date.now().toString(),
      date,
      fieldId: selectedFieldIds.length === 1 ? selectedFieldIds[0] : undefined,
      fieldName: displayName,
      fieldIds: selectedFieldIds.length > 0 ? selectedFieldIds : undefined,
      fieldNames: selectedNames.length > 0 ? selectedNames : undefined,
      operator,
      tankSize,
      carrierRate,
      acres,
      products,
      totalVolume: prefill?.totalVolume || carrierRate * acres,
      weather: prefill?.weather,
      notes: notes || undefined,
      createdAt: new Date().toISOString(),
    };

    onSave(record);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-semibold mb-4">
          {prefill ? 'Save Spray Record' : 'Add Spray Record'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
              <input
                type="date"
                className="input-field"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Operator</label>
              <input
                type="text"
                className="input-field"
                value={operator}
                onChange={(e) => setOperator(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Field{fields.length > 0 ? '(s)' : ''} *
            </label>
            {fields.length > 0 ? (
              <div className="space-y-2">
                <div className="border rounded-lg max-h-48 overflow-y-auto p-2 space-y-1">
                  {fields.map((f) => (
                    <label
                      key={f.id}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-gray-50 ${
                        selectedFieldIds.includes(f.id) ? 'bg-ag-green-50' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedFieldIds.includes(f.id)}
                        onChange={() => toggleField(f.id)}
                        className="rounded text-ag-green-600"
                      />
                      <span className="text-sm flex-1">
                        {f.fieldNumber ? `${f.fieldNumber} - ` : ''}{f.name}
                      </span>
                      <span className="text-xs text-gray-400">{f.acres} ac</span>
                    </label>
                  ))}
                </div>
                {selectedFieldIds.length > 0 && (
                  <div className="text-xs text-gray-500">
                    {selectedFieldIds.length} field{selectedFieldIds.length !== 1 ? 's' : ''} selected &middot; {acres} ac total
                  </div>
                )}
                {selectedFieldIds.length === 0 && (
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Or type field name"
                    value={manualFieldName}
                    onChange={(e) => setManualFieldName(e.target.value)}
                  />
                )}
              </div>
            ) : (
              <input
                type="text"
                className="input-field"
                placeholder="Field name"
                value={manualFieldName}
                onChange={(e) => setManualFieldName(e.target.value)}
                required
              />
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tank (gal)</label>
              <input
                type="number"
                className="input-field"
                value={tankSize}
                onChange={(e) => setTankSize(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rate (gpa)</label>
              <input
                type="number"
                step="0.5"
                className="input-field"
                value={carrierRate}
                onChange={(e) => setCarrierRate(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Acres</label>
              <input
                type="number"
                step="0.1"
                className="input-field"
                value={acres}
                onChange={(e) => setAcres(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>

          {/* Products */}
          <div className="border-t pt-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-medium text-gray-700">Products</h3>
              <button type="button" onClick={addProduct} className="text-sm text-ag-green-700 hover:text-ag-green-800 font-medium">
                + Add Product
              </button>
            </div>
            {products.length === 0 ? (
              <p className="text-sm text-gray-400">No products added</p>
            ) : (
              <div className="space-y-3">
                {products.map((p, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <div className="flex-1 grid grid-cols-4 gap-2">
                      <input
                        type="text"
                        placeholder="Product"
                        className="input-field text-sm py-2 col-span-2"
                        value={p.productName}
                        onChange={(e) => updateProduct(i, { productName: e.target.value })}
                      />
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Rate"
                        className="input-field text-sm py-2"
                        value={p.rate || ''}
                        onChange={(e) => updateProduct(i, { rate: parseFloat(e.target.value) || 0 })}
                      />
                      <input
                        type="text"
                        placeholder="Unit"
                        className="input-field text-sm py-2"
                        value={p.unit}
                        onChange={(e) => updateProduct(i, { unit: e.target.value })}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeProduct(i)}
                      className="text-red-400 hover:text-red-600 mt-2"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Weather snapshot indicator */}
          {prefill?.weather && (
            <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
              Weather snapshot: {prefill.weather.temperature}&deg;F, {prefill.weather.windSpeed} mph {prefill.weather.windDirection}, {prefill.weather.humidity}% RH
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              className="input-field"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" className="btn-primary flex-1">
              Save Record
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

export default RecordModal;
