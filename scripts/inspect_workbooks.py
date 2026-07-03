import openpyxl, sys, glob, os

for path in sorted(glob.glob("reference/source-workbooks/*.xlsx")):
    print("=" * 70)
    print(os.path.basename(path))
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    for ws in wb.worksheets:
        dims = ws.calculate_dimension()
        # header row = first row
        rows = ws.iter_rows(min_row=1, max_row=1, values_only=True)
        header = next(rows, None)
        print(f"  sheet '{ws.title}'  dims={dims}")
        if header:
            print("     header:", [str(c)[:20] for c in header][:15])
    wb.close()
