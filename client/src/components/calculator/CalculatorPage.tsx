import React, { useState, useEffect } from 'react';
import { useCalculator } from '../../hooks/useCalculator';
import { useLoadSplitter } from '../../hooks/useLoadSplitter';
import { useWeather } from '../../hooks/useWeather';
import TankSetupCard from './TankSetupCard';
import CarrierAcresCard from './CarrierAcresCard';
import ProductSelector from './ProductSelector';
import ResultsSummary from './ResultsSummary';
import LoadSplitter from './LoadSplitter';
import LoadScheduleTable from './LoadScheduleTable';
import MixingInstructions from './MixingInstructions';
import ContainerBreakdownSection from './ContainerBreakdown';
import RecordModal from '../records/RecordModal';
import { Field, SprayRecord, SprayRecordProduct, SprayedField } from '../../types';
import { saveRecord, getFields } from '../../utils/storageService';
import { useCropYear } from '../../App';

// Field selection with partial acre support
interface FieldSelection {
  fieldId: string;
  sprayedAcres: number;
  subFieldId?: string;
}

const CalculatorPage: React.FC = () => {
  const calc = useCalculator();
  const { weather } = useWeather();
  const { cropYear } = useCropYear();
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [recordSaved, setRecordSaved] = useState(false);
  const [fieldSelections, setFieldSelections] = useState<FieldSelection[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [fieldSearch, setFieldSearch] = useState('');

  useEffect(() => {
    getFields().then(setFields);
  }, []);

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
      farmName?: string;
      fieldNumber?: string;
    }> = [];

    // Sort fields by field number first
    const sortedFields = [...fields].sort((a, b) => {
      const numA = a.fieldNumber || '';
      const numB = b.fieldNumber || '';
      return numA.localeCompare(numB, undefined, { numeric: true });
    });

    for (const field of sortedFields) {
      const subFieldsForYear = field.subFields?.filter(sf => sf.cropYear === cropYear) || [];

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
            farmName: field.farmName,
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
          farmName: field.farmName,
          fieldNumber: field.fieldNumber,
        });
      }
    }
    return items;
  };

  const selectableItems = getSelectableItems();

  const toggleField = (itemId: string, fieldId: string, acres: number, subFieldId?: string) => {
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
        next = [...prev, { fieldId, sprayedAcres: acres, subFieldId }];
      }
      const totalAcres = next.reduce((sum, s) => sum + s.sprayedAcres, 0);
      calc.setAcres(Math.round(totalAcres * 10) / 10);
      return next;
    });
  };

  const updateFieldAcres = (fieldId: string, acres: number, subFieldId?: string) => {
    setFieldSelections((prev) => {
      const updated = prev.map((s) =>
        s.fieldId === fieldId && s.subFieldId === subFieldId
          ? { ...s, sprayedAcres: Math.max(0, acres) }
          : s
      );
      const totalAcres = updated.reduce((sum, s) => sum + s.sprayedAcres, 0);
      calc.setAcres(Math.round(totalAcres * 10) / 10);
      return updated;
    });
  };

  const isSelected = (fieldId: string, subFieldId?: string) =>
    fieldSelections.some((s) => s.fieldId === fieldId && s.subFieldId === subFieldId);

  const getSelection = (fieldId: string, subFieldId?: string) =>
    fieldSelections.find((s) => s.fieldId === fieldId && s.subFieldId === subFieldId);

  const splitter = useLoadSplitter(
    calc.totalVolume,
    calc.tankSize,
    calc.numberOfLoads,
    calc.selectedProducts
  );

  const showLoadPlanner = calc.numberOfLoads > 1;

  const buildRecordPrefill = (): Partial<SprayRecord> => {
    const products: SprayRecordProduct[] = calc.selectedProducts.map((p) => ({
      productName: p.product.name,
      rate: p.rate,
      unit: p.product.unit,
      rateBasis: p.rateBasis,
      totalAmount: p.totalAmount,
    }));

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

    return {
      tankSize: calc.tankSize,
      carrierRate: calc.carrierRate,
      acres: calc.acres,
      totalVolume: calc.totalVolume,
      fieldIds: selectedFieldIds.length > 0 ? selectedFieldIds : undefined,
      fieldName: selectedNames.join(', ') || undefined,
      products,
      sprayedFields: sprayedFields.length > 0 ? sprayedFields : undefined,
      cropYear,
      weather: weather
        ? {
            temperature: weather.temperature,
            humidity: weather.humidity,
            windSpeed: weather.windSpeed,
            windDirection: weather.windDirection,
            source: weather.source,
          }
        : undefined,
    };
  };

  const handleSaveRecord = async (record: SprayRecord) => {
    await saveRecord(record);
    setShowRecordModal(false);
    setRecordSaved(true);
    setTimeout(() => setRecordSaved(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Field Selector */}
      {fields.length > 0 && (
        <div className="card">
          <label className="block text-sm font-medium text-gray-700 mb-1">Fields</label>
          {selectableItems.length > 5 && (
            <input
              type="text"
              placeholder="Search fields..."
              value={fieldSearch}
              onChange={(e) => setFieldSearch(e.target.value)}
              className="input-field mb-2 text-sm"
            />
          )}
          <div className="border rounded-lg max-h-48 overflow-y-auto p-2 space-y-1">
            {selectableItems.filter((item) => {
              if (!fieldSearch) return true;
              const q = fieldSearch.toLowerCase();
              return (
                item.displayName.toLowerCase().includes(q) ||
                (item.farmName && item.farmName.toLowerCase().includes(q)) ||
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
                  <span className="text-sm flex-1 cursor-pointer" onClick={() => toggleField(item.id, item.fieldId, item.acres, item.subFieldId)}>
                    {item.fieldNumber && !item.isSubField ? `${item.fieldNumber} - ` : ''}{item.displayName}{item.farmName && !item.isSubField ? ` — ${item.farmName}` : ''}
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
            <div className="text-xs text-gray-500 mt-1">
              {fieldSelections.length} field{fieldSelections.length !== 1 ? 's' : ''} selected &middot; {calc.acres} ac total
            </div>
          )}
        </div>
      )}

      {/* Section A: Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <TankSetupCard tankSize={calc.tankSize} onTankSizeChange={calc.setTankSize} />
        <CarrierAcresCard
          carrierRate={calc.carrierRate}
          acres={calc.acres}
          onCarrierRateChange={calc.setCarrierRate}
          onAcresChange={(v) => { setFieldSelections([]); calc.setAcres(v); }}
        />
      </div>

      {/* Section B: Products */}
      <ProductSelector
        acres={calc.acres}
        totalVolume={calc.totalVolume}
        selectedProducts={calc.selectedProducts}
        onAddProduct={calc.addProduct}
        onUpdateRate={calc.updateProductRate}
        onRemoveProduct={calc.removeProduct}
      />

      {/* Section C: Results Summary */}
      <ResultsSummary
        totalVolume={calc.totalVolume}
        numberOfLoads={calc.numberOfLoads}
        tankSize={calc.tankSize}
        acres={calc.acres}
        carrierRate={calc.carrierRate}
      />

      {/* Section D: Load Planner */}
      {showLoadPlanner && (
        <LoadSplitter
          numberOfLoads={splitter.numberOfLoads}
          minLoads={calc.numberOfLoads}
          splitMode={splitter.splitMode}
          loads={splitter.loads}
          tankSize={calc.tankSize}
          lockedLoads={splitter.lockedLoads}
          onNumberOfLoadsChange={splitter.setNumberOfLoads}
          onSplitModeChange={splitter.setSplitMode}
          onLoadVolumeChange={splitter.setLoadVolume}
          onResetLocks={splitter.resetLocks}
        />
      )}

      {/* Section E: Load Schedule Table */}
      {showLoadPlanner && (
        <LoadScheduleTable
          loads={splitter.loads}
          selectedProducts={calc.selectedProducts}
          acres={calc.acres}
          totalVolume={calc.totalVolume}
        />
      )}

      {/* Section F: Mixing Instructions (collapsible) */}
      <MixingInstructions selectedProducts={calc.selectedProducts} />

      {/* Section G: Container Breakdown (collapsible) */}
      <ContainerBreakdownSection
        selectedProducts={calc.selectedProducts}
        loads={showLoadPlanner ? splitter.loads : undefined}
      />

      {/* Section H: Save as Spray Record */}
      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Save Spray Record</h2>
            <p className="text-sm text-gray-500 mt-1">
              Capture this calculation as a spray record for your records
            </p>
          </div>
          <div className="flex items-center gap-3">
            {recordSaved && (
              <span className="text-sm text-green-600 font-medium">Record saved!</span>
            )}
            <button
              onClick={() => setShowRecordModal(true)}
              className="btn-primary text-sm py-2 px-4"
              disabled={calc.selectedProducts.length === 0}
            >
              Save as Record
            </button>
          </div>
        </div>
      </div>

      {showRecordModal && (
        <RecordModal
          prefill={buildRecordPrefill()}
          onSave={handleSaveRecord}
          onClose={() => setShowRecordModal(false)}
        />
      )}
    </div>
  );
};

export default CalculatorPage;
