import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.font_manager as fm
import pandas as pd
import os
import sys

PROCESSED_PATH = "data/processed/sales_processed.csv"
ANOMALY_PATH = "data/processed/anomaly_result.csv"
CHART_DIR = "output/charts"

PALETTE = ["#4C72B0", "#DD8452", "#55A868", "#C44E52", "#8172B2",
           "#937860", "#DA8BC3", "#8C8C8C"]


# ── 공통 유틸 ──────────────────────────────────────────────────────────────


def _setup_font():
    """한글 데이터 레이블을 위한 폰트 설정 (Windows 기준)"""
    candidates = ["Malgun Gothic", "NanumGothic", "AppleGothic"]
    available = {f.name for f in fm.fontManager.ttflist}
    for font in candidates:
        if font in available:
            plt.rcParams["font.family"] = font
            break
    plt.rcParams["axes.unicode_minus"] = False


def _save(fig, filename):
    os.makedirs(CHART_DIR, exist_ok=True)
    path = os.path.join(CHART_DIR, filename)
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"  Saved: {path}")


def _no_data_chart(filename, title):
    """데이터가 없을 때 표시하는 빈 차트"""
    fig, ax = plt.subplots(figsize=(7, 4))
    ax.text(0.5, 0.5, "No data available", ha="center", va="center",
            fontsize=14, color="#aaaaaa", transform=ax.transAxes)
    ax.set_title(title, fontsize=13, fontweight="bold", pad=15)
    ax.axis("off")
    _save(fig, filename)
    print(f"    (no data — placeholder saved)")


def _bar_value_labels(ax, bars, values, fmt="{:,}", offset_ratio=0.02):
    """막대 위에 값 레이블 추가"""
    max_val = max(v for v in values if v == v) or 1
    for bar, val in zip(bars, values):
        ax.text(
            bar.get_x() + bar.get_width() / 2,
            bar.get_height() + max_val * offset_ratio,
            fmt.format(int(val)),
            ha="center", va="bottom", fontsize=9
        )


def _hbar_value_labels(ax, bars, labels):
    """가로 막대 옆에 값 레이블 추가"""
    for bar, label in zip(bars, labels):
        ax.text(
            bar.get_width() + ax.get_xlim()[1] * 0.01,
            bar.get_y() + bar.get_height() / 2,
            label,
            va="center", fontsize=9
        )


# ── 차트 1: 카테고리별 매출 ────────────────────────────────────────────────


def chart_category_sales(df):
    cat_rev = df.groupby("category")["revenue"].sum().sort_values(ascending=False)

    fig, ax = plt.subplots(figsize=(8, 5))
    colors = PALETTE[:len(cat_rev)]
    bars = ax.bar(cat_rev.index, cat_rev.values, color=colors, width=0.55)

    ax.set_title("카테고리별 총 매출액", fontsize=14, fontweight="bold", pad=15)
    ax.set_xlabel("카테고리", fontsize=11)
    ax.set_ylabel("매출액 (원)", fontsize=11)
    ax.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, _: f"{int(x):,}"))
    ax.set_ylim(0, cat_rev.max() * 1.22)
    ax.spines[["top", "right"]].set_visible(False)
    _bar_value_labels(ax, bars, cat_rev.values)

    _save(fig, "category_sales.png")


# ── 차트 2: 지역별 매출 ────────────────────────────────────────────────────


def chart_region_sales(df):
    reg_rev = df.groupby("region")["revenue"].sum().sort_values(ascending=False)

    fig, ax = plt.subplots(figsize=(8, 5))
    colors = PALETTE[:len(reg_rev)]
    bars = ax.bar(reg_rev.index, reg_rev.values, color=colors, width=0.55)

    ax.set_title("지역별 총 매출액", fontsize=14, fontweight="bold", pad=15)
    ax.set_xlabel("지역", fontsize=11)
    ax.set_ylabel("매출액 (원)", fontsize=11)
    ax.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, _: f"{int(x):,}"))
    ax.set_ylim(0, reg_rev.max() * 1.22)
    ax.spines[["top", "right"]].set_visible(False)
    _bar_value_labels(ax, bars, reg_rev.values)

    _save(fig, "region_sales.png")


