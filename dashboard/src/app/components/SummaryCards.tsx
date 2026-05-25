"use client";

import type { Summary } from "../types";

function formatKRW(n: number): string {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억원`;
  if (n >= 10_000) return `${Math.round(n / 10_000).toLocaleString()}만원`;
  return `${n.toLocaleString()}원`;
}

export default function SummaryCards({ summary }: { summary: Summary }) {
  const cards = [
    {
      label: "총 매출액",
      value: formatKRW(summary.total_revenue),
      sub: `${summary.analysis_days}일 합계`,
      bg: "bg-blue-50 border-blue-200",
      text: "text-blue-700",
    },
    {
      label: "총 판매량",
      value: `${summary.total_sales_qty.toLocaleString()}개`,
      sub: `상품 ${summary.total_products}개`,
      bg: "bg-indigo-50 border-indigo-200",
      text: "text-indigo-700",
    },
    {
      label: "이상 탐지 건수",
      value: `${summary.anomaly_count}건`,
      sub: "분석 기간 내",
      bg: "bg-orange-50 border-orange-200",
      text: "text-orange-700",
    },
    {
      label: "예상 매출 손실",
      value: formatKRW(summary.estimated_daily_loss),
      sub: "재고 이슈 / 일",
      bg: "bg-red-50 border-red-200",
      text: "text-red-700",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, i) => (
        <div key={i} className={`rounded-xl border p-5 ${card.bg}`}>
          <p className="text-sm text-gray-500">{card.label}</p>
          <p className={`text-2xl font-bold mt-1 ${card.text}`}>{card.value}</p>
          <p className="text-xs text-gray-400 mt-1">{card.sub}</p>
        </div>
      ))}
    </div>
  );
}
