import React, { useState, useEffect } from 'react';
import { SprayRecord, SprayRecordProduct, SprayedField, Field } from '../../types';
import { getFields } from '../../utils/storageService';
import { useCropYear } from '../../App';

// Field selection with partial acre support
interface FieldSelection {
  fieldId: string;
  sprayedAcres: number;
  subFieldId?: string;
}

interface RecordModalProps {
  /** Pre-filled data from calculator (partial record) */
  prefill?: Partial<SprayRecord>;
  onSave: (record: SprayRecord) => void;
  onClose: () => void;
}

const RecordModal: React.FC<RecordModalProps> = ({ prefill, onSave, onClose }) => {
  const { cropYear } = useCropYear();
  const [fields, setFields] = useState<Field[]>([]);
  const [date, setDate] = useState(prefill?.date || new Date().toISOString().split('T')[0]);

  // Initialize field selections from prefill sprayedFields or fallback to legacy fieldIds
  const initializeSelections = (): FieldSelection[] => {
    if (prefill?.sprayedFields) {
      return prefill.sprayedFields.map((sf) => ({
        fieldId: sf.fieldId,
        sprayedAcres: sf.sprayedAcres,
        subFieldId: sf.subFieldId,
      }));
    }
    if (prefill?.fieldIds) {
      return prefill.fieldIds.map((id) => ({
        fieldId: id,
        sprayedAcres: 0, // Will be set after fields load
        subFieldId: undefined,
      }));
    }
    if (prefill?.fieldId) {
      return [{ fieldId: prefill.fieldId, sprayedAcres: 0, subFieldId: undefined }];
    }
    return [];
  };

  const [fieldSelections, setFieldSelections] = useState<FieldSelection[]>(initializeSelections);
  const [manualFieldName, setManualFieldName] = useState(
    prefill?.fieldIds?.length || prefill?.fieldId || prefill?.sprayedFields?.length ? '' : (prefill?.fieldName || '')
  );
  const [fieldSearch, setFieldSearch] = useState('');
  const [operator, setOperator] = useState(prefill?.operator || '');
  const [tankSize, setTankSize] = useState(prefill?.tankSize || 300);
  const [carrierRate, setCarrierRate] = useState(prefill?.carrierRate || 20);
  const [acres, setAcres] = useState(prefill?.acres || 0);
  const [notes, setNotes] = useState(prefill?.notes || '');
  const [products, setProducts] = useState<SprayRecordProduct[]>(prefill?.products || []);

  useEffect(() => {
    getFields().then((loadedFields) => {
      setFields(loadedFields);
      // If we have legacy field IDs without sprayedAcres, populate them now
      if (!prefill?.sprayedFields && (prefill?.fieldIds || prefill?.fieldId)) {
        setFieldSelections((prev) =>
          prev.map((sel) => {
            if (sel.sprayedAcres === 0) {
              const field = loadedFields.find((f) => f.id === sel.fieldId);
              return { ...sel, sprayedAcres: field?.acres || 0 };
            }
            return sel;
          })
        );
      }
    });
  }, [prefill?.fieldIds, prefill?.fieldId, prefill?.sprayedFields]);

  // Get selectable items - either sub-fields (for current crop year) or parent fields
  const getSelectableItems = () => {
    const items: Array<{
      id: string;
      fieldId: string;
      name: string;
      displayName: string;
      acres: number;
      isSubField: boolean;
      subFieldId?: string;
      parentFieldName?: string;
      fieldNumber?: string;
    }> = [];

    for (const field of fields) {
      const subFieldsForYear = field.subFields?.filter((sf) => sf.cropYear === cropYear) || [];

      if (subFieldsForYear.length > 0) {
        // Show sub-fields instead of parent
        for (const sf of subFieldsForYear) {
          items.push({
            id: `${field.id}:${sf.id}`,
            fieldId: field.id,
            name: sf.name,
            displayName: `${field.name} - ${sf.name}`,
            acres: sf.acres,
            isSubField: true,
            subFieldId: sf.id,
            parentFieldName: field.name,
            fieldNumber: field.fieldNumber,
          });
        }
      } else {
        // Show parent field normally
        items.push({
          id: field.id,
          fieldId: field.id,
          name: field.name,
          displayName: field.name,
          acres: field.acres,
          isSubField: false,
          fieldNumber: field.fieldNumber,
        });
      }
    }
    return items;
  };

  const selectableItems = getSelectableItems();

  const toggleField = (itemId: string, fieldId: string, itemAcres: number, subFieldId?: string) => {
    setFieldSelections((prev) => {
      const existingIdx = prev.findIndex(
        (s) => s.fieldId === fieldId && s.subFieldId === subFieldId
      );
      let next: FieldSelection[];
      if (existingIdx >= 0) {
        // Remove selection
        next = prev.filter((_, i) => i !== existingIdx);
      } else {
        // Add with full acres by default
        next = [...prev, { fieldId, sprayedAcres: itemAcres, subFieldId }];
      }
      const totalAcres = next.reduce((sum, s) => sum + s.sprayedAcres, 0);
      setAcres(Math.round(totalAcres * 10) / 10);
      return next;
    });
  };

  const updateFieldAcres = (fieldId: string, newAcres: number, subFieldId?: string) => {
    setFieldSelections((prev) => {
      const updated = prev.map((s) =>
        s.fieldId === fieldId && s.subFieldId === subFieldId
          ? { ...s, sprayedAcres: Math.max(0, newAcres) }
          : s
      );
      const totalAcres = updated.reduce((sum, s) => sum + s.sprayedAcres, 0);
      setAcres(Math.round(totalAcres * 10) / 10);
      return updated;
    });
  };

  const isSelected = (fieldId: string, subFieldId?: string) =>
    fieldSelections.some((s) => s.fieldId === fieldId && s.subFieldId === subFieldId);

  const getSelection = (fieldId: string, subFieldId?: string) =>
    fieldSelections.find((s) => s.fieldId === fieldId && s.subFieldId === subFieldId);

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

    // Build sprayedFields with partial acre data
    const sprayedFields: SprayedField[] = fieldSelections.map((sel) => {
      const field = fields.find((f) => f.id === sel.fieldId);
      const subField = sel.subFieldId
        ? field?.subFields?.find((sf) => sf.id === sel.subFieldId)
        : undefined;

      return {
        fieldId: sel.fieldId,
        fieldName: field?.name || '',
        totalAcres: subField ? subField.acres : (field?.acres || 0),
        sprayedAcres: sel.sprayedAcres,
        subFieldId: sel.subFieldId,
        subFieldName: subField?.name,
      };
    });

    const selectedNames = sprayedFields.map((sf) =>
      sf.subFieldName ? `${sf.fieldName} - ${sf.subFieldName}` : sf.fieldName
    );
    const selectedFieldIds = Array.from(new Set(fieldSelections.map((s) => s.fieldId)));

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
      sprayedFields: sprayedFields.length > 0 ? sprayedFields : undefined,
      cropYear: prefill?.cropYear || cropYear,
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
                {selectableItems.length > 5 && (
                  <input
                    type="text"
                    placeholder="Search fields..."
                    value={fieldSearch}
                    onChange={(e) => setFieldSearch(e.target.value)}
                    className="input-field text-sm"
                  />
                )}
                <div className="border rounded-lg max-h-48 overflow-y-auto p-2 space-y-1">
                  {selectableItems.filter((item) => {
                    if (!fieldSearch) return true;
                    const q = fieldSearch.toLowerCase();
                    return (
                      item.displayName.toLowerCase().includes(q) ||
                      (item.fieldNumber && item.fieldNumber.toLowerCase().includes(q))
                    );
                  }).map((item) => {
                    const selected = isSelected(item.fieldId, item.subFieldId);
                    const selection = getSelection(item.fieldId, item.subFieldId);
                    return (
                      <div
                        key={item.id}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded ${
                          selected ? 'bg-ag-green-50' : 'hover:bg-gray-50'
                        } ${item.isSubField ? 'ml-4' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleField(item.id, item.fieldId, item.acres, item.subFieldId)}
                          className="rounded text-ag-green-600 cursor-pointer"
                        />
                        <span
                          className="text-sm flex-1 cursor-pointer"
                          onClick={() => toggleField(item.id, item.fieldId, item.acres, item.subFieldId)}
                        >
                          {item.fieldNumber && !item.isSubField ? `${item.fieldNumber} - ` : ''}{item.displayName}
                        </span>
                        {selected ? (
                          <div className="flex items-center gap-1 text-xs">
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              max={item.acres}
                              value={selection?.sprayedAcres || 0}
                              onChange={(e) => updateFieldAcres(item.fieldId, parseFloat(e.target.value) || 0, item.subFieldId)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-14 px-1 py-0.5 border border-gray-300 rounded text-right text-xs"
                            />
                            <span className="text-gray-400">/ {item.acres} ac</span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">{item.acres} ac</span>
                        )}
                      </div>
                    );
                  })}
                </div>
                {fieldSelections.length > 0 && (
                  <div className="text-xs text-gray-500">
                    {fieldSelections.length} field{fieldSelections.length !== 1 ? 's' : ''} selected &middot; {acres} ac total
                  </div>
                )}
                {fieldSelections.length === 0 && (
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
