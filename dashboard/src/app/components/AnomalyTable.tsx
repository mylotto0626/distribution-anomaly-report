"use client";

import type { Anomaly } from "../types";

const TYPE_STYLES: Record<string, string> = {
  sales_spike: "bg-blue-100 text-blue-700",
  sales_drop: "bg-yellow-100 text-yellow-700",
  out_of_stock: "bg-red-100 text-red-700",
  stockout_risk: "bg-orange-100 text-orange-700",
  no_sales_with_stock: "bg-purple-100 text-purple-700",
};

export default function AnomalyTable({ anomalies }: { anomalies: Anomaly[] }) {
  return (
    <section className="bg-white rounded-xl shadow-sm p-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">
        이상 탐지 상세{" "}
        <span className="text-base font-normal text-gray-400">({anomalies.length}건)</span>
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 text-gray-500 font-medium">날짜</th>
              <th className="text-left py-3 px-4 text-gray-500 font-medium">상품</th>
              <th className="text-left py-3 px-4 text-gray-500 font-medium">유형</th>
              <th className="text-left py-3 px-4 text-gray-500 font-medium">상세 내용</th>
              <th className="text-right py-3 px-4 text-gray-500 font-medium">예상 손실/일</th>
            </tr>
          </thead>
          <tbody>
            {anomalies.map((item, i) => (
              <tr key={i} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                <td className="py-3 px-4 text-gray-500 whitespace-nowrap font-mono text-xs">
                  {item.date}
                </td>
                <td className="py-3 px-4">
                  <div className="font-medium text-gray-800">{item.product_name}</div>
                  <div className="text-xs text-gray-400">{item.category}</div>
                </td>
                <td className="py-3 px-4">
                  <span
                    className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                      TYPE_STYLES[item.anomaly_type] ?? "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {item.anomaly_label}
                  </span>
                </td>
                <td className="py-3 px-4 text-gray-600 text-xs max-w-xs">{item.detail}</td>
                <td className="py-3 px-4 text-right font-mono text-sm">
                  {item.estimated_lost_sales > 0 ? (
                    <span className="text-red-600 font-medium">
                      {item.estimated_lost_sales.toLocaleString()}원
                    </span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
