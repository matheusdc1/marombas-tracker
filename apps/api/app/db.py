import os
import sqlite3
from pathlib import Path

from .taco_seed import FOODS

DEFAULT_DB = Path(__file__).resolve().parent.parent / "data" / "marombas.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS foods (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    kcal REAL NOT NULL,
    protein_g REAL NOT NULL,
    carbs_g REAL NOT NULL,
    fat_g REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS meals (
    id INTEGER PRIMARY KEY,
    day TEXT NOT NULL,
    food_id INTEGER NOT NULL REFERENCES foods(id),
    grams REAL NOT NULL,
    meal_type TEXT NOT NULL DEFAULT 'Almoço'
);
CREATE TABLE IF NOT EXISTS workout_sets (
    id INTEGER PRIMARY KEY,
    day TEXT NOT NULL,
    exercise TEXT NOT NULL,
    sets INTEGER NOT NULL,
    reps INTEGER NOT NULL,
    weight_kg REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS goals (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    kcal REAL NOT NULL,
    protein_g REAL NOT NULL,
    water_ml REAL NOT NULL DEFAULT 4000,
    carbs_g REAL NOT NULL DEFAULT 300,
    fat_g REAL NOT NULL DEFAULT 70
);
CREATE TABLE IF NOT EXISTS water (
    id INTEGER PRIMARY KEY,
    day TEXT NOT NULL,
    ml REAL NOT NULL
);
"""


def db_path() -> Path:
    return Path(os.environ.get("MAROMBAS_DB", DEFAULT_DB))


def connect() -> sqlite3.Connection:
    path = db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    # check_same_thread=False: o FastAPI roda dependency e endpoint sync em
    # threads distintas do pool; a conexao e por-request (uso sequencial), seguro.
    conn = sqlite3.connect(path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    init(conn)
    return conn


def init(conn: sqlite3.Connection) -> None:
    conn.executescript(SCHEMA)
    if conn.execute("SELECT COUNT(*) FROM foods").fetchone()[0] == 0:
        conn.executemany(
            "INSERT INTO foods (name, kcal, protein_g, carbs_g, fat_g) VALUES (?, ?, ?, ?, ?)",
            FOODS,
        )
    # migracoes: bancos criados antes de cada coluna nova
    _ensure_column(conn, "goals", "water_ml REAL NOT NULL DEFAULT 4000")
    _ensure_column(conn, "goals", "carbs_g REAL NOT NULL DEFAULT 300")
    _ensure_column(conn, "goals", "fat_g REAL NOT NULL DEFAULT 70")
    _ensure_column(conn, "meals", "meal_type TEXT NOT NULL DEFAULT 'Almoço'")
    conn.execute(
        "INSERT OR IGNORE INTO goals (id, kcal, protein_g, water_ml, carbs_g, fat_g)"
        " VALUES (1, 2500, 150, 4000, 300, 70)"
    )
    conn.commit()


def _ensure_column(conn: sqlite3.Connection, table: str, ddl: str) -> None:
    try:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {ddl}")
    except sqlite3.OperationalError:
        pass  # coluna ja existe


def get_db():
    conn = connect()
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()
