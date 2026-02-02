import { TankMixProduct, RateBasis, MeasurementUnit } from '../types';
import { getConversionFactor, getBaseDisplayUnit, parseLegacyUnit } from './unitConstants';

/**
 * Convert a rate to a total amount.
 *
 * - per_acre (default): rate × conversionFactor × acres
 * - per_100_gal:        rate × conversionFactor × (totalVolume / 100)
 *
 * Falls back to parseLegacyUnit() when new params are not provided.
 */
export function convertRateToAmount(
  rate: number,
  unit: string,
  acres: number,
  totalVolume?: number,
  rateBasis?: RateBasis,
  measurementUnit?: MeasurementUnit
): number {
  let basis: RateBasis;
  let convFactor: number;

  if (measurementUnit && rateBasis) {
    basis = rateBasis;
    convFactor = getConversionFactor(measurementUnit);
  } else {
    // Legacy path: parse from the old unit string
    const parsed = parseLegacyUnit(unit);
    basis = parsed.rateBasis;
    convFactor = getConversionFactor(parsed.measurementUnit);
  }

  if (basis === 'per_100_gal') {
    const vol = totalVolume ?? 0;
    return rate * convFactor * (vol / 100);
  }

  // Default: per_acre
  return rate * convFactor * acres;
}

/**
 * Calculate an even split of totalVolume across numberOfLoads,
 * capping each load at tankSize.
 * Returns an array of load volumes.
 */
export function calculateEvenSplit(
  totalVolume: number,
  numberOfLoads: number,
  tankSize: number
): number[] {
  if (numberOfLoads <= 0 || totalVolume <= 0) return [];
  const evenVolume = totalVolume / numberOfLoads;
  const cappedVolume = Math.min(evenVolume, tankSize);
  return Array.from({ length: numberOfLoads }, () =>
    Math.round(cappedVolume * 100) / 100
  );
}

/**
 * Redistribute load volumes when a user changes one load's volume in custom mode.
 * Adjusts all OTHER loads proportionally so total remains the same.
 *
 * @param loadVolumes   Current array of per-load volumes
 * @param changedIndex  Index of the load the user changed
 * @param newVolume     New volume for that load (clamped to 0..tankSize)
 * @param totalVolume   The total volume that must be distributed
 * @param tankSize      Max per-load volume
 */
export function redistributeLoadVolumes(
  loadVolumes: number[],
  changedIndex: number,
  newVolume: number,
  totalVolume: number,
  tankSize: number
): number[] {
  const clamped = Math.max(0, Math.min(newVolume, tankSize));
  const remaining = totalVolume - clamped;
  const otherIndices = loadVolumes
    .map((_, i) => i)
    .filter((i) => i !== changedIndex);

  const otherSum = otherIndices.reduce((s, i) => s + loadVolumes[i], 0);

  const result = [...loadVolumes];
  result[changedIndex] = clamped;

  if (otherSum === 0) {
    // Distribute remaining evenly among other loads
    const each = remaining / otherIndices.length;
    otherIndices.forEach((i) => {
      result[i] = Math.min(Math.round(each * 100) / 100, tankSize);
    });
  } else {
    // Proportional redistribution
    otherIndices.forEach((i) => {
      const proportion = loadVolumes[i] / otherSum;
      result[i] = Math.min(
        Math.round(remaining * proportion * 100) / 100,
        tankSize
      );
    });
  }

  return result;
}

/**
 * Calculate how many whole packages to buy for a given total amount.
 */
export function calculatePackages(
  totalAmount: number,
  packageSize: number
): { packages: number; totalFromPackages: number; excess: number } {
  if (packageSize <= 0 || totalAmount <= 0) {
    return { packages: 0, totalFromPackages: 0, excess: 0 };
  }
  const packages = Math.ceil(totalAmount / packageSize);
  const totalFromPackages = packages * packageSize;
  const excess = Math.round((totalFromPackages - totalAmount) * 100) / 100;
  return { packages, totalFromPackages, excess };
}

export interface LoadProductAmount {
  product: TankMixProduct;
  amount: number;       // total product for this load
  displayUnit: string;  // 'gal' or 'lbs'
}

/**
 * Calculate per-load product amounts based on the load's proportion of total volume.
 */
export function calculateLoadProducts(
  loadVolume: number,
  totalVolume: number,
  selectedProducts: TankMixProduct[]
): LoadProductAmount[] {
  if (totalVolume <= 0) return [];
  const proportion = loadVolume / totalVolume;
  return selectedProducts.map((item) => ({
    product: item,
    amount: Math.round(item.totalAmount * proportion * 100) / 100,
    displayUnit: getBaseDisplayUnit(item.product.measurementUnit),
  }));
}
