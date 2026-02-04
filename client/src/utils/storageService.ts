import { Product, Field, CalculatorDefaults, SprayRecord, TenderRoute, SavedPin } from '../types';
import { ContainerType, DEFAULT_CONTAINERS } from './containerCalculations';
import { supabase, supabaseConfigured } from './supabaseClient';
import { LocationData } from './weatherService';

// --- Snake ↔ Camel case helpers ---
const SNAKE_OVERRIDES: Record<string, string> = {
  pHSensitive: 'ph_sensitive',
};
const CAMEL_OVERRIDES: Record<string, string> = {
  ph_sensitive: 'pHSensitive',
};

function toSnakeCase(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const key in obj) {
    const snakeKey = SNAKE_OVERRIDES[key] || key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    result[snakeKey] = obj[key];
  }
  return result;
}

function toCamelCase(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const key in obj) {
    const camelKey = CAMEL_OVERRIDES[key] || key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    result[camelKey] = obj[key];
  }
  return result;
}

// --- localStorage helpers (kept as offline cache) ---
const KEYS = {
  products: 'agrispray_products',
  containers: 'agrispray_containers',
  fields: 'agrispray_fields',
  calculatorDefaults: 'agrispray_calculator_defaults',
  tankPresets: 'agrispray_tank_presets',
  carrierPresets: 'agrispray_carrier_presets',
  records: 'agrispray_records',
  routes: 'agrispray_routes',
  pins: 'agrispray_pins',
  farmLocation: 'farmLocation',
};

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

// --- Default products ---
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

const DEFAULT_CALCULATOR: CalculatorDefaults = {
  tankSize: 300,
  carrierRate: 20,
  acres: 160,
};

const DEFAULT_TANK_PRESETS = [200, 300, 500, 750, 1000];
const DEFAULT_CARRIER_PRESETS = [10, 15, 20, 25];

export const DEFAULT_FARM_LOCATION: LocationData = {
  latitude: 41.4389,
  longitude: -84.3558,
  city: 'Defiance',
  state: 'Ohio',
  county: 'Defiance County',
  timezone: 'America/New_York',
};

// --- Products ---
export async function getProducts(): Promise<Product[]> {
  if (!supabaseConfigured) {
    return loadJSON<Product[]>(KEYS.products) || DEFAULT_PRODUCTS;
  }
  try {
    const { data, error } = await supabase.from('products').select('*');
    if (error || !data || data.length === 0) {
      const cached = loadJSON<Product[]>(KEYS.products);
      return cached || DEFAULT_PRODUCTS;
    }
    const products = data.map((row) => toCamelCase(row) as unknown as Product);
    saveJSON(KEYS.products, products);
    return products;
  } catch {
    return loadJSON<Product[]>(KEYS.products) || DEFAULT_PRODUCTS;
  }
}

export async function saveProduct(product: Product): Promise<void> {
  const cached = loadJSON<Product[]>(KEYS.products) || [];
  const idx = cached.findIndex((p) => p.id === product.id);
  if (idx >= 0) cached[idx] = product;
  else cached.push(product);
  saveJSON(KEYS.products, cached);
  if (supabaseConfigured) {
    const row = toSnakeCase(product as any);
    supabase.from('products').upsert(row).then(() => {}, () => {});
  }
}

export async function deleteProduct(id: string): Promise<void> {
  const cached = (loadJSON<Product[]>(KEYS.products) || []).filter((p) => p.id !== id);
  saveJSON(KEYS.products, cached);
  if (supabaseConfigured) {
    supabase.from('products').delete().eq('id', id).then(() => {}, () => {});
  }
}

export async function resetProducts(): Promise<void> {
  saveJSON(KEYS.products, DEFAULT_PRODUCTS);
  if (supabaseConfigured) {
    try {
      await supabase.from('products').delete().neq('id', '');
      const rows = DEFAULT_PRODUCTS.map((p) => toSnakeCase(p as any));
      await supabase.from('products').insert(rows);
    } catch {}
  }
}

