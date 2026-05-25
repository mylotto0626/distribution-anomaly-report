"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase, isConfigured } from "@/lib/supabase";
import { detectAnomalies, TYPE_LABELS, type SalesRow } from "@/lib/anomaly";
import SummaryCards from "./components/SummaryCards";
import DailySalesChart from "./components/DailySalesChart";
import CategoryChart from "./components/CategoryChart";
import AnomalyTypeChart from "./components/AnomalyTypeChart";
import AnomalyTable from "./components/AnomalyTable";
import type { Summary, DailySale, CategorySale, AnomalyTypeCount, StockItem, Anomaly } from "./types";

interface RawSaleRow {
  date: string;
  product_id: string;
  sales_qty: number;
  stock_qty: number;
  products: {
    product_name: string;
    category: string;
    region: string;
    unit_price: number;
  } | null;
}

interface DashboardState {
  summary: Summary;
  dailySales: DailySale[];
  categorySales: CategorySale[];
  stockItems: StockItem[];
  anomalies: Anomaly[];
  anomalyTypeCounts: AnomalyTypeCount[];
  latestDate: string;
}

function buildDashboard(rows: RawSaleRow[]): DashboardState {
  const salesRows: SalesRow[] = rows.map((r) => ({
    date: r.date,
    product_id: r.product_id,
    product_name: r.products?.product_name ?? r.product_id,
    category: r.products?.category ?? "",
    sales_qty: r.sales_qty,
    stock_qty: r.stock_qty,
    unit_price: r.products?.unit_price ?? 0,
  }));

  // Daily aggregation
  const dailyMap = new Map<string, { qty: number; revenue: number }>();
  for (const r of rows) {
    const price = r.products?.unit_price ?? 0;
    const prev = dailyMap.get(r.date) ?? { qty: 0, revenue: 0 };
    dailyMap.set(r.date, {
      qty: prev.qty + r.sales_qty,
      revenue: prev.revenue + r.sales_qty * price,
    });
  }
  const dailySales: DailySale[] = [...dailyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }));

  // Category aggregation
  const catMap = new Map<string, { qty: number; revenue: number }>();
  for (const r of rows) {
    const cat = r.products?.category ?? "기타";
    const price = r.products?.unit_price ?? 0;
    const prev = catMap.get(cat) ?? { qty: 0, revenue: 0 };
    catMap.set(cat, {
      qty: prev.qty + r.sales_qty,
      revenue: prev.revenue + r.sales_qty * price,
    });
  }
  const categorySales: CategorySale[] = [...catMap.entries()]
    .map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => b.revenue - a.revenue);

  // Anomaly detection
  const anomalyRows = detectAnomalies(salesRows);
  const anomalies: Anomaly[] = anomalyRows.map((a) => ({
    date: a.date,
    product_id: a.product_id,
    product_name: a.product_name,
    category: a.category,
    anomaly_type: a.anomaly_type,
    anomaly_label: a.anomaly_label,
    value: a.value,
    detail: a.detail,
    estimated_lost_sales: a.estimated_lost_sales,
  }));

  // Anomaly type counts
  const typeCountMap = new Map<string, number>();
  for (const a of anomalies) {
    typeCountMap.set(a.anomaly_type, (typeCountMap.get(a.anomaly_type) ?? 0) + 1);
  }
  const anomalyTypeCounts: AnomalyTypeCount[] = [...typeCountMap.entries()].map(
    ([type, count]) => ({ type, label: TYPE_LABELS[type] ?? type, count })
  );

  // Stock status from latest date
  const latestDate = rows.reduce((m, r) => (r.date > m ? r.date : m), "");
  const latestAnomalyTypes = new Map<string, string>();
  for (const a of anomalyRows) {
    if (a.date === latestDate) latestAnomalyTypes.set(a.product_id, a.anomaly_type);
  }
  const stockItems: StockItem[] = rows
    .filter((r) => r.date === latestDate)
    .map((r) => {
      const atype = latestAnomalyTypes.get(r.product_id);
      const status: "위험" | "주의" | "정상" =
        atype === "out_of_stock" ? "위험" : atype === "stockout_risk" ? "주의" : "정상";
      return {
        product_id: r.product_id,
        product_name: r.products?.product_name ?? r.product_id,
        category: r.products?.category ?? "",
        stock_qty: r.stock_qty,
        status,
      };
    });

  // Summary
  const summary: Summary = {
    total_products: new Set(rows.map((r) => r.product_id)).size,
    analysis_days: new Set(rows.map((r) => r.date)).size,
    total_sales_qty: dailySales.reduce((s, d) => s + d.qty, 0),
    total_revenue: dailySales.reduce((s, d) => s + d.revenue, 0),
    anomaly_count: anomalies.length,
    estimated_daily_loss: anomalies.reduce((s, a) => s + a.estimated_lost_sales, 0),
  };

  return { summary, dailySales, categorySales, stockItems, anomalies, anomalyTypeCounts, latestDate };
}

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [dash, setDash] = useState<DashboardState | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!isConfigured) {
      setErrorCode("NOT_CONFIGURED");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("daily_sales")
      .select(
        "date, product_id, sales_qty, stock_qty, products(product_name, category, region, unit_price)"
      )
      .order("date");

    if (error) {
      setErrorCode(error.message);
      setLoading(false);
      return;
    }

    if (!data || data.length === 0) {
      setErrorCode("NO_DATA");
      setLoading(false);
      return;
    }

    setDash(buildDashboard(data as unknown as RawSaleRow[]));
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const runAnalysis = async () => {
    setAnalyzing(true);
    const res = await fetch("/api/analyze", { method: "POST" });
    const json = await res.json();
    if (res.ok) {
      setLastSaved(new Date().toLocaleString("ko-KR"));
    } else {
      alert(json.error ?? "분석 실패");
    }
    setAnalyzing(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400 text-lg animate-pulse">로딩 중...</div>
      </div>
    );
  }

  if (errorCode === "NOT_CONFIGURED") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md p-8 bg-white rounded-xl shadow-sm">
          <p className="text-xl font-bold text-gray-700 mb-3">Supabase 설정 필요</p>
          <p className="text-gray-500 text-sm mb-2">
            <code className="bg-gray-100 px-2 py-1 rounded">dashboard/.env.local</code> 파일에
            아래 값을 입력하세요.
          </p>
          <pre className="bg-gray-50 rounded p-3 text-xs text-left text-gray-600 mt-3">
{`NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key`}
          </pre>
        </div>
      </div>
    );
  }

  if (errorCode === "NO_DATA") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md p-8 bg-white rounded-xl shadow-sm">
          <p className="text-xl font-bold text-gray-700 mb-3">데이터 없음</p>
          <p className="text-gray-500 text-sm">
            상품 관리에서 상품을 등록하고, 판매/재고 입력에서 데이터를 추가하세요.
          </p>
        </div>
      </div>
    );
  }

  if (errorCode) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-600 font-medium">오류: {errorCode}</p>
      </div>
    );
  }

  if (!dash) return null;

  const { summary, dailySales, categorySales, stockItems, anomalies, anomalyTypeCounts, latestDate } = dash;

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">유통 판매 이상 탐지 대시보드</h1>
            {latestDate && (
              <p className="text-gray-400 text-sm mt-1">최신 데이터 기준일: {latestDate}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {lastSaved && (
              <span className="text-xs text-gray-400">마지막 저장: {lastSaved}</span>
            )}
            <button
              onClick={runAnalysis}
              disabled={analyzing}
              className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-50 transition-colors"
            >
              {analyzing ? "분석 중..." : "이상 탐지 실행 & 저장"}
            </button>
          </div>
        </div>

        {/* 요약 카드 */}
        <SummaryCards summary={summary} />

        {/* 일별 판매 추이 */}
        <section className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">일별 판매 추이</h2>
          <DailySalesChart data={dailySales} />
        </section>

        {/* 카테고리 + 이상 유형 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">카테고리별 매출액</h2>
            <CategoryChart data={categorySales} />
          </section>
          <section className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">이상 유형별 탐지 건수</h2>
            <AnomalyTypeChart data={anomalyTypeCounts} />
          </section>
        </div>

        {/* 재고 현황 */}
        <section className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">재고 현황 (최신 기준)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">상품명</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">카테고리</th>
                  <th className="text-right py-3 px-4 text-gray-500 font-medium">현재 재고</th>
                  <th className="text-center py-3 px-4 text-gray-500 font-medium">상태</th>
                </tr>
              </thead>
              <tbody>
                {stockItems.map((item, i) => (
                  <tr key={i} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 font-medium text-gray-800">{item.product_name}</td>
                    <td className="py-3 px-4 text-gray-600">{item.category}</td>
                    <td className="py-3 px-4 text-right font-mono">
                      {item.stock_qty.toLocaleString()}개
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                          item.status === "위험"
                            ? "bg-red-100 text-red-700"
                            : item.status === "주의"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-green-100 text-green-700"
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 이상 탐지 상세 */}
        <AnomalyTable anomalies={anomalies} />
      </main>

      <footer className="text-center text-xs text-gray-400 py-6 border-t border-gray-200">
        유통 판매 이상 탐지 시스템 · Next.js + Supabase
      </footer>
    </div>
  );
}
