import React, { useEffect, useMemo, useState } from "react";
import {
  Home, CalendarDays, Pill, Wallet, Bell, Plus, Check, Clock3, History,
  Syringe, Droplets, AlertTriangle, ChevronRight, LogOut, Smartphone, Trash2,
  FileSpreadsheet, FileText, Share2, NotebookPen, Pin, Stethoscope, Activity
} from "lucide-react";
import { supabase } from "./lib/supabase";
import { list, insert, update } from "./lib/db";
import { enablePush } from "./lib/push";
import Modal from "./components/Modal";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const money = n => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const today = () => new Date().toISOString().slice(0, 10);
const fmtDate = s => s ? new Date(`${s}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "";
const fmtFull = s => s ? new Date(`${s}T12:00:00`).toLocaleDateString("pt-BR") : "";

const appointmentKind = item => {
  if (item?.appointment_type === "exam") return "exam";
  if (item?.appointment_type === "consultation") return "consultation";

  const title = String(item?.title || "").toLowerCase();

  const examWords = [
    "exame","eletro","ecg","ultrassom","ultrassonografia","raio x","raio-x",
    "tomografia","ressonância","ressonancia","mamografia","endoscopia",
    "colonoscopia","doppler","holter","mapa","hemograma","sangue","urina",
    "ecocardiograma","eletroencefalograma"
  ];

  return examWords.some(word => title.includes(word))
    ? "exam"
    : "consultation";
};

const appointmentTypeLabel = item =>
  appointmentKind(item) === "exam" ? "Exame" : "Consulta médica";

const fmtDateTimeSP = s => {
  if (!s) return "";
  const d = new Date(s);
  return d.toLocaleString("pt-BR", {
    timeZone:"America/Sao_Paulo",
    day:"2-digit",
    month:"2-digit",
    year:"numeric",
    hour:"2-digit",
    minute:"2-digit"
  });
};

const dateKeySP = s => {
  if (!s) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone:"America/Sao_Paulo",
    year:"numeric",
    month:"2-digit",
    day:"2-digit"
  }).format(new Date(s));
};

const reportFile = (name, month) =>
  `${name}-${month || "todos"}`.replace(/[^\w-]+/g, "-").toLowerCase();

function exportWorkbook(fileName, sheets) {
  const workbook = XLSX.utils.book_new();

  sheets.forEach(({ name, rows }) => {
    const sheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, sheet, name.slice(0, 31));
  });

  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}

function exportPdfReport({ fileName, title, subtitle, columns, rows, footerLines=[] }) {
  const doc = new jsPDF({
    orientation:"landscape",
    unit:"mm",
    format:"a4"
  });

  doc.setFontSize(18);
  doc.text(title, 14, 16);

  if (subtitle) {
    doc.setFontSize(10);
    doc.text(subtitle, 14, 23);
  }

  autoTable(doc, {
    startY: subtitle ? 29 : 23,
    head:[columns],
    body:rows,
    styles:{
      fontSize:8,
      cellPadding:2.2,
      overflow:"linebreak"
    },
    headStyles:{
      fontStyle:"bold"
    },
    margin:{ left:10, right:10 }
  });

  let y = (doc.lastAutoTable?.finalY || 30) + 7;

  footerLines.forEach(line => {
    if (y > 195) {
      doc.addPage();
      y = 15;
    }
    doc.setFontSize(9);
    doc.text(String(line), 14, y);
    y += 5;
  });

  doc.save(`${fileName}.pdf`);
}

export default function App() {
  const [session, setSession] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoadingAuth(false); });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (loadingAuth) return <div className="center-screen">Carregando…</div>;
  if (!session) return <Login />;

  return <CareApp user={session.user} />;
}

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("login");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const submit = async e => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (password.length < 6) {
      setError("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password
      });

      if (error) {
        setError(error.message);
        return;
      }

      setMessage("Cadastro realizado. Agora tente entrar.");
      setMode("login");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      setError(error.message);
      return;
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="app-mark">✦</div>

        <h1>Central de Cuidados</h1>

        <p>
          Consultas, medicamentos, lembretes e gastos em um só lugar.
        </p>

        <form onSubmit={submit}>
          <label>
            Seu e-mail
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="voce@email.com"
            />
          </label>

          <label>
            Senha
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
            />
          </label>

          <button className="primary wide">
            {mode === "login" ? "Entrar" : "Criar conta"}
          </button>

          {error && <small className="error">{error}</small>}

          {message && (
            <small style={{ color: "#17835c" }}>
              {message}
            </small>
          )}
        </form>

        <button
          type="button"
          onClick={() =>
            setMode(mode === "login" ? "signup" : "login")
          }
          style={{
            marginTop: "16px",
            border: 0,
            background: "transparent",
            color: "#6747e8",
            fontWeight: 700
          }}
        >
          {mode === "login"
            ? "Primeiro acesso? Criar conta"
            : "Já tenho conta"}
        </button>
      </div>
    </div>
  );
}

function CareApp({ user }) {
  const [tab, setTab] = useState("home");
  const [appointments, setAppointments] = useState([]);
  const [medications, setMedications] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [logs, setLogs] = useState([]);
  const [notes, setNotes] = useState([]);
  const [history, setHistory] = useState([]);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState("");

  const notify = msg => { setToast(msg); setTimeout(() => setToast(""), 2800); };

  const load = async () => {
    try {
      const [a,m,r,e,l,n] = await Promise.all([
        list("appointments","date",true),
        list("medications","name",true),
        list("reminders","due_date",true),
        list("expenses","date",false),
        list("medication_logs","taken_at",false),
        list("care_notes","created_at",false)
      ]);
      setAppointments(a);
      setMedications(m);
      setReminders(r);
      setExpenses(e);
      setLogs(l);
      setNotes(n);

      const events = [
        ...e.map(x => ({ type:"expense", date:x.date, title:"Gasto adicionado", subtitle:`${x.description} • ${money(x.amount)}` })),
        ...a.filter(x => x.status !== "upcoming").map(x => ({ type:"appointment", date:x.date, title:"Consulta atualizada", subtitle:x.title })),
        ...l.map(x => ({ type:"medication", date:(x.taken_at || "").slice(0,10), title:"Medicamento tomado", subtitle:x.medication_name || "Medicamento" }))
      ].filter(x=>x.date).sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,100);
      setHistory(events);
    } catch (e) { notify("Erro ao carregar dados: " + e.message); }
  };

  useEffect(() => { load(); }, []);

  const month = today().slice(0,7);
  const nextAppointment = appointments.filter(x => x.status==="upcoming" && x.date>=today()).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time))[0];
  const dashboard = {
    nextAppointment,
    pendingReminders: reminders.filter(x=>x.status==="pending").length,
    monthExpenses: expenses.filter(x=>x.date?.startsWith(month)).reduce((s,x)=>s+Number(x.amount),0),
    upcomingCount: appointments.filter(x=>x.status==="upcoming"&&x.date>=today()).length
  };

  const activatePush = async () => {
    try { await enablePush(); notify("Notificações ativadas neste aparelho."); }
    catch(e) { notify(e.message); }
  };

  const nav = [
    ["home","Início",Home],["appointments","Consultas",CalendarDays],["medications","Medicamentos",Pill],
    ["expenses","Gastos",Wallet],["more","Mais",History]
  ];

  return <div className="app-shell">
    <header className="topbar">
      <div><div className="brand">✦ Central de Cuidados</div><div className="subbrand">Tudo da saúde da sua mãe em um só lugar.</div></div>
      <div className="top-actions">
        <button className="notify-btn" onClick={activatePush}><Bell size={18}/> Ativar avisos</button>
        <button className="icon-only" onClick={()=>supabase.auth.signOut()} title="Sair"><LogOut size={18}/></button>
      </div>
    </header>

    <main className="page">
      {tab==="home" && <HomePage {...{dashboard,medications,setTab,setModal}}/>}
      {tab==="appointments" && <AppointmentsPage items={appointments} reload={load} setModal={setModal}/>}
      {tab==="medications" && <MedicationsPage items={medications} logs={logs} reload={load} setModal={setModal} notify={notify}/>}
      {tab==="expenses" && <ExpensesPage items={expenses} setModal={setModal}/>}
      {tab==="more" && <MorePage notes={notes} reminders={reminders} history={history} appointments={appointments} medications={medications} expenses={expenses} logs={logs} reload={load} setModal={setModal}/>}
    </main>

    <nav className="bottom-nav">
      {nav.map(([id,label,Icon]) => <button key={id} className={tab===id?"active":""} onClick={()=>setTab(id)}><Icon size={20}/><span>{label}</span></button>)}
    </nav>

    {modal?.type==="appointment" && <AppointmentModal item={modal.item} presetType={modal.presetType} onClose={()=>setModal(null)} reload={load}/>}
    {modal?.type==="expense" && <ExpenseModal onClose={()=>setModal(null)} reload={load}/>}
    {modal?.type==="reminder" && <ReminderModal onClose={()=>setModal(null)} reload={load}/>}
    {modal?.type==="medication" && <MedicationModal item={modal.item} onClose={()=>setModal(null)} reload={load}/>}
    {modal?.type==="note" && <NoteModal item={modal.item} onClose={()=>setModal(null)} reload={load}/>}

    {toast && <div className="toast">{toast}</div>}
  </div>
}

function HomePage({ dashboard, medications, setTab, setModal }) {
  const configured = medications.filter(m => Array.isArray(m.schedule) && m.schedule.length);
  const nextMed = useMemo(() => {
    const now = new Date(), mins = now.getHours()*60 + now.getMinutes();
    let opts = [];
    configured.forEach(m => m.schedule.forEach(t => {
      const [h,mm] = t.split(":").map(Number);
      opts.push({ m, t, delta:h*60+mm-mins });
    }));
    return opts.filter(x=>x.delta>=0).sort((a,b)=>a.delta-b.delta)[0] || null;
  }, [medications]);

  return <>
    <section className="hello"><div><h1>Olá, Camilla 👋</h1><p>Organize os cuidados de hoje sem perder nada.</p></div><div className="avatar">M</div></section>

    <section className="hero-card">
      <div className="eyebrow">PRÓXIMA CONSULTA</div>
      {dashboard.nextAppointment ? <>
        <div className="hero-date">{fmtDate(dashboard.nextAppointment.date)} · {dashboard.nextAppointment.time || "Horário a confirmar"}</div>
        <strong>{dashboard.nextAppointment.title}</strong>
        <span>{dashboard.nextAppointment.place || dashboard.nextAppointment.specialty || ""}</span>
      </> : <><div className="hero-date">Nenhuma consulta cadastrada</div><span>Cadastre a próxima para receber avisos.</span></>}
      <button onClick={()=>setTab("appointments")}>Ver agenda <ChevronRight size={17}/></button>
    </section>

    <section className="metric-grid">
      <Metric icon={<Bell/>} value={dashboard.pendingReminders||0} label="Lembretes pendentes"/>
      <Metric icon={<Pill/>} value={nextMed?nextMed.t:"—"} label={nextMed?nextMed.m.name:"Próximo remédio"}/>
      <Metric icon={<Wallet/>} value={money(dashboard.monthExpenses)} label="Gastos no mês"/>
      <Metric icon={<CalendarDays/>} value={dashboard.upcomingCount||0} label="Próximas consultas"/>
    </section>

    <section className="section">
      <div className="section-title"><h2>Ações rápidas</h2></div>
      <div className="quick-grid">
        <Quick icon={<CalendarDays/>} label="Nova consulta" onClick={()=>setModal({type:"appointment"})}/>
        <Quick icon={<Wallet/>} label="Novo gasto" onClick={()=>setModal({type:"expense"})}/>
        <Quick icon={<Bell/>} label="Novo lembrete" onClick={()=>setModal({type:"reminder"})}/>
        <Quick icon={<Pill/>} label="Medicamento" onClick={()=>setModal({type:"medication"})}/>
      </div>
    </section>

    <div className="install-note"><Smartphone size={20}/><div><b>PWA instalável</b><span>No celular, use “Adicionar à tela inicial” para abrir como aplicativo.</span></div></div>
  </>;
}

function Metric({icon,value,label}) { return <div className="metric"><div className="metric-icon">{icon}</div><strong>{value}</strong><span>{label}</span></div>; }
function Quick({icon,label,onClick}) { return <button className="quick" onClick={onClick}>{icon}<span>{label}</span></button>; }

function AppointmentsPage({ items, reload, setModal }) {
  const [activeType,setActiveType] = useState("consultation");

  const visibleItems = (items || [])
    .filter(x => appointmentKind(x) === activeType)
    .sort((a,b) => {
      const aKey = `${a.date || ""}${a.time || ""}`;
      const bKey = `${b.date || ""}${b.time || ""}`;
      return aKey.localeCompare(bKey);
    });

  const consultationCount = (items || []).filter(
    x => appointmentKind(x) === "consultation"
  ).length;

  const examCount = (items || []).filter(
    x => appointmentKind(x) === "exam"
  ).length;

  const complete = async x => {
    await update("appointments", x.id, { status:"completed" });
    reload();
  };

  const reopen = async x => {
    await update("appointments", x.id, {
      status:"upcoming",
      notification_sent:false
    });
    reload();
  };

  const removeAppointment = async x => {
    const label = appointmentKind(x) === "exam" ? "exame" : "consulta";
    const confirmed = window.confirm(
      `Excluir ${label} "${x.title}"?\n\nEssa ação não pode ser desfeita.`
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("appointments")
      .delete()
      .eq("id", x.id);

    if (error) {
      window.alert(`Não foi possível excluir ${label}: ${error.message}`);
      return;
    }

    reload();
  };

  const shareWhatsApp = () => {
    if (!visibleItems.length) {
      window.alert(
        activeType === "exam"
          ? "Nenhum exame para compartilhar."
          : "Nenhuma consulta para compartilhar."
      );
      return;
    }

    const heading =
      activeType === "exam"
        ? "EXAMES"
        : "CONSULTAS MÉDICAS";

    const blocks = visibleItems.map(x => {
      const lines = [
        `*${x.title || appointmentTypeLabel(x)}*`,
        x.date ? `📅 Data: ${fmtFull(x.date)}` : "",
        x.time ? `🕐 Horário: ${String(x.time).slice(0,5)}` : ""
      ];

      if (appointmentKind(x) === "exam") {
        if (x.requesting_doctor) {
          lines.push(`👩‍⚕️ Médico solicitante: ${x.requesting_doctor}`);
        }
        if (x.requesting_specialty) {
          lines.push(`🩺 Especialidade: ${x.requesting_specialty}`);
        }
      } else {
        if (x.professional) {
          lines.push(`👩‍⚕️ Médico: ${x.professional}`);
        }
        if (x.specialty) {
          lines.push(`🩺 Especialidade: ${x.specialty}`);
        }
      }

      if (x.place) lines.push(`📍 Local: ${x.place}`);
      if (x.address) lines.push(`📌 Endereço: ${x.address}`);
      if (x.notes) lines.push(`📝 Observações: ${x.notes}`);

      lines.push(
        `Status: ${x.status === "completed" ? "Realizado" : "Agendado"}`
      );

      return lines.filter(Boolean).join("\n");
    });

    const message =
      `*Central de Cuidados*\n*${heading}*\n\n` +
      blocks.join("\n\n────────────────\n\n");

    window.open(
      `https://wa.me/?text=${encodeURIComponent(message)}`,
      "_blank"
    );
  };

  const tabButton = (type,label,count,Icon) => {
    const active = activeType === type;

    return (
      <button
        type="button"
        onClick={()=>setActiveType(type)}
        style={{
          flex:"1 1 160px",
          border:active ? "1px solid #7351ef" : "1px solid #e0e3ed",
          borderRadius:"14px",
          background:active ? "#f1edff" : "#fff",
          color:active ? "#6243df" : "#737b8d",
          minHeight:"48px",
          padding:"0 14px",
          display:"flex",
          alignItems:"center",
          justifyContent:"center",
          gap:"8px",
          fontWeight:800,
          cursor:"pointer"
        }}
      >
        <Icon size={18}/>
        {label}
        <span style={{
          minWidth:"23px",
          height:"23px",
          borderRadius:"999px",
          display:"grid",
          placeItems:"center",
          padding:"0 6px",
          background:active ? "#6c49e8" : "#eef0f5",
          color:active ? "#fff" : "#737b8d",
          fontSize:"12px"
        }}>
          {count}
        </span>
      </button>
    );
  };

  return <section>
    <div className="section-title" style={{alignItems:"flex-start"}}>
      <div>
        <h1>Consultas e exames</h1>
        <p>Agendamentos separados para encontrar tudo rapidamente.</p>
      </div>

      <div style={{
        display:"flex",
        flexWrap:"wrap",
        gap:"8px",
        justifyContent:"flex-end"
      }}>
        <button
          type="button"
          className="soft"
          onClick={shareWhatsApp}
          style={{
            display:"flex",
            alignItems:"center",
            gap:"7px",
            minHeight:"44px"
          }}
        >
          <Share2 size={17}/>
          WhatsApp
        </button>

        <button
          className="primary"
          onClick={()=>setModal({
            type:"appointment",
            presetType:activeType
          })}
        >
          <Plus size={18}/>
          Adicionar
        </button>
      </div>
    </div>

    <div style={{
      display:"flex",
      flexWrap:"wrap",
      gap:"8px",
      marginBottom:"18px"
    }}>
      {tabButton(
        "consultation",
        "Consultas médicas",
        consultationCount,
        Stethoscope
      )}

      {tabButton(
        "exam",
        "Exames",
        examCount,
        Activity
      )}
    </div>

    <div className="list">
      {visibleItems.length===0 ? (
        <Empty
          text={
            activeType === "exam"
              ? "Nenhum exame cadastrado."
              : "Nenhuma consulta médica cadastrada."
          }
        />
      ) : visibleItems.map(x => {
        const isExam = appointmentKind(x) === "exam";

        return (
          <div
            className="list-card"
            key={x.id}
            style={{
              alignItems:"flex-start",
              gap:"12px"
            }}
          >
            <div className="date-tile" style={{flex:"0 0 auto"}}>
              <b>{fmtDate(x.date).split(" ")[0]}</b>
              <span>{fmtDate(x.date).split(" ")[1]}</span>
            </div>

            <div className="grow" style={{minWidth:0}}>
              <strong style={{
                display:"block",
                overflowWrap:"anywhere"
              }}>
                {x.title}
              </strong>

              <span>
                {x.time ? String(x.time).slice(0,5) : "Horário a confirmar"}
              </span>

              {isExam ? (
                <>
                  {x.requesting_doctor && (
                    <small style={{display:"block"}}>
                      Solicitado por: <b>{x.requesting_doctor}</b>
                    </small>
                  )}

                  {x.requesting_specialty && (
                    <small style={{display:"block"}}>
                      {x.requesting_specialty}
                    </small>
                  )}
                </>
              ) : (
                <>
                  {x.professional && (
                    <small style={{display:"block"}}>
                      Médico: <b>{x.professional}</b>
                    </small>
                  )}

                  {x.specialty && (
                    <small style={{display:"block"}}>
                      Especialidade: {x.specialty}
                    </small>
                  )}
                </>
              )}

              {(x.place || x.address) && (
                <small style={{display:"block"}}>
                  {x.place || x.address}
                </small>
              )}

              <small style={{
                display:"inline-block",
                marginTop:"5px",
                color:x.status === "completed" ? "#17835c" : "#6747e8",
                fontWeight:700
              }}>
                {x.status === "completed" ? "Realizado" : "Agendado"}
              </small>
            </div>

            <div style={{
              display:"flex",
              gap:"6px",
              alignItems:"center",
              flexWrap:"wrap",
              justifyContent:"flex-end",
              flex:"0 0 auto"
            }}>
              <button
                type="button"
                className="soft"
                onClick={()=>setModal({type:"appointment",item:x})}
              >
                Editar
              </button>

              {x.status==="upcoming" ? (
                <button
                  type="button"
                  className="soft success"
                  title="Marcar como realizado"
                  onClick={()=>complete(x)}
                >
                  <Check size={16}/>
                </button>
              ) : (
                <button
                  type="button"
                  className="soft"
                  onClick={()=>reopen(x)}
                >
                  Reabrir
                </button>
              )}

              <button
                type="button"
                title={isExam ? "Excluir exame" : "Excluir consulta"}
                aria-label={`Excluir ${x.title}`}
                onClick={()=>removeAppointment(x)}
                style={{
                  width:"38px",
                  height:"38px",
                  border:"1px solid #f1d7d9",
                  borderRadius:"10px",
                  background:"#fff5f5",
                  color:"#c94a54",
                  display:"grid",
                  placeItems:"center"
                }}
              >
                <Trash2 size={17}/>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  </section>;
}

function MedicationsPage({ items, logs, reload, setModal, notify }) {
  const [glucose,setGlucose] = useState("");

  const localDateKey = date => {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone:"America/Sao_Paulo",
      year:"numeric",
      month:"2-digit",
      day:"2-digit"
    }).format(date);
  };

  const todaySP = localDateKey(new Date());

  const isTaken = (medicationId, time) => {
    return (logs || []).some(log => {
      if (log.medication_id !== medicationId) return false;
      if (!log.scheduled_at) return false;

      const d = new Date(log.scheduled_at);

      const logDate = localDateKey(d);

      const logTime = new Intl.DateTimeFormat("pt-BR", {
        timeZone:"America/Sao_Paulo",
        hour:"2-digit",
        minute:"2-digit",
        hourCycle:"h23"
      }).format(d);

      return logDate === todaySP && logTime === time;
    });
  };

  const take = async (m,time) => {
    if (isTaken(m.id,time)) {
      notify(`${m.name}: esta dose já foi marcada como tomada.`);
      return;
    }

    const scheduledAt = new Date(`${todaySP}T${time}:00-03:00`).toISOString();

    const { error } = await supabase
      .from("medication_logs")
      .insert({
        medication_id:m.id,
        medication_name:m.name,
        scheduled_at:scheduledAt,
        taken_at:new Date().toISOString(),
        status:"taken"
      });

    if (error) {
      if (error.code === "23505") {
        notify(`${m.name}: esta dose já foi marcada como tomada.`);
        reload();
        return;
      }

      notify("Erro ao registrar medicamento: " + error.message);
      return;
    }

    notify(`${m.name}: registrado como tomado.`);
    reload();
  };

  const toggleNotifications = async m => {
    const nextValue = !(m.notifications_enabled ?? true);

    const { error } = await supabase
      .from("medications")
      .update({ notifications_enabled:nextValue })
      .eq("id",m.id);

    if (error) {
      notify("Erro ao alterar avisos: " + error.message);
      return;
    }

    notify(
      nextValue
        ? `${m.name}: avisos ativados.`
        : `${m.name}: avisos desativados.`
    );

    reload();
  };

  const removeMedication = async m => {
    const confirmed = window.confirm(
      `Excluir o medicamento "${m.name}"?\n\nEssa ação remove o medicamento e seus próximos avisos.`
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("medications")
      .delete()
      .eq("id",m.id);

    if (error) {
      window.alert("Não foi possível excluir o medicamento: " + error.message);
      return;
    }

    notify(`${m.name}: medicamento excluído.`);
    reload();
  };

  const registerGlucose = async () => {
    const value = Number(glucose);

    if (!value) return;

    await insert("glucose_logs",{
      measured_at:new Date().toISOString(),
      value
    });

    setGlucose("");
    notify("Glicemia registrada.");
  };

  return <section>
    <div className="section-title">
      <div>
        <h1>Medicamentos</h1>
        <p>Horários, doses, estoque e tomadas.</p>
      </div>

      <button
        className="primary"
        onClick={()=>setModal({type:"medication"})}
      >
        <Plus size={18}/>
        Adicionar
      </button>
    </div>

    <div className="glucose-card">
      <div>
        <Droplets/>
        <strong>Registrar glicemia</strong>
        <span>Guarde o valor medido para o histórico.</span>
      </div>

      <div className="glucose-action">
        <input
          type="number"
          placeholder="mg/dL"
          value={glucose}
          onChange={e=>setGlucose(e.target.value)}
        />

        <button onClick={registerGlucose}>
          Registrar
        </button>
      </div>
    </div>

    <div className="list">
      {items.map(m=>(
        <div className="med-card" key={m.id}>
          <div
            className="med-top"
            style={{
              display:"flex",
              alignItems:"flex-start",
              gap:"12px"
            }}
          >
            <div className="med-icon" style={{flex:"0 0 auto"}}>
              {m.name.toLowerCase().includes("insulina")
                ? <Syringe/>
                : <Pill/>
              }
            </div>

            <div className="grow" style={{minWidth:0}}>
              <strong style={{
                display:"block",
                overflowWrap:"anywhere"
              }}>
                {m.name}
              </strong>

              <span>{m.dose}</span>
              <small style={{overflowWrap:"anywhere"}}>
                {m.prescription_text}
              </small>
            </div>
          </div>

          <div
            style={{
              display:"flex",
              flexWrap:"wrap",
              gap:"8px",
              marginTop:"14px"
            }}
          >
            <button
              type="button"
              className="soft"
              onClick={()=>toggleNotifications(m)}
              title={(m.notifications_enabled ?? true) ? "Desativar avisos" : "Ativar avisos"}
              style={{
                display:"flex",
                alignItems:"center",
                justifyContent:"center",
                gap:"6px",
                minHeight:"40px"
              }}
            >
              <Bell size={16}/>
              {(m.notifications_enabled ?? true) ? "Avisos on" : "Avisos off"}
            </button>

            <button
              type="button"
              className="soft"
              onClick={()=>setModal({type:"medication",item:m})}
              style={{minHeight:"40px"}}
            >
              Editar
            </button>

            <button
              type="button"
              title="Excluir medicamento"
              aria-label={`Excluir medicamento ${m.name}`}
              onClick={()=>removeMedication(m)}
              style={{
                width:"42px",
                height:"40px",
                border:"1px solid #f1d7d9",
                borderRadius:"10px",
                background:"#fff5f5",
                color:"#c94a54",
                display:"grid",
                placeItems:"center",
                flex:"0 0 auto"
              }}
            >
              <Trash2 size={17}/>
            </button>
          </div>

          {Array.isArray(m.schedule) && m.schedule.length ? (
            <div
              className="schedule-row"
              style={{
                marginTop:"14px",
                display:"flex",
                flexWrap:"wrap",
                gap:"8px"
              }}
            >
              {m.schedule.map(t=>{
                const taken = isTaken(m.id,t);

                return (
                  <button
                    key={t}
                    type="button"
                    disabled={taken}
                    onClick={()=>take(m,t)}
                    style={taken ? {
                      opacity:.78,
                      cursor:"default",
                      background:"#edf9f2",
                      borderColor:"#bfe5ce"
                    } : undefined}
                  >
                    {taken ? <Check size={15}/> : <Clock3 size={15}/>}
                    {t}
                    <span>
                      {taken ? "Tomado" : "Marcar como tomado"}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="needs-confirm" style={{marginTop:"14px"}}>
              <AlertTriangle size={16}/>
              Defina os horários reais deste medicamento.
            </div>
          )}

          {m.stock!==null && (
            <div className="stock">
              Estoque: <b>{m.stock} {m.stock_unit}</b>
              {m.stock<=m.low_stock_threshold && (
                <span> • estoque baixo</span>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  </section>;
}

function ExpensesPage({ items, setModal }) {
  const month = today().slice(0,7);
  const monthItems = items.filter(x=>x.date?.startsWith(month));
  const total = monthItems.reduce((s,x)=>s+Number(x.amount),0);
  const cats = Object.entries(monthItems.reduce((a,x)=>(a[x.category]=(a[x.category]||0)+Number(x.amount),a),{})).sort((a,b)=>b[1]-a[1]);
  return <section>
    <div className="section-title"><div><h1>Gastos</h1><p>Controle tudo que foi gasto com os cuidados.</p></div><button className="primary" onClick={()=>setModal({type:"expense"})}><Plus size={18}/>Adicionar</button></div>
    <div className="expense-total"><span>Total no mês</span><strong>{money(total)}</strong><div>{cats.slice(0,5).map(([c,v])=><span key={c}>{c}: <b>{money(v)}</b></span>)}</div></div>
    <div className="list">{items.length===0?<Empty text="Nenhum gasto cadastrado."/>:items.map(x=><div className="list-card" key={x.id}><div className="expense-icon"><Wallet/></div><div className="grow"><strong>{x.description}</strong><span>{x.category} • {fmtFull(x.date)}</span><small>{x.payment_method||""}</small></div><b>{money(x.amount)}</b></div>)}</div>
  </section>;
}

function MorePage({
  notes,
  reminders,
  history,
  appointments,
  medications,
  expenses,
  logs,
  reload,
  setModal
}) {
  const [reportMonth,setReportMonth] = useState(today().slice(0,7));
  const [moreTab,setMoreTab] = useState("notes");

  const toggle = async r => {
    const nextStatus = r.status === "completed" ? "pending" : "completed";

    await update("reminders", r.id, {
      status: nextStatus,
      ...(nextStatus === "pending" ? { notification_sent: false } : {})
    });

    reload();
  };

  const removeReminder = async r => {
    const confirmed = window.confirm(
      `Excluir o lembrete "${r.title}"?\n\nEssa ação não pode ser desfeita.`
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("reminders")
      .delete()
      .eq("id", r.id);

    if (error) {
      window.alert("Não foi possível excluir o lembrete: " + error.message);
      return;
    }

    reload();
  };

  const clearMedicationHistory = async () => {
    const confirmed = window.confirm(
      "Limpar todo o histórico de medicamentos tomados?\n\nOs medicamentos, horários, avisos, consultas e gastos não serão apagados."
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("medication_logs")
      .delete()
      .not("id","is",null);

    if (error) {
      window.alert("Não foi possível limpar o histórico de medicamentos: " + error.message);
      return;
    }

    window.alert("Histórico de medicamentos limpo.");
    reload();
  };

  const sortedNotes = [...(notes || [])].sort((a,b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) {
      return a.pinned ? -1 : 1;
    }

    const aDate = a.occurred_date || a.created_at || "";
    const bDate = b.occurred_date || b.created_at || "";

    return String(bDate).localeCompare(String(aDate));
  });

  const removeNote = async note => {
    const confirmed = window.confirm(
      `Excluir a anotação "${note.title}"?\n\nEssa ação não pode ser desfeita.`
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("care_notes")
      .delete()
      .eq("id",note.id);

    if (error) {
      window.alert("Não foi possível excluir a anotação: " + error.message);
      return;
    }

    reload();
  };

  const togglePinNote = async note => {
    const { error } = await supabase
      .from("care_notes")
      .update({ pinned:!note.pinned })
      .eq("id",note.id);

    if (error) {
      window.alert("Não foi possível atualizar a anotação: " + error.message);
      return;
    }

    reload();
  };

  const monthLabel = reportMonth
    ? new Date(`${reportMonth}-01T12:00:00`).toLocaleDateString("pt-BR",{
        month:"long",
        year:"numeric"
      })
    : "todos os períodos";

  const expensesPeriod = (expenses || []).filter(x =>
    !reportMonth || x.date?.startsWith(reportMonth)
  );

  const appointmentsPeriod = (appointments || []).filter(x =>
    !reportMonth || x.date?.startsWith(reportMonth)
  );

  const logsPeriod = (logs || []).filter(x => {
    if (!reportMonth) return true;
    return dateKeySP(x.taken_at).startsWith(reportMonth);
  });

  const exportExpensesExcel = () => {
    const rows = expensesPeriod.map(x => ({
      Data:fmtFull(x.date),
      Categoria:x.category || "",
      Descrição:x.description || "",
      Valor:Number(x.amount || 0),
      "Forma de pagamento":x.payment_method || ""
    }));

    rows.push({
      Data:"",
      Categoria:"",
      Descrição:"TOTAL",
      Valor:expensesPeriod.reduce((sum,x)=>sum+Number(x.amount||0),0),
      "Forma de pagamento":""
    });

    exportWorkbook(
      reportFile("relatorio-gastos",reportMonth),
      [{name:"Gastos",rows}]
    );
  };

  const exportExpensesPdf = () => {
    const rows = expensesPeriod.map(x => [
      fmtFull(x.date),
      x.category || "",
      x.description || "",
      money(x.amount),
      x.payment_method || ""
    ]);

    const total = expensesPeriod.reduce(
      (sum,x)=>sum+Number(x.amount||0),
      0
    );

    exportPdfReport({
      fileName:reportFile("relatorio-gastos",reportMonth),
      title:"Central de Cuidados - Relatório de gastos",
      subtitle:`Período: ${monthLabel}`,
      columns:["Data","Categoria","Descrição","Valor","Pagamento"],
      rows,
      footerLines:[
        `Total do período: ${money(total)}`,
        `Quantidade de lançamentos: ${expensesPeriod.length}`
      ]
    });
  };

  const exportAppointmentsExcel = () => {
    const rows = appointmentsPeriod.map(x => ({
      Tipo:appointmentTypeLabel(x),
      Data:fmtFull(x.date),
      Horário:x.time || "",
      Título:x.title || "",
      Especialidade:appointmentKind(x)==="exam"
        ? (x.requesting_specialty || "")
        : (x.specialty || ""),
      Profissional:appointmentKind(x)==="exam"
        ? (x.requesting_doctor || "")
        : (x.professional || ""),
      Local:x.place || x.address || "",
      Status:x.status === "completed" ? "Realizado" : "Agendado",
      "Avisar antes (min)":Number(x.remind_minutes_before || 0)
    }));

    exportWorkbook(
      reportFile("relatorio-consultas",reportMonth),
      [{name:"Consultas",rows}]
    );
  };

  const exportAppointmentsPdf = () => {
    const rows = appointmentsPeriod.map(x => [
      appointmentTypeLabel(x),
      fmtFull(x.date),
      x.time || "",
      x.title || "",
      appointmentKind(x)==="exam"
        ? (x.requesting_doctor || "")
        : (x.professional || ""),
      x.place || x.address || "",
      x.status === "completed" ? "Realizado" : "Agendado"
    ]);

    exportPdfReport({
      fileName:reportFile("relatorio-consultas",reportMonth),
      title:"Central de Cuidados - Relatório de consultas e exames",
      subtitle:`Período: ${monthLabel}`,
      columns:["Tipo","Data","Hora","Consulta/Exame","Prof./Solic.","Local","Status"],
      rows,
      footerLines:[
        `Total de consultas/exames: ${appointmentsPeriod.length}`,
        `Realizadas: ${appointmentsPeriod.filter(x=>x.status==="completed").length}`,
        `Agendadas: ${appointmentsPeriod.filter(x=>x.status==="upcoming").length}`
      ]
    });
  };

  const medicationSummaryRows = (medications || []).map(m => {
    const medLogs = logsPeriod.filter(log => log.medication_id === m.id);

    return {
      Medicamento:m.name || "",
      Dose:m.dose || "",
      Horários:Array.isArray(m.schedule) ? m.schedule.join(", ") : "",
      Avisos:(m.notifications_enabled ?? true) ? "Ativados" : "Desativados",
      "Tomadas no período":medLogs.length,
      Estoque:m.stock == null
        ? ""
        : `${m.stock} ${m.stock_unit || ""}`.trim()
    };
  });

  const medicationTakenRows = logsPeriod.map(log => ({
    Data:fmtDateTimeSP(log.taken_at),
    Medicamento:log.medication_name || "",
    "Horário programado":fmtDateTimeSP(log.scheduled_at),
    Status:log.status === "taken" ? "Tomado" : (log.status || "")
  }));

  const exportMedicationsExcel = () => {
    exportWorkbook(
      reportFile("relatorio-medicamentos",reportMonth),
      [
        {name:"Medicamentos",rows:medicationSummaryRows},
        {name:"Tomadas",rows:medicationTakenRows}
      ]
    );
  };

  const exportMedicationsPdf = () => {
    const rows = medicationSummaryRows.map(x => [
      x.Medicamento,
      x.Dose,
      x.Horários,
      x.Avisos,
      String(x["Tomadas no período"]),
      x.Estoque
    ]);

    exportPdfReport({
      fileName:reportFile("relatorio-medicamentos",reportMonth),
      title:"Central de Cuidados - Relatório de medicamentos",
      subtitle:`Período das tomadas: ${monthLabel}`,
      columns:["Medicamento","Dose","Horários","Avisos","Tomadas","Estoque"],
      rows,
      footerLines:[
        `Medicamentos cadastrados: ${(medications || []).length}`,
        `Tomadas registradas no período: ${logsPeriod.length}`
      ]
    });
  };

  const reportCard = ({
    icon,
    title,
    description,
    onPdf,
    onExcel
  }) => (
    <div style={{
      border:"1px solid #e3e5ef",
      background:"#fff",
      borderRadius:"18px",
      padding:"16px",
      minWidth:0
    }}>
      <div style={{
        display:"flex",
        alignItems:"center",
        gap:"10px",
        marginBottom:"8px"
      }}>
        <div className="metric-icon">
          {icon}
        </div>

        <div style={{minWidth:0}}>
          <strong style={{display:"block"}}>
            {title}
          </strong>
          <span style={{
            display:"block",
            fontSize:"13px",
            color:"#777f91",
            marginTop:"2px"
          }}>
            {description}
          </span>
        </div>
      </div>

      <div style={{
        display:"flex",
        flexWrap:"wrap",
        gap:"8px",
        marginTop:"14px"
      }}>
        <button
          type="button"
          className="soft"
          onClick={onPdf}
          style={{
            display:"flex",
            alignItems:"center",
            gap:"6px",
            minHeight:"40px"
          }}
        >
          <FileText size={16}/>
          PDF
        </button>

        <button
          type="button"
          className="soft"
          onClick={onExcel}
          style={{
            display:"flex",
            alignItems:"center",
            gap:"6px",
            minHeight:"40px"
          }}
        >
          <FileSpreadsheet size={16}/>
          Excel
        </button>
      </div>
    </div>
  );

  const moreTabButton = (id,label,Icon) => {
    const active = moreTab === id;

    return (
      <button
        type="button"
        onClick={()=>setMoreTab(id)}
        style={{
          flex:"1 1 150px",
          minHeight:"46px",
          border:active ? "1px solid #7351ef" : "1px solid #e0e3ed",
          borderRadius:"14px",
          background:active ? "#f1edff" : "#fff",
          color:active ? "#6243df" : "#737b8d",
          fontWeight:800,
          display:"flex",
          alignItems:"center",
          justifyContent:"center",
          gap:"8px",
          cursor:"pointer"
        }}
      >
        <Icon size={18}/>
        {label}
      </button>
    );
  };

  return <section>
    <div className="section-title">
      <div>
        <h1>Mais</h1>
        <p>Anotações importantes, relatórios, lembretes e histórico.</p>
      </div>
    </div>

    <div style={{
      display:"flex",
      flexWrap:"wrap",
      gap:"8px",
      marginBottom:"18px"
    }}>
      {moreTabButton("notes","Anotações",NotebookPen)}
      {moreTabButton("reports","Relatórios",FileText)}
      {moreTabButton("history","Lembretes e histórico",History)}
    </div>

    {moreTab === "notes" && (
      <div>
        <div style={{
          display:"flex",
          alignItems:"center",
          justifyContent:"space-between",
          gap:"12px",
          flexWrap:"wrap",
          marginBottom:"14px"
        }}>
          <div>
            <h2 style={{margin:"0 0 4px"}}>
              Anotações importantes
            </h2>
            <p style={{margin:0,color:"#777f91"}}>
              Informações médicas que você precisa encontrar rapidamente.
            </p>
          </div>

          <button
            className="primary"
            type="button"
            onClick={()=>setModal({type:"note"})}
          >
            <Plus size={18}/>
            Nova anotação
          </button>
        </div>

        <div style={{
          display:"grid",
          gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",
          gap:"12px"
        }}>
          {sortedNotes.length === 0 ? (
            <Empty text="Nenhuma anotação importante cadastrada."/>
          ) : sortedNotes.map(note => (
            <article
              key={note.id}
              style={{
                border:"1px solid #e1e4ee",
                borderRadius:"18px",
                background:"#fff",
                padding:"16px",
                minWidth:0,
                boxShadow:note.pinned
                  ? "0 8px 24px rgba(103,71,232,.08)"
                  : "none"
              }}
            >
              <div style={{
                display:"flex",
                alignItems:"flex-start",
                justifyContent:"space-between",
                gap:"10px"
              }}>
                <div style={{minWidth:0}}>
                  <div style={{
                    display:"flex",
                    alignItems:"center",
                    gap:"7px",
                    flexWrap:"wrap"
                  }}>
                    <strong style={{
                      fontSize:"17px",
                      overflowWrap:"anywhere"
                    }}>
                      {note.title}
                    </strong>

                    {note.pinned && (
                      <span style={{
                        display:"inline-flex",
                        alignItems:"center",
                        gap:"4px",
                        color:"#6747e8",
                        fontSize:"12px",
                        fontWeight:800
                      }}>
                        <Pin size={13}/>
                        Fixada
                      </span>
                    )}
                  </div>

                  <span style={{
                    display:"block",
                    marginTop:"4px",
                    color:"#777f91",
                    fontSize:"13px"
                  }}>
                    {note.category || "Informação importante"}
                    {note.occurred_date
                      ? ` • ${fmtFull(note.occurred_date)}`
                      : ""
                    }
                  </span>
                </div>

                <button
                  type="button"
                  onClick={()=>togglePinNote(note)}
                  title={note.pinned ? "Desafixar" : "Fixar no topo"}
                  className="soft"
                  style={{padding:"8px"}}
                >
                  <Pin size={15}/>
                </button>
              </div>

              {(note.hospital || note.doctor || note.specialty) && (
                <div style={{
                  marginTop:"12px",
                  padding:"10px 12px",
                  borderRadius:"12px",
                  background:"#f8f8fc",
                  color:"#596174",
                  fontSize:"13px",
                  lineHeight:1.55
                }}>
                  {note.hospital && <div><b>Local:</b> {note.hospital}</div>}
                  {note.doctor && <div><b>Médico:</b> {note.doctor}</div>}
                  {note.specialty && <div><b>Especialidade:</b> {note.specialty}</div>}
                </div>
              )}

              {note.details && (
                <p style={{
                  whiteSpace:"pre-wrap",
                  overflowWrap:"anywhere",
                  margin:"12px 0 0",
                  color:"#596174",
                  lineHeight:1.55
                }}>
                  {note.details}
                </p>
              )}

              <div style={{
                display:"flex",
                flexWrap:"wrap",
                gap:"8px",
                marginTop:"14px"
              }}>
                <button
                  type="button"
                  className="soft"
                  onClick={()=>setModal({type:"note",item:note})}
                >
                  Editar
                </button>

                <button
                  type="button"
                  onClick={()=>removeNote(note)}
                  style={{
                    border:"1px solid #f1d7d9",
                    borderRadius:"10px",
                    background:"#fff5f5",
                    color:"#c94a54",
                    minHeight:"40px",
                    padding:"0 12px",
                    display:"flex",
                    alignItems:"center",
                    gap:"6px",
                    fontWeight:700
                  }}
                >
                  <Trash2 size={16}/>
                  Excluir
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    )}

    {moreTab === "reports" && (
      <div style={{
        border:"1px solid #e1e4ee",
        background:"#f8f8fc",
        borderRadius:"20px",
        padding:"16px",
        marginBottom:"22px"
      }}>
        <div style={{
          display:"flex",
          gap:"14px",
          justifyContent:"space-between",
          alignItems:"end",
          flexWrap:"wrap",
          marginBottom:"14px"
        }}>
          <div>
            <h2 style={{margin:"0 0 4px"}}>
              Relatórios
            </h2>
            <p style={{margin:0,color:"#777f91"}}>
              Exporte medicamentos, gastos, consultas e exames em PDF ou Excel.
            </p>
          </div>

          <label style={{
            display:"grid",
            gap:"5px",
            fontSize:"13px",
            fontWeight:700
          }}>
            Período
            <input
              type="month"
              value={reportMonth}
              onChange={e=>setReportMonth(e.target.value)}
              style={{
                minHeight:"40px",
                border:"1px solid #dfe2ec",
                borderRadius:"10px",
                padding:"0 10px",
                background:"#fff"
              }}
            />
          </label>
        </div>

        <div style={{
          display:"grid",
          gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",
          gap:"12px"
        }}>
          {reportCard({
            icon:<Pill size={19}/>,
            title:"Medicamentos",
            description:`${logsPeriod.length} tomada(s) no período`,
            onPdf:exportMedicationsPdf,
            onExcel:exportMedicationsExcel
          })}

          {reportCard({
            icon:<Wallet size={19}/>,
            title:"Gastos",
            description:`${expensesPeriod.length} lançamento(s)`,
            onPdf:exportExpensesPdf,
            onExcel:exportExpensesExcel
          })}

          {reportCard({
            icon:<CalendarDays size={19}/>,
            title:"Consultas e exames",
            description:`${appointmentsPeriod.length} compromisso(s)`,
            onPdf:exportAppointmentsPdf,
            onExcel:exportAppointmentsExcel
          })}
        </div>
      </div>
    )}

    {moreTab === "history" && (
      <>
        <div style={{
          display:"flex",
          justifyContent:"flex-end",
          marginBottom:"14px"
        }}>
          <button
            className="primary"
            onClick={() => setModal({type:"reminder"})}
          >
            <Plus size={18}/>
            Novo lembrete
          </button>
        </div>

        <div className="two-col">
          <div>
            <h2 className="mini-title">Lembretes</h2>

            <div className="list">
              {reminders.length === 0 ? (
                <Empty text="Nenhum lembrete."/>
              ) : (
                reminders.map(r => (
                  <div
                    className={`reminder ${r.status==="completed"?"done":""}`}
                    key={r.id}
                    style={{
                      display:"flex",
                      alignItems:"center",
                      gap:"10px"
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => toggle(r)}
                      style={{
                        flex:1,
                        border:0,
                        background:"transparent",
                        padding:0,
                        display:"flex",
                        alignItems:"center",
                        gap:"11px",
                        textAlign:"left",
                        color:"inherit"
                      }}
                    >
                      <span className="check-circle">
                        {r.status==="completed" ? <Check size={15}/> : null}
                      </span>

                      <div>
                        <strong>{r.title}</strong>
                        <span>{fmtFull(r.due_date)} {r.due_time||""}</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => removeReminder(r)}
                      title="Excluir lembrete"
                      style={{
                        width:"38px",
                        height:"38px",
                        border:"1px solid #f1d7d9",
                        borderRadius:"10px",
                        background:"#fff5f5",
                        color:"#c94a54",
                        display:"grid",
                        placeItems:"center",
                        flex:"0 0 auto"
                      }}
                    >
                      <Trash2 size={17}/>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <div style={{
              display:"flex",
              alignItems:"center",
              justifyContent:"space-between",
              gap:"10px",
              marginBottom:"10px"
            }}>
              <h2 className="mini-title" style={{margin:0}}>
                Histórico
              </h2>

              <button
                type="button"
                onClick={clearMedicationHistory}
                title="Limpar histórico de medicamentos tomados"
                style={{
                  border:"1px solid #f1d7d9",
                  borderRadius:"10px",
                  background:"#fff5f5",
                  color:"#c94a54",
                  padding:"8px 10px",
                  display:"flex",
                  alignItems:"center",
                  gap:"6px",
                  fontWeight:700,
                  cursor:"pointer"
                }}
              >
                <Trash2 size={16}/>
                Limpar tomadas
              </button>
            </div>

            <div className="timeline">
              {history.length === 0 ? (
                <Empty text="O histórico aparecerá aqui."/>
              ) : (
                history.map((h,i)=>(
                  <div className="timeline-item" key={i}>
                    <div className="dot"/>
                    <div>
                      <strong>{h.title}</strong>
                      <span>{h.subtitle}</span>
                      <small>{fmtFull(h.date)}</small>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </>
    )}
  </section>;

}

function Empty({text}) { return <div className="empty">{text}</div>; }

function AppointmentModal({item,presetType,onClose,reload}) {
  const initialType =
    item
      ? appointmentKind(item)
      : (presetType || "consultation");

  const [f,setF]=useState({
    appointment_type:initialType,
    title:item?.title||"",
    specialty:item?.specialty||"",
    professional:item?.professional||"",
    requesting_doctor:item?.requesting_doctor||"",
    requesting_specialty:item?.requesting_specialty||"",
    place:item?.place||"",
    address:item?.address||"",
    date:item?.date||today(),
    time:item?.time||"",
    notes:item?.notes||"",
    status:item?.status||"upcoming",
    remind_minutes_before:item?.remind_minutes_before ?? 1440
  });

  const isExam = f.appointment_type === "exam";

  const save = async e => {
    e.preventDefault();

    const body = {
      ...f,
      remind_minutes_before:Number(f.remind_minutes_before),
      notification_sent:false,
      professional:isExam ? null : f.professional,
      specialty:isExam ? null : f.specialty,
      requesting_doctor:isExam ? f.requesting_doctor : null,
      requesting_specialty:isExam ? f.requesting_specialty : null
    };

    if (item) {
      await update("appointments", item.id, body);
    } else {
      await insert("appointments", body);
    }

    reload();
    onClose();
  };

  return <Modal
    title={
      item
        ? (isExam ? "Editar exame" : "Editar consulta médica")
        : (isExam ? "Novo exame" : "Nova consulta médica")
    }
    onClose={onClose}
  >
    <form onSubmit={save} className="form">
      <label>
        Tipo de agendamento
        <select
          value={f.appointment_type}
          onChange={e=>setF({
            ...f,
            appointment_type:e.target.value
          })}
        >
          <option value="consultation">Consulta médica</option>
          <option value="exam">Exame</option>
        </select>
      </label>

      <label>
        {isExam ? "Nome do exame" : "Título / motivo da consulta"}
        <input
          required
          value={f.title}
          onChange={e=>setF({...f,title:e.target.value})}
          placeholder={
            isExam
              ? "Ex.: Eletrocardiograma"
              : "Ex.: Retorno com cardiologista"
          }
        />
      </label>

      {isExam ? (
        <>
          <label>
            Médico que solicitou
            <input
              value={f.requesting_doctor}
              onChange={e=>setF({
                ...f,
                requesting_doctor:e.target.value
              })}
              placeholder="Ex.: Dra. Vanessa Nogueira Veloso"
            />
          </label>

          <label>
            Especialidade do médico solicitante
            <input
              value={f.requesting_specialty}
              onChange={e=>setF({
                ...f,
                requesting_specialty:e.target.value
              })}
              placeholder="Ex.: Cardiologia"
            />
          </label>
        </>
      ) : (
        <>
          <label>
            Especialidade
            <input
              value={f.specialty}
              onChange={e=>setF({...f,specialty:e.target.value})}
              placeholder="Ex.: Cardiologia"
            />
          </label>

          <label>
            Nome do médico
            <input
              value={f.professional}
              onChange={e=>setF({...f,professional:e.target.value})}
              placeholder="Ex.: Dra. Vanessa Nogueira Veloso"
            />
          </label>
        </>
      )}

      <div className="form-row">
        <label>
          Data
          <input
            required
            type="date"
            value={f.date}
            onChange={e=>setF({...f,date:e.target.value})}
          />
        </label>

        <label>
          Horário
          <input
            type="time"
            value={f.time}
            onChange={e=>setF({...f,time:e.target.value})}
          />
        </label>
      </div>

      <label>
        Local
        <input
          value={f.place}
          onChange={e=>setF({...f,place:e.target.value})}
          placeholder="Ex.: AE Várzea do Carmo"
        />
      </label>

      <label>
        Endereço
        <input
          value={f.address}
          onChange={e=>setF({...f,address:e.target.value})}
        />
      </label>

      <label>
        Observações
        <textarea
          value={f.notes}
          onChange={e=>setF({...f,notes:e.target.value})}
        />
      </label>

      <label>
        Avisar
        <select
          value={f.remind_minutes_before}
          onChange={e=>setF({
            ...f,
            remind_minutes_before:Number(e.target.value)
          })}
        >
          <option value="0">No horário</option>
          <option value="60">1 hora antes</option>
          <option value="1440">1 dia antes</option>
          <option value="10080">7 dias antes</option>
        </select>
      </label>

      <button className="primary wide">
        {item ? "Salvar alterações" : (isExam ? "Salvar exame" : "Salvar consulta")}
      </button>
    </form>
  </Modal>;
}

function NoteModal({item,onClose,reload}) {
  const [f,setF] = useState({
    title:item?.title || "",
    category:item?.category || "Informação importante",
    occurred_date:item?.occurred_date || "",
    hospital:item?.hospital || "",
    doctor:item?.doctor || "",
    specialty:item?.specialty || "",
    details:item?.details || "",
    pinned:Boolean(item?.pinned)
  });

  const save = async e => {
    e.preventDefault();

    const body = {
      ...f,
      occurred_date:f.occurred_date || null,
      updated_at:new Date().toISOString()
    };

    if (item) {
      await update("care_notes",item.id,body);
    } else {
      await insert("care_notes",body);
    }

    reload();
    onClose();
  };

  return <Modal
    title={item ? "Editar anotação" : "Nova anotação importante"}
    onClose={onClose}
  >
    <form onSubmit={save} className="form">
      <label>
        Título
        <input
          required
          value={f.title}
          onChange={e=>setF({...f,title:e.target.value})}
          placeholder="Ex.: Convulsões, AVC, Amputação"
        />
      </label>

      <label>
        Categoria
        <select
          value={f.category}
          onChange={e=>setF({...f,category:e.target.value})}
        >
          {[
            "Informação importante",
            "Convulsão",
            "AVC",
            "Fratura",
            "Cirurgia / Amputação",
            "Internação",
            "Diagnóstico",
            "Alergia",
            "Outro"
          ].map(x=><option key={x}>{x}</option>)}
        </select>
      </label>

      <label>
        Data do ocorrido
        <input
          type="date"
          value={f.occurred_date}
          onChange={e=>setF({...f,occurred_date:e.target.value})}
        />
      </label>

      <label>
        Hospital / local
        <input
          value={f.hospital}
          onChange={e=>setF({...f,hospital:e.target.value})}
        />
      </label>

      <div className="form-row">
        <label>
          Médico
          <input
            value={f.doctor}
            onChange={e=>setF({...f,doctor:e.target.value})}
          />
        </label>

        <label>
          Especialidade
          <input
            value={f.specialty}
            onChange={e=>setF({...f,specialty:e.target.value})}
          />
        </label>
      </div>

      <label>
        Informações / observações
        <textarea
          required
          value={f.details}
          onChange={e=>setF({...f,details:e.target.value})}
          placeholder="Registre aqui todas as informações importantes."
          style={{minHeight:"150px"}}
        />
      </label>

      <label style={{
        display:"flex",
        alignItems:"center",
        gap:"9px"
      }}>
        <input
          type="checkbox"
          checked={f.pinned}
          onChange={e=>setF({...f,pinned:e.target.checked})}
          style={{width:"18px",height:"18px"}}
        />
        Fixar esta anotação no topo
      </label>

      <button className="primary wide">
        {item ? "Salvar alterações" : "Salvar anotação"}
      </button>
    </form>
  </Modal>;
}

function ExpenseModal({onClose,reload}) {
  const [f,setF]=useState({date:today(),category:"Medicamentos",description:"",amount:"",payment_method:""});
  const save=async e=>{e.preventDefault();await insert("expenses",{...f,amount:Number(f.amount)});reload();onClose();};
  return <Modal title="Novo gasto" onClose={onClose}><form onSubmit={save} className="form">
    <div className="form-row"><label>Data<input type="date" value={f.date} onChange={e=>setF({...f,date:e.target.value})}/></label><label>Valor<input required type="number" step="0.01" value={f.amount} onChange={e=>setF({...f,amount:e.target.value})}/></label></div>
    <label>Categoria<select value={f.category} onChange={e=>setF({...f,category:e.target.value})}>{["Medicamentos","Consultas","Exames","Transporte","Alimentação","Higiene","Outros"].map(x=><option key={x}>{x}</option>)}</select></label>
    <label>Descrição<input required value={f.description} onChange={e=>setF({...f,description:e.target.value})}/></label>
    <label>Forma de pagamento<input value={f.payment_method} onChange={e=>setF({...f,payment_method:e.target.value})} placeholder="Pix, dinheiro, cartão..."/></label>
    <button className="primary wide">Salvar gasto</button>
  </form></Modal>;
}

function ReminderModal({onClose,reload}) {
  const [f,setF]=useState({
  title:"",
  due_date:today(),
  due_time:"",
  notes:"",
  status:"pending",
  remind_minutes_before:0
});
  const save=async e=>{e.preventDefault();await insert("reminders",f);reload();onClose();};
  return <Modal title="Novo lembrete" onClose={onClose}><form onSubmit={save} className="form">
    <label>Lembrete<input required value={f.title} onChange={e=>setF({...f,title:e.target.value})} placeholder="Ex.: Retirar resultado"/></label>
    <div className="form-row"><label>Data<input type="date" value={f.due_date} onChange={e=>setF({...f,due_date:e.target.value})}/></label><label>Horário<input type="time" value={f.due_time} onChange={e=>setF({...f,due_time:e.target.value})}/></label></div>
    <label>Observações<textarea value={f.notes} onChange={e=>setF({...f,notes:e.target.value})}/></label>
    <label>
  Avisar
  <select
    value={f.remind_minutes_before}
    onChange={e =>
      setF({
        ...f,
        remind_minutes_before:Number(e.target.value)
      })
    }
  >
    <option value="0">No horário</option>
    <option value="15">15 minutos antes</option>
    <option value="30">30 minutos antes</option>
    <option value="60">1 hora antes</option>
    <option value="1440">1 dia antes</option>
  </select>
</label>
    <button className="primary wide">Salvar lembrete</button>
  </form></Modal>;
}

function MedicationModal({item,onClose,reload}) {
  const [f,setF]=useState({
    name:item?.name||"",dose:item?.dose||"",frequency:item?.frequency||"",
    schedule:(item?.schedule||[]).join(","),prescription_text:item?.prescription_text||"",
    stock:item?.stock??"",stock_unit:item?.stock_unit||"comprimidos",
    low_stock_threshold:item?.low_stock_threshold??7
  });
  const save=async e=>{
    e.preventDefault();
    const body={...f,stock:f.stock===""?null:Number(f.stock),low_stock_threshold:Number(f.low_stock_threshold),schedule:f.schedule.split(",").map(x=>x.trim()).filter(Boolean)};
    if(item) await update("medications",item.id,body); else await insert("medications",body);
    reload();onClose();
  };
  return <Modal title={item?"Editar medicamento":"Novo medicamento"} onClose={onClose}><form onSubmit={save} className="form">
    <label>Medicamento<input required value={f.name} onChange={e=>setF({...f,name:e.target.value})}/></label>
    <div className="form-row"><label>Dose<input value={f.dose} onChange={e=>setF({...f,dose:e.target.value})}/></label><label>Frequência<input value={f.frequency} onChange={e=>setF({...f,frequency:e.target.value})}/></label></div>
    <label>Horários<input value={f.schedule} onChange={e=>setF({...f,schedule:e.target.value})} placeholder="08:00, 20:00"/><small>Separe os horários por vírgula.</small></label>
    <label>Texto da receita<textarea value={f.prescription_text} onChange={e=>setF({...f,prescription_text:e.target.value})}/></label>
    <div className="form-row"><label>Estoque<input type="number" value={f.stock} onChange={e=>setF({...f,stock:e.target.value})}/></label><label>Unidade<input value={f.stock_unit} onChange={e=>setF({...f,stock_unit:e.target.value})}/></label></div>
    <button className="primary wide">Salvar medicamento</button>
  </form></Modal>;
}