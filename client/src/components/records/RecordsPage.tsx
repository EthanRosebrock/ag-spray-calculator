import React, { useState, useEffect, useMemo } from 'react';
import { SprayRecord } from '../../types';
import { getRecords, saveRecord, deleteRecord } from '../../utils/storageService';
import RecordModal from './RecordModal';

const RecordsPage: React.FC = () => {
  const [records, setRecords] = useState<SprayRecord[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  const reload = () => {
    const all = getRecords();
    // Sort newest first
    all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setRecords(all);
  };

  useEffect(() => {
    reload();
  }, []);

  const filtered = useMemo(() => {
    return records.filter((r) => {
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const fieldMatch = r.fieldNames
          ? r.fieldNames.some((n) => n.toLowerCase().includes(term))
          : r.fieldName.toLowerCase().includes(term);
        if (!fieldMatch && !r.operator.toLowerCase().includes(term)) {
          return false;
        }
      }
      if (dateFilter && !r.date.startsWith(dateFilter)) {
        return false;
      }
      return true;
    });
  }, [records, searchTerm, dateFilter]);

  const handleSave = (record: SprayRecord) => {
    saveRecord(record);
    reload();
    setShowModal(false);
  };

  const handleDelete = (id: string) => {
    deleteRecord(id);
    reload();
    setDeleteConfirm(null);
  };

  const exportCSV = () => {
    const headers = ['Date', 'Field', 'Operator', 'Tank Size', 'Carrier Rate', 'Acres', 'Total Volume', 'Products', 'Notes'];
    const rows = records.map((r) => [
      r.date,
      r.fieldName,
      r.operator,
      r.tankSize,
      r.carrierRate,
      r.acres,
      r.totalVolume,
      r.products.map((p) => `${p.productName} ${p.rate} ${p.unit}`).join('; '),
      r.notes || '',
    ]);

    const csv = [headers.join(','), ...rows.map((row) =>
      row.map((cell) => {
        const s = String(cell);
        return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(',')
    )].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `spray-records-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Spray Records</h1>
        <div className="flex gap-2">
          {records.length > 0 && (
            <button onClick={exportCSV} className="btn-secondary text-sm py-2 px-4">
              Export CSV
            </button>
          )}
          <button
            onClick={() => setShowModal(true)}
            className="btn-primary text-sm py-2 px-4"
          >
            + Add Record
          </button>
        </div>
      </div>

      {/* Filters */}
      {records.length > 0 && (
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Search by field or operator..."
            className="input-field flex-1"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <input
            type="month"
            className="input-field w-auto"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          />
          {(searchTerm || dateFilter) && (
            <button
              onClick={() => { setSearchTerm(''); setDateFilter(''); }}
              className="btn-secondary text-sm py-2 px-3"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500">
            {records.length === 0
              ? 'No spray records yet. Save records from the Calculator or add them manually.'
              : 'No records match your search.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((record) => (
            <div key={record.id} className="card">
              <div
                className="flex justify-between items-center cursor-pointer"
                onClick={() => setExpandedId(expandedId === record.id ? null : record.id)}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">{record.fieldName}</span>
                    <span className="text-sm text-gray-500">
                      {new Date(record.date).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    {record.operator && <span>{record.operator} &middot; </span>}
                    {record.products.length} product{record.products.length !== 1 ? 's' : ''} &middot;{' '}
                    {record.totalVolume.toFixed(0)} gal &middot; {record.acres} ac
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {deleteConfirm === record.id ? (
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleDelete(record.id)}
                        className="text-sm text-red-600 font-medium"
                      >
                        Confirm Delete
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="text-sm text-gray-500"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirm(record.id);
                      }}
                      className="text-sm text-red-500 hover:text-red-700"
                    >
                      Delete
                    </button>
                  )}
                  <span className="text-gray-400">
                    {expandedId === record.id ? '\u25B2' : '\u25BC'}
                  </span>
                </div>
              </div>

              {expandedId === record.id && (
                <div className="mt-4 pt-4 border-t border-gray-100 space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500 block">Tank Size</span>
                      <span className="font-medium">{record.tankSize} gal</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Carrier Rate</span>
                      <span className="font-medium">{record.carrierRate} gpa</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Acres</span>
                      <span className="font-medium">{record.acres}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Total Volume</span>
                      <span className="font-medium">{record.totalVolume.toFixed(0)} gal</span>
                    </div>
                  </div>

                  {record.products.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Products</h4>
                      <div className="space-y-1">
                        {record.products.map((p, i) => (
                          <div key={i} className="flex justify-between text-sm bg-gray-50 p-2 rounded">
                            <span>{p.productName}</span>
                            <span className="text-gray-600">
                              {p.rate} {p.unit} &middot; {p.totalAmount.toFixed(2)} total
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {record.weather && (
                    <div className="text-sm bg-blue-50 p-3 rounded">
                      <span className="font-medium">Weather at spray time: </span>
                      {record.weather.temperature}&deg;F, {record.weather.windSpeed} mph{' '}
                      {record.weather.windDirection}, {record.weather.humidity}% RH
                      <span className="text-xs text-gray-500 ml-2">({record.weather.source})</span>
                    </div>
                  )}

                  {record.notes && (
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">Notes: </span>{record.notes}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <RecordModal
          onSave={handleSave}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
};

export default RecordsPage;
