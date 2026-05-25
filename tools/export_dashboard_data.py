import json
import os
import shutil
import sys
import pandas as pd
from datetime import datetime

PROCESSED_PATH = "data/processed/sales_processed.csv"
ANOMALY_PATH = "data/processed/anomaly_result.csv"
OUTPUT_PATH = "output/dashboard_data.json"
DASHBOARD_PUBLIC_PATH = "dashboard/public/dashboard_data.json"

STOCK_DANGER_QTY = 20
STOCK_CAUTION_QTY = 50

TYPE_LABELS = {
    "sales_spike":         "판매 급증",
    "sales_drop":          "판매 급감",
    "out_of_stock":        "재고 소진 (품절)",
    "stockout_risk":       "재고 부족 위험",
    "no_sales_with_stock": "재고있음+판매없음",
}


def run():
    print("=" * 55)
    print("  [4단계] 대시보드 데이터 내보내기")
    print("=" * 55)
    print()

    for path in [PROCESSED_PATH, ANOMALY_PATH]:
        if not os.path.exists(path):
            print(f"[오류] 파일을 찾을 수 없어요: {path}")
            print("  → python main.py를 먼저 실행해주세요.")
            sys.exit(1)

    df = pd.read_csv(PROCESSED_PATH, parse_dates=["date"])
    anomaly_df = pd.read_csv(ANOMALY_PATH)
    anomaly_df["estimated_lost_sales"] = pd.to_numeric(
        anomaly_df["estimated_lost_sales"], errors="coerce"
    ).fillna(0).astype(int)

    # ── 요약 ─────────────────────────────────────────────────────────
    total_loss = int(anomaly_df["estimated_lost_sales"].sum())
    summary = {
        "total_products": int(df["product_id"].nunique()),
        "analysis_days":  int(df["date"].nunique()),
        "total_sales_qty": int(df["sales_qty"].sum()),
        "total_revenue":  int(df["revenue"].sum()),
        "anomaly_count":  len(anomaly_df),
        "estimated_daily_loss": total_loss,
    }

    # ── 일별 판매 ─────────────────────────────────────────────────────
    daily = (
        df.groupby("date")
        .agg(qty=("sales_qty", "sum"), revenue=("revenue", "sum"))
        .reset_index()
    )
    daily_sales = [
        {
            "date": r["date"].strftime("%Y-%m-%d"),
            "qty": int(r["qty"]),
            "revenue": int(r["revenue"]),
        }
        for _, r in daily.iterrows()
    ]

    # ── 카테고리별 매출 ───────────────────────────────────────────────
    cat = (
        df.groupby("category")
        .agg(qty=("sales_qty", "sum"), revenue=("revenue", "sum"))
        .sort_values("revenue", ascending=False)
        .reset_index()
    )
    category_sales = [
        {"category": r["category"], "qty": int(r["qty"]), "revenue": int(r["revenue"])}
        for _, r in cat.iterrows()
    ]

    # ── 지역별 매출 ───────────────────────────────────────────────────
    reg = (
        df.groupby("region")
        .agg(qty=("sales_qty", "sum"), revenue=("revenue", "sum"))
        .sort_values("revenue", ascending=False)
        .reset_index()
    )
    region_sales = [
        {"region": r["region"], "qty": int(r["qty"]), "revenue": int(r["revenue"])}
        for _, r in reg.iterrows()
    ]

    # ── 재고 현황 (최신 날짜 기준) ───────────────────────────────────
    latest_date = df["date"].max()
    latest = df[df["date"] == latest_date].sort_values("stock_qty")
    stock_status = []
    for _, r in latest.iterrows():
        qty = int(r["stock_qty"])
        status = "위험" if qty <= STOCK_DANGER_QTY else "주의" if qty <= STOCK_CAUTION_QTY else "정상"
        stock_status.append({
            "product_id":   r["product_id"],
            "product_name": r["product_name"],
            "category":     r["category"],
            "stock_qty":    qty,
            "status":       status,
        })

    # ── 이상 탐지 목록 ────────────────────────────────────────────────
    anomalies = [
        {
            "date":                str(r["date"]),
            "product_id":          r["product_id"],
            "product_name":        r["product_name"],
            "category":            r["category"],
            "anomaly_type":        r["anomaly_type"],
            "anomaly_label":       TYPE_LABELS.get(r["anomaly_type"], r["anomaly_type"]),
            "value":               int(r["value"]),
            "detail":              r["detail"],
            "estimated_lost_sales": int(r["estimated_lost_sales"]),
        }
        for _, r in anomaly_df.iterrows()
    ]

    # ── 이상 유형별 건수 ──────────────────────────────────────────────
    type_counts = anomaly_df["anomaly_type"].value_counts()
    anomaly_type_counts = [
        {"type": t, "label": TYPE_LABELS.get(t, t), "count": int(c)}
        for t, c in type_counts.items()
    ]

    # ── 조합 ─────────────────────────────────────────────────────────
    data = {
        "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "analysis_period": {
            "start": df["date"].min().strftime("%Y-%m-%d"),
            "end":   df["date"].max().strftime("%Y-%m-%d"),
        },
        "summary":             summary,
        "daily_sales":         daily_sales,
        "category_sales":      category_sales,
        "region_sales":        region_sales,
        "stock_status":        stock_status,
        "anomalies":           anomalies,
        "anomaly_type_counts": anomaly_type_counts,
    }

    # ── 저장: output/ ─────────────────────────────────────────────────
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"  저장: {OUTPUT_PATH}")

    # ── 복사: dashboard/public/ ───────────────────────────────────────
    public_dir = os.path.dirname(DASHBOARD_PUBLIC_PATH)
    os.makedirs(public_dir, exist_ok=True)
    shutil.copy(OUTPUT_PATH, DASHBOARD_PUBLIC_PATH)
    print(f"  복사: {DASHBOARD_PUBLIC_PATH}")

    print(f"  이상 탐지 {len(anomalies)}건 / 상품 {summary['total_products']}개")
    print()


if __name__ == "__main__":
    run()
