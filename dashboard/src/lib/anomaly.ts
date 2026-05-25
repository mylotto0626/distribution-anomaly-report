// detect_anomaly.py 의 로직을 TypeScript로 동일하게 구현
// Python tools/ 파일은 변경하지 않음

const Z_SPIKE = 2.0;
const Z_DROP = -2.0;
const STOCKOUT_RISK_DAYS = 3;

export const TYPE_LABELS: Record<string, string> = {
  sales_spike: "판매 급증",
  sales_drop: "판매 급감",
  out_of_stock: "재고 소진 (품절)",
  stockout_risk: "재고 부족 위험",
  no_sales_with_stock: "재고있음+판매없음",
};

export interface SalesRow {
  date: string;
  product_id: string;
  product_name: string;
  category: string;
  sales_qty: number;
  stock_qty: number;
  unit_price: number;
}

export interface AnomalyRow {
  date: string;
  product_id: string;
  product_name: string;
  category: string;
  anomaly_type: string;
  anomaly_label: string;
  value: number;
  z_score: number | null;
  days_of_stock: number | null;
  avg_daily_sales: number;
  estimated_lost_sales: number;
  detail: string;
}

function populationStd(values: number[]): number {
  const n = values.length;
  if (n === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  return Math.sqrt(values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / n);
}

export function detectAnomalies(rows: SalesRow[]): AnomalyRow[] {
  const anomalies: AnomalyRow[] = [];

  // 상품별 평균/표준편차 계산
  const byProduct: Record<string, SalesRow[]> = {};
  for (const row of rows) {
    (byProduct[row.product_id] ??= []).push(row);
  }

  const stats: Record<string, { avg: number; std: number }> = {};
  for (const [pid, pRows] of Object.entries(byProduct)) {
    const vals = pRows.map((r) => r.sales_qty);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    stats[pid] = { avg, std: populationStd(vals) };
  }

  // 1. 판매 급증/급감 (z-score 기반)
  for (const row of rows) {
    const { avg, std } = stats[row.product_id];
    const z = std > 0 ? (row.sales_qty - avg) / std : 0;
    const r3 = (n: number) => Math.round(n * 1000) / 1000;
    const r1 = (n: number) => Math.round(n * 10) / 10;

    if (z >= Z_SPIKE) {
      anomalies.push({
        date: row.date,
        product_id: row.product_id,
        product_name: row.product_name,
        category: row.category,
        anomaly_type: "sales_spike",
        anomaly_label: TYPE_LABELS.sales_spike,
        value: row.sales_qty,
        z_score: r3(z),
        days_of_stock: null,
        avg_daily_sales: r1(avg),
        estimated_lost_sales: 0,
        detail: `판매 급증: ${row.sales_qty}개 판매 (평균 ${r1(avg)}개, z=${z.toFixed(2)})`,
      });
    } else if (z <= Z_DROP) {
      anomalies.push({
        date: row.date,
        product_id: row.product_id,
        product_name: row.product_name,
        category: row.category,
        anomaly_type: "sales_drop",
        anomaly_label: TYPE_LABELS.sales_drop,
        value: row.sales_qty,
        z_score: r3(z),
        days_of_stock: null,
        avg_daily_sales: r1(avg),
        estimated_lost_sales: 0,
        detail: `판매 급감: ${row.sales_qty}개 판매 (평균 ${r1(avg)}개, z=${z.toFixed(2)})`,
      });
    }
  }

  // 2. 재고 부족/품절/미판매 (최신 날짜 기준)
  const latestDate = rows.reduce((m, r) => (r.date > m ? r.date : m), "");
  for (const row of rows.filter((r) => r.date === latestDate)) {
    const { avg } = stats[row.product_id];
    const days = avg > 0 ? row.stock_qty / avg : Infinity;
    const loss = Math.round(avg * row.unit_price);
    const r1 = (n: number) => Math.round(n * 10) / 10;

    if (row.stock_qty === 0) {
      anomalies.push({
        date: row.date,
        product_id: row.product_id,
        product_name: row.product_name,
        category: row.category,
        anomaly_type: "out_of_stock",
        anomaly_label: TYPE_LABELS.out_of_stock,
        value: 0,
        z_score: null,
        days_of_stock: 0,
        avg_daily_sales: r1(avg),
        estimated_lost_sales: loss,
        detail: `재고 소진: 현재 0개 / 평균 ${r1(avg)}개/일 판매 / 예상 손실 ${loss.toLocaleString()}원/일`,
      });
    } else if (days <= STOCKOUT_RISK_DAYS) {
      anomalies.push({
        date: row.date,
        product_id: row.product_id,
        product_name: row.product_name,
        category: row.category,
        anomaly_type: "stockout_risk",
        anomaly_label: TYPE_LABELS.stockout_risk,
        value: row.stock_qty,
        z_score: null,
        days_of_stock: Math.round(days * 10) / 10,
        avg_daily_sales: r1(avg),
        estimated_lost_sales: loss,
        detail: `재고 위험: 현재 ${row.stock_qty}개 (${days.toFixed(1)}일치) / 평균 ${r1(avg)}개/일 판매 / 예상 손실 ${loss.toLocaleString()}원/일`,
      });
    }

    if (row.sales_qty === 0 && row.stock_qty > 0) {
      anomalies.push({
        date: row.date,
        product_id: row.product_id,
        product_name: row.product_name,
        category: row.category,
        anomaly_type: "no_sales_with_stock",
        anomaly_label: TYPE_LABELS.no_sales_with_stock,
        value: row.stock_qty,
        z_score: null,
        days_of_stock: null,
        avg_daily_sales: r1(avg),
        estimated_lost_sales: 0,
        detail: `판매 0, 재고 ${row.stock_qty}개 보유 / 이 상품 평균 판매량 ${r1(avg)}개/일`,
      });
    }
  }

  return anomalies;
}
