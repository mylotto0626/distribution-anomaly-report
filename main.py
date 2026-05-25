import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from tools.preprocess_sales import run as preprocess
from tools.detect_anomaly import run as detect
from tools.generate_report import run as generate
from tools.visualize import run as visualize
from tools.export_dashboard_data import run as export_dashboard


def main():
    print()
    print("=" * 55)
    print("  유통 판매 이상 탐지 시스템")
    print("=" * 55)
    print()

    preprocess()
    detect()
    generate()
    visualize()
    export_dashboard()

    print("=" * 55)
    print("  모든 작업 완료!")
    print("  결과물 위치:")
    print("    data/processed/sales_processed.csv")
    print("    data/processed/anomaly_result.csv")
    print("    output/reports/daily_report.md")
    print("    output/charts/category_sales.png")
    print("    output/charts/region_sales.png")
    print("    output/charts/anomaly_type_count.png")
    print("    output/charts/stock_risk_top.png")
    print("    output/charts/lost_sales_top.png")
    print("    output/dashboard_data.json")
    print("    dashboard/public/dashboard_data.json")
    print("=" * 55)
    print()


if __name__ == "__main__":
    main()
