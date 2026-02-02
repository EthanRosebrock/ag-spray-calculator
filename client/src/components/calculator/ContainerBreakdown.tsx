import React, { useState, useMemo } from 'react';
import { TankMixProduct } from '../../types';
import {
  ContainerCalculator,
  ContainerBreakdown as ContainerBreakdownType,
  ContainerType,
} from '../../utils/containerCalculations';
import {
  getContainers,
  saveContainer,
  deleteContainer,
  toggleContainerAvailability,
  resetContainers,
} from '../../utils/storageService';
import { getBaseDisplayUnit, getContainerCategory } from '../../utils/unitConstants';
import ContainerModal from '../settings/ContainerModal';

interface ContainerBreakdownProps {
  selectedProducts: TankMixProduct[];
}

interface ProductBreakdown {
  item: TankMixProduct;
  breakdown: ContainerBreakdownType;
  breakdownText: string;
}

const ContainerBreakdownSection: React.FC<ContainerBreakdownProps> = ({ selectedProducts }) => {
  const [open, setOpen] = useState(false);
  const [containers, setContainers] = useState(() => getContainers());
  const [showContainerModal, setShowContainerModal] = useState(false);
  const [editingContainer, setEditingContainer] = useState<ContainerType | null>(null);
  const [showManage, setShowManage] = useState(false);

  const reloadContainers = () => setContainers(getContainers());

  const calculator = useMemo(() => new ContainerCalculator(containers), [containers]);

  const productBreakdowns: ProductBreakdown[] = useMemo(() => {
    return selectedProducts.map((item) => {
      // For bulk products, resolve the container category from the measurement unit
      const containerType = item.product.type === 'bulk'
        ? getContainerCategory(item.product.measurementUnit)
        : item.product.type;
      const breakdown = calculator.calculateOptimalBreakdown(
        item.totalAmount,
        containerType,
        item.product.preferredContainers
      );
      const breakdownText = calculator.formatContainerBreakdown(breakdown);
      return { item, breakdown, breakdownText };
    });
  }, [selectedProducts, calculator]);

  if (selectedProducts.length === 0) return null;

  return (
    <div className="card">
      <button
        onClick={() => setOpen(!open)}
        className="flex justify-between items-center w-full text-left"
      >
        <h2 className="text-lg font-semibold">Container Breakdown</h2>
        <span className="text-gray-400">{open ? '\u25B2' : '\u25BC'}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          {productBreakdowns.map((pb) => (
            <div
              key={pb.item.product.id}
              className="border border-gray-200 rounded-lg p-4"
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold">{pb.item.product.name}</h3>
                <span className="text-sm text-gray-500">
                  {pb.item.rate} {pb.item.product.unit}
                </span>
              </div>
              <div className="text-sm text-ag-green-700 font-medium mb-1">
                {pb.breakdownText}
              </div>
              <div className="text-xs text-gray-500">
                Total: {pb.item.totalAmount.toFixed(2)}{' '}
                {getBaseDisplayUnit(pb.item.product.measurementUnit)}
              </div>
            </div>
          ))}

          {/* Manage containers sub-section */}
          <div className="border-t border-gray-200 pt-4">
            <button
              onClick={() => setShowManage(!showManage)}
              className="text-sm text-gray-500 hover:text-gray-700 font-medium"
            >
              {showManage ? 'Hide' : 'Manage'} Containers
            </button>

            {showManage && (
              <div className="mt-3 space-y-3">
                <div className="flex gap-2 mb-3">
                  <button
                    onClick={() => {
                      setEditingContainer(null);
                      setShowContainerModal(true);
                    }}
                    className="text-sm text-ag-green-600 hover:text-ag-green-700 font-medium"
                  >
                    + Add Container
                  </button>
                  <button
                    onClick={() => {
                      resetContainers();
                      reloadContainers();
                    }}
                    className="text-sm text-gray-500 hover:text-gray-700 font-medium"
                  >
                    Reset to Defaults
                  </button>
                </div>

                {containers.map((c) => (
                  <div
                    key={c.id}
                    className="flex justify-between items-center border border-gray-200 rounded p-3"
                  >
                    <div>
                      <span className="font-medium text-sm">{c.name}</span>
                      <span className="text-xs text-gray-500 ml-2">
                        {c.size} {c.unit} &middot; {c.productType}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          toggleContainerAvailability(c.id);
                          reloadContainers();
                        }}
                        className={`text-xs px-2 py-1 rounded ${
                          c.available
                            ? 'bg-ag-green-50 text-ag-green-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {c.available ? 'Available' : 'Disabled'}
                      </button>
                      <button
                        onClick={() => {
                          setEditingContainer(c);
                          setShowContainerModal(true);
                        }}
                        className="text-xs text-blue-600 hover:text-blue-800"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          deleteContainer(c.id);
                          reloadContainers();
                        }}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showContainerModal && (
        <ContainerModal
          container={editingContainer}
          onSave={(c) => {
            saveContainer(c);
            reloadContainers();
            setShowContainerModal(false);
            setEditingContainer(null);
          }}
          onClose={() => {
            setShowContainerModal(false);
            setEditingContainer(null);
          }}
        />
      )}
    </div>
  );
};

export default ContainerBreakdownSection;
