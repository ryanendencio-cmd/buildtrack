export default function Pagination({ page, pageSize, total, pageCount, setPage, setPageSize }) {
    if (total <= 10) return null;

    const start = (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, total);

    return (
        <nav className="flex flex-wrap items-center justify-between gap-2 px-2 py-2 text-[11px] text-gray-500" aria-label="Pagination">
            <span aria-live="polite">Showing {start}–{end} of {total}</span>
            <div className="flex items-center gap-1.5">
                <label className="flex items-center gap-1">
                    Rows
                    <select
                        aria-label="Rows per page"
                        value={pageSize}
                        onChange={(event) => setPageSize(event.target.value)}
                        className="rounded border border-gray-200 bg-white px-1.5 py-1 text-[11px] font-semibold text-gray-700"
                    >
                        {[10, 25, 50].map((size) => <option key={size} value={size}>{size}</option>)}
                    </select>
                </label>
                <button
                    type="button"
                    aria-label="Previous page"
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                    className="rounded border border-gray-200 px-2 py-1 font-bold text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                    Previous
                </button>
                <span aria-current="page" className="min-w-[48px] text-center font-bold text-gray-700">{page} / {pageCount}</span>
                <button
                    type="button"
                    aria-label="Next page"
                    disabled={page >= pageCount}
                    onClick={() => setPage(page + 1)}
                    className="rounded border border-gray-200 px-2 py-1 font-bold text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                    Next
                </button>
            </div>
        </nav>
    );
}
