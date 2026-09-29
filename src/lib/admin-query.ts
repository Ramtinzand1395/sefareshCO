export const ADMIN_MAX_PAGE_SIZE = 50;

export function normalizeAdminPagination(page: number, pageSize: number) {
  const normalizedPage = Math.max(1, Math.trunc(page) || 1);
  const normalizedPageSize = Math.min(
    Math.max(1, Math.trunc(pageSize) || 1),
    ADMIN_MAX_PAGE_SIZE,
  );

  return {
    page: normalizedPage,
    pageSize: normalizedPageSize,
    skip: (normalizedPage - 1) * normalizedPageSize,
  };
}

export function escapeAdminSearch(value: string) {
  return value.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function createPaginationMeta(
  page: number,
  pageSize: number,
  total: number,
) {
  const normalized = normalizeAdminPagination(page, pageSize);
  const totalPages = Math.max(1, Math.ceil(total / normalized.pageSize));

  return {
    page: normalized.page,
    pageSize: normalized.pageSize,
    total,
    totalPages,
    hasNextPage: normalized.page < totalPages,
    hasPreviousPage: normalized.page > 1,
  };
}

export type AdminPaginationMeta = ReturnType<typeof createPaginationMeta>;
