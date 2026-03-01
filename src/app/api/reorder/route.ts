import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type ReorderableTable = "accounts" | "budgets";

interface ReorderItem {
  id: string;
  display_order: number;
}

interface ReorderRequest {
  table: ReorderableTable;
  items: ReorderItem[];
}

const ALLOWED_TABLES: ReorderableTable[] = ["accounts", "budgets"];

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: ReorderRequest = await request.json();
    const { table, items } = body;

    if (!table || !ALLOWED_TABLES.includes(table)) {
      return NextResponse.json(
        { error: "Invalid table. Must be 'accounts' or 'budgets'" },
        { status: 400 }
      );
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Items array is required and must not be empty" },
        { status: 400 }
      );
    }

    const updates = items.map((item) =>
      supabase
        .from(table)
        .update({ display_order: item.display_order })
        .eq("id", item.id)
        .eq("user_id", user.id)
    );

    const results = await Promise.all(updates);
    
    const errors = results.filter((r) => r.error);
    if (errors.length > 0) {
      console.error("Reorder errors:", errors.map((e) => e.error));
      return NextResponse.json(
        { error: "Error updating order for some items" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Reorder error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
