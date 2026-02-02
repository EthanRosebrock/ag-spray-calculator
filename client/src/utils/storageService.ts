import { Product, Field, CalculatorDefaults, SprayRecord, TenderRoute } from '../types';
import { ContainerType, DEFAULT_CONTAINERS } from './containerCalculations';
import { parseLegacyUnit, formatUnitDisplay } from './unitConstants';

// --- Storage keys ---
const KEYS = {
  products: 'agrispray_products',
  containers: 'agrispray_containers',
  fields: 'agrispray_fields',
  calculatorDefaults: 'agrispray_calculator_defaults',
  storageVersion: 'agrispray_storage_version',
  tankPresets: 'agrispray_tank_presets',
  carrierPresets: 'agrispray_carrier_presets',
  records: 'agrispray_records',
  routes: 'agrispray_routes',
  // backward-compatible keys
  farmLocation: 'farmLocation',
  fieldLocations: 'fieldLocations',
};

const CURRENT_STORAGE_VERSION = 2;

// --- Default products (matches server.js /api/products) ---
export const DEFAULT_PRODUCTS: Product[] = [
  {
    id: 'default-roundup',
    name: 'Roundup PowerMAX',
    type: 'liquid',
    unit: 'fl oz / acre',
    defaultRate: 32,
    mixingOrder: 2,
    pHSensitive: false,
    isCustom: false,
    measurementUnit: 'fl_oz',
    rateBasis: 'per_acre',
  },
  {
    id: 'default-atrazine',
    name: 'Atrazine 4L',
    type: 'liquid',
    unit: 'qt / acre',
    defaultRate: 1.5,
    mixingOrder: 3,
    pHSensitive: false,
    isCustom: false,
    measurementUnit: 'qt',
    rateBasis: 'per_acre',
  },
  {
    id: 'default-ams',
    name: 'AMS',
    type: 'dry',
    unit: 'lbs / 100 gal water',
    defaultRate: 17,
    mixingOrder: 1,
    pHSensitive: false,
    isCustom: false,
    measurementUnit: 'lbs',
    rateBasis: 'per_100_gal',
  },
];

// --- Helpers ---
function loadJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveJSON<T>(key: string, data: T): void {
  localStorage.setItem(key, JSON.stringify(data));
}

// --- Migration ---
function migrateProducts(): void {
  const version = loadJSON<number>(KEYS.storageVersion) ?? 1;
  if (version >= CURRENT_STORAGE_VERSION) return;

  const stored = loadJSON<Product[]>(KEYS.products);
  if (stored) {
    const migrated = stored.map((p) => {
      if (p.measurementUnit && p.rateBasis) return p; // already migrated
      const parsed = parseLegacyUnit(p.unit);
      return {
        ...p,
        measurementUnit: parsed.measurementUnit,
        rateBasis: parsed.rateBasis,
        unit: formatUnitDisplay(parsed.measurementUnit, parsed.rateBasis),
      };
    });
    saveJSON(KEYS.products, migrated);
  }

  saveJSON(KEYS.storageVersion, CURRENT_STORAGE_VERSION);
}

// Run migration on module load
migrateProducts();

// --- Products ---
export function getProducts(): Product[] {
  const stored = loadJSON<Product[]>(KEYS.products);
  if (stored) return stored;
  // seed defaults on first use
  saveJSON(KEYS.products, DEFAULT_PRODUCTS);
  return DEFAULT_PRODUCTS;
}

export function saveProduct(product: Product): void {
  const products = getProducts();
  const idx = products.findIndex((p) => p.id === product.id);
  if (idx >= 0) {
    products[idx] = product;
  } else {
    products.push(product);
  }
  saveJSON(KEYS.products, products);
}

export function deleteProduct(id: string): void {
  const products = getProducts().filter((p) => p.id !== id);
  saveJSON(KEYS.products, products);
}

export function resetProducts(): void {
  saveJSON(KEYS.products, DEFAULT_PRODUCTS);
}

// --- Containers ---
export function getContainers(): ContainerType[] {
  const stored = loadJSON<ContainerType[]>(KEYS.containers);
  if (stored) return stored;
  // seed defaults on first use
  saveJSON(KEYS.containers, DEFAULT_CONTAINERS);
  return [...DEFAULT_CONTAINERS];
}

