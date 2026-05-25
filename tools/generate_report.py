import matplotlib
matplotlib.use("Agg")  # 화면 없이 파일로만 저장
import matplotlib.pyplot as plt
import matplotlib.font_manager as fm
import pandas as pd
import os
import sys
from datetime import datetime

PROCESSED_PATH = "data/processed/sales_processed.csv"
ANOMALY_PATH = "data/processed/anomaly_result.csv"
CHART_DIR = "output/charts"
REPORT_DIR = "output/reports"
CHART_CATEGORY = f"{CHART_DIR}/category_sales.png"
CHART_STOCK = f"{CHART_DIR}/stock_risk.png"
REPORT_PATH = f"{REPORT_DIR}/daily_report.md"

STOCK_DANGER_QTY = 20
STOCK_CAUTION_QTY = 50


def _setup_korean_font():
    """Windows 한글 폰트 설정"""
    candidates = ["Malgun Gothic", "NanumGothic", "AppleGothic", "DejaVu Sans"]
    available = {f.name for f in fm.fontManager.ttflist}
    for font in candidates:
        if font in available:
            plt.rcParams["font.family"] = font
            break
    plt.rcParams["axes.unicode_minus"] = False


def _make_category_chart(df):
    """카테고리별 총 매출액 막대 차트"""
    cat_rev = df.groupby("category")["revenue"].sum().sort_values(ascending=False)
    colors = ["#4C72B0", "#DD8452", "#55A868", "#C44E52", "#8172B2"][:len(cat_rev)]

    fig, ax = plt.subplots(figsize=(8, 5))
    bars = ax.bar(cat_rev.index, cat_rev.values, color=colors, width=0.55)
    ax.set_title("카테고리별 총 매출액", fontsize=14, fontweight="bold", pad=15)
    ax.set_xlabel("카테고리", fontsize=11)
    ax.set_ylabel("매출액 (원)", fontsize=11)
    ax.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, _: f"{int(x):,}"))
    ax.set_ylim(0, cat_rev.max() * 1.2)
    ax.spines[["top", "right"]].set_visible(False)

    for bar, val in zip(bars, cat_rev.values):
        ax.text(
            bar.get_x() + bar.get_width() / 2,
            bar.get_height() + cat_rev.max() * 0.02,
            f"{int(val):,}원",
            ha="center", va="bottom", fontsize=9
        )

    plt.tight_layout()
    os.makedirs(CHART_DIR, exist_ok=True)
    plt.savefig(CHART_CATEGORY, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"  차트 저장: {CHART_CATEGORY}")


def _make_stock_chart(df):
    """상품별 재고 현황 가로 막대 차트 (최신 날짜 기준)"""
    latest_date = df["date"].max()
    latest = df[df["date"] == latest_date].copy()
    latest = latest.sort_values("stock_qty")

    colors = [
        "#e74c3c" if q <= STOCK_DANGER_QTY
        else "#f39c12" if q <= STOCK_CAUTION_QTY
        else "#2ecc71"
        for q in latest["stock_qty"]
    ]

    fig, ax = plt.subplots(figsize=(9, 5))
    bars = ax.barh(latest["product_name"], latest["stock_qty"], color=colors, height=0.55)
    ax.axvline(
        x=STOCK_DANGER_QTY, color="#e74c3c",
        linestyle="--", linewidth=1.5,
        label=f"위험 기준선 ({STOCK_DANGER_QTY}개)"
    )
    ax.set_title(
        f"상품별 재고 현황 ({latest_date.strftime('%Y-%m-%d')} 기준)",
        fontsize=13, fontweight="bold", pad=15
    )
    ax.set_xlabel("재고 수량 (개)", fontsize=11)
    ax.legend(fontsize=10)
    ax.spines[["top", "right"]].set_visible(False)

    max_val = latest["stock_qty"].max()
    for bar, val in zip(bars, latest["stock_qty"]):
        ax.text(
            bar.get_width() + max_val * 0.01,
            bar.get_y() + bar.get_height() / 2,
            f"{int(val)}개",
            va="center", fontsize=9
        )

    plt.tight_layout()
    os.makedirs(CHART_DIR, exist_ok=True)
    plt.savefig(CHART_STOCK, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"  차트 저장: {CHART_STOCK}")


