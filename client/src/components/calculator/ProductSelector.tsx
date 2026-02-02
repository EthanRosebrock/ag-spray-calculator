import React, { useState, useMemo, useCallback } from 'react';
import { Product, TankMixProduct } from '../../types';
import { getProducts, deleteProduct } from '../../utils/storageService';
import { getBaseDisplayUnit } from '../../utils/unitConstants';
import { calculatePackages } from '../../utils/loadCalculations';
import ProductModal from '../settings/ProductModal';

interface ProductSelectorProps {
  acres: number;
  totalVolume: number;
  selectedProducts: TankMixProduct[];
  onAddProduct: (product: Product) => void;
  onUpdateRate: (index: number, newRate: number) => void;
  onRemoveProduct: (index: number) => void;
}

const ProductSelector: React.FC<ProductSelectorProps> = ({
  acres,
  totalVolume,
  selectedProducts,
  onAddProduct,
  onUpdateRate,
  onRemoveProduct,
}) => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const productLibrary = useMemo(() => getProducts(), [refreshKey]);

  const handleProductSaved = useCallback(
    (product: Product) => {
      setShowAddProduct(false);
      setRefreshKey((k) => k + 1);
      onAddProduct(product);
    },
    [onAddProduct]
  );

  const handleEditSaved = useCallback(
    (_product: Product) => {
      setEditingProduct(null);
      setRefreshKey((k) => k + 1);
    },
    []
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent, product: Product) => {
      e.stopPropagation();
      deleteProduct(product.id);
      // Remove from tank mix if selected
      const selectedIdx = selectedProducts.findIndex((p) => p.product.id === product.id);
      if (selectedIdx >= 0) {
        onRemoveProduct(selectedIdx);
      }
      setRefreshKey((k) => k + 1);
    },
    [selectedProducts, onRemoveProduct]
  );

  const handleEdit = useCallback(
    (e: React.MouseEvent, product: Product) => {
      e.stopPropagation();
      setEditingProduct(product);
    },
    []
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Left: product library */}
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Product Library</h2>
          <button
            onClick={() => setShowAddProduct(true)}
            className="text-sm text-ag-green-600 hover:text-ag-green-700 font-medium"
          >
            + Add Product
          </button>
        </div>

        <div className="space-y-2 max-h-96 overflow-y-auto">
          {productLibrary.map((product) => {
            const isSelected = selectedProducts.some((p) => p.product.id === product.id);
            return (
              <div
                key={product.id}
                className={`flex items-center gap-2 p-3 border rounded-lg transition-colors ${
                  isSelected
                    ? 'bg-gray-100 text-gray-400 border-gray-200'
                    : 'bg-white hover:bg-ag-green-50 border-gray-200 hover:border-ag-green-300'
                }`}
              >
                <button
                  onClick={() => onAddProduct(product)}
                  disabled={isSelected}
                  className={`flex-1 text-left ${isSelected ? 'cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{product.name}</span>
                    {product.rateBasis === 'per_100_gal' && (
                      <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-medium">
                        by water vol
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    {product.defaultRate} {product.unit} &middot; {product.type}
                    {product.isCustom && (
                      <span className="ml-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                        custom
                      </span>
                    )}
                  </div>
                </button>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={(e) => handleEdit(e, product)}
                    className="px-2 py-1 text-xs text-gray-500 hover:text-ag-green-700 hover:bg-ag-green-50 rounded transition-colors"
                    title="Edit product"
                  >
                    Edit
                  </button>
                  <button
                    onClick={(e) => handleDelete(e, product)}
                    className="px-2 py-1 text-xs text-gray-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                    title="Delete product"
                  >
                    Del
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right: selected products */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">
          Tank Mix ({selectedProducts.length} product{selectedProducts.length !== 1 ? 's' : ''})
        </h2>

        {selectedProducts.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p className="mb-1">No products selected</p>
            <p className="text-xs">Click products on the left to add them</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {selectedProducts.map((item, index) => {
              const baseUnit = getBaseDisplayUnit(item.product.measurementUnit);
              const isPerWater = item.product.rateBasis === 'per_100_gal';
              return (
                <div key={item.product.id} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-medium text-sm">{item.product.name}</h3>
                    <button
                      onClick={() => onRemoveProduct(index)}
                      className="text-red-500 hover:text-red-700 text-xs font-medium"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="number"
                      value={item.rate}
                      onChange={(e) => onUpdateRate(index, parseFloat(e.target.value) || 0)}
                      className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                      step="0.1"
                      min="0"
                    />
                    <span className="text-xs text-gray-600">{item.product.unit}</span>
                  </div>

                  <div className="text-xs text-gray-600">
                    Total: {item.totalAmount.toFixed(2)} {baseUnit}
                    {isPerWater ? (
                      <span className="text-gray-400 ml-1">
                        ({Math.round(totalVolume)} gal water)
                      </span>
                    ) : (
                      acres > 0 && (
                        <span className="text-gray-400 ml-1">
                          ({acres} ac)
                        </span>
                      )
                    )}
                  </div>
                  {item.product.packageSize != null && item.product.packageSize > 0 && (() => {
                    const pkg = calculatePackages(item.totalAmount, item.product.packageSize!);
                    return (
                      <div className="text-xs text-blue-700 mt-1">
                        {pkg.packages} package{pkg.packages !== 1 ? 's' : ''} ({item.product.packageSize} {baseUnit} each)
                        {pkg.excess > 0 && (
                          <span className="text-gray-500"> — {pkg.excess.toFixed(2)} {baseUnit} excess</span>
                        )}
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showAddProduct && (
        <ProductModal
          onSave={handleProductSaved}
          onClose={() => setShowAddProduct(false)}
        />
      )}

      {editingProduct && (
        <ProductModal
          product={editingProduct}
          onSave={handleEditSaved}
          onClose={() => setEditingProduct(null)}
        />
      )}
    </div>
  );
};

export default ProductSelector;