export function saveContainer(container: ContainerType): void {
  const containers = getContainers();
  const idx = containers.findIndex((c) => c.id === container.id);
  if (idx >= 0) {
    containers[idx] = container;
  } else {
    containers.push(container);
  }
  saveJSON(KEYS.containers, containers);
}

export function deleteContainer(id: string): void {
  const containers = getContainers().filter((c) => c.id !== id);
  saveJSON(KEYS.containers, containers);
}

export function toggleContainerAvailability(id: string): void {
  const containers = getContainers();
  const idx = containers.findIndex((c) => c.id === id);
  if (idx >= 0) {
    containers[idx] = { ...containers[idx], available: !containers[idx].available };
    saveJSON(KEYS.containers, containers);
  }
}

export function resetContainers(): void {
  saveJSON(KEYS.containers, DEFAULT_CONTAINERS);
}

// --- Fields ---
export function getFields(): Field[] {
  return loadJSON<Field[]>(KEYS.fields) || [];
}

export function saveField(field: Field): void {
  const fields = getFields();
  const idx = fields.findIndex((f) => f.id === field.id);
  if (idx >= 0) {
    fields[idx] = field;
  } else {
    fields.push(field);
  }
  saveJSON(KEYS.fields, fields);
}

export function deleteField(id: string): void {
  const fields = getFields().filter((f) => f.id !== id);
  saveJSON(KEYS.fields, fields);
}

// --- Calculator Defaults ---
const DEFAULT_CALCULATOR: CalculatorDefaults = {
  tankSize: 300,
  carrierRate: 20,
  acres: 160,
};

export function getCalculatorDefaults(): CalculatorDefaults {
  const stored = loadJSON<CalculatorDefaults>(KEYS.calculatorDefaults);
  return stored || DEFAULT_CALCULATOR;
}

export function saveCalculatorDefaults(defaults: Partial<CalculatorDefaults>): void {
  const current = getCalculatorDefaults();
  saveJSON(KEYS.calculatorDefaults, { ...current, ...defaults });
}

// --- Tank Size Presets ---
const DEFAULT_TANK_PRESETS = [200, 300, 500, 750, 1000];

export function getTankPresets(): number[] {
  const stored = loadJSON<number[]>(KEYS.tankPresets);
  if (stored) return stored;
  saveJSON(KEYS.tankPresets, DEFAULT_TANK_PRESETS);
  return DEFAULT_TANK_PRESETS;
}

export function saveTankPresets(presets: number[]): void {
  saveJSON(KEYS.tankPresets, presets);
}

// --- Carrier Rate Presets ---
const DEFAULT_CARRIER_PRESETS = [10, 15, 20, 25];

export function getCarrierPresets(): number[] {
  const stored = loadJSON<number[]>(KEYS.carrierPresets);
  if (stored) return stored;
  saveJSON(KEYS.carrierPresets, DEFAULT_CARRIER_PRESETS);
  return DEFAULT_CARRIER_PRESETS;
}

export function saveCarrierPresets(presets: number[]): void {
  saveJSON(KEYS.carrierPresets, presets);
}

// --- Spray Records ---
export function getRecords(): SprayRecord[] {
  return loadJSON<SprayRecord[]>(KEYS.records) || [];
}

export function saveRecord(record: SprayRecord): void {
  const records = getRecords();
  const idx = records.findIndex((r) => r.id === record.id);
  if (idx >= 0) {
    records[idx] = record;
  } else {
    records.push(record);
  }
  saveJSON(KEYS.records, records);
}

export function deleteRecord(id: string): void {
  const records = getRecords().filter((r) => r.id !== id);
  saveJSON(KEYS.records, records);
}

// --- Tender Routes ---
export function getRoutes(): TenderRoute[] {
  return loadJSON<TenderRoute[]>(KEYS.routes) || [];
}

export function saveRoute(route: TenderRoute): void {
  const routes = getRoutes();
  const idx = routes.findIndex((r) => r.id === route.id);
  if (idx >= 0) {
    routes[idx] = route;
  } else {
    routes.push(route);
  }
  saveJSON(KEYS.routes, routes);
}

export function deleteRoute(id: string): void {
  const routes = getRoutes().filter((r) => r.id !== id);
  saveJSON(KEYS.routes, routes);
}
