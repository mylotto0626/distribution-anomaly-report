import pandas as pd
import os
import sys

INPUT_PATH = "data/processed/sales_processed.csv"
OUTPUT_PATH = "data/processed/anomaly_result.csv"

# ── 이상 탐지 기준값 ─────────────────────────────────────────────────────────
Z_SPIKE_THRESHOLD = 2.0    # z-score 이 이상 → 판매량 급증 (sales_spike)
Z_DROP_THRESHOLD = -2.0    # z-score 이 이하 → 판매량 급감 (sales_drop)
STOCKOUT_RISK_DAYS = 3     # 재고 소진까지 이 일 이하 → 재고 부족 위험 (stockout_risk)

OUTPUT_COLUMNS = [
    "date", "product_id", "product_name", "category",
    "anomaly_type", "value", "z_score", "days_of_stock",
    "avg_daily_sales", "estimated_lost_sales", "detail"
]


def _calc_product_stats(df):
    """
    상품별 평균 판매량·표준편차를 계산하고 z-score를 추가한다.

    z-score란?
      숫자가 평균에서 얼마나 떨어져 있는지를 나타내는 값.
      +2 이상이면 평균보다 크게 높은 것, -2 이하면 크게 낮은 것.
      표준편차 ddof=0을 써서 데이터가 적어도 NaN이 나오지 않게 처리.
    """
    grp = df.groupby("product_id")["sales_qty"]
    avg_s = grp.mean().rename("avg_daily_sales")
    std_s = grp.apply(lambda x: x.std(ddof=0)).rename("std_sales")

    stats = pd.concat([avg_s, std_s], axis=1).reset_index()
    df = df.merge(stats, on="product_id")

    df["z_score"] = df.apply(
        lambda r: round(
            (r["sales_qty"] - r["avg_daily_sales"]) / r["std_sales"], 3
        ) if r["std_sales"] > 0 else 0.0,
        axis=1
    )
    return df


def _detect_sales_anomaly(df):
    """
    판매량 급증(sales_spike) / 급감(sales_drop) 탐지.
    z-score >= 2  → sales_spike (평균보다 통계적으로 크게 많이 팔림)
    z-score <= -2 → sales_drop  (평균보다 통계적으로 크게 적게 팔림)
    """
    anomalies = []

    for _, row in df.iterrows():
        z = row["z_score"]
        qty = int(row["sales_qty"])
        avg = row["avg_daily_sales"]

        if z >= Z_SPIKE_THRESHOLD:
            anomalies.append({
                "date": row["date"].date(),
                "product_id": row["product_id"],
                "product_name": row["product_name"],
                "category": row["category"],
                "anomaly_type": "sales_spike",
                "value": qty,
                "z_score": round(z, 3),
                "days_of_stock": None,
                "avg_daily_sales": round(avg, 1),
                "estimated_lost_sales": 0,
                "detail": f"판매 급증: {qty}개 판매 (평균 {avg:.1f}개, z={z:.2f})"
            })

        elif z <= Z_DROP_THRESHOLD:
            anomalies.append({
                "date": row["date"].date(),
                "product_id": row["product_id"],
                "product_name": row["product_name"],
                "category": row["category"],
                "anomaly_type": "sales_drop",
                "value": qty,
                "z_score": round(z, 3),
                "days_of_stock": None,
                "avg_daily_sales": round(avg, 1),
                "estimated_lost_sales": 0,
                "detail": f"판매 급감: {qty}개 판매 (평균 {avg:.1f}개, z={z:.2f})"
            })

    return anomalies


def _detect_stock_risk(df):
    """
    재고 부족 위험 탐지 (가장 최근 날짜 기준).

    out_of_stock:  재고가 0개 → 지금 당장 팔 물건이 없음
    stockout_risk: 재고가 남은 날 수(days_of_stock) <= 3일 → 곧 소진 예상

    days_of_stock = 현재 재고 ÷ 하루 평균 판매량
    예상 손실 = 하루 평균 판매량 × 단가
    """
    anomalies = []
    latest_date = df["date"].max()
    latest = df[df["date"] == latest_date].copy()

    for _, row in latest.iterrows():
        stock = row["stock_qty"]
        avg = row["avg_daily_sales"]
        unit_price = row["unit_price"]
        estimated_lost = int(round(avg * unit_price))

        if avg > 0:
            days_of_stock = round(stock / avg, 1)
        else:
            days_of_stock = float("inf")

        if stock == 0:
            anomalies.append({
                "date": latest_date.date(),
                "product_id": row["product_id"],
                "product_name": row["product_name"],
                "category": row["category"],
                "anomaly_type": "out_of_stock",
                "value": 0,
                "z_score": None,
                "days_of_stock": 0.0,
                "avg_daily_sales": round(avg, 1),
                "estimated_lost_sales": estimated_lost,
                "detail": (
                    f"재고 소진: 현재 0개 / "
                    f"평균 {avg:.1f}개/일 판매 / "
                    f"예상 손실 {estimated_lost:,}원/일"
                )
            })

        elif days_of_stock <= STOCKOUT_RISK_DAYS:
            anomalies.append({
                "date": latest_date.date(),
                "product_id": row["product_id"],
                "product_name": row["product_name"],
                "category": row["category"],
                "anomaly_type": "stockout_risk",
                "value": int(stock),
                "z_score": None,
                "days_of_stock": days_of_stock,
                "avg_daily_sales": round(avg, 1),
                "estimated_lost_sales": estimated_lost,
                "detail": (
                    f"재고 위험: 현재 {int(stock)}개 ({days_of_stock:.1f}일치) / "
                    f"평균 {avg:.1f}개/일 판매 / "
                    f"예상 손실 {estimated_lost:,}원/일"
                )
            })

    return anomalies


