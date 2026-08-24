import React, { useEffect, useMemo, useState } from "react";
import {
  Home, CalendarDays, Pill, Wallet, Bell, Plus, Check, Clock3, History,
  Syringe, Droplets, AlertTriangle, ChevronRight, LogOut, Smartphone, Trash2
} from "lucide-react";
import { supabase } from "./lib/supabase";
import { list, insert, update } from "./lib/db";
import { enablePush } from "./lib/push";
import Modal from "./components/Modal";

const money = n => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const today = () => new Date().toISOString().slice(0, 10);
const fmtDate = s => s ? new Date(`${s}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "";
const fmtFull = s => s ? new Date(`${s}T12:00:00`).toLocaleDateString("pt-BR") : "";

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
  const [history, setHistory] = useState([]);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState("");

  const notify = msg => { setToast(msg); setTimeout(() => setToast(""), 2800); };

  const load = async () => {
    try {
      const [a,m,r,e,l] = await Promise.all([
        list("appointments","date",true),
        list("medications","name",true),
        list("reminders","due_date",true),
        list("expenses","date",false),
        list("medication_logs","taken_at",false)
      ]);
      setAppointments(a); setMedications(m); setReminders(r); setExpenses(e); setLogs(l);

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
      {tab==="medications" && <MedicationsPage items={medications} reload={load} setModal={setModal} notify={notify}/>}
      {tab==="expenses" && <ExpensesPage items={expenses} setModal={setModal}/>}
      {tab==="more" && <MorePage reminders={reminders} history={history} reload={load} setModal={setModal}/>}
    </main>

    <nav className="bottom-nav">
      {nav.map(([id,label,Icon]) => <button key={id} className={tab===id?"active":""} onClick={()=>setTab(id)}><Icon size={20}/><span>{label}</span></button>)}
    </nav>

    {modal?.type==="appointment" && <AppointmentModal onClose={()=>setModal(null)} reload={load}/>}
    {modal?.type==="expense" && <ExpenseModal onClose={()=>setModal(null)} reload={load}/>}
    {modal?.type==="reminder" && <ReminderModal onClose={()=>setModal(null)} reload={load}/>}
    {modal?.type==="medication" && <MedicationModal item={modal.item} onClose={()=>setModal(null)} reload={load}/>}

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
  const complete = async id => { await update("appointments",id,{status:"completed"}); reload(); };
  return <section>
    <div className="section-title"><div><h1>Consultas e exames</h1><p>Próximos compromissos e histórico.</p></div><button className="primary" onClick={()=>setModal({type:"appointment"})}><Plus size={18}/>Adicionar</button></div>
    <div className="list">{items.length===0?<Empty text="Nenhuma consulta cadastrada."/>:items.map(x=><div className="list-card" key={x.id}>
      <div className="date-tile"><b>{fmtDate(x.date).split(" ")[0]}</b><span>{fmtDate(x.date).split(" ")[1]}</span></div>
      <div className="grow"><strong>{x.title}</strong><span>{x.time||"Horário a confirmar"} {x.professional?`• ${x.professional}`:""}</span><small>{x.place||x.address||""}</small></div>
      {x.status==="upcoming"&&<button className="soft success" onClick={()=>complete(x.id)}><Check size={16}/></button>}
    </div>)}</div>
  </section>;
}

function MedicationsPage({ items, reload, setModal, notify }) {
  const [glucose,setGlucose] = useState("");

  const take = async (m,time) => {
    await insert("medication_logs",{
      medication_id:m.id,
      medication_name:m.name,
      scheduled_at:`${today()}T${time}:00`,
      taken_at:new Date().toISOString(),
      status:"taken"
    });
    notify(`${m.name}: registrado como tomado.`);
    reload();
  };

  const registerGlucose = async () => {
    const value = Number(glucose);
    if (!value) return;
    await insert("glucose_logs",{ measured_at:new Date().toISOString(), value });
    setGlucose("");
    notify("Glicemia registrada.");
  };

  return <section>
    <div className="section-title"><div><h1>Medicamentos</h1><p>Horários, doses, estoque e tomadas.</p></div><button className="primary" onClick={()=>setModal({type:"medication"})}><Plus size={18}/>Adicionar</button></div>
    <div className="glucose-card">
      <div><Droplets/><strong>Registrar glicemia</strong><span>Guarde o valor medido para o histórico.</span></div>
      <div className="glucose-action"><input type="number" placeholder="mg/dL" value={glucose} onChange={e=>setGlucose(e.target.value)}/><button onClick={registerGlucose}>Registrar</button></div>
    </div>

    <div className="list">{items.map(m=><div className="med-card" key={m.id}>
      <div className="med-top">
        <div className="med-icon">{m.name.toLowerCase().includes("insulina")?<Syringe/>:<Pill/>}</div>
        <div className="grow"><strong>{m.name}</strong><span>{m.dose}</span><small>{m.prescription_text}</small></div>
        <button className="soft" onClick={()=>setModal({type:"medication",item:m})}>Editar</button>
      </div>
      {Array.isArray(m.schedule)&&m.schedule.length ? <div className="schedule-row">{m.schedule.map(t=><button key={t} onClick={()=>take(m,t)}><Clock3 size={15}/>{t}<span>Marcar como tomado</span></button>)}</div>
      : <div className="needs-confirm"><AlertTriangle size={16}/> Defina os horários reais deste medicamento.</div>}
      {m.stock!==null && <div className="stock">Estoque: <b>{m.stock} {m.stock_unit}</b>{m.stock<=m.low_stock_threshold&&<span> • estoque baixo</span>}</div>}
    </div>)}</div>
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

function MorePage({ reminders, history, reload, setModal }) {
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

  return <section>
    <div className="section-title">
      <div>
        <h1>Lembretes e histórico</h1>
        <p>Pendências e tudo que já foi registrado.</p>
      </div>

      <button
        className="primary"
        onClick={() => setModal({type:"reminder"})}
      >
        <Plus size={18}/>
        Lembrete
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
                className={`reminder ${r.status === "completed" ? "done" : ""}`}
                key={r.id}
                style={{ display:"flex", alignItems:"center", gap:"10px" }}
              >
                <button
                  type="button"
                  onClick={() => toggle(r)}
                  style={{ flex:1, border:0, background:"transparent", padding:0, display:"flex", alignItems:"center", gap:"11px", textAlign:"left", color:"inherit" }}
                  aria-label={r.status === "completed" ? "Marcar lembrete como pendente" : "Marcar lembrete como concluído"}
                >
                  <span className="check-circle">
                    {r.status === "completed" ? <Check size={15}/> : null}
                  </span>

                  <div>
                    <strong>{r.title}</strong>
                    <span>{fmtFull(r.due_date)} {r.due_time || ""}</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => removeReminder(r)}
                  title="Excluir lembrete"
                  aria-label={`Excluir lembrete ${r.title}`}
                  style={{ width:"38px", height:"38px", border:"1px solid #f1d7d9", borderRadius:"10px", background:"#fff5f5", color:"#c94a54", display:"grid", placeItems:"center", flex:"0 0 auto" }}
                >
                  <Trash2 size={17}/>
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div>
        <h2 className="mini-title">Histórico</h2>

        <div className="timeline">
          {history.length === 0 ? (
            <Empty text="O histórico aparecerá aqui."/>
          ) : (
            history.map((h,i) => (
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
  </section>;
}

function Empty({text}) { return <div className="empty">{text}</div>; }

function AppointmentModal({onClose,reload}) {
  const [f,setF]=useState({title:"",specialty:"",professional:"",place:"",address:"",date:today(),time:"",notes:"",status:"upcoming", remind_minutes_before:1440});
  const save=async e=>{e.preventDefault();await insert("appointments",f);reload();onClose();};
  return <Modal title="Nova consulta / exame" onClose={onClose}><form onSubmit={save} className="form">
    <label>Título<input required value={f.title} onChange={e=>setF({...f,title:e.target.value})} placeholder="Ex.: Cardiologista"/></label>
    <div className="form-row"><label>Data<input required type="date" value={f.date} onChange={e=>setF({...f,date:e.target.value})}/></label><label>Horário<input type="time" value={f.time} onChange={e=>setF({...f,time:e.target.value})}/></label></div>
    <label>Profissional<input value={f.professional} onChange={e=>setF({...f,professional:e.target.value})}/></label>
    <label>Local<input value={f.place} onChange={e=>setF({...f,place:e.target.value})}/></label>
    <label>Avisar antes<select value={f.remind_minutes_before} onChange={e=>setF({...f,remind_minutes_before:Number(e.target.value)})}><option value="60">1 hora</option><option value="1440">1 dia</option><option value="10080">7 dias</option></select></label>
    <button className="primary wide">Salvar consulta</button>
  </form></Modal>;
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