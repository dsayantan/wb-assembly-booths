from pathlib import Path
import pandas as pd
import json
import re

RAW_DIR = Path("raw-xlsx")
OUT_DIR = Path("docs/data/assemblies")
INDEX_FILE = Path("docs/data/index.json")
DISTRICT_FILE = Path("ACNO2DIST.xlsx")

OUT_DIR.mkdir(parents=True, exist_ok=True)
INDEX_FILE.parent.mkdir(parents=True, exist_ok=True)


def slugify(text):
    text = str(text).strip().lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")


def parse_filename(path):
    """
    Example:
    185Uttarpara_2026_Form20.xlsx
    -> ac_no = 185, assembly = Uttarpara
    """
    name = path.stem
    match = re.match(r"^(\d+)\s*([A-Za-z _\-]+)", name)

    if not match:
        raise ValueError(f"Cannot parse AC number and assembly name from filename: {path.name}")

    ac_no = int(match.group(1))
    assembly = match.group(2).strip().replace("_", " ").replace("-", " ")
    assembly = re.sub(r"\s+", " ", assembly).strip()

    return ac_no, assembly


def clean_value(value):
    if pd.isna(value):
        return ""
    if isinstance(value, float) and value.is_integer():
        return int(value)
    return value


def find_col(columns, possible_names):
    for col in columns:
        clean_col = str(col).strip().lower().replace(".", "").replace(" ", "").replace("_", "")
        for name in possible_names:
            clean_name = name.lower().replace(".", "").replace(" ", "").replace("_", "")
            if clean_col == clean_name:
                return col
    return None


def normalize_columns(df):
    """
    Adds helper columns for website filtering without removing original columns.
    """
    columns = list(df.columns)

    ps_col = find_col(columns, ["PS No", "PS. No.", "Ps No.", "Part No", "Part No."])
    booth_col = find_col(columns, ["booth_name", "Booth Name", "PS Name", "Polling Station Name"])
    municipality_col = find_col(columns, ["Municipality"])
    ward_col = find_col(columns, ["Ward", "Ward No", "Ward No."])
    panchayat_col = find_col(columns, ["Panchayat", "Panchayat or GP", "GP", "Panchayat/GP"])

    df["_ps_no"] = df[ps_col] if ps_col else ""
    df["_booth_name"] = df[booth_col] if booth_col else ""
    df["_municipality"] = df[municipality_col] if municipality_col else ""
    df["_ward"] = df[ward_col] if ward_col else ""
    df["_panchayat"] = df[panchayat_col] if panchayat_col else ""

    return df


def load_district_mapping():
    """
    Reads ACNO2DIST.xlsx and returns {ac_no: district}.
    Supports common header variations such as AC No, ACNO, AC_No, District.
    """
    if not DISTRICT_FILE.exists():
        print("Warning: ACNO2DIST.xlsx not found. Districts will be blank.")
        return {}

    mapping_df = pd.read_excel(DISTRICT_FILE)
    mapping_df.columns = [str(c).strip() for c in mapping_df.columns]
    columns = list(mapping_df.columns)

    ac_col = find_col(columns, ["AC No", "ACNO", "AC_No", "AC", "Assembly No", "Assembly Number"])
    district_col = find_col(columns, ["District", "District Name"])

    if not ac_col or not district_col:
        raise ValueError(
            "Could not find AC No and District columns in ACNO2DIST.xlsx. "
            f"Found columns: {columns}"
        )

    mapping = {}

    for _, row in mapping_df.iterrows():
        if pd.isna(row[ac_col]) or pd.isna(row[district_col]):
            continue

        try:
            ac_no = int(float(row[ac_col]))
        except ValueError:
            continue

        district = str(row[district_col]).strip()
        if district:
            mapping[ac_no] = district

    return mapping


def main():
    if not RAW_DIR.exists():
        raise FileNotFoundError(f"Input folder not found: {RAW_DIR}")

    district_mapping = load_district_mapping()
    index = []

    for file in sorted(RAW_DIR.glob("*.xlsx")):
        if file.name.startswith("~$"):
            continue

        ac_no, assembly = parse_filename(file)

        df = pd.read_excel(file)
        df = normalize_columns(df)

        # Compatible with older pandas versions where DataFrame.map does not exist.
        df = df.apply(lambda col: col.map(clean_value))

        assembly_slug = f"{ac_no}-{slugify(assembly)}"
        out_file = OUT_DIR / f"{assembly_slug}.json"

        records = df.to_dict(orient="records")

        data = {
            "ac_no": ac_no,
            "assembly": assembly,
            "district": district_mapping.get(ac_no, ""),
            "columns": list(df.columns),
            "records": records,
        }

        with open(out_file, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False)

        index.append({
            "ac_no": ac_no,
            "assembly": assembly,
            "district": district_mapping.get(ac_no, ""),
            "file": f"data/assemblies/{assembly_slug}.json",
        })

    index.sort(key=lambda x: int(x["ac_no"]))

    with open(INDEX_FILE, "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, indent=2)

    missing_districts = [item for item in index if not item.get("district")]

    print(f"Converted {len(index)} Excel files.")
    if missing_districts:
        print("Warning: District not found for these ACs:")
        for item in missing_districts:
            print(f"  {item['ac_no']} - {item['assembly']}")


if __name__ == "__main__":
    main()