// --- Containers (localStorage only, no Supabase table) ---
export function getContainers(): ContainerType[] {
  const stored = loadJSON<ContainerType[]>(KEYS.containers);
  if (stored) return stored;
  saveJSON(KEYS.containers, DEFAULT_CONTAINERS);
  return [...DEFAULT_CONTAINERS];
}

export function saveContainer(container: ContainerType): void {
  const containers = getContainers();
  const idx = containers.findIndex((c) => c.id === container.id);
  if (idx >= 0) containers[idx] = container;
  else containers.push(container);
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
export async function getFields(): Promise<Field[]> {
  if (!supabaseConfigured) {
    return loadJSON<Field[]>(KEYS.fields) || [];
  }
  try {
    const { data, error } = await supabase.from('fields').select('*');
    if (error || !data) {
      return loadJSON<Field[]>(KEYS.fields) || [];
    }
    if (data.length > 0) {
      const fields = data.map((row) => toCamelCase(row) as unknown as Field);
      saveJSON(KEYS.fields, fields);
      return fields;
    }
    // Supabase empty — don't overwrite localStorage
    return loadJSON<Field[]>(KEYS.fields) || [];
  } catch {
    return loadJSON<Field[]>(KEYS.fields) || [];
  }
}

export async function saveField(field: Field): Promise<void> {
  // Save to localStorage first (synchronous, always works)
  const cached = loadJSON<Field[]>(KEYS.fields) || [];
  const idx = cached.findIndex((f) => f.id === field.id);
  if (idx >= 0) cached[idx] = field;
  else cached.push(field);
  saveJSON(KEYS.fields, cached);
  // Sync to Supabase in the background (don't block on it)
  if (supabaseConfigured) {
    const row = toSnakeCase(field as any);
    supabase.from('fields').upsert(row).then(() => {}, () => {});
  }
}

export async function deleteField(id: string): Promise<void> {
  const cached = (loadJSON<Field[]>(KEYS.fields) || []).filter((f) => f.id !== id);
  saveJSON(KEYS.fields, cached);
  if (supabaseConfigured) {
    supabase.from('fields').delete().eq('id', id).then(() => {}, () => {});
  }
}

// --- Calculator Defaults ---
export async function getCalculatorDefaults(): Promise<CalculatorDefaults> {
  if (!supabaseConfigured) {
    return loadJSON<CalculatorDefaults>(KEYS.calculatorDefaults) || DEFAULT_CALCULATOR;
  }
  try {
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'calculator_defaults')
      .single();
    if (data?.value) {
      saveJSON(KEYS.calculatorDefaults, data.value);
      return data.value as CalculatorDefaults;
    }
    return loadJSON<CalculatorDefaults>(KEYS.calculatorDefaults) || DEFAULT_CALCULATOR;
  } catch {
    return loadJSON<CalculatorDefaults>(KEYS.calculatorDefaults) || DEFAULT_CALCULATOR;
  }
}

export async function saveCalculatorDefaults(defaults: Partial<CalculatorDefaults>): Promise<void> {
  const current = loadJSON<CalculatorDefaults>(KEYS.calculatorDefaults) || DEFAULT_CALCULATOR;
  const merged = { ...current, ...defaults };
  saveJSON(KEYS.calculatorDefaults, merged);
  if (supabaseConfigured) {
    supabase.from('settings').upsert({ key: 'calculator_defaults', value: merged }).then(() => {}, () => {});
  }
}

// --- Tank Size Presets ---
export async function getTankPresets(): Promise<number[]> {
  if (!supabaseConfigured) {
    return loadJSON<number[]>(KEYS.tankPresets) || DEFAULT_TANK_PRESETS;
  }
  try {
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'tank_presets')
      .single();
    if (data?.value) {
      saveJSON(KEYS.tankPresets, data.value);
      return data.value as number[];
    }
    return loadJSON<number[]>(KEYS.tankPresets) || DEFAULT_TANK_PRESETS;
  } catch {
    return loadJSON<number[]>(KEYS.tankPresets) || DEFAULT_TANK_PRESETS;
  }
}

