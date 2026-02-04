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
import { Field, SprayRecord, SprayRecordProduct } from '../../types';
import { saveRecord, getFields } from '../../utils/storageService';

const CalculatorPage: React.FC = () => {
  const calc = useCalculator();
  const { weather } = useWeather();
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [recordSaved, setRecordSaved] = useState(false);
  const [selectedFieldIds, setSelectedFieldIds] = useState<string[]>([]);
  const [fields, setFields] = useState<Field[]>([]);

  useEffect(() => {
    getFields().then(setFields);
  }, []);

  const toggleField = (id: string) => {
    setSelectedFieldIds((prev) => {
      const next = prev.includes(id) ? prev.filter((fid) => fid !== id) : [...prev, id];
      const totalAcres = next.reduce((sum, fid) => {
        const f = fields.find((field) => field.id === fid);
        return sum + (f?.acres || 0);
      }, 0);
      calc.setAcres(Math.round(totalAcres * 10) / 10);
      return next;
    });
  };

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

    const selectedNames = selectedFieldIds
      .map((id) => fields.find((f) => f.id === id)?.name)
      .filter(Boolean) as string[];

    return {
      tankSize: calc.tankSize,
      carrierRate: calc.carrierRate,
      acres: calc.acres,
      totalVolume: calc.totalVolume,
      fieldIds: selectedFieldIds.length > 0 ? selectedFieldIds : undefined,
      fieldName: selectedNames.join(', ') || undefined,
      products,
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
                  {f.name}{f.farmName ? ` — ${f.farmName}` : ''}
                </span>
                <span className="text-xs text-gray-400">{f.acres} ac</span>
              </label>
            ))}
          </div>
          {selectedFieldIds.length > 0 && (
            <div className="text-xs text-gray-500 mt-1">
              {selectedFieldIds.length} field{selectedFieldIds.length !== 1 ? 's' : ''} selected &middot; {calc.acres} ac total
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
          onAcresChange={(v) => { setSelectedFieldIds([]); calc.setAcres(v); }}
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
          onNumberOfLoadsChange={splitter.setNumberOfLoads}
          onSplitModeChange={splitter.setSplitMode}
          onLoadVolumeChange={splitter.setLoadVolume}
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
      <ContainerBreakdownSection selectedProducts={calc.selectedProducts} />

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
