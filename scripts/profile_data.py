from __future__ import annotations

from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
RAW_DIRS = [
    ROOT / "data" / "raw" / "base_ideal",
    ROOT / "data" / "raw" / "bases_fuente",
]
REPORT_PATH = ROOT / "reports" / "data_profile.xlsx"


def list_input_files() -> list[Path]:
    extensions = {".csv", ".xlsx", ".xls", ".xlsm", ".parquet"}
    files: list[Path] = []
    for folder in RAW_DIRS:
        if folder.exists():
            files.extend(path for path in folder.rglob("*") if path.suffix.lower() in extensions)
    return sorted(files)


def read_preview(path: Path, sheet_name: str | int | None = None) -> pd.DataFrame:
    suffix = path.suffix.lower()
    if suffix == ".csv":
        return pd.read_csv(path, nrows=200)
    if suffix in {".xlsx", ".xls", ".xlsm"}:
        return pd.read_excel(path, sheet_name=sheet_name or 0, nrows=200)
    if suffix == ".parquet":
        return pd.read_parquet(path).head(200)
    raise ValueError(f"Formato no soportado: {path}")


def excel_sheets(path: Path) -> list[str]:
    if path.suffix.lower() not in {".xlsx", ".xls", ".xlsm"}:
        return ["__single_table__"]
    return pd.ExcelFile(path).sheet_names


def profile_dataframe(path: Path, sheet: str, df: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for column in df.columns:
        series = df[column]
        rows.append(
            {
                "archivo": str(path.relative_to(ROOT)),
                "hoja": sheet,
                "columna": column,
                "tipo_detectado": str(series.dtype),
                "n_muestra": len(series),
                "nulos_muestra": int(series.isna().sum()),
                "unicos_muestra": int(series.nunique(dropna=True)),
                "ejemplos": " | ".join(
                    series.dropna().astype(str).drop_duplicates().head(5).tolist()
                ),
            }
        )
    return pd.DataFrame(rows)


def main() -> None:
    files = list_input_files()
    if not files:
        print("No encontre archivos en data/raw/base_ideal o data/raw/bases_fuente.")
        return

    profiles = []
    inventory = []

    for path in files:
        sheets = excel_sheets(path)
        for sheet in sheets:
            df = read_preview(path, None if sheet == "__single_table__" else sheet)
            inventory.append(
                {
                    "archivo": str(path.relative_to(ROOT)),
                    "hoja": sheet,
                    "filas_muestra": len(df),
                    "columnas": len(df.columns),
                }
            )
            profiles.append(profile_dataframe(path, sheet, df))

    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with pd.ExcelWriter(REPORT_PATH, engine="openpyxl") as writer:
        pd.DataFrame(inventory).to_excel(writer, sheet_name="archivos", index=False)
        pd.concat(profiles, ignore_index=True).to_excel(
            writer, sheet_name="columnas", index=False
        )

    print(f"Reporte generado: {REPORT_PATH}")


if __name__ == "__main__":
    main()