export async function saveTankPresets(presets: number[]): Promise<void> {
  saveJSON(KEYS.tankPresets, presets);
  if (supabaseConfigured) {
    supabase.from('settings').upsert({ key: 'tank_presets', value: presets }).then(() => {}, () => {});
  }
}

// --- Carrier Rate Presets ---
export async function getCarrierPresets(): Promise<number[]> {
  if (!supabaseConfigured) {
    return loadJSON<number[]>(KEYS.carrierPresets) || DEFAULT_CARRIER_PRESETS;
  }
  try {
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'carrier_presets')
      .single();
    if (data?.value) {
      saveJSON(KEYS.carrierPresets, data.value);
      return data.value as number[];
    }
    return loadJSON<number[]>(KEYS.carrierPresets) || DEFAULT_CARRIER_PRESETS;
  } catch {
    return loadJSON<number[]>(KEYS.carrierPresets) || DEFAULT_CARRIER_PRESETS;
  }
}

export async function saveCarrierPresets(presets: number[]): Promise<void> {
  saveJSON(KEYS.carrierPresets, presets);
  if (supabaseConfigured) {
    supabase.from('settings').upsert({ key: 'carrier_presets', value: presets }).then(() => {}, () => {});
  }
}

// --- Spray Records ---
export async function getRecords(): Promise<SprayRecord[]> {
  if (!supabaseConfigured) {
    return loadJSON<SprayRecord[]>(KEYS.records) || [];
  }
  try {
    const { data, error } = await supabase.from('spray_records').select('*');
    if (error || !data) {
      return loadJSON<SprayRecord[]>(KEYS.records) || [];
    }
    if (data.length > 0) {
      const records = data.map((row) => toCamelCase(row) as unknown as SprayRecord);
      saveJSON(KEYS.records, records);
      return records;
    }
    return loadJSON<SprayRecord[]>(KEYS.records) || [];
  } catch {
    return loadJSON<SprayRecord[]>(KEYS.records) || [];
  }
}

export async function saveRecord(record: SprayRecord): Promise<void> {
  const cached = loadJSON<SprayRecord[]>(KEYS.records) || [];
  const idx = cached.findIndex((r) => r.id === record.id);
  if (idx >= 0) cached[idx] = record;
  else cached.push(record);
  saveJSON(KEYS.records, cached);
  if (supabaseConfigured) {
    const row = toSnakeCase(record as any);
    supabase.from('spray_records').upsert(row).then(() => {}, () => {});
  }
}

export async function deleteRecord(id: string): Promise<void> {
  const cached = (loadJSON<SprayRecord[]>(KEYS.records) || []).filter((r) => r.id !== id);
  saveJSON(KEYS.records, cached);
  if (supabaseConfigured) {
    supabase.from('spray_records').delete().eq('id', id).then(() => {}, () => {});
  }
}

// --- Tender Routes ---
export async function getRoutes(): Promise<TenderRoute[]> {
  if (!supabaseConfigured) {
    return loadJSON<TenderRoute[]>(KEYS.routes) || [];
  }
  try {
    const { data, error } = await supabase.from('tender_routes').select('*');
    if (error || !data) {
      return loadJSON<TenderRoute[]>(KEYS.routes) || [];
    }
    if (data.length > 0) {
      const routes = data.map((row) => toCamelCase(row) as unknown as TenderRoute);
      saveJSON(KEYS.routes, routes);
      return routes;
    }
    return loadJSON<TenderRoute[]>(KEYS.routes) || [];
  } catch {
    return loadJSON<TenderRoute[]>(KEYS.routes) || [];
  }
}

