import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import db from "./db.js";

const app = express();
const PORT = process.env.PORT || 3333;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(cors());
app.use(express.json());

const parseMed = row => row ? ({...row, schedule: JSON.parse(row.schedule_json || "[]")}) : row;

app.get("/api/health", (_, res) => res.json({ ok: true }));

app.get("/api/dashboard", (req, res) => {
  const today = new Date().toISOString().slice(0,10);
  const month = today.slice(0,7);

  const nextAppointment = db.prepare(`
    SELECT * FROM appointments
    WHERE status='upcoming' AND date >= ?
    ORDER BY date ASC, COALESCE(time,'23:59') ASC LIMIT 1
  `).get(today);

  const pendingReminders = db.prepare(`
    SELECT COUNT(*) c FROM reminders
    WHERE status='pending'
  `).get().c;

  const monthExpenses = db.prepare(`
    SELECT COALESCE(SUM(amount),0) total FROM expenses WHERE substr(date,1,7)=?
  `).get(month).total;

  const upcomingCount = db.prepare(`
    SELECT COUNT(*) c FROM appointments
    WHERE status='upcoming' AND date >= ? AND date <= date(?, '+30 days')
  `).get(today, today).c;

  res.json({ nextAppointment, pendingReminders, monthExpenses, upcomingCount });
});

function crud(table, fields) {
  app.get(`/api/${table}`, (req,res) => {
    let order = "id DESC";
    if (table === "appointments") order = "date ASC, time ASC";
    if (table === "reminders") order = "due_date ASC, due_time ASC";
    if (table === "expenses") order = "date DESC, id DESC";
    res.json(db.prepare(`SELECT * FROM ${table} ORDER BY ${order}`).all());
  });

  app.post(`/api/${table}`, (req,res) => {
    const data = req.body;
    const keys = fields.filter(k => data[k] !== undefined);
    const stmt = db.prepare(`INSERT INTO ${table} (${keys.join(",")}) VALUES (${keys.map(()=>"?").join(",")})`);
    const info = stmt.run(...keys.map(k=>data[k]));
    res.status(201).json(db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(info.lastInsertRowid));
  });

  app.put(`/api/${table}/:id`, (req,res) => {
    const data = req.body;
    const keys = fields.filter(k => data[k] !== undefined);
    if (!keys.length) return res.status(400).json({error:"Nada para atualizar"});
    db.prepare(`UPDATE ${table} SET ${keys.map(k=>`${k}=?`).join(",")} WHERE id=?`)
      .run(...keys.map(k=>data[k]), req.params.id);
    res.json(db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(req.params.id));
  });

  app.delete(`/api/${table}/:id`, (req,res) => {
    db.prepare(`DELETE FROM ${table} WHERE id=?`).run(req.params.id);
    res.status(204).end();
  });
}

crud("appointments", ["title","specialty","professional","place","address","date","time","notes","status"]);
crud("reminders", ["title","due_date","due_time","notes","status"]);
crud("expenses", ["date","category","description","amount","payment_method","notes"]);

app.get("/api/medications", (req,res) => {
  res.json(db.prepare("SELECT * FROM medications WHERE active=1 ORDER BY name").all().map(parseMed));
});

app.post("/api/medications", (req,res) => {
  const {name,dose,frequency,schedule=[],prescription_text="",stock=null,stock_unit="unidades",low_stock_threshold=7,needs_schedule_confirmation=0} = req.body;
  const info = db.prepare(`
    INSERT INTO medications
    (name,dose,frequency,schedule_json,prescription_text,stock,stock_unit,low_stock_threshold,needs_schedule_confirmation)
    VALUES (?,?,?,?,?,?,?,?,?)
  `).run(name,dose,frequency,JSON.stringify(schedule),prescription_text,stock,stock_unit,low_stock_threshold,needs_schedule_confirmation);
  res.status(201).json(parseMed(db.prepare("SELECT * FROM medications WHERE id=?").get(info.lastInsertRowid)));
});

