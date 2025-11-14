'use client';
import React, { useState, useMemo } from 'react';

export default function Page() {
  const items = Array.from({ length: 42 }).map((_, i) => ({
    id: i + 1,
    title: `Item ${i + 1}`,
    description: `This is a short description for Item ${i + 1}.`,
    status: i % 2 === 0 ? 'Pending' : 'Approved',
  }));

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const totalPages = Math.ceil(items.length / pageSize);

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, currentPage, pageSize]);

  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setPageSize(Number(e.target.value));
    setCurrentPage(1);
  };

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
  };

  return (
    <div className="min-h-full flex flex-col px-6 py-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between mb-4 gap-2">
        <h1 className="text-2xl font-semibold text-white">Pending Approval</h1>
        <div className="flex items-center gap-2 text-sm text-neutral-300">
          <span>Show:</span>
          <select
            value={pageSize}
            onChange={handlePageSizeChange}
            className="bg-neutral-800 border border-neutral-700 rounded-md px-2 py-1 text-neutral-200"
          >
            {[5, 8, 10, 15, 20].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          <span>per page</span>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto border border-neutral-800 rounded-lg divide-y divide-neutral-800 bg-neutral-900">
        <div className="grid grid-cols-3 sm:grid-cols-4 p-3 text-neutral-400 text-sm font-semibold bg-neutral-800/60 sticky top-0 z-10">
          <span>ID</span>
          <span className="col-span-2 sm:col-span-2">Title</span>
          <span className="hidden sm:block text-right">Status</span>
        </div>

        {paginatedItems.map((item) => (
          <div
            key={item.id}
            className="grid grid-cols-3 sm:grid-cols-4 items-center p-4 hover:bg-neutral-800/50 transition"
          >
            <span className="text-neutral-400 text-sm">{item.id}</span>
            <div className="col-span-2 sm:col-span-2">
              <div className="text-white font-medium">{item.title}</div>
              <div className="text-sm text-neutral-400">{item.description}</div>
            </div>
            <div className="hidden sm:flex justify-end">
              <span
                className={`px-2 py-1 rounded-md text-xs font-semibold ${
                  item.status === 'Pending'
                    ? 'bg-yellow-500/20 text-yellow-400'
                    : 'bg-green-500/20 text-green-400'
                }`}
              >
                {item.status}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div className="flex justify-between items-center mt-4 text-sm text-neutral-300">
        <div>
          Page <span className="font-semibold">{currentPage}</span> of{' '}
          <span className="font-semibold">{totalPages}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1}
            className={`px-3 py-1.5 rounded-md border border-neutral-700 ${
              currentPage === 1
                ? 'text-neutral-500 cursor-not-allowed'
                : 'hover:bg-neutral-700'
            }`}
          >
            Prev
          </button>

          {Array.from({ length: totalPages })
            .slice(0, 5)
            .map((_, i) => {
              const page = i + 1;
              return (
                <button
                  key={page}
                  onClick={() => goToPage(page)}
                  className={`px-3 py-1.5 rounded-md border border-neutral-700 ${
                    page === currentPage
                      ? 'bg-blue-600 text-white'
                      : 'hover:bg-neutral-700'
                  }`}
                >
                  {page}
                </button>
              );
            })}

          <button
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage === totalPages}
            className={`px-3 py-1.5 rounded-md border border-neutral-700 ${
              currentPage === totalPages
                ? 'text-neutral-500 cursor-not-allowed'
                : 'hover:bg-neutral-700'
            }`}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