def _generate_insights(df, anomaly_df):
    """자동 인사이트 생성"""
    insights = []

    # 최고 매출 카테고리
    cat_rev = df.groupby("category")["revenue"].sum()
    top_cat = cat_rev.idxmax()
    insights.append(
        f"가장 매출이 높은 카테고리는 **{top_cat}** ({int(cat_rev.max()):,}원)입니다."
    )

    # 재고 부족 위험 상품
    stock_risk = anomaly_df[anomaly_df["anomaly_type"].isin(["out_of_stock", "stockout_risk"])]
    if not stock_risk.empty:
        out = stock_risk[stock_risk["anomaly_type"] == "out_of_stock"]["product_name"].tolist()
        risk = stock_risk[stock_risk["anomaly_type"] == "stockout_risk"]["product_name"].tolist()
        if out:
            insights.append(f"품절 상품: **{', '.join(out)}** — 재고가 0개입니다. 긴급 발주가 필요합니다.")
        if risk:
            insights.append(f"재고 부족 위험 상품: **{', '.join(risk)}** — 3일 이내 소진 예상, 즉시 발주 검토가 필요합니다.")

    # 판매량 급증 상품
    surge = anomaly_df[anomaly_df["anomaly_type"] == "sales_spike"]
    if not surge.empty:
        names = ", ".join(surge["product_name"].unique().tolist())
        insights.append(f"판매 급증 상품: **{names}** — 재고 소진 속도를 모니터링하세요.")

    # 판매량 급감 상품
    drop = anomaly_df[anomaly_df["anomaly_type"] == "sales_drop"]
    if not drop.empty:
        names = ", ".join(drop["product_name"].unique().tolist())
        insights.append(f"판매 급감 상품: **{names}** — 수요 변화 원인을 확인하세요.")

    # 재고 있는데 판매 없는 상품
    unsold = anomaly_df[anomaly_df["anomaly_type"] == "no_sales_with_stock"]
    if not unsold.empty:
        names = ", ".join(unsold["product_name"].unique().tolist())
        insights.append(f"재고 있음 + 판매 0 상품: **{names}** — 할인 또는 프로모션 검토를 권장합니다.")

    # 전체 판매 추세
    daily_sales = df.groupby("date")["sales_qty"].sum()
    if len(daily_sales) >= 2:
        first_day = int(daily_sales.iloc[0])
        last_day = int(daily_sales.iloc[-1])
        if last_day > first_day:
            insights.append(f"전체 판매량은 증가 추세입니다 ({first_day}개 → {last_day}개).")
        elif last_day < first_day:
            insights.append(f"전체 판매량은 감소 추세입니다 ({first_day}개 → {last_day}개).")
        else:
            insights.append(f"전체 판매량은 안정적입니다 ({first_day}개 → {last_day}개).")

    return insights


