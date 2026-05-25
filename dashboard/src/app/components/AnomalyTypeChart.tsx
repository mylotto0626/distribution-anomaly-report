"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { AnomalyTypeCount } from "../types";

const COLORS: Record<string, string> = {
  sales_spike: "#4C72B0",
  sales_drop: "#f39c12",
  out_of_stock: "#e74c3c",
  stockout_risk: "#DD8452",
  no_sales_with_stock: "#8172B2",
};

export default function AnomalyTypeChart({ data }: { data: AnomalyTypeCount[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 5, right: 40, left: 10, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
        <YAxis dataKey="label" type="category" tick={{ fontSize: 10 }} width={120} />
        <Tooltip formatter={(value) => [`${value}건`, "탐지 건수"]} />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} name="건수">
          {data.map((entry, i) => (
            <Cell key={i} fill={COLORS[entry.type] ?? "#8C8C8C"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
