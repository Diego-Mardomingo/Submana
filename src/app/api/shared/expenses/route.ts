import { NextRequest } from "next/server";
import { saveSharedExpense } from "@/lib/shared/saveExpense";

/** Create a shared expense (split inputs in, shares recomputed server-side). */
export async function POST(request: NextRequest) {
  return saveSharedExpense(request, null);
}
