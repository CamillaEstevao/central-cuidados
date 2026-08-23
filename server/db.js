import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, "../data");
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, "central-cuidados.db"));
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS appointments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  specialty TEXT,
  professional TEXT,
  place TEXT,
  address TEXT,
  date TEXT NOT NULL,
  time TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'upcoming',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS medications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  dose TEXT,
  frequency TEXT,
  schedule_json TEXT DEFAULT '[]',
  prescription_text TEXT,
  stock INTEGER,
  stock_unit TEXT DEFAULT 'unidades',
  low_stock_threshold INTEGER DEFAULT 7,
  active INTEGER DEFAULT 1,
  needs_schedule_confirmation INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS medication_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  medication_id INTEGER NOT NULL,
  scheduled_at TEXT,
  taken_at TEXT,
  status TEXT NOT NULL DEFAULT 'taken',
  notes TEXT,
  FOREIGN KEY (medication_id) REFERENCES medications(id)
);

CREATE TABLE IF NOT EXISTS reminders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  due_date TEXT NOT NULL,
  due_time TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  amount REAL NOT NULL,
  payment_method TEXT,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS glucose_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  measured_at TEXT NOT NULL,
  value INTEGER NOT NULL,
  suggested_units INTEGER,
  notes TEXT
);
`);

const hasSeed = db.prepare("SELECT COUNT(*) c FROM medications").get().c > 0;

if (!hasSeed) {
  const insert = db.prepare(`
    INSERT INTO medications
    (name, dose, frequency, schedule_json, prescription_text, stock, stock_unit, needs_schedule_confirmation)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const meds = [
    ["Insulina Humana NPH 100 UI/mL", "6 UI cedo / 4 UI após almoço", "2x ao dia", JSON.stringify([]), "Aplicar 6 UI cedo e 4 UI após o almoço.", null, "UI", 1],
    ["Ácido acetilsalicílico 100 mg", "1 comprimido", "1x ao dia", JSON.stringify([]), "Tomar 1 comprimido após o almoço.", null, "comprimidos", 1],
    ["Hidroclorotiazida 25 mg", "1 comprimido", "1x ao dia", JSON.stringify([]), "Tomar 1 comprimido cedo.", null, "comprimidos", 1],
    ["Captopril 25 mg", "1 comprimido", "A cada 12 horas", JSON.stringify([]), "Tomar 1 comprimido a cada 12 horas.", null, "comprimidos", 1],
    ["Metformina 500 mg XR", "1 comprimido", "A cada 12 horas", JSON.stringify([]), "Tomar 1 comprimido a cada 12 horas.", null, "comprimidos", 1],
    ["Insulina Humana Regular 100 UI/mL", "Conforme glicemia", "Conforme escala", JSON.stringify([]), "Registrar glicemia e seguir a escala prescrita.", null, "UI", 1],
    ["Dapagliflozina 10 mg", "1 comprimido", "1x ao dia", JSON.stringify([]), "Tomar 1 comprimido pela manhã.", null, "comprimidos", 1],
    ["Losartana 50 mg", "1 comprimido", "1x ao dia", JSON.stringify([]), "Tomar 1 comprimido 1x ao dia.", null, "comprimidos", 1],
    ["Sinvastatina 40 mg", "1 comprimido", "1x ao dia", JSON.stringify([]), "Tomar 1 comprimido à noite.", null, "comprimidos", 1],
    ["Valproato de sódio 500 mg", "1 comprimido", "1x ao dia", JSON.stringify([]), "Tomar 1 comprimido à noite. Uso contínuo.", null, "comprimidos", 1],
    ["Retinol (Vit. A) + Colecalciferol (Vit. D)", "5 gotas", "1x ao dia", JSON.stringify([]), "Tomar 5 gotas por dia. Uso contínuo.", null, "gotas", 1]
  ];
  const tx = db.transaction(() => meds.forEach(m => insert.run(...m)));
  tx();
}

export default db;
