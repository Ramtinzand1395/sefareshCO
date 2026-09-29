import "server-only";

import { requireAdmin } from "@/src/lib/admin-helpers";
import {
  getAdminDashboardOverviewRecord,
  type UserCountsDTO,
  type CafeCountsDTO,
  type SupplierCountsDTO,
  type RecentUserDTO,
  type RecentCafeDTO,
  type RecentSupplierDTO,
} from "@/src/repositories/admin-dashboard-repository";

// ---------------------------------------------------------------------------
// Dashboard overview DTO – fully serializable, safe for client components
// ---------------------------------------------------------------------------

export type AdminDashboardOverviewDTO = {
  users: UserCountsDTO;
  cafes: CafeCountsDTO;
  suppliers: SupplierCountsDTO;
  latestUsers: RecentUserDTO[];
  latestCafes: RecentCafeDTO[];
  latestSuppliers: RecentSupplierDTO[];
};

/**
 * Fetches the full admin dashboard overview.
 *
 * 1. Enforces admin authorization (database-backed)
 * 2. Fetches counts and recent activity in three parallel aggregate requests
 * 3. Returns a fully serializable DTO with no sensitive data
 */
export async function getAdminDashboardOverview(): Promise<AdminDashboardOverviewDTO> {
  // Authorization – throws redirect if not admin
  await requireAdmin();

  return getAdminDashboardOverviewRecord(5);
}