app.put("/api/medications/:id", (req,res) => {
  const current = db.prepare("SELECT * FROM medications WHERE id=?").get(req.params.id);
  if (!current) return res.status(404).json({error:"Medicamento não encontrado"});
  const next = {
    name: req.body.name ?? current.name,
    dose: req.body.dose ?? current.dose,
    frequency: req.body.frequency ?? current.frequency,
    schedule: req.body.schedule ?? JSON.parse(current.schedule_json || "[]"),
    prescription_text: req.body.prescription_text ?? current.prescription_text,
    stock: req.body.stock ?? current.stock,
    stock_unit: req.body.stock_unit ?? current.stock_unit,
    low_stock_threshold: req.body.low_stock_threshold ?? current.low_stock_threshold,
    needs_schedule_confirmation: req.body.needs_schedule_confirmation ?? current.needs_schedule_confirmation,
    active: req.body.active ?? current.active
  };
  db.prepare(`
    UPDATE medications SET name=?,dose=?,frequency=?,schedule_json=?,prescription_text=?,stock=?,stock_unit=?,low_stock_threshold=?,needs_schedule_confirmation=?,active=?
    WHERE id=?
  `).run(next.name,next.dose,next.frequency,JSON.stringify(next.schedule),next.prescription_text,next.stock,next.stock_unit,next.low_stock_threshold,next.needs_schedule_confirmation,next.active,req.params.id);
  res.json(parseMed(db.prepare("SELECT * FROM medications WHERE id=?").get(req.params.id)));
});

app.post("/api/medication-logs", (req,res) => {
  const {medication_id, scheduled_at, taken_at=new Date().toISOString(), status="taken", notes=""} = req.body;
  const info = db.prepare(`
    INSERT INTO medication_logs (medication_id,scheduled_at,taken_at,status,notes)
    VALUES (?,?,?,?,?)
  `).run(medication_id,scheduled_at,taken_at,status,notes);
  res.status(201).json(db.prepare("SELECT * FROM medication_logs WHERE id=?").get(info.lastInsertRowid));
});

app.get("/api/medication-logs", (req,res) => {
  const rows = db.prepare(`
    SELECT l.*, m.name medication_name, m.dose
    FROM medication_logs l JOIN medications m ON m.id=l.medication_id
    ORDER BY COALESCE(taken_at, scheduled_at) DESC LIMIT 500
  `).all();
  res.json(rows);
});

const insulinScale = [
  {min: 180, max: 250, units: 3},
  {min: 251, max: 300, units: 6},
  {min: 301, max: 350, units: 8},
  {min: 351, max: 400, units: 10},
  {min: 401, max: Infinity, units: 12}
];

app.post("/api/glucose", (req,res) => {
  const value = Number(req.body.value);
  if (!Number.isFinite(value) || value <= 0) return res.status(400).json({error:"Glicemia inválida"});
  let suggested_units = null;
  if (value >= 71 && value < 180) suggested_units = 0;
  else {
    const band = insulinScale.find(b => value >= b.min && value <= b.max);
    if (band) suggested_units = band.units;
  }
  const measured_at = req.body.measured_at || new Date().toISOString();
  const notes = req.body.notes || "";
  const info = db.prepare("INSERT INTO glucose_logs(measured_at,value,suggested_units,notes) VALUES(?,?,?,?)")
    .run(measured_at,value,suggested_units,notes);
  res.status(201).json({...db.prepare("SELECT * FROM glucose_logs WHERE id=?").get(info.lastInsertRowid),
    warning: value < 71 ? "A receita indica oferecer suco doce em caso de hipoglicemia; confirme a conduta com a equipe de saúde." :
             value > 400 ? "A receita indica dose máxima da escala e orientação adicional. Confirme a conduta com a equipe de saúde." : null
  });
});

app.get("/api/history", (req,res) => {
  const limit = Math.min(Number(req.query.limit || 100), 500);
  const events = [];

  db.prepare("SELECT * FROM expenses ORDER BY date DESC LIMIT ?").all(limit).forEach(x =>
    events.push({type:"expense", date:x.date, title:"Gasto adicionado", subtitle:`${x.description} • R$ ${Number(x.amount).toFixed(2)}`})
  );
  db.prepare("SELECT * FROM appointments WHERE status!='upcoming' ORDER BY date DESC LIMIT ?").all(limit).forEach(x =>
    events.push({type:"appointment", date:x.date, title:x.status==="completed"?"Consulta realizada":"Consulta atualizada", subtitle:x.title})
  );
  db.prepare(`
    SELECT l.*,m.name FROM medication_logs l JOIN medications m ON m.id=l.medication_id
    ORDER BY COALESCE(l.taken_at,l.scheduled_at) DESC LIMIT ?
  `).all(limit).forEach(x =>
    events.push({type:"medication", date:(x.taken_at||x.scheduled_at||"").slice(0,10), title:"Medicamento tomado", subtitle:x.name})
  );

  events.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  res.json(events.slice(0,limit));
});

const dist = path.resolve(__dirname, "../client/dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get("*", (_,res)=>res.sendFile(path.join(dist,"index.html")));
}

app.listen(PORT, () => console.log(`Central de Cuidados API em http://localhost:${PORT}`));
