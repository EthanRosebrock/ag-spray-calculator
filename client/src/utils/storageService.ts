import { Product, Field, CalculatorDefaults } from '../types';
import { ContainerType, DEFAULT_CONTAINERS } from './containerCalculations';

// --- Storage keys ---
const KEYS = {
  products: 'agrispray_products',
  containers: 'agrispray_containers',
  fields: 'agrispray_fields',
  calculatorDefaults: 'agrispray_calculator_defaults',
  // backward-compatible keys
  farmLocation: 'farmLocation',
  fieldLocations: 'fieldLocations',
};

// --- Default products (matches server.js /api/products) ---
export const DEFAULT_PRODUCTS: Product[] = [
  {
    id: 'default-roundup',
    name: 'Roundup PowerMAX',
    type: 'liquid',
    unit: 'oz/acre',
    defaultRate: 32,
    mixingOrder: 2,
    pHSensitive: false,
    isCustom: false,
  },
  {
    id: 'default-atrazine',
    name: 'Atrazine 4L',
    type: 'liquid',
    unit: 'qt/acre',
    defaultRate: 1.5,
    mixingOrder: 3,
    pHSensitive: false,
    isCustom: false,
  },
  {
    id: 'default-ams',
    name: 'AMS',
    type: 'dry',
    unit: 'lbs/acre',
    defaultRate: 17,
    mixingOrder: 1,
    pHSensitive: false,
    isCustom: false,
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
