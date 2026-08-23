import React, {useEffect, useMemo, useState} from "react";
import {
  Home, CalendarDays, Pill, Wallet, Bell, Plus, Check, Clock3, History,
  Trash2, Syringe, Droplets, AlertTriangle, ChevronRight
} from "lucide-react";
import {api} from "./api";
import Modal from "./components/Modal";

const money = n => Number(n||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const today = () => new Date().toISOString().slice(0,10);
const fmtDate = s => s ? new Date(`${s}T12:00:00`).toLocaleDateString("pt-BR",{day:"2-digit",month:"short"}) : "";
const fmtFull = s => s ? new Date(`${s}T12:00:00`).toLocaleDateString("pt-BR") : "";

export default function App(){
  const [tab,setTab] = useState("home");
  const [dashboard,setDashboard]=useState({});
  const [appointments,setAppointments]=useState([]);
  const [medications,setMedications]=useState([]);
  const [reminders,setReminders]=useState([]);
  const [expenses,setExpenses]=useState([]);
  const [history,setHistory]=useState([]);
  const [logs,setLogs]=useState([]);
  const [modal,setModal]=useState(null);
  const [toast,setToast]=useState("");

  const load = async()=>{
    const [d,a,m,r,e,h,l]=await Promise.all([
      api("/dashboard"),api("/appointments"),api("/medications"),api("/reminders"),
      api("/expenses"),api("/history"),api("/medication-logs")
    ]);
    setDashboard(d);setAppointments(a);setMedications(m);setReminders(r);setExpenses(e);setHistory(h);setLogs(l);
  };
  useEffect(()=>{load()},[]);

  const notify = msg => {setToast(msg);setTimeout(()=>setToast(""),2600)};
  const requestNotifications=async()=>{
    if(!("Notification" in window)) return notify("Este navegador não suporta notificações.");
    const permission=await Notification.requestPermission();
    notify(permission==="granted"?"Notificações ativadas.":"Permissão não concedida.");
  };

  useEffect(()=>{
    const timer=setInterval(()=>{
      if(Notification?.permission!=="granted") return;
      const now=new Date();
      const hhmm=now.toTimeString().slice(0,5);
      medications.forEach(m=>{
        if((m.schedule||[]).includes(hhmm)){
          const key=`notify-${m.id}-${today()}-${hhmm}`;
          if(!localStorage.getItem(key)){
            new Notification("Hora do medicamento",{body:`${m.name} • ${m.dose||""}`});
            localStorage.setItem(key,"1");
          }
        }
      });
    },30000);
    return()=>clearInterval(timer);
  },[medications]);

  const nav=[
    ["home","Início",Home],["appointments","Consultas",CalendarDays],["medications","Medicamentos",Pill],
    ["expenses","Gastos",Wallet],["more","Mais",History]
  ];

  return <div className="app-shell">
    <header className="topbar">
      <div><div className="brand">✦ Central de Cuidados</div><div className="subbrand">Tudo da saúde da sua mãe em um só lugar.</div></div>
      <button className="notify-btn" onClick={requestNotifications}><Bell size={19}/> Ativar avisos</button>
    </header>

    <main className="page">
      {tab==="home" && <HomePage {...{dashboard,appointments,medications,reminders,expenses,setTab,setModal}}/>}
      {tab==="appointments" && <AppointmentsPage items={appointments} reload={load} setModal={setModal}/>}
      {tab==="medications" && <MedicationsPage items={medications} logs={logs} reload={load} setModal={setModal} notify={notify}/>}
      {tab==="expenses" && <ExpensesPage items={expenses} reload={load} setModal={setModal}/>}
      {tab==="more" && <MorePage reminders={reminders} history={history} reload={load} setModal={setModal}/>}
    </main>

    <nav className="bottom-nav">
      {nav.map(([id,label,Icon])=><button key={id} className={tab===id?"active":""} onClick={()=>setTab(id)}><Icon size={20}/><span>{label}</span></button>)}
    </nav>

    {modal?.type==="appointment" && <AppointmentModal onClose={()=>setModal(null)} reload={load}/>}
    {modal?.type==="expense" && <ExpenseModal onClose={()=>setModal(null)} reload={load}/>}
    {modal?.type==="reminder" && <ReminderModal onClose={()=>setModal(null)} reload={load}/>}
    {modal?.type==="medication" && <MedicationModal item={modal.item} onClose={()=>setModal(null)} reload={load}/>}
    {toast && <div className="toast">{toast}</div>}
  </div>
}

function HomePage({dashboard,medications,reminders,setTab,setModal}){
  const medsConfigured = medications.filter(m=>(m.schedule||[]).length);
  const nextMed = useMemo(()=>{
    const now=new Date(), mins=now.getHours()*60+now.getMinutes();
    let opts=[];
    medsConfigured.forEach(m=>(m.schedule||[]).forEach(t=>{
      const [h,mm]=t.split(":").map(Number); opts.push({m,t,delta:h*60+mm-mins});
    }));
    return opts.filter(x=>x.delta>=0).sort((a,b)=>a.delta-b.delta)[0]||null;
  },[medications]);

  return <>
    <section className="hello">
      <div><h1>Olá, Camilla 👋</h1><p>Organize os cuidados de hoje sem perder nada.</p></div>
      <div className="avatar">M</div>
    </section>

    <section className="hero-card">
      <div className="eyebrow">PRÓXIMA CONSULTA</div>
      {dashboard.nextAppointment ? <>
        <div className="hero-date">{fmtDate(dashboard.nextAppointment.date)} · {dashboard.nextAppointment.time||"Horário a confirmar"}</div>
        <strong>{dashboard.nextAppointment.title}</strong>
        <span>{dashboard.nextAppointment.place||dashboard.nextAppointment.specialty||""}</span>
      </> : <><div className="hero-date">Nenhuma consulta cadastrada</div><span>Cadastre a próxima para receber avisos.</span></>}
      <button onClick={()=>setTab("appointments")}>Ver agenda <ChevronRight size={17}/></button>
    </section>

    <section className="metric-grid">
      <Metric icon={<Bell/>} value={dashboard.pendingReminders||0} label="Lembretes pendentes"/>
      <Metric icon={<Pill/>} value={nextMed?nextMed.t:"—"} label={nextMed?nextMed.m.name:"Próximo remédio"}/>
      <Metric icon={<Wallet/>} value={money(dashboard.monthExpenses)} label="Gastos no mês"/>
      <Metric icon={<CalendarDays/>} value={dashboard.upcomingCount||0} label="Compromissos / 30 dias"/>
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

    {medications.some(m=>m.needs_schedule_confirmation) && <div className="warning"><AlertTriangle size={19}/><div><strong>Horários precisam ser confirmados</strong><p>Algumas receitas informam “manhã”, “noite” ou “a cada 12 horas”, sem horário exato. Ajuste em Medicamentos.</p></div></div>}
  </>
}

function Metric({icon,value,label}){return <div className="metric"><div className="metric-icon">{icon}</div><strong>{value}</strong><span>{label}</span></div>}
function Quick({icon,label,onClick}){return <button className="quick" onClick={onClick}>{icon}<span>{label}</span></button>}

function AppointmentsPage({items,reload,setModal}){
  const update=async(id,status)=>{await api(`/appointments/${id}`,{method:"PUT",body:JSON.stringify({status})});reload()};
  return <section>
    <div className="section-title"><div><h1>Consultas e exames</h1><p>Próximos compromissos e histórico.</p></div><button className="primary" onClick={()=>setModal({type:"appointment"})}><Plus size={18}/>Adicionar</button></div>
    <div className="list">
      {items.length===0?<Empty text="Nenhuma consulta cadastrada."/>:items.map(x=><div className="list-card" key={x.id}>
        <div className="date-tile"><b>{fmtDate(x.date).split(" ")[0]}</b><span>{fmtDate(x.date).split(" ")[1]}</span></div>
        <div className="grow"><strong>{x.title}</strong><span>{x.time||"Horário a confirmar"} {x.professional?`• ${x.professional}`:""}</span><small>{x.place||x.address||""}</small></div>
        {x.status==="upcoming"&&<button className="soft success" onClick={()=>update(x.id,"completed")}><Check size={16}/></button>}
      </div>)}
    </div>
  </section>
}

function MedicationsPage({items,logs,reload,setModal,notify}){
  const [glucose,setGlucose]=useState("");
  const take=async(m,time)=>{
    await api("/medication-logs",{method:"POST",body:JSON.stringify({medication_id:m.id,scheduled_at:`${today()}T${time||new Date().toTimeString().slice(0,5)}:00`})});
    notify(`${m.name}: registrado como tomado.`);
    reload();
  };
  const registerGlucose=async()=>{
    if(!glucose)return;
    const r=await api("/glucose",{method:"POST",body:JSON.stringify({value:Number(glucose)})});
    setGlucose("");
    const msg = r.suggested_units===null ? "Glicemia registrada. Consulte a orientação da receita/equipe." : `Glicemia registrada. Escala cadastrada: ${r.suggested_units} UI.`;
    notify(msg);
  };

  return <section>
    <div className="section-title"><div><h1>Medicamentos</h1><p>Horários, doses, estoque e tomadas.</p></div><button className="primary" onClick={()=>setModal({type:"medication"})}><Plus size={18}/>Adicionar</button></div>
    <div className="glucose-card">
      <div><Droplets/><strong>Registrar glicemia</strong><span>Usada para consultar a escala cadastrada da Insulina Regular.</span></div>
      <div className="glucose-action"><input type="number" placeholder="mg/dL" value={glucose} onChange={e=>setGlucose(e.target.value)}/><button onClick={registerGlucose}>Registrar</button></div>
    </div>
    <div className="list">
      {items.map(m=><div className="med-card" key={m.id}>
        <div className="med-top">
          <div className="med-icon">{m.name.toLowerCase().includes("insulina")?<Syringe/>:<Pill/>}</div>
          <div className="grow"><strong>{m.name}</strong><span>{m.dose}</span><small>{m.prescription_text}</small></div>
          <button className="soft" onClick={()=>setModal({type:"medication",item:m})}>Editar</button>
        </div>
        {(m.schedule||[]).length ? <div className="schedule-row">{m.schedule.map(t=><button key={t} onClick={()=>take(m,t)}><Clock3 size={15}/>{t}<span>Tomado</span></button>)}</div>
        : <div className="needs-confirm"><AlertTriangle size={16}/> Defina os horários reais deste medicamento.</div>}
        {m.stock!==null && <div className="stock">Estoque: <b>{m.stock} {m.stock_unit}</b>{m.stock<=m.low_stock_threshold&&<span> • estoque baixo</span>}</div>}
      </div>)}
    </div>
  </section>
}

function ExpensesPage({items,reload,setModal}){
  const month = today().slice(0,7);
  const monthItems=items.filter(x=>x.date?.startsWith(month));
  const total=monthItems.reduce((s,x)=>s+Number(x.amount),0);
  const cats=Object.entries(monthItems.reduce((a,x)=>(a[x.category]=(a[x.category]||0)+Number(x.amount),a),{})).sort((a,b)=>b[1]-a[1]);
  return <section>
    <div className="section-title"><div><h1>Gastos</h1><p>Controle tudo que foi gasto com os cuidados.</p></div><button className="primary" onClick={()=>setModal({type:"expense"})}><Plus size={18}/>Adicionar</button></div>
    <div className="expense-total"><span>Total no mês</span><strong>{money(total)}</strong><div>{cats.slice(0,4).map(([c,v])=><span key={c}>{c}: <b>{money(v)}</b></span>)}</div></div>
    <div className="list">
      {items.length===0?<Empty text="Nenhum gasto cadastrado."/>:items.map(x=><div className="list-card" key={x.id}>
        <div className="expense-icon"><Wallet/></div><div className="grow"><strong>{x.description}</strong><span>{x.category} • {fmtFull(x.date)}</span><small>{x.payment_method||""}</small></div><b>{money(x.amount)}</b>
      </div>)}
    </div>
  </section>
}

function MorePage({reminders,history,reload,setModal}){
  const toggle=async(r)=>{await api(`/reminders/${r.id}`,{method:"PUT",body:JSON.stringify({status:r.status==="completed"?"pending":"completed"})});reload()};
  return <section>
    <div className="section-title"><div><h1>Lembretes e histórico</h1><p>Pendências e tudo que já foi registrado.</p></div><button className="primary" onClick={()=>setModal({type:"reminder"})}><Plus size={18}/>Lembrete</button></div>
    <div className="two-col">
      <div>
        <h2 className="mini-title">Lembretes</h2>
        <div className="list">
          {reminders.length===0?<Empty text="Nenhum lembrete."/>:reminders.map(r=><button className={`reminder ${r.status==="completed"?"done":""}`} key={r.id} onClick={()=>toggle(r)}>
            <span className="check-circle">{r.status==="completed"?<Check size={15}/>:null}</span><div><strong>{r.title}</strong><span>{fmtFull(r.due_date)} {r.due_time||""}</span></div>
          </button>)}
        </div>
      </div>
      <div>
        <h2 className="mini-title">Histórico</h2>
        <div className="timeline">
          {history.length===0?<Empty text="O histórico aparecerá aqui."/>:history.map((h,i)=><div className="timeline-item" key={i}><div className="dot"/><div><strong>{h.title}</strong><span>{h.subtitle}</span><small>{fmtFull(h.date)}</small></div></div>)}
        </div>
      </div>
    </div>
  </section>
}

function Empty({text}){return <div className="empty">{text}</div>}

function AppointmentModal({onClose,reload}){
  const [f,setF]=useState({title:"",specialty:"",professional:"",place:"",date:today(),time:"",notes:"",status:"upcoming"});
  const save=async e=>{e.preventDefault();await api("/appointments",{method:"POST",body:JSON.stringify(f)});reload();onClose()};
  return <Modal title="Nova consulta / exame" onClose={onClose}><form onSubmit={save} className="form">
    <label>Título<input required value={f.title} onChange={e=>setF({...f,title:e.target.value})} placeholder="Ex.: Cardiologista"/></label>
    <div className="form-row"><label>Data<input required type="date" value={f.date} onChange={e=>setF({...f,date:e.target.value})}/></label><label>Horário<input type="time" value={f.time} onChange={e=>setF({...f,time:e.target.value})}/></label></div>
    <label>Profissional<input value={f.professional} onChange={e=>setF({...f,professional:e.target.value})}/></label>
    <label>Local<input value={f.place} onChange={e=>setF({...f,place:e.target.value})}/></label>
    <label>Observações<textarea value={f.notes} onChange={e=>setF({...f,notes:e.target.value})}/></label>
    <button className="primary wide">Salvar consulta</button>
  </form></Modal>
}

function ExpenseModal({onClose,reload}){
  const [f,setF]=useState({date:today(),category:"Medicamentos",description:"",amount:"",payment_method:""});
  const save=async e=>{e.preventDefault();await api("/expenses",{method:"POST",body:JSON.stringify({...f,amount:Number(f.amount)})});reload();onClose()};
  return <Modal title="Novo gasto" onClose={onClose}><form onSubmit={save} className="form">
    <div className="form-row"><label>Data<input type="date" value={f.date} onChange={e=>setF({...f,date:e.target.value})}/></label><label>Valor<input required type="number" step="0.01" value={f.amount} onChange={e=>setF({...f,amount:e.target.value})}/></label></div>
    <label>Categoria<select value={f.category} onChange={e=>setF({...f,category:e.target.value})}>{["Medicamentos","Consultas","Exames","Transporte","Alimentação","Higiene","Outros"].map(x=><option key={x}>{x}</option>)}</select></label>
    <label>Descrição<input required value={f.description} onChange={e=>setF({...f,description:e.target.value})}/></label>
    <label>Forma de pagamento<input value={f.payment_method} onChange={e=>setF({...f,payment_method:e.target.value})} placeholder="Pix, dinheiro, cartão..."/></label>
    <button className="primary wide">Salvar gasto</button>
  </form></Modal>
}

function ReminderModal({onClose,reload}){
  const [f,setF]=useState({title:"",due_date:today(),due_time:"",notes:"",status:"pending"});
  const save=async e=>{e.preventDefault();await api("/reminders",{method:"POST",body:JSON.stringify(f)});reload();onClose()};
  return <Modal title="Novo lembrete" onClose={onClose}><form onSubmit={save} className="form">
    <label>Lembrete<input required value={f.title} onChange={e=>setF({...f,title:e.target.value})} placeholder="Ex.: Retirar resultado"/></label>
    <div className="form-row"><label>Data<input type="date" value={f.due_date} onChange={e=>setF({...f,due_date:e.target.value})}/></label><label>Horário<input type="time" value={f.due_time} onChange={e=>setF({...f,due_time:e.target.value})}/></label></div>
    <label>Observações<textarea value={f.notes} onChange={e=>setF({...f,notes:e.target.value})}/></label>
    <button className="primary wide">Salvar lembrete</button>
  </form></Modal>
}

function MedicationModal({item,onClose,reload}){
  const [f,setF]=useState({
    name:item?.name||"", dose:item?.dose||"", frequency:item?.frequency||"",
    schedule:(item?.schedule||[]).join(","), prescription_text:item?.prescription_text||"",
    stock:item?.stock??"", stock_unit:item?.stock_unit||"comprimidos",
    low_stock_threshold:item?.low_stock_threshold??7, needs_schedule_confirmation:item?.needs_schedule_confirmation??0
  });
  const save=async e=>{
    e.preventDefault();
    const body={...f,stock:f.stock===""?null:Number(f.stock),low_stock_threshold:Number(f.low_stock_threshold),
      schedule:f.schedule.split(",").map(x=>x.trim()).filter(Boolean),needs_schedule_confirmation:0};
    if(item) await api(`/medications/${item.id}`,{method:"PUT",body:JSON.stringify(body)});
    else await api("/medications",{method:"POST",body:JSON.stringify(body)});
    reload();onClose()
  };
  return <Modal title={item?"Editar medicamento":"Novo medicamento"} onClose={onClose}><form onSubmit={save} className="form">
    <label>Medicamento<input required value={f.name} onChange={e=>setF({...f,name:e.target.value})}/></label>
    <div className="form-row"><label>Dose<input value={f.dose} onChange={e=>setF({...f,dose:e.target.value})}/></label><label>Frequência<input value={f.frequency} onChange={e=>setF({...f,frequency:e.target.value})}/></label></div>
    <label>Horários<input value={f.schedule} onChange={e=>setF({...f,schedule:e.target.value})} placeholder="08:00, 20:00"/><small>Separe os horários por vírgula.</small></label>
    <label>Texto da receita<textarea value={f.prescription_text} onChange={e=>setF({...f,prescription_text:e.target.value})}/></label>
    <div className="form-row"><label>Estoque<input type="number" value={f.stock} onChange={e=>setF({...f,stock:e.target.value})}/></label><label>Unidade<input value={f.stock_unit} onChange={e=>setF({...f,stock_unit:e.target.value})}/></label></div>
    <button className="primary wide">Salvar medicamento</button>
  </form></Modal>
}
