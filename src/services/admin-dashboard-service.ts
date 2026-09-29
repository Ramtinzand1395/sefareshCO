import "server-only";

import { requireAdmin } from "@/src/lib/admin-helpers";
import {
  getUserCounts,
  getCafeCounts,
  getSupplierCounts,
  getLatestUsers,
  getLatestCafes,
  getLatestSuppliers,
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
 * 2. Runs all count + recent-activity queries in parallel
 * 3. Returns a fully serializable DTO with no sensitive data
 */
export async function getAdminDashboardOverview(): Promise<AdminDashboardOverviewDTO> {
  // Authorization – throws redirect if not admin
  await requireAdmin();

  // Run all independent queries in parallel for performance
  const [users, cafes, suppliers, latestUsers, latestCafes, latestSuppliers] =
    await Promise.all([
      getUserCounts(),
      getCafeCounts(),
      getSupplierCounts(),
      getLatestUsers(5),
      getLatestCafes(5),
      getLatestSuppliers(5),
    ]);

  return {
    users,
    cafes,
    suppliers,
    latestUsers,
    latestCafes,
    latestSuppliers,
  };
}
