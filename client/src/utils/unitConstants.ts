import { UnitConfig, MeasurementUnit, ProductType, RateBasis } from '../types';

export const UNIT_CONFIGS: UnitConfig[] = [
  // Liquid units (base unit: gal)
  { value: 'fl_oz', label: 'fl oz', category: 'liquid', toBaseUnit: 1 / 128 },
  { value: 'pt',    label: 'pt',    category: 'liquid', toBaseUnit: 1 / 8 },
  { value: 'qt',    label: 'qt',    category: 'liquid', toBaseUnit: 1 / 4 },
  { value: 'gal',   label: 'gal',   category: 'liquid', toBaseUnit: 1 },
  // Dry units (base unit: lbs)
  { value: 'oz',    label: 'oz',    category: 'dry',    toBaseUnit: 1 / 16 },
  { value: 'lbs',   label: 'lbs',   category: 'dry',    toBaseUnit: 1 },
];

/**
 * Return the measurement units available for a given product type.
 * liquid → liquid units, dry → dry units, bulk → all units.
 */
export function getUnitsForProductType(type: ProductType): UnitConfig[] {
  if (type === 'bulk') return UNIT_CONFIGS;
  const category = type === 'liquid' ? 'liquid' : 'dry';
  return UNIT_CONFIGS.filter((u) => u.category === category);
}

/**
 * Format a human-readable display string, e.g. "fl oz / acre" or "lbs / 100 gal water".
 */
export function formatUnitDisplay(measurementUnit: MeasurementUnit, rateBasis: RateBasis): string {
  const config = UNIT_CONFIGS.find((u) => u.value === measurementUnit);
  const unitLabel = config?.label ?? measurementUnit;
  const basisLabel = rateBasis === 'per_100_gal' ? '100 gal water' : 'acre';
  return `${unitLabel} / ${basisLabel}`;
}

/**
 * Look up the conversion factor for a measurement unit to its base unit.
 */
export function getConversionFactor(measurementUnit: MeasurementUnit): number {
  const config = UNIT_CONFIGS.find((u) => u.value === measurementUnit);
  return config?.toBaseUnit ?? 1;
}

/**
 * Return the base display unit for a given measurement unit.
 * Liquid units → 'gal', dry units → 'lbs'.
 */
export function getBaseDisplayUnit(measurementUnit?: MeasurementUnit): string {
  if (!measurementUnit) return 'gal';
  const config = UNIT_CONFIGS.find((u) => u.value === measurementUnit);
  if (!config) return 'gal';
  return config.category === 'liquid' ? 'gal' : 'lbs';
}

/**
 * Return the container product type category for a measurement unit.
 * Useful for bulk products where type doesn't directly map to container category.
 */
export function getContainerCategory(measurementUnit?: MeasurementUnit): 'liquid' | 'dry' {
  if (!measurementUnit) return 'liquid';
  const config = UNIT_CONFIGS.find((u) => u.value === measurementUnit);
  return config?.category ?? 'liquid';
}

/**
 * Map legacy unit strings (e.g. 'oz/acre', 'lbs/acre') to the new
 * measurementUnit + rateBasis pair.
 */
export function parseLegacyUnit(unit: string): { measurementUnit: MeasurementUnit; rateBasis: RateBasis } {
  const mapping: Record<string, { measurementUnit: MeasurementUnit; rateBasis: RateBasis }> = {
    'oz/acre':  { measurementUnit: 'fl_oz', rateBasis: 'per_acre' },
    'pt/acre':  { measurementUnit: 'pt',    rateBasis: 'per_acre' },
    'qt/acre':  { measurementUnit: 'qt',    rateBasis: 'per_acre' },
    'gal/acre': { measurementUnit: 'gal',   rateBasis: 'per_acre' },
    'lbs/acre': { measurementUnit: 'lbs',   rateBasis: 'per_acre' },
    // New display format strings
    'fl oz / acre':         { measurementUnit: 'fl_oz', rateBasis: 'per_acre' },
    'pt / acre':            { measurementUnit: 'pt',    rateBasis: 'per_acre' },
    'qt / acre':            { measurementUnit: 'qt',    rateBasis: 'per_acre' },
    'gal / acre':           { measurementUnit: 'gal',   rateBasis: 'per_acre' },
    'oz / acre':            { measurementUnit: 'oz',    rateBasis: 'per_acre' },
    'lbs / acre':           { measurementUnit: 'lbs',   rateBasis: 'per_acre' },
    'fl oz / 100 gal water': { measurementUnit: 'fl_oz', rateBasis: 'per_100_gal' },
    'pt / 100 gal water':   { measurementUnit: 'pt',    rateBasis: 'per_100_gal' },
    'qt / 100 gal water':   { measurementUnit: 'qt',    rateBasis: 'per_100_gal' },
    'gal / 100 gal water':  { measurementUnit: 'gal',   rateBasis: 'per_100_gal' },
    'oz / 100 gal water':   { measurementUnit: 'oz',    rateBasis: 'per_100_gal' },
    'lbs / 100 gal water':  { measurementUnit: 'lbs',   rateBasis: 'per_100_gal' },
  };
  return mapping[unit] ?? { measurementUnit: 'fl_oz', rateBasis: 'per_acre' };
}
