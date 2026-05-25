export interface Summary {
  total_products: number;
  analysis_days: number;
  total_sales_qty: number;
  total_revenue: number;
  anomaly_count: number;
  estimated_daily_loss: number;
}

export interface DailySale {
  date: string;
  qty: number;
  revenue: number;
}

export interface CategorySale {
  category: string;
  qty: number;
  revenue: number;
}

export interface RegionSale {
  region: string;
  qty: number;
  revenue: number;
}

export interface StockItem {
  product_id: string;
  product_name: string;
  category: string;
  stock_qty: number;
  status: "위험" | "주의" | "정상";
}

export interface Anomaly {
  date: string;
  product_id: string;
  product_name: string;
  category: string;
  anomaly_type: string;
  anomaly_label: string;
  value: number;
  detail: string;
  estimated_lost_sales: number;
}

export interface AnomalyTypeCount {
  type: string;
  label: string;
  count: number;
}

export interface DashboardData {
  generated_at: string;
  analysis_period: { start: string; end: string };
  summary: Summary;
  daily_sales: DailySale[];
  category_sales: CategorySale[];
  region_sales: RegionSale[];
  stock_status: StockItem[];
  anomalies: Anomaly[];
  anomaly_type_counts: AnomalyTypeCount[];
}
