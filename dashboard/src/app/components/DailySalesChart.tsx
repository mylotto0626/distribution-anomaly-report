"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { DailySale } from "../types";

export default function DailySalesChart({ data }: { data: DailySale[] }) {
  const formatted = data.map((d) => ({
    date: d.date.slice(5),
    qty: d.qty,
    revenue_만: Math.round(d.revenue / 10_000),
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={formatted} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={4} />
        <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fontSize: 11 }}
          tickFormatter={(v) => `${v}만`}
        />
        <Tooltip
          formatter={(value, name) =>
            name === "판매량 (개)" ? [`${value}개`, name] : [`${value}만원`, name]
          }
        />
        <Legend />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="qty"
          stroke="#4C72B0"
          strokeWidth={2}
          dot={false}
          name="판매량 (개)"
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="revenue_만"
          stroke="#DD8452"
          strokeWidth={2}
          dot={false}
          name="매출액 (만원)"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
