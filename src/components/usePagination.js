import { useMemo, useState } from 'react';

export function usePagination(items, resetKey = '', initialPageSize = 10) {
    const [pagination, setPagination] = useState({
        page: 1,
        pageSize: initialPageSize,
        resetKey
    });
    const pageSize = pagination.pageSize;
    const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
    const page = pagination.resetKey === resetKey ? Math.min(pagination.page, pageCount) : 1;
    const pageItems = useMemo(
        () => items.slice((page - 1) * pageSize, page * pageSize),
        [items, page, pageSize]
    );

    return {
        pageItems,
        page,
        pageSize,
        total: items.length,
        pageCount,
        setPage: (nextPage) => setPagination(previous => ({
            ...previous,
            page: nextPage,
            resetKey
        })),
        setPageSize: (size) => setPagination(previous => ({
            ...previous,
            page: 1,
            pageSize: Number(size),
            resetKey
        }))
    };
}