export async function saveRoute(route: TenderRoute): Promise<void> {
  const cached = loadJSON<TenderRoute[]>(KEYS.routes) || [];
  const idx = cached.findIndex((r) => r.id === route.id);
  if (idx >= 0) cached[idx] = route;
  else cached.push(route);
  saveJSON(KEYS.routes, cached);
  if (supabaseConfigured) {
    const row = toSnakeCase(route as any);
    supabase.from('tender_routes').upsert(row).then(() => {}, () => {});
  }
}

export async function deleteRoute(id: string): Promise<void> {
  const cached = (loadJSON<TenderRoute[]>(KEYS.routes) || []).filter((r) => r.id !== id);
  saveJSON(KEYS.routes, cached);
  if (supabaseConfigured) {
    supabase.from('tender_routes').delete().eq('id', id).then(() => {}, () => {});
  }
}

// --- Saved Pins ---
export async function getPins(): Promise<SavedPin[]> {
  if (!supabaseConfigured) {
    return loadJSON<SavedPin[]>(KEYS.pins) || [];
  }
  try {
    const { data, error } = await supabase.from('saved_pins').select('*');
    if (error || !data) {
      return loadJSON<SavedPin[]>(KEYS.pins) || [];
    }
    if (data.length > 0) {
      const pins = data.map((row) => toCamelCase(row) as unknown as SavedPin);
      saveJSON(KEYS.pins, pins);
      return pins;
    }
    return loadJSON<SavedPin[]>(KEYS.pins) || [];
  } catch {
    return loadJSON<SavedPin[]>(KEYS.pins) || [];
  }
}

export async function savePin(pin: SavedPin): Promise<void> {
  const cached = loadJSON<SavedPin[]>(KEYS.pins) || [];
  const idx = cached.findIndex((p) => p.id === pin.id);
  if (idx >= 0) cached[idx] = pin;
  else cached.push(pin);
  saveJSON(KEYS.pins, cached);
  if (supabaseConfigured) {
    const row = toSnakeCase(pin as any);
    supabase.from('saved_pins').upsert(row).then(() => {}, () => {});
  }
}

export async function deletePin(id: string): Promise<void> {
  const cached = (loadJSON<SavedPin[]>(KEYS.pins) || []).filter((p) => p.id !== id);
  saveJSON(KEYS.pins, cached);
  if (supabaseConfigured) {
    supabase.from('saved_pins').delete().eq('id', id).then(() => {}, () => {});
  }
}

export async function replaceAllPins(pins: SavedPin[]): Promise<void> {
  saveJSON(KEYS.pins, pins);
  if (supabaseConfigured) {
    try {
      await supabase.from('saved_pins').delete().neq('id', '');
      if (pins.length > 0) {
        const rows = pins.map((p) => toSnakeCase(p as any));
        await supabase.from('saved_pins').insert(rows);
      }
    } catch {}
  }
}

// --- Farm Location ---
export async function getFarmLocation(): Promise<LocationData> {
  if (!supabaseConfigured) {
    return loadJSON<LocationData>(KEYS.farmLocation) || DEFAULT_FARM_LOCATION;
  }
  try {
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'farm_location')
      .single();
    if (data?.value) {
      saveJSON(KEYS.farmLocation, data.value);
      return data.value as LocationData;
    }
    return loadJSON<LocationData>(KEYS.farmLocation) || DEFAULT_FARM_LOCATION;
  } catch {
    return loadJSON<LocationData>(KEYS.farmLocation) || DEFAULT_FARM_LOCATION;
  }
}

export async function saveFarmLocation(location: LocationData): Promise<void> {
  saveJSON(KEYS.farmLocation, location);
  if (supabaseConfigured) {
    supabase.from('settings').upsert({ key: 'farm_location', value: location }).then(() => {}, () => {});
  }
}

