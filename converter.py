from pathlib import Path
import pandas as pd
import json
import re

RAW_DIR = Path("raw-xlsx")
OUT_DIR = Path("docs/data/assemblies")
INDEX_FILE = Path("docs/data/index.json")

OUT_DIR.mkdir(parents=True, exist_ok=True)

def slugify(text):
    text = str(text).strip().lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")

def parse_filename(path):
    """
    Example:
    185Uttarpara_2026_Form20.xlsx
    → ac_no = 185, assembly = Uttarpara
    """
    name = path.stem
    match = re.match(r"^(\d+)\s*([A-Za-z ]+)", name)
    if not match:
        raise ValueError(f"Cannot parse AC number and name from filename: {path.name}")

    ac_no = int(match.group(1))
    assembly = match.group(2).strip().replace("_", " ")
    return ac_no, assembly

def clean_value(value):
    if pd.isna(value):
        return ""
    if isinstance(value, float) and value.is_integer():
        return int(value)
    return value

def normalize_columns(df):
    """
    Creates helper columns for filtering without removing original columns.
    """
    columns = list(df.columns)

    def find_col(possible_names):
        for col in columns:
            clean_col = str(col).strip().lower().replace(".", "").replace(" ", "")
            for name in possible_names:
                clean_name = name.lower().replace(".", "").replace(" ", "")
                if clean_col == clean_name:
                    return col
        return None

    ps_col = find_col(["PS No", "PS. No.", "Ps No."])
    booth_col = find_col(["booth_name", "Booth Name", "PS Name"])
    municipality_col = find_col(["Municipality"])
    ward_col = find_col(["Ward"])
    panchayat_col = find_col(["Panchayat", "Panchayat or GP", "GP"])

    df["_ps_no"] = df[ps_col] if ps_col else ""
    df["_booth_name"] = df[booth_col] if booth_col else ""
    df["_municipality"] = df[municipality_col] if municipality_col else ""
    df["_ward"] = df[ward_col] if ward_col else ""
    df["_panchayat"] = df[panchayat_col] if panchayat_col else ""

    return df

index = []

for file in sorted(RAW_DIR.glob("*.xlsx")):
    ac_no, assembly = parse_filename(file)

    df = pd.read_excel(file)
    df = normalize_columns(df)

    #df = df.map(clean_value)
    df = df.apply(lambda col: col.map(clean_value))

    assembly_slug = f"{ac_no}-{slugify(assembly)}"
    out_file = OUT_DIR / f"{assembly_slug}.json"

    records = df.to_dict(orient="records")

    data = {
        "ac_no": ac_no,
        "assembly": assembly,
        "columns": list(df.columns),
        "records": records
    }

    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)

    index.append({
        "ac_no": ac_no,
        "assembly": assembly,
        "file": f"data/assemblies/{assembly_slug}.json"
    })

index.sort(key=lambda x: int(x["ac_no"]))

with open(INDEX_FILE, "w", encoding="utf-8") as f:
    json.dump(index, f, ensure_ascii=False, indent=2)

print(f"Converted {len(index)} Excel files.")
