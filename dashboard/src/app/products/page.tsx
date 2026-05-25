"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import ProductForm from "../components/ProductForm";

interface Product {
  product_id: string;
  product_name: string;
  category: string;
  region: string;
  unit_price: number;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("products").select("*").order("product_id");
    setProducts(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <h1 className="text-2xl font-bold text-gray-800">상품 관리</h1>

        <section className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">신규 상품 등록</h2>
          <ProductForm onSuccess={loadProducts} />
        </section>

        <section className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            등록 상품 목록{" "}
            <span className="text-base font-normal text-gray-400">({products.length}개)</span>
          </h2>
          {loading ? (
            <p className="text-gray-400 text-sm animate-pulse">불러오는 중...</p>
          ) : products.length === 0 ? (
            <p className="text-gray-400 text-sm">등록된 상품이 없습니다.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-3 text-gray-500 font-medium">코드</th>
                    <th className="text-left py-3 px-3 text-gray-500 font-medium">상품명</th>
                    <th className="text-left py-3 px-3 text-gray-500 font-medium">카테고리</th>
                    <th className="text-left py-3 px-3 text-gray-500 font-medium">지역</th>
                    <th className="text-right py-3 px-3 text-gray-500 font-medium">단가</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.product_id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-3 font-mono text-gray-500">{p.product_id}</td>
                      <td className="py-3 px-3 font-medium text-gray-800">{p.product_name}</td>
                      <td className="py-3 px-3 text-gray-600">{p.category}</td>
                      <td className="py-3 px-3 text-gray-600">{p.region}</td>
                      <td className="py-3 px-3 text-right font-mono">
                        {p.unit_price.toLocaleString()}원
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
