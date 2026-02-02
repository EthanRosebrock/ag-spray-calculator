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

    const breakdown: ContainerBreakdown = {
      containers: [],
      remainder: { amount: 0, unit: '', displayText: '' },
      totalAmount
    };

    // Only use containers that are explicitly assigned to this product
    let availableContainers: ContainerType[] = [];
    if (preferredContainers?.length) {
      availableContainers = this.containerTypes.filter(
        c => c.productType === productType && c.available && preferredContainers.includes(c.id)
      );
    }

    let remaining = totalAmount;

    if (availableContainers.length > 0) {
      // Sort by size (largest first) for optimal breakdown
      availableContainers.sort((a, b) => b.size - a.size);

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
    }

    // Express any remainder as a measurement (not unassigned containers)
    if (remaining > 0.001) {
      const hasBulk = breakdown.containers.some(c => c.type.size >= 250);
      breakdown.remainder = this.formatRemainder(remaining, productType, hasBulk);
    }

    return breakdown;
  }

  private formatRemainder(amount: number, productType: string, bulk = false): {
    amount: number;
    unit: string;
    displayText: string;
  } {
    if (productType === 'liquid') {
      // Bulk (250 gal+) remainders: tenths of a gallon with oz in parentheses
      if (bulk) {
        const oz = Math.round(amount * 128);
        if (amount >= 0.1) {
          return { amount, unit: 'gal', displayText: `${amount.toFixed(1)} gal (${oz} oz)` };
        }
        return { amount: oz, unit: 'oz', displayText: `${oz} oz` };
      }
      // Standard liquid: whole gal + remaining oz
      const wholeGal = Math.floor(amount);
      const remainingOz = Math.round((amount - wholeGal) * 128);
      if (wholeGal > 0 && remainingOz > 0) {
        return { amount, unit: 'gal', displayText: `${wholeGal} gal ${remainingOz} oz` };
      } else if (wholeGal > 0) {
        return { amount: wholeGal, unit: 'gal', displayText: `${wholeGal} gal` };
      } else {
        const oz = Math.round(amount * 128);
        return { amount: oz, unit: 'oz', displayText: `${oz} oz` };
      }
    } else {
      const wholeLbs = Math.floor(amount);
      const remainingOz = Math.round((amount - wholeLbs) * 16);

      if (wholeLbs > 0 && remainingOz > 0) {
        return { amount, unit: 'lb', displayText: `${wholeLbs} lbs ${remainingOz} oz` };
      } else if (wholeLbs > 0) {
        return { amount: wholeLbs, unit: 'lb', displayText: `${wholeLbs} lbs` };
      } else {
        const oz = Math.round(amount * 16);
        return { amount: oz, unit: 'oz', displayText: `${oz} oz` };
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
  // Bulk liquid containers
  {
    id: 'liquid-30drum',
    name: '30 gal drum',
    size: 30,
    unit: 'gal',
    productType: 'liquid',
    available: true
  },
  {
    id: 'liquid-250tote',
    name: '250 gal tote',
    size: 250,
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