def _make_report(df, anomaly_df):
    """Markdown 리포트 생성"""
    today = datetime.now().strftime("%Y-%m-%d")
    date_min = df["date"].min().strftime("%Y-%m-%d")
    date_max = df["date"].max().strftime("%Y-%m-%d")
    total_sales = int(df["sales_qty"].sum())
    total_revenue = int(df["revenue"].sum())
    total_anomalies = len(anomaly_df)
    total_loss = int(anomaly_df["estimated_lost_sales"].sum()) if not anomaly_df.empty else 0

    lines = []

    # 헤더
    lines += [
        "# 유통 판매 이상 탐지 리포트",
        "",
        f"**생성일:** {today}  ",
        f"**분석 기간:** {date_min} ~ {date_max}",
        "",
        "---",
        "",
    ]

    # 요약
    lines += [
        "## 요약",
        "",
        "| 항목 | 값 |",
        "|------|-----|",
        f"| 분석 상품 수 | {df['product_id'].nunique()}개 |",
        f"| 분석 기간 | {df['date'].nunique()}일 |",
        f"| 총 판매량 | {total_sales:,}개 |",
        f"| 총 매출액 | {total_revenue:,}원 |",
        f"| 이상 탐지 건수 | {total_anomalies}건 |",
        f"| 예상 매출 손실 (재고 이슈) | {total_loss:,}원/일 |",
        "",
    ]

    # 일자별 판매 현황
    daily = (
        df.groupby("date")
        .agg(total_qty=("sales_qty", "sum"), total_rev=("revenue", "sum"))
        .reset_index()
    )
    lines += ["## 일자별 판매 현황", "", "| 날짜 | 총 판매량 | 총 매출액 |", "|------|----------|----------|"]
    for _, r in daily.iterrows():
        lines.append(f"| {r['date'].strftime('%Y-%m-%d')} | {int(r['total_qty']):,}개 | {int(r['total_rev']):,}원 |")
    lines.append("")

    # 카테고리별 매출
    cat = (
        df.groupby("category")
        .agg(total_qty=("sales_qty", "sum"), total_rev=("revenue", "sum"))
        .sort_values("total_rev", ascending=False)
        .reset_index()
    )
    lines += [
        "## 카테고리별 매출",
        "",
        "![카테고리별 매출](../charts/category_sales.png)",
        "",
        "| 카테고리 | 총 판매량 | 총 매출액 |",
        "|---------|----------|----------|",
    ]
    for _, r in cat.iterrows():
        lines.append(f"| {r['category']} | {int(r['total_qty']):,}개 | {int(r['total_rev']):,}원 |")
    lines.append("")

    # 지역별 매출
    reg = (
        df.groupby("region")
        .agg(total_qty=("sales_qty", "sum"), total_rev=("revenue", "sum"))
        .sort_values("total_rev", ascending=False)
        .reset_index()
    )
    lines += [
        "## 지역별 매출",
        "",
        "![지역별 매출](../charts/region_sales.png)",
        "",
        "| 지역 | 총 판매량 | 총 매출액 |",
        "|-----|----------|----------|",
    ]
    for _, r in reg.iterrows():
        lines.append(f"| {r['region']} | {int(r['total_qty']):,}개 | {int(r['total_rev']):,}원 |")
    lines.append("")

    # 재고 현황
    latest_df = df[df["date"] == df["date"].max()][
        ["product_name", "category", "stock_qty"]
    ].sort_values("stock_qty")
    lines += [
        "## 재고 현황",
        "",
        "![재고 현황](../charts/stock_risk.png)",
        "",
        "| 상품명 | 카테고리 | 현재 재고 | 상태 |",
        "|-------|---------|---------|------|",
    ]
    for _, r in latest_df.iterrows():
        qty = int(r["stock_qty"])
        if qty <= STOCK_DANGER_QTY:
            status = "[위험]"
        elif qty <= STOCK_CAUTION_QTY:
            status = "[주의]"
        else:
            status = "[정상]"
        lines.append(f"| {r['product_name']} | {r['category']} | {qty:,}개 | {status} |")
    lines.append("")

    # 이상 탐지 결과
    lines += ["## 이상 탐지 결과", ""]
    if total_anomalies == 0:
        lines.append("> 이상 항목이 없습니다. 모든 상품이 정상 범위입니다.")
    else:
        lines += [
            "![이상 유형별 건수](../charts/anomaly_type_count.png)",
            "",
            "![재고 부족 위험 상품](../charts/stock_risk_top.png)",
            "",
            "![예상 매출 손실](../charts/lost_sales_top.png)",
            "",
        ]
        type_labels = {
            "sales_spike":         "판매 급증",
            "sales_drop":          "판매 급감",
            "out_of_stock":        "재고 소진 (품절)",
            "stockout_risk":       "재고 부족 위험",
            "no_sales_with_stock": "재고있음 + 판매없음",
        }
        for atype, label in type_labels.items():
            subset = anomaly_df[anomaly_df["anomaly_type"] == atype]
            if subset.empty:
                continue
            lines += [
                f"### {label} ({len(subset)}건)",
                "",
                "| 날짜 | 상품 | 카테고리 | 값 | 상세 내용 |",
                "|------|-----|---------|-----|---------|",
            ]
            for _, r in subset.iterrows():
                lines.append(
                    f"| {r['date']} | {r['product_name']} | {r['category']} | {int(r['value'])} | {r['detail']} |"
                )
            lines.append("")

    # 자동 인사이트
    lines += ["## 자동 인사이트", ""]
    for insight in _generate_insights(df, anomaly_df):
        lines.append(f"- {insight}")
    lines += [
        "",
        "---",
        "*이 리포트는 자동으로 생성되었습니다.*",
    ]

    os.makedirs(REPORT_DIR, exist_ok=True)
    with open(REPORT_PATH, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print(f"  리포트 저장: {REPORT_PATH}")


def run():
    print("=" * 55)
    print("  [3단계] 리포트 생성")
    print("=" * 55)

    for path in [PROCESSED_PATH, ANOMALY_PATH]:
        if not os.path.exists(path):
            print(f"\n[오류] 파일을 찾을 수 없어요: {path}")
            print("  → preprocess_sales.py와 detect_anomaly.py를 먼저 실행해주세요.")
            sys.exit(1)

    df = pd.read_csv(PROCESSED_PATH, parse_dates=["date"])
    anomaly_df = pd.read_csv(ANOMALY_PATH)

    _setup_korean_font()

    print("  차트 생성 중...")
    _make_category_chart(df)
    _make_stock_chart(df)

    print("  리포트 작성 중...")
    _make_report(df, anomaly_df)

    print()
    print("  [완료] 모든 결과물 생성 완료!")
    print(f"    리포트:  {REPORT_PATH}")
    print(f"    차트 1:  {CHART_CATEGORY}")
    print(f"    차트 2:  {CHART_STOCK}")
    print()

    return True


if __name__ == "__main__":
    run()