# ── 차트 3: 이상 유형별 건수 ───────────────────────────────────────────────


def chart_anomaly_type_count(anomaly_df):
    if anomaly_df.empty:
        _no_data_chart("anomaly_type_count.png", "Anomaly Count by Type")
        return

    type_kr = {
        "sales_spike":         "판매 급증",
        "sales_drop":          "판매 급감",
        "out_of_stock":        "재고 소진 (품절)",
        "stockout_risk":       "재고 부족 위험",
        "no_sales_with_stock": "재고있음+판매없음",
    }
    counts = anomaly_df["anomaly_type"].value_counts().sort_values()
    counts.index = counts.index.map(lambda x: type_kr.get(x, x))
    colors = ["#e74c3c" if "재고 소진" in t or "재고 부족" in t
              else "#f39c12" if "급감" in t or "판매없음" in t
              else "#4C72B0"
              for t in counts.index]

    fig, ax = plt.subplots(figsize=(8, 5))
    bars = ax.barh(counts.index, counts.values, color=colors, height=0.55)

    ax.set_title("이상 유형별 탐지 건수", fontsize=14, fontweight="bold", pad=15)
    ax.set_xlabel("건수", fontsize=11)
    ax.set_ylabel("이상 유형", fontsize=11)
    ax.set_xlim(0, counts.max() * 1.25)
    ax.spines[["top", "right"]].set_visible(False)
    _hbar_value_labels(ax, bars, [str(int(v)) for v in counts.values])

    _save(fig, "anomaly_type_count.png")


# ── 차트 4: 재고 부족 위험 TOP 상품 ───────────────────────────────────────


def chart_stock_risk_top(anomaly_df, processed_df):
    """
    out_of_stock / stockout_risk 상품의 days_of_stock을 시각화.
    product_id를 축 레이블로 사용 (한글 깨짐 방지).
    """
    subset = anomaly_df[
        anomaly_df["anomaly_type"].isin(["out_of_stock", "stockout_risk"])
    ].copy()

    if subset.empty:
        _no_data_chart("stock_risk_top.png", "Stock Risk - Top Products")
        return

    # 상품 ID 기준 가장 위험한 것 우선 (days_of_stock 오름차순)
    subset = (
        subset.sort_values("days_of_stock", ascending=False)
        .drop_duplicates("product_id")
        .sort_values("days_of_stock")
    )

    colors = ["#e74c3c" if t == "out_of_stock" else "#f39c12"
              for t in subset["anomaly_type"]]

    # 0일인 경우 bar가 안 보이므로 최소 0.15 확보
    bar_values = subset["days_of_stock"].fillna(0).clip(lower=0.15)

    fig, ax = plt.subplots(figsize=(9, max(4, len(subset) * 1.2)))
    bars = ax.barh(subset["product_id"], bar_values, color=colors, height=0.55)

    # 위험 기준선
    ax.axvline(x=3, color="#e74c3c", linestyle="--", linewidth=1.5,
               label="위험 기준선 (3일)")

    ax.set_title("재고 부족/품절 위험 상품 (잔여 재고 일수)",
                 fontsize=13, fontweight="bold", pad=15)
    ax.set_xlabel("잔여 재고 일수 (일)", fontsize=11)
    ax.set_ylabel("상품 ID", fontsize=11)
    ax.legend(fontsize=10)
    ax.spines[["top", "right"]].set_visible(False)

    # 레이블: 품절 또는 X.X일 / 평균 Y개/일
    labels = []
    for _, row in subset.iterrows():
        avg = row.get("avg_daily_sales", 0)
        if row["anomaly_type"] == "out_of_stock":
            labels.append(f"품절  (평균 {avg:.0f}개/일)")
        else:
            labels.append(f"{row['days_of_stock']:.1f}일  (평균 {avg:.0f}개/일)")
    _hbar_value_labels(ax, bars, labels)

    # 범례용 패치
    from matplotlib.patches import Patch
    legend_elements = [
        Patch(facecolor="#e74c3c", label="재고 소진 (품절)"),
        Patch(facecolor="#f39c12", label="재고 부족 위험"),
    ]
    ax.legend(handles=legend_elements + ax.get_legend_handles_labels()[0][len(legend_elements):],
              fontsize=9, loc="lower right")

    _save(fig, "stock_risk_top.png")


