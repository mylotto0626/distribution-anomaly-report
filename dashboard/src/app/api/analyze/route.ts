import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { detectAnomalies, type SalesRow } from "@/lib/anomaly";

export async function POST() {
  const { data: products, error: pErr } = await supabase
    .from("products")
    .select("product_id, product_name, category, unit_price");

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

  const { data: sales, error: sErr } = await supabase
    .from("daily_sales")
    .select("date, product_id, sales_qty, stock_qty")
    .order("date");

  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });

  if (!sales || sales.length === 0) {
    return NextResponse.json({ error: "판매 데이터가 없습니다." }, { status: 400 });
  }

  const productMap = new Map((products ?? []).map((p) => [p.product_id, p]));

  const rows: SalesRow[] = sales.map((s) => {
    const p = productMap.get(s.product_id);
    return {
      date: s.date,
      product_id: s.product_id,
      product_name: p?.product_name ?? s.product_id,
      category: p?.category ?? "",
      sales_qty: s.sales_qty,
      stock_qty: s.stock_qty,
      unit_price: p?.unit_price ?? 0,
    };
  });

  const anomalies = detectAnomalies(rows);

  if (anomalies.length === 0) {
    return NextResponse.json({ count: 0, anomalies: [] });
  }

  const { error: iErr } = await supabase.from("anomaly_results").insert(
    anomalies.map((a) => ({
      date: a.date,
      product_id: a.product_id,
      product_name: a.product_name,
      category: a.category,
      anomaly_type: a.anomaly_type,
      anomaly_label: a.anomaly_label,
      value: a.value,
      z_score: a.z_score,
      days_of_stock: a.days_of_stock,
      avg_daily_sales: a.avg_daily_sales,
      estimated_lost_sales: a.estimated_lost_sales,
      detail: a.detail,
    }))
  );

  if (iErr) return NextResponse.json({ error: iErr.message }, { status: 500 });

  return NextResponse.json({ count: anomalies.length, anomalies });
}
