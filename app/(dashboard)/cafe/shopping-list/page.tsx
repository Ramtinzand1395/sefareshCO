import type { Metadata } from "next";

import { ShoppingListWorkspace } from "@/app/(dashboard)/cafe/shopping-list/_components/shopping-list-workspace";
import {
  canCreatePurchaseRequest,
  canManageShoppingList,
} from "@/src/domain/cafe-access";
import { getBuyerCatalog } from "@/src/services/cafe-catalog-service";
import {
  getActiveShoppingList,
  requireCafeMemberAccess,
} from "@/src/services/shopping-list-service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "لیست خرید | پنل کافه",
};

export default async function ShoppingListPage() {
  const identity = await requireCafeMemberAccess();
  const canManage = canManageShoppingList(identity);
  const canCreateRfq = canCreatePurchaseRequest(identity);

  const [list, catalog] = await Promise.all([
    getActiveShoppingList(),
    canManage
      ? getBuyerCatalog({ page: 1, pageSize: 48, sort: "newest" })
      : Promise.resolve(null),
  ]);

  return (
    <ShoppingListWorkspace
      list={list}
      canManage={canManage}
      canCreateRfq={canCreateRfq}
      products={(catalog?.items ?? []).map((product) => ({
        id: product.id,
        name: product.name,
        brand: product.brand,
        unit: product.unit,
      }))}
    />
  );
}
