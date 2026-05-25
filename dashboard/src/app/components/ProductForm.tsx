"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

const CATEGORIES = ["냉동식품", "음료", "스낵", "유제품", "신선식품", "가공식품"];
const REGIONS = ["서울", "경기", "부산", "대구", "인천", "광주", "대전"];

const EMPTY = { product_id: "", product_name: "", category: "", region: "", unit_price: "" };

export default function ProductForm({ onSuccess }: { onSuccess: () => void }) {
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error: err } = await supabase.from("products").insert({
      ...form,
      unit_price: parseInt(form.unit_price, 10),
    });
    setLoading(false);
    if (err) {
      setError(err.message);
    } else {
      setForm(EMPTY);
      onSuccess();
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded">{error}</p>}
      <div className="grid grid-cols-2 gap-4">
        <Field label="상품 코드">
          <input required value={form.product_id} onChange={set("product_id")} placeholder="P011" className={INPUT} />
        </Field>
        <Field label="상품명">
          <input required value={form.product_name} onChange={set("product_name")} placeholder="신제품A" className={INPUT} />
        </Field>
        <Field label="카테고리">
          <select required value={form.category} onChange={set("category")} className={INPUT}>
            <option value="">선택</option>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="지역">
          <select required value={form.region} onChange={set("region")} className={INPUT}>
            <option value="">선택</option>
            {REGIONS.map((r) => <option key={r}>{r}</option>)}
          </select>
        </Field>
        <Field label="단가 (원)" className="col-span-2">
          <input required type="number" min="0" value={form.unit_price} onChange={set("unit_price")} placeholder="5000" className={INPUT} />
        </Field>
      </div>
      <button type="submit" disabled={loading} className={BTN}>
        {loading ? "등록 중..." : "상품 등록"}
      </button>
    </form>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

const INPUT = "block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500";
const BTN = "w-full bg-slate-800 text-white py-2 rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-50 transition-colors";