def _detect_no_sales_with_stock(df):
    """
    재고는 있는데 판매량이 0인 상품 탐지 (최신 날짜 기준).
    no_sales_with_stock: sales_qty == 0 이고 stock_qty > 0
    → 물건은 있는데 안 팔리는 상태. 마케팅·할인 검토 필요.
    """
    anomalies = []
    latest_date = df["date"].max()
    latest = df[df["date"] == latest_date]

    for _, row in latest.iterrows():
        if row["sales_qty"] == 0 and row["stock_qty"] > 0:
            avg = row["avg_daily_sales"]
            anomalies.append({
                "date": latest_date.date(),
                "product_id": row["product_id"],
                "product_name": row["product_name"],
                "category": row["category"],
                "anomaly_type": "no_sales_with_stock",
                "value": int(row["stock_qty"]),
                "z_score": None,
                "days_of_stock": None,
                "avg_daily_sales": round(avg, 1),
                "estimated_lost_sales": 0,
                "detail": (
                    f"판매 0, 재고 {int(row['stock_qty'])}개 보유 / "
                    f"이 상품 평균 판매량 {avg:.1f}개/일"
                )
            })

    return anomalies


def run():
    print("=" * 55)
    print("  [2단계] 이상 탐지 (z-score 고도화 버전)")
    print("=" * 55)
    print()

    if not os.path.exists(INPUT_PATH):
        print(f"[오류] 파일을 찾을 수 없어요: {INPUT_PATH}")
        print("  → preprocess_sales.py를 먼저 실행해야 해요.")
        sys.exit(1)

    df = pd.read_csv(INPUT_PATH, parse_dates=["date"])
    print(f"  데이터 로드 완료: {len(df)}행 "
          f"({df['product_id'].nunique()}개 상품, {df['date'].nunique()}일)")
    print()

    # ── 상품별 통계 계산 ──────────────────────────────────────────
    print("  상품별 통계 계산 중...")
    df = _calc_product_stats(df)

    stats_view = (
        df.groupby(["product_id", "product_name"])
        .agg(avg=("avg_daily_sales", "first"), std=("std_sales", "first"))
        .reset_index()
    )
    for _, r in stats_view.iterrows():
        print(f"    {r['product_name']}: "
              f"평균 {r['avg']:.1f}개/일, 표준편차 {r['std']:.1f}")
    print()
    print(f"  z-score 기준: 급증 >= {Z_SPIKE_THRESHOLD}, "
          f"급감 <= {Z_DROP_THRESHOLD}")
    print(f"  재고 위험 기준: days_of_stock <= {STOCKOUT_RISK_DAYS}일")
    print()

    # ── 탐지 실행 ─────────────────────────────────────────────────
    anomalies = []

    print("  [탐지 1] 판매량 급증/급감 (z-score 기반)...")
    sales_anomalies = _detect_sales_anomaly(df)
    anomalies.extend(sales_anomalies)
    if sales_anomalies:
        for a in sales_anomalies:
            print(f"    [!] {a['product_name']} | {a['anomaly_type']} | {a['detail']}")
    else:
        print(f"    → 해당 없음 (모든 상품 z-score 정상 범위)")

    print()
    print("  [탐지 2] 재고 부족 위험 (days_of_stock 기반)...")
    stock_anomalies = _detect_stock_risk(df)
    anomalies.extend(stock_anomalies)
    if stock_anomalies:
        for a in stock_anomalies:
            print(f"    [!] {a['product_name']} | {a['anomaly_type']} | {a['detail']}")
    else:
        print(f"    → 해당 없음 (모든 상품 재고 안전)")

    print()
    print("  [탐지 3] 재고 있음 + 판매 0 상품...")
    unsold_anomalies = _detect_no_sales_with_stock(df)
    anomalies.extend(unsold_anomalies)
    if unsold_anomalies:
        for a in unsold_anomalies:
            print(f"    [!] {a['product_name']} | {a['anomaly_type']} | {a['detail']}")
    else:
        print(f"    → 해당 없음")

    print()

    # ── 결과 저장 ─────────────────────────────────────────────────
    if anomalies:
        result_df = pd.DataFrame(anomalies)[OUTPUT_COLUMNS]
    else:
        result_df = pd.DataFrame(columns=OUTPUT_COLUMNS)

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    result_df.to_csv(OUTPUT_PATH, index=False, encoding="utf-8-sig")

    # ── 요약 출력 ─────────────────────────────────────────────────
    total = len(result_df)
    type_labels = {
        "sales_spike":          "판매 급증",
        "sales_drop":           "판매 급감",
        "out_of_stock":         "재고 소진",
        "stockout_risk":        "재고 부족 위험",
        "no_sales_with_stock":  "재고있음+판매0",
    }

    print(f"  탐지 결과 요약: 총 {total}건")
    if total > 0:
        for atype, cnt in result_df["anomaly_type"].value_counts().items():
            label = type_labels.get(atype, atype)
            print(f"    · {label} ({atype}): {cnt}건")

        total_loss = int(result_df["estimated_lost_sales"].sum())
        if total_loss > 0:
            print()
            print(f"  예상 매출 손실 (재고 이슈 기준): {total_loss:,}원/일")
    else:
        print("  이상 항목 없음 — 모든 상품이 정상 범위입니다.")

    print()
    print(f"  저장 완료: {OUTPUT_PATH}")
    print()

    return result_df


if __name__ == "__main__":
    run()
