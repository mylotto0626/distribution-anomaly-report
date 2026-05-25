"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

interface Product {
  product_id: string;
  product_name: string;
}

export default function SalesEntryForm({
  products,
  onSuccess,
}: {
  products: Product[];
  onSuccess: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ date: today, product_id: "", sales_qty: "", stock_qty: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error: err } = await supabase.from("daily_sales").upsert(
      {
        date: form.date,
        product_id: form.product_id,
        sales_qty: parseInt(form.sales_qty, 10),
        stock_qty: parseInt(form.stock_qty, 10),
      },
      { onConflict: "date,product_id" }
    );
    setLoading(false);
    if (err) {
      setError(err.message);
    } else {
      setForm((f) => ({ ...f, product_id: "", sales_qty: "", stock_qty: "" }));
      onSuccess();
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded">{error}</p>}
      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <span className="text-sm font-medium text-gray-700">날짜</span>
          <input required type="date" value={form.date} onChange={set("date")} className={INPUT} />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-gray-700">상품</span>
          <select required value={form.product_id} onChange={set("product_id")} className={INPUT}>
            <option value="">선택</option>
            {products.map((p) => (
              <option key={p.product_id} value={p.product_id}>
                {p.product_name} ({p.product_id})
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium text-gray-700">판매량 (개)</span>
          <input required type="number" min="0" value={form.sales_qty} onChange={set("sales_qty")} placeholder="0" className={INPUT} />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-gray-700">재고량 (개)</span>
          <input required type="number" min="0" value={form.stock_qty} onChange={set("stock_qty")} placeholder="0" className={INPUT} />
        </label>
      </div>
      <button type="submit" disabled={loading} className={BTN}>
        {loading ? "저장 중..." : "판매/재고 저장"}
      </button>
    </form>
  );
}

const INPUT = "mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500";
const BTN = "w-full bg-slate-800 text-white py-2 rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-50 transition-colors";
