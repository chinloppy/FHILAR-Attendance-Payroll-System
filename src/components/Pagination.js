
import React, { useState } from "react";

export const PAGE_SIZE = 6;

/**
 * Independent pagination for one table.
 * Pass the FULL filtered array (not the original unfiltered array).
 * Totals and CSV exports should continue using the full array.
 */
export function usePagination(items = [], pageSize = PAGE_SIZE) {
  const [requestedPage, setRequestedPage] = useState(1);
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  // Clamp immediately when items are deleted or filtered.
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  const pageItems = items.slice((page - 1) * pageSize, page * pageSize);

  const changePage = number => {
    setRequestedPage(Math.min(totalPages, Math.max(1, number)));
  };

  return {
    page,
    pageItems,
    totalItems,
    totalPages,
    pageSize,
    changePage,
    resetPage: () => setRequestedPage(1)
  };
}

export default function Pagination({
  page,
  totalItems,
  pageSize = PAGE_SIZE,
  totalPages = Math.max(1, Math.ceil(totalItems / pageSize)),
  changePage
}) {
  if (totalItems <= pageSize) return null;

  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, totalItems);
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    n => n === 1 || n === totalPages || Math.abs(n - page) <= 1
  );

  return (
    <nav className="fhilar-pagination print-hide" aria-label="Table pagination">
      <span className="fhilar-pagination-info">
        Showing {first}–{last} of {totalItems} records
      </span>
      <div className="fhilar-pagination-controls">
        <button type="button" className="fhilar-page-btn"
          aria-label="Previous page" disabled={page <= 1}
          onClick={() => changePage(page - 1)}>‹</button>
        {pages.map((n, index) => (
          <React.Fragment key={n}>
            {index > 0 && n - pages[index - 1] > 1 &&
              <span className="fhilar-page-dots" aria-hidden="true">…</span>}
            <button type="button"
              className={`fhilar-page-btn ${page === n ? "active" : ""}`}
              aria-label={`Page ${n}`}
              aria-current={page === n ? "page" : undefined}
              onClick={() => changePage(n)}>{n}</button>
          </React.Fragment>
        ))}
        <button type="button" className="fhilar-page-btn"
          aria-label="Next page" disabled={page >= totalPages}
          onClick={() => changePage(page + 1)}>›</button>
      </div>
    </nav>
  );
}

/**
 * Uses six visible rows while keeping the entire filtered table available
 * in browser Print / Print to PDF. Never changes the source data array.
 */
export function PaginatedRows({ items, pageItems, renderRow }) {
  const hasExtraPages = items.length > pageItems.length;
  return (
    <>
      {pageItems.map((item, index) =>
        React.cloneElement(renderRow(item, index), {
          className: hasExtraPages ? "fhilar-screen-row" : undefined
        })
      )}
      {hasExtraPages && items.map((item, index) =>
        React.cloneElement(renderRow(item, index), {
          key: `fhilar-print-${index}`,
          className: "fhilar-print-row"
        })
      )}
    </>
  );
}
