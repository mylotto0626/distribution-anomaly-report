"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { CategorySale } from "../types";

export default function CategoryChart({ data }: { data: CategorySale[] }) {
  const formatted = data.map((d) => ({
    category: d.category,
    revenue_만: Math.round(d.revenue / 10_000),
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={formatted} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="category" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}만`} />
        <Tooltip formatter={(value) => [`${value}만원`, "매출액"]} />
        <Bar dataKey="revenue_만" fill="#4C72B0" name="매출액 (만원)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