// Synchronous version for code paths that can't await (e.g. WeatherService static methods)
export function getFarmLocationSync(): LocationData {
  return loadJSON<LocationData>(KEYS.farmLocation) || DEFAULT_FARM_LOCATION;
}

// --- One-time localStorage → Supabase migration ---
const MIGRATION_KEY = 'agrispray_supabase_migrated_v2';

export async function migrateLocalStorageToSupabase(): Promise<boolean> {
  if (!supabaseConfigured) return false;
  if (localStorage.getItem(MIGRATION_KEY)) return false;

  let migrated = false;
  let anyError = false;

  // Products
  const products = loadJSON<Product[]>(KEYS.products);
  if (products && products.length > 0) {
    const rows = products.map((p) => toSnakeCase(p as any));
    const { error } = await supabase.from('products').upsert(rows);
    if (error) { console.error('Migration: products failed', error); anyError = true; }
    else migrated = true;
  }

  // Fields
  const fields = loadJSON<Field[]>(KEYS.fields);
  if (fields && fields.length > 0) {
    const rows = fields.map((f) => toSnakeCase(f as any));
    const { error } = await supabase.from('fields').upsert(rows);
    if (error) { console.error('Migration: fields failed', error); anyError = true; }
    else migrated = true;
  }

  // Spray Records
  const records = loadJSON<SprayRecord[]>(KEYS.records);
  if (records && records.length > 0) {
    const rows = records.map((r) => toSnakeCase(r as any));
    const { error } = await supabase.from('spray_records').upsert(rows);
    if (error) { console.error('Migration: spray_records failed', error); anyError = true; }
    else migrated = true;
  }

  // Tender Routes
  const routes = loadJSON<TenderRoute[]>(KEYS.routes);
  if (routes && routes.length > 0) {
    const rows = routes.map((r) => toSnakeCase(r as any));
    const { error } = await supabase.from('tender_routes').upsert(rows);
    if (error) { console.error('Migration: tender_routes failed', error); anyError = true; }
    else migrated = true;
  }

  // Saved Pins
  const pins = loadJSON<SavedPin[]>(KEYS.pins);
  if (pins && pins.length > 0) {
    const rows = pins.map((p) => toSnakeCase(p as any));
    const { error } = await supabase.from('saved_pins').upsert(rows);
    if (error) { console.error('Migration: saved_pins failed', error); anyError = true; }
    else migrated = true;
  }

  // Calculator Defaults
  const calcDefaults = loadJSON<CalculatorDefaults>(KEYS.calculatorDefaults);
  if (calcDefaults) {
    const { error } = await supabase.from('settings').upsert({ key: 'calculator_defaults', value: calcDefaults });
    if (error) { console.error('Migration: calculator_defaults failed', error); anyError = true; }
    else migrated = true;
  }

  // Tank Presets
  const tankPresets = loadJSON<number[]>(KEYS.tankPresets);
  if (tankPresets) {
    const { error } = await supabase.from('settings').upsert({ key: 'tank_presets', value: tankPresets });
    if (error) { console.error('Migration: tank_presets failed', error); anyError = true; }
    else migrated = true;
  }

  // Carrier Presets
  const carrierPresets = loadJSON<number[]>(KEYS.carrierPresets);
  if (carrierPresets) {
    const { error } = await supabase.from('settings').upsert({ key: 'carrier_presets', value: carrierPresets });
    if (error) { console.error('Migration: carrier_presets failed', error); anyError = true; }
    else migrated = true;
  }

  // Farm Location
  const farmLoc = loadJSON<LocationData>(KEYS.farmLocation);
  if (farmLoc) {
    const { error } = await supabase.from('settings').upsert({ key: 'farm_location', value: farmLoc });
    if (error) { console.error('Migration: farm_location failed', error); anyError = true; }
    else migrated = true;
  }

  // Only mark as done if no errors occurred
  if (!anyError) {
    localStorage.setItem(MIGRATION_KEY, new Date().toISOString());
  }

  return migrated;
}
