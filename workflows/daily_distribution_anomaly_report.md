# Workflow: Daily Distribution Anomaly Report

## 목표

유통 판매 데이터를 분석하여 이상 판매, 재고 부족 위험, 장기 미판매 상품을 탐지하고 Markdown 리포트를 생성한다.

## 입력

- data/raw/sales_sample.csv

## 실행 Tool

1. tools/preprocess_sales.py
2. tools/detect_anomaly.py
3. tools/generate_report.py

## 출력

- data/processed/sales_processed.csv
- data/processed/anomaly_result.csv
- output/charts/category_sales.png
- output/charts/stock_risk.png
- output/reports/daily_report.md

## 분석 항목

1. 일자별 판매량
2. 카테고리별 매출
3. 판매량 급증/급감 상품
4. 재고 부족 위험 상품
5. 장기 미판매 상품
6. 자동 인사이트 요약

## 실패 시 처리

- CSV가 없으면 필요한 파일 경로를 알려준다.
- 필수 컬럼이 없으면 부족한 컬럼명을 출력한다.
- output 폴더가 없으면 자동 생성한다.
