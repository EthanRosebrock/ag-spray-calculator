import React, { useState } from 'react';
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
import { SprayRecord, SprayRecordProduct } from '../../types';
import { saveRecord } from '../../utils/storageService';

const CalculatorPage: React.FC = () => {
  const calc = useCalculator();
  const { weather } = useWeather();
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [recordSaved, setRecordSaved] = useState(false);

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

    return {
      tankSize: calc.tankSize,
      carrierRate: calc.carrierRate,
      acres: calc.acres,
      totalVolume: calc.totalVolume,
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

  const handleSaveRecord = (record: SprayRecord) => {
    saveRecord(record);
    setShowRecordModal(false);
    setRecordSaved(true);
    setTimeout(() => setRecordSaved(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Section A: Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <TankSetupCard tankSize={calc.tankSize} onTankSizeChange={calc.setTankSize} />
        <CarrierAcresCard
          carrierRate={calc.carrierRate}
          acres={calc.acres}
          onCarrierRateChange={calc.setCarrierRate}
          onAcresChange={calc.setAcres}
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
