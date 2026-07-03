import openpyxl, glob, os, datetime, json
from collections import defaultdict

# The 4 "Transactions" source sheets (see PRD §6).
SHEETS = [
    ("reference/source-workbooks/2022-budget.xlsx", "Transactions 2023 "),
    ("reference/source-workbooks/2022-budget.xlsx", "Transactions -2024"),
    ("reference/source-workbooks/2024-budget.xlsx", "Transactions"),
    ("reference/source-workbooks/2026-budget-v1.2.xlsx", "New"),
]

def year_of(v):
    if isinstance(v, (datetime.datetime, datetime.date)):
        return v.year
    if isinstance(v, str):
        s = v.strip()
        for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d %b %y", "%d/%m/%y", "%d %B %Y"):
            try:
                return datetime.datetime.strptime(s, fmt).year
            except ValueError:
                pass
    return None

by_year_count = defaultdict(int)
by_year_sum = defaultdict(float)
grand_n = 0
grand_sum = 0.0

for path, sheet in SHEETS:
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb[sheet]
    header = None
    for row in ws.iter_rows(values_only=True):
        if header is None:
            header = [str(c).strip() if c is not None else "" for c in row]
            di = header.index("Date")
            ai = header.index("Amount")
            continue
        date = row[di] if di < len(row) else None
        amt = row[ai] if ai < len(row) else None
        if date is None and amt is None:
            continue
        y = year_of(date)
        try:
            a = float(amt)
        except (TypeError, ValueError):
            continue
        if y is None:
            continue
        by_year_count[y] += 1
        by_year_sum[y] += a
        grand_n += 1
        grand_sum += a
    wb.close()

out = {
    "by_year": {str(y): {"count": by_year_count[y], "sum": round(by_year_sum[y], 2)} for y in sorted(by_year_count)},
    "grand": {"count": grand_n, "sum": round(grand_sum, 2)},
}
print(json.dumps(out, indent=2))
