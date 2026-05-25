import pandas as pd
import os
import sys

INPUT_PATH = "data/raw/sales_sample.csv"
OUTPUT_PATH = "data/processed/sales_processed.csv"

REQUIRED_COLUMNS = [
    "date", "product_id", "product_name",
    "category", "region", "sales_qty", "stock_qty", "unit_price"
]


def run():
    print("=" * 55)
    print("  [1단계] 데이터 전처리")
    print("=" * 55)

    # 입력 파일 확인
    if not os.path.exists(INPUT_PATH):
        print(f"\n[오류] 파일을 찾을 수 없어요: {INPUT_PATH}")
        print("  해결 방법: data/raw/ 폴더 안에 sales_sample.csv 파일이 있는지 확인해주세요.")
        sys.exit(1)

    # CSV 불러오기 (한글 인코딩 자동 처리)
    try:
        df = pd.read_csv(INPUT_PATH, encoding="utf-8")
    except UnicodeDecodeError:
        df = pd.read_csv(INPUT_PATH, encoding="cp949")

    print(f"  파일 읽기 완료: {len(df)}행")

    # 필수 컬럼 확인
    missing = [col for col in REQUIRED_COLUMNS if col not in df.columns]
    if missing:
        print(f"\n[오류] CSV에 다음 컬럼이 없어요: {missing}")
        print(f"  현재 파일의 컬럼: {list(df.columns)}")
        print("  → 파일을 열어서 컬럼 이름을 확인해주세요.")
        sys.exit(1)

    # 날짜 변환
    df["date"] = pd.to_datetime(df["date"])

    # 매출액 계산 (판매량 × 단가)
    df["revenue"] = df["sales_qty"] * df["unit_price"]

    # 결측값 처리
    numeric_cols = ["sales_qty", "stock_qty", "unit_price"]
    null_counts = df[numeric_cols].isnull().sum()
    if null_counts.sum() > 0:
        print(f"  [주의] 빈 값 발견 → 0으로 채웁니다: {null_counts[null_counts > 0].to_dict()}")
        df[numeric_cols] = df[numeric_cols].fillna(0)

    # 날짜·상품 순서로 정렬
    df = df.sort_values(["date", "product_id"]).reset_index(drop=True)

    # 출력 폴더 생성
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)

    # 저장
    df.to_csv(OUTPUT_PATH, index=False, encoding="utf-8-sig")

    date_min = df["date"].min().strftime("%Y-%m-%d")
    date_max = df["date"].max().strftime("%Y-%m-%d")
    print(f"  분석 기간: {date_min} ~ {date_max}  ({df['date'].nunique()}일)")
    print(f"  상품 종류: {df['product_id'].nunique()}개")
    print(f"  저장 완료: {OUTPUT_PATH}")
    print()

    return df


if __name__ == "__main__":
    run()