# ── 차트 5: 예상 매출 손실 TOP 상품 ───────────────────────────────────────


def chart_lost_sales_top(anomaly_df):
    """
    estimated_lost_sales가 있는 상품의 하루 예상 손실을 시각화.
    product_id를 축 레이블로 사용 (한글 깨짐 방지).
    """
    subset = anomaly_df[anomaly_df["estimated_lost_sales"] > 0].copy()

    if subset.empty:
        _no_data_chart("lost_sales_top.png", "Estimated Lost Sales — Top Products")
        return

    # 상품별 최대 손실 (동일 상품이 여러 행일 경우 최댓값)
    top = (
        subset.groupby("product_id")["estimated_lost_sales"]
        .max()
        .sort_values(ascending=True)
    )

    threshold = 1_000_000
    colors = ["#c0392b" if v >= threshold else "#e67e22" for v in top.values]

    fig, ax = plt.subplots(figsize=(9, max(4, len(top) * 1.2)))
    bars = ax.barh(top.index, top.values, color=colors, height=0.55)

    ax.set_title("예상 매출 손실 TOP 상품 (일 기준)",
                 fontsize=13, fontweight="bold", pad=15)
    ax.set_xlabel("예상 손실액 (원/일)", fontsize=11)
    ax.set_ylabel("상품 ID", fontsize=11)
    ax.xaxis.set_major_formatter(plt.FuncFormatter(lambda x, _: f"{int(x):,}"))
    ax.spines[["top", "right"]].set_visible(False)

    labels = [f"{int(v):,}원" for v in top.values]
    _hbar_value_labels(ax, bars, labels)

    _save(fig, "lost_sales_top.png")


# ── 실행 진입점 ────────────────────────────────────────────────────────────


def run():
    print("=" * 55)
    print("  [시각화] 차트 생성")
    print("=" * 55)
    print()

    # 파일 존재 확인
    for path in [PROCESSED_PATH, ANOMALY_PATH]:
        if not os.path.exists(path):
            print(f"[오류] 파일을 찾을 수 없어요: {path}")
            print("  → main.py를 먼저 실행해주세요.")
            sys.exit(1)

    df = pd.read_csv(PROCESSED_PATH, parse_dates=["date"])
    anomaly_df = pd.read_csv(ANOMALY_PATH)

    # anomaly_result가 구버전(컬럼 없음)이면 안전하게 빈 값 처리
    for col in ["z_score", "days_of_stock", "avg_daily_sales", "estimated_lost_sales"]:
        if col not in anomaly_df.columns:
            anomaly_df[col] = None

    _setup_font()

    print("  [1/5] Revenue by Category...")
    chart_category_sales(df)

    print("  [2/5] Revenue by Region...")
    chart_region_sales(df)

    print("  [3/5] Anomaly Count by Type...")
    chart_anomaly_type_count(anomaly_df)

    print("  [4/5] Stock Risk Top Products...")
    chart_stock_risk_top(anomaly_df, df)

    print("  [5/5] Estimated Lost Sales Top Products...")
    chart_lost_sales_top(anomaly_df)

    print()
    print(f"  모든 차트 저장 완료: {CHART_DIR}/")
    print()

    return True


if __name__ == "__main__":
    run()
