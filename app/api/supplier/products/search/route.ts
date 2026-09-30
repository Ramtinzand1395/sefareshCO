import { type NextRequest, NextResponse } from "next/server";

import { getActiveProductsForOfferSearch } from "@/src/services/supplier-offer-service";
import { SupplierAuthError, OfferPermissionError } from "@/src/services/supplier-offer-service";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim().slice(0, 100);

  try {
    const results = await getActiveProductsForOfferSearch(q);
    return NextResponse.json(results);
  } catch (error) {
    if (error instanceof SupplierAuthError) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    if (error instanceof OfferPermissionError) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
