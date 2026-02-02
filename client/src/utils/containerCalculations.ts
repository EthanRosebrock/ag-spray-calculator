export interface ContainerType {
  id: string;
  name: string;
  size: number;
  unit: string;
  productType: 'liquid' | 'dry' | 'granular';
  available: boolean;
}

export interface ContainerBreakdown {
  containers: Array<{
    type: ContainerType;
    quantity: number;
    totalAmount: number;
  }>;
  remainder: {
    amount: number;
    unit: string;
    displayText: string;
  };
  totalAmount: number;
}

export class ContainerCalculator {
  private containerTypes: ContainerType[];

  constructor(containerTypes: ContainerType[]) {
    this.containerTypes = containerTypes;
  }

  calculateOptimalBreakdown(
    totalAmount: number,
    productType: 'liquid' | 'dry' | 'granular',
    preferredContainers?: string[]
  ): ContainerBreakdown {

    // Filter available containers for this product type
    let availableContainers = this.containerTypes.filter(
      c => c.productType === productType && c.available
    );

    // If preferred containers specified, prioritize them
    if (preferredContainers?.length) {
      const preferred = availableContainers.filter(c =>
        preferredContainers.includes(c.id)
      );
      const others = availableContainers.filter(c =>
        !preferredContainers.includes(c.id)
      );
      availableContainers = [...preferred, ...others];
    }

    // Sort by size (largest first) for optimal breakdown
    availableContainers.sort((a, b) => b.size - a.size);

    const breakdown: ContainerBreakdown = {
      containers: [],
      remainder: { amount: 0, unit: '', displayText: '' },
      totalAmount
    };

    let remaining = totalAmount;

    // Calculate containers needed
    for (const container of availableContainers) {
      if (remaining <= 0) break;

      const quantity = Math.floor(remaining / container.size);
      if (quantity > 0) {
        breakdown.containers.push({
          type: container,
          quantity,
          totalAmount: quantity * container.size
        });
        remaining -= quantity * container.size;
      }
    }

    // Handle remainder with smart unit conversion
    if (remaining > 0) {
      breakdown.remainder = this.formatRemainder(remaining, productType);
    }

    return breakdown;
  }

  private formatRemainder(amount: number, productType: string): {
    amount: number;
    unit: string;
    displayText: string;
  } {
    if (productType === 'liquid') {
      if (amount >= 1) {
        return {
          amount,
          unit: 'gal',
          displayText: `${amount.toFixed(1)} gal`
        };
      } else if (amount >= 0.25) {
        const quarts = amount * 4;
        return {
          amount: quarts,
          unit: 'qt',
          displayText: `${quarts.toFixed(1)} qt`
        };
      } else {
        const ounces = amount * 128;
        return {
          amount: ounces,
          unit: 'oz',
          displayText: `${Math.ceil(ounces)} oz`
        };
      }
    } else {
      // Dry products
      if (amount >= 1) {
        return {
          amount,
          unit: 'lb',
          displayText: `${amount.toFixed(1)} lbs`
        };
      } else {
        const ounces = amount * 16;
        return {
          amount: ounces,
          unit: 'oz',
          displayText: `${Math.ceil(ounces)} oz`
        };
      }
    }
  }

  formatContainerBreakdown(breakdown: ContainerBreakdown): string {
    const parts: string[] = [];

    breakdown.containers.forEach(container => {
      parts.push(`${container.quantity}x ${container.type.name}`);
    });

    if (breakdown.remainder.amount > 0) {
      parts.push(`+ ${breakdown.remainder.displayText}`);
    }

    return parts.join(' ') || 'No containers needed';
  }
}

// Default container configurations
export const DEFAULT_CONTAINERS: ContainerType[] = [
  // Liquid containers
  {
    id: 'liquid-2.5gal',
    name: '2.5 gal jug',
    size: 2.5,
    unit: 'gal',
    productType: 'liquid',
    available: true
  },
  {
    id: 'liquid-1gal',
    name: '1 gal jug',
    size: 1,
    unit: 'gal',
    productType: 'liquid',
    available: true
  },
  {
    id: 'liquid-1qt',
    name: '1 qt bottle',
    size: 0.25,
    unit: 'gal',
    productType: 'liquid',
    available: true
  },
  // Dry containers
  {
    id: 'dry-50lb',
    name: '50 lb bag',
    size: 50,
    unit: 'lb',
    productType: 'dry',
    available: true
  },
  {
    id: 'dry-25lb',
    name: '25 lb bag',
    size: 25,
    unit: 'lb',
    productType: 'dry',
    available: true
  },
  {
    id: 'dry-10lb',
    name: '10 lb bag',
    size: 10,
    unit: 'lb',
    productType: 'dry',
    available: true
  }
];
