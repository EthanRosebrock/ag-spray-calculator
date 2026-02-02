import React, { useState, useMemo } from 'react';
import { TankMixProduct } from '../../types';
import { ContainerCalculator } from '../../utils/containerCalculations';
import { getContainers } from '../../utils/storageService';
import { getContainerCategory } from '../../utils/unitConstants';

interface MixingInstructionsProps {
  selectedProducts: TankMixProduct[];
}

const MixingInstructions: React.FC<MixingInstructionsProps> = ({ selectedProducts }) => {
  const [open, setOpen] = useState(false);

  const containers = useMemo(() => getContainers(), []);
  const calculator = useMemo(() => new ContainerCalculator(containers), [containers]);

  const instructions = useMemo(() => {
    const breakdowns = selectedProducts.map((item) => {
      // For bulk products, resolve the container category from the measurement unit
      const containerType = item.product.type === 'bulk'
        ? getContainerCategory(item.product.measurementUnit)
        : item.product.type;
      return {
        item,
        text: calculator.formatContainerBreakdown(
          calculator.calculateOptimalBreakdown(
            item.totalAmount,
            containerType,
            item.product.preferredContainers
          )
        ),
      };
    });

    const sorted = [...breakdowns].sort(
      (a, b) => a.item.product.mixingOrder - b.item.product.mixingOrder
    );

    const steps: string[] = [
      '1. Fill tank 1/2 with clean water',
      '2. Begin agitation',
    ];
    sorted.forEach((pb, i) => {
      steps.push(`${i + 3}. Add ${pb.item.product.name} (${pb.text})`);
      if (pb.item.product.pHSensitive) {
        steps.push('   - Check and adjust pH if needed');
      }
    });
    steps.push(`${sorted.length + 3}. Top off tank with water to desired volume`);
    steps.push(`${sorted.length + 4}. Continue agitation for 2-3 minutes`);
    steps.push(`${sorted.length + 5}. Verify even mixing before application`);
    return steps;
  }, [selectedProducts, calculator]);

  const compatibilityWarnings = useMemo(() => {
    const warnings: string[] = [];
    const hasHerbicide = selectedProducts.some(
      (p) =>
        p.product.name.toLowerCase().includes('roundup') ||
        p.product.name.toLowerCase().includes('2,4-d')
    );
    const hasFungicide = selectedProducts.some((p) =>
      p.product.name.toLowerCase().includes('fungicide')
    );
    if (hasHerbicide && hasFungicide) {
      warnings.push('Herbicide + Fungicide: Monitor pH carefully');
    }
    const phCount = selectedProducts.filter((p) => p.product.pHSensitive).length;
    if (phCount > 1) {
      warnings.push(`${phCount} pH-sensitive products - test small batch first`);
    }
    return warnings;
  }, [selectedProducts]);

  if (selectedProducts.length === 0) return null;

  return (
    <div className="card">
      <button
        onClick={() => setOpen(!open)}
        className="flex justify-between items-center w-full text-left"
      >
        <h2 className="text-lg font-semibold">Mixing Instructions</h2>
        <span className="text-gray-400">{open ? '\u25B2' : '\u25BC'}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          <ol className="space-y-1 text-sm">
            {instructions.map((instr, i) => (
              <li key={i} className={instr.startsWith('   ') ? 'ml-4 text-yellow-700' : ''}>
                {instr}
              </li>
            ))}
          </ol>

          {compatibilityWarnings.length > 0 && (
            <div className="border border-yellow-300 bg-yellow-50 rounded-lg p-4">
              <h3 className="font-semibold text-yellow-800 mb-2">Compatibility Warnings</h3>
              <ul className="space-y-1 text-sm text-yellow-700">
                {compatibilityWarnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MixingInstructions;
