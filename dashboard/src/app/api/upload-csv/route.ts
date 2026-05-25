import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

function parseCSV(text: string): Array<Record<string, string>> {
  const lines = text
    .trim()
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const vals = line.split(",").map((v) => v.trim());
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? ""]));
  });
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });

  const text = await file.text();
  const rows = parseCSV(text);

  if (rows.length === 0) {
    return NextResponse.json({ error: "유효한 데이터가 없습니다." }, { status: 400 });
  }

  const records = rows
    .filter((r) => r.date && r.product_id)
    .map((r) => ({
      date: r.date,
      product_id: r.product_id,
      sales_qty: parseInt(r.sales_qty, 10) || 0,
      stock_qty: parseInt(r.stock_qty, 10) || 0,
    }));

  const { error } = await supabase
    .from("daily_sales")
    .upsert(records, { onConflict: "date,product_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ inserted: records.length });
}
