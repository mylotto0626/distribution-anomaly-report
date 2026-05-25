"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import SalesEntryForm from "../components/SalesEntryForm";
import CSVUpload from "../components/CSVUpload";

interface Product {
  product_id: string;
  product_name: string;
}

interface SaleRow {
  date: string;
  product_id: string;
  sales_qty: number;
  stock_qty: number;
}

export default function SalesPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [recentSales, setRecentSales] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    const [{ data: prods }, { data: sales }] = await Promise.all([
      supabase.from("products").select("product_id, product_name").order("product_id"),
      supabase
        .from("daily_sales")
        .select("date, product_id, sales_qty, stock_qty")
        .order("date", { ascending: false })
        .limit(20),
    ]);
    setProducts(prods ?? []);
    setRecentSales(sales ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <h1 className="text-2xl font-bold text-gray-800">판매/재고 입력</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">직접 입력</h2>
            <SalesEntryForm products={products} onSuccess={loadData} />
          </section>

          <section className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">CSV 일괄 업로드</h2>
            <CSVUpload onSuccess={loadData} />
          </section>
        </div>

        <section className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            최근 입력 데이터{" "}
            <span className="text-base font-normal text-gray-400">(최근 20건)</span>
          </h2>
          {loading ? (
            <p className="text-gray-400 text-sm animate-pulse">불러오는 중...</p>
          ) : recentSales.length === 0 ? (
            <p className="text-gray-400 text-sm">입력된 데이터가 없습니다.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-3 text-gray-500 font-medium">날짜</th>
                    <th className="text-left py-3 px-3 text-gray-500 font-medium">상품 코드</th>
                    <th className="text-right py-3 px-3 text-gray-500 font-medium">판매량</th>
                    <th className="text-right py-3 px-3 text-gray-500 font-medium">재고</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSales.map((s, i) => (
                    <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-3 font-mono text-gray-500">{s.date}</td>
                      <td className="py-3 px-3 text-gray-800">{s.product_id}</td>
                      <td className="py-3 px-3 text-right font-mono">
                        {s.sales_qty.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-right font-mono">
                        {s.stock_qty.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
