import React, { useState } from 'react';
import { Product, TankMixProduct } from '../../types';
import { getProducts } from '../../utils/storageService';
import ProductModal from '../settings/ProductModal';

interface ProductSelectorProps {
  acres: number;
  selectedProducts: TankMixProduct[];
  onAddProduct: (product: Product) => void;
  onUpdateRate: (index: number, newRate: number) => void;
  onRemoveProduct: (index: number) => void;
}

const ProductSelector: React.FC<ProductSelectorProps> = ({
  acres,
  selectedProducts,
  onAddProduct,
  onUpdateRate,
  onRemoveProduct,
}) => {
  const [productLibrary] = useState<Product[]>(() => getProducts());
  const [showAddProduct, setShowAddProduct] = useState(false);

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
              <button
                key={product.id}
                onClick={() => onAddProduct(product)}
                disabled={isSelected}
                className={`w-full text-left p-3 border rounded-lg transition-colors ${
                  isSelected
                    ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                    : 'bg-white hover:bg-ag-green-50 border-gray-200 hover:border-ag-green-300'
                }`}
              >
                <div className="font-medium text-sm">{product.name}</div>
                <div className="text-xs text-gray-500">
                  {product.defaultRate} {product.unit} &middot; {product.type}
                  {product.isCustom && (
                    <span className="ml-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                      custom
                    </span>
                  )}
                </div>
              </button>
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
            {selectedProducts.map((item, index) => (
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
                  Total: {item.totalAmount.toFixed(2)}{' '}
                  {item.product.type === 'liquid' ? 'gal' : 'lbs'}
                  {acres > 0 && (
                    <span className="text-gray-400 ml-1">
                      ({acres} ac)
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAddProduct && (
        <ProductModal
          onSave={(product) => {
            setShowAddProduct(false);
            onAddProduct(product);
          }}
          onClose={() => setShowAddProduct(false)}
        />
      )}
    </div>
  );
};

export default ProductSelector;
