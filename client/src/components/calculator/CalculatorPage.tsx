import React from 'react';
import { useCalculator } from '../../hooks/useCalculator';
import { useLoadSplitter } from '../../hooks/useLoadSplitter';
import TankSetupCard from './TankSetupCard';
import CarrierAcresCard from './CarrierAcresCard';
import ProductSelector from './ProductSelector';
import ResultsSummary from './ResultsSummary';
import LoadSplitter from './LoadSplitter';
import LoadScheduleTable from './LoadScheduleTable';
import MixingInstructions from './MixingInstructions';
import ContainerBreakdownSection from './ContainerBreakdown';
import WeatherWidget from './WeatherWidget';

const CalculatorPage: React.FC = () => {
  const calc = useCalculator();

  const splitter = useLoadSplitter(
    calc.totalVolume,
    calc.tankSize,
    calc.numberOfLoads,
    calc.selectedProducts
  );

  const showLoadPlanner = calc.numberOfLoads > 1;

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

      {/* Section H: Weather Check (collapsible) */}
      <WeatherWidget />
    </div>
  );
};

export default CalculatorPage;
