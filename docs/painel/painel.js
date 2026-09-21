// ============================================================================
//  PAINEL DO LABORATÓRIO — TV + gestão
//  Usa o mesmo projeto Firebase do Caderno (config em ../config.js).
//  Dados próprios do painel: coleção "lab" (ver firestore.rules).
// ============================================================================
import { FIREBASE_CONFIG, ORIENTADOR_EMAIL } from "../config.js";
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendEmailVerification, sendPasswordResetEmail, signOut
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  getFirestore, collection, doc, getDoc, setDoc, addDoc, deleteDoc, onSnapshot, writeBatch
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { gravarResumo, atualizarSeAntigo } from "./resumo.js";

const app = getApps()[0] || initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app); auth.languageCode = "pt";
const db = getFirestore(app);
const DONO = (ORIENTADOR_EMAIL || "").toLowerCase();

/* ---------------- estado ---------------- */
const GRUPOS = ["tarefas", "agenda", "conferencias", "mural", "equipamentos", "reservas", "estoque", "equipe"];
const S = Object.fromEntries(GRUPOS.map(c => [c, []]));
let CFG = { labNome: "LAB · UFSC", labSub: "Laboratório de Engenharia de Materiais", rotacaoSeg: 15, ultimoIncidente: "", incluirExemplos: false };
let RES = null;                               // lab/resumo (dados vindos do Caderno)
let ACESSO = { gestores: [], tv: [] };        // lab/acesso
let user = null, email = "", papel = "loading"; // dono | editor | gestor | tv | sem
let unsubs = [];

const SCHEMA = {
  tarefas: { label: "Pendências", one: "pendência", desc: "Tarefas do laboratório e quem cuida de cada uma. As abertas aparecem no painel, das atrasadas e mais urgentes para as demais.",
    fields: [
      { k: "titulo", l: "Tarefa", t: "text", req: 1, wide: 1 },
      { k: "responsavel", l: "Responsável", t: "member" },
      { k: "categoria", l: "Categoria", t: "select", o: ["manutenção", "compras", "limpeza", "segurança", "administrativo", "outros"] },
      { k: "prioridade", l: "Prioridade", t: "select", o: ["alta", "média", "baixa"] },
      { k: "status", l: "Status", t: "select", o: ["a fazer", "em andamento", "aguardando compra", "concluída"] },
      { k: "prazo", l: "Prazo", t: "date" }],
    cols: ["titulo", "responsavel", "prioridade", "status", "prazo"], sort: (a, b) => (a.status === "concluída") - (b.status === "concluída") || cmpDate(a.prazo, b.prazo) },
  agenda: { label: "Agenda extra", one: "evento", desc: "Palestras, seminários, reuniões e apresentações. Defesas e qualificações entram sozinhas a partir dos marcos do Caderno; use esta lista para o resto.",
    fields: [
      { k: "tipo", l: "Tipo", t: "select", o: ["Palestra", "Seminário do grupo", "Apresentação em congresso", "Defesa de TCC", "Banca externa", "Reunião", "Visita técnica", "Outro"] },
      { k: "pessoa", l: "Apresentador(a) / responsável", t: "member", req: 1 },
      { k: "titulo", l: "Título", t: "text", wide: 1 },
      { k: "local", l: "Local", t: "text" },
      { k: "data", l: "Data", t: "date", req: 1 },
      { k: "hora", l: "Hora", t: "time" }],
    cols: ["data", "hora", "tipo", "pessoa", "titulo"], sort: (a, b) => cmpDate(a.data, b.data) || (a.hora || "").localeCompare(b.hora || "") },
  conferencias: { label: "Conferências", one: "conferência", desc: "Congressos da área e seus prazos. Prazos nos próximos 30 dias ficam em destaque. As participações do grupo vêm do Caderno.",
    fields: [
      { k: "nome", l: "Nome", t: "text", req: 1, wide: 1 },
      { k: "local", l: "Local", t: "text" },
      { k: "url", l: "Site", t: "text" },
      { k: "inicio", l: "Início", t: "date" },
      { k: "fim", l: "Término", t: "date" },
      { k: "deadline", l: "Próximo prazo", t: "date" },
      { k: "deadlineLabel", l: "Descrição do prazo", t: "text" }],
    cols: ["nome", "local", "inicio", "deadline", "deadlineLabel"], sort: (a, b) => cmpDate(a.deadline || a.inicio, b.deadline || b.inicio) },
  mural: { label: "Mural", one: "item do mural", desc: "Notícias da área, informes da UFSC, curiosidades científicas e avisos. Os avisos correm na faixa inferior do painel.",
    fields: [
      { k: "tipo", l: "Tipo", t: "select", o: ["Notícia da área", "UFSC", "Curiosidade", "Aviso"] },
      { k: "data", l: "Data", t: "date" },
      { k: "titulo", l: "Título", t: "text", req: 1, wide: 1 },
      { k: "texto", l: "Texto", t: "textarea", wide: 1 },
      { k: "fonte", l: "Fonte", t: "text", wide: 1 }],
    cols: ["tipo", "titulo", "fonte", "data"], sort: (a, b) => (a.tipo || "").localeCompare(b.tipo || "") || cmpDate(b.data, a.data) },
  equipamentos: { label: "Equipamentos", one: "equipamento", desc: "Situação de cada equipamento. Os que estão fora de operação aparecem sinalizados no painel.",
    fields: [
      { k: "nome", l: "Equipamento", t: "text", req: 1, wide: 1 },
      { k: "local", l: "Sala", t: "text" },
      { k: "status", l: "Situação", t: "select", o: ["operacional", "uso restrito", "em manutenção", "fora de uso"] },
      { k: "responsavel", l: "Responsável", t: "member" },
      { k: "proxManutencao", l: "Próxima manutenção/calibração", t: "date" },
      { k: "obs", l: "Observação", t: "text", wide: 1 }],
    cols: ["nome", "local", "status", "responsavel", "proxManutencao"], sort: (a, b) => (a.nome || "").localeCompare(b.nome || "") },
  reservas: { label: "Reservas", one: "reserva", desc: "Agendamento de uso dos equipamentos. As reservas do dia aparecem no painel.",
    fields: [
      { k: "equipamento", l: "Equipamento", t: "equip", req: 1, wide: 1 },
      { k: "pessoa", l: "Quem vai usar", t: "member", req: 1 },
      { k: "data", l: "Data", t: "date", req: 1 },
      { k: "inicio", l: "Início", t: "time" },
      { k: "fim", l: "Fim", t: "time" },
      { k: "obs", l: "Observação", t: "text", wide: 1 }],
    cols: ["data", "inicio", "fim", "equipamento", "pessoa"], sort: (a, b) => cmpDate(a.data, b.data) || (a.inicio || "").localeCompare(b.inicio || "") },
  estoque: { label: "Estoque", one: "item de estoque", desc: "Consumíveis e reagentes. Itens abaixo do mínimo aparecem no painel como alerta de reposição.",
    fields: [
      { k: "item", l: "Item", t: "text", req: 1, wide: 1 },
      { k: "quantidade", l: "Quantidade", t: "number" },
      { k: "minimo", l: "Mínimo", t: "number" },
      { k: "unidade", l: "Unidade", t: "text" },
      { k: "local", l: "Local", t: "text" }],
    cols: ["item", "quantidade", "minimo", "unidade", "local"], sort: (a, b) => low(b) - low(a) || (a.item || "").localeCompare(b.item || "") },
  equipe: { label: "Equipe (outros)", one: "pessoa", desc: "Quem é do laboratório mas não está no Caderno: professores, técnicos, visitantes. Os orientandos ativos já entram sozinhos.",
    fields: [
      { k: "nome", l: "Nome", t: "text", req: 1, wide: 1 },
      { k: "funcao", l: "Função", t: "select", o: ["Coordenador(a)", "Professor(a)", "Técnico(a)", "Pós-doc", "Visitante", "Outro"] },
      { k: "email", l: "E-mail", t: "text" },
      { k: "aniversario", l: "Aniversário", t: "text", hint: "dd/mm" }],
    cols: ["nome", "funcao", "email", "aniversario"], sort: (a, b) => (a.nome || "").localeCompare(b.nome || "") }
};

// Sugestões iniciais (reais, verificadas em set/2026) — carregadas por botão na gestão.
const SUGESTOES = {
  conferencias: [
    { nome: "26º CBECiMat", local: "Florianópolis, SC", inicio: "2026-11-22", fim: "2026-11-26", deadline: "2026-09-30", deadlineLabel: "Submissão de pôsteres tardios", url: "https://www.cbecimat.com.br" },
    { nome: "26º CBECiMat — e-pôster e resumo revisado", local: "Florianópolis, SC", inicio: "2026-11-22", fim: "2026-11-26", deadline: "2026-10-22", deadlineLabel: "Envio de resumo revisado e e-pôster", url: "https://www.cbecimat.com.br/datas-importantes" },
    { nome: "XXIV B-MRS Meeting (SBPMat)", local: "Curitiba, PR", inicio: "2026-09-27", fim: "2026-10-01", deadline: "", deadlineLabel: "Submissões encerradas", url: "https://www.sbpmat.org.br/24encontro/" },
    { nome: "2027 MRS Spring Meeting", local: "Seattle, EUA", inicio: "2027-04-01", fim: "", deadline: "", deadlineLabel: "Prazo de resumos a confirmar", url: "https://www.mrs.org/meetings-events/annual-meetings/2027-mrs-spring-meeting-exhibit" },
    { nome: "E-MRS 2027 Spring Meeting", local: "Estrasburgo, França", inicio: "2027-05-17", fim: "2027-05-21", deadline: "", deadlineLabel: "Prazo de resumos a confirmar", url: "https://www.european-mrs.com/meetings/2027-spring-meeting-exhibit" }],
  mural: [
    { tipo: "Notícia da área", titulo: "Microscópio eletrônico assistido por computador quântico", texto: "Pesquisadores combinam microscopia eletrônica e computação quântica para extrair mais informação com menos elétrons, preservando amostras sensíveis.", fonte: "ScienceDaily", data: "2026-09-15" },
    { tipo: "Notícia da área", titulo: "Membranas ultrafinas de diamante geram eletricidade", texto: "Membranas de diamante flexíveis apresentaram efeito piezoelétrico inesperado, abrindo novas aplicações em sensores.", fonte: "ScienceDaily", data: "2026-08-31" },
    { tipo: "Notícia da área", titulo: "Nova rota química produz nanocristais de nitretos metálicos em escala", texto: "Nanocristais considerados difíceis de sintetizar ganham rota escalável, com potencial para LEDs, implantes e supercondutores.", fonte: "ScienceDaily", data: "2026-08-30" },
    { tipo: "UFSC", titulo: "23ª Sepex: 19 a 23 de outubro", texto: "Propostas de minicursos, estandes e roteiros temáticos pelo sgsepex.ufsc.br.", fonte: "Notícias UFSC", data: "2026-09-04" },
    { tipo: "UFSC", titulo: "Semestre 2026.2 termina em 12 de dezembro", texto: "Confira o calendário acadêmico completo no site do DAE.", fonte: "Calendário acadêmico UFSC", data: "2026-08-10" },
    { tipo: "Curiosidade", titulo: "O tungstênio só funde a 3.422 °C", texto: "É o metal com o maior ponto de fusão — por isso é usado em filamentos, eletrodos TIG e resistências de fornos a vácuo.", fonte: "", data: "" },
    { tipo: "Curiosidade", titulo: "Gálio derrete na palma da mão", texto: "Com ponto de fusão de 29,8 °C, o gálio passa ao estado líquido com o calor do corpo humano.", fonte: "", data: "" },
    { tipo: "Curiosidade", titulo: "O concreto romano se autorregenera", texto: "Clastos de cal na mistura reagem com a água que infiltra nas trincas e precipitam carbonato de cálcio, selando-as.", fonte: "", data: "" },
    { tipo: "Curiosidade", titulo: "As cores do revenimento revelam a temperatura", texto: "Aço aquecido ao ar forma uma camada de óxido cuja cor muda com a espessura: palha perto de 220 °C, bronze a 250 °C, azul por volta de 300 °C.", fonte: "", data: "" },
    { tipo: "Aviso", titulo: "Jaleco, óculos de segurança e sapato fechado são obrigatórios no laboratório", texto: "", fonte: "", data: "" },
    { tipo: "Aviso", titulo: "Registre toda reserva de equipamento no painel antes de usar", texto: "", fonte: "", data: "" },
    { tipo: "Aviso", titulo: "Resíduos químicos nunca devem ser descartados na pia", texto: "", fonte: "", data: "" }]
};

/* ---------------- utilidades ---------------- */
const $ = s => document.querySelector(s);
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function pd(s) { if (!s) return null; const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
function cmpDate(a, b) { const x = pd(a), y = pd(b); if (!x && !y) return 0; if (!x) return 1; if (!y) return -1; return x - y; }
function today() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function iso(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function days(s) { const d = pd(s); return d ? Math.round((d - today()) / 864e5) : null; }
function fdate(s, opt) { const d = pd(s); return d ? d.toLocaleDateString("pt-BR", opt || { day: "2-digit", month: "2-digit", year: "numeric" }) : ""; }
function fshort(s) { const d = pd(s); return d ? d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "") : ""; }
function low(x) { return (Number(x.minimo) > 0 && Number(x.quantidade) < Number(x.minimo)) ? 1 : 0; }
const PRIO = { alta: "crit", "média": "warn", baixa: "blue" };
const EQ = { operacional: "ok", "uso restrito": "blue", "em manutenção": "warn", "fora de uso": "crit" };
const STC = { "a fazer": "", "em andamento": "blue", "aguardando compra": "warn", "concluída": "ok" };
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => t.hidden = true, 3200); }
const podeGerir = () => ["dono", "editor", "gestor"].includes(papel);
const ehEditor = () => papel === "dono" || papel === "editor";
function errMsg(e) {
  const c = e && e.code || "";
  if (c.includes("permission")) return "Sem permissão para esta ação. Confirme com o orientador se o seu e-mail está na lista de gestores.";
  if (c.includes("unavailable")) return "Sem ligação à internet. Tente de novo em instantes.";
  return "Não foi possível concluir. Tente novamente.";
}
function membros() {   // nomes para os campos de responsável
  const n = new Set();
  (RES?.membros || []).forEach(m => n.add(m.nome));
  S.equipe.forEach(m => m.nome && n.add(m.nome));
  return [...n].sort((a, b) => a.localeCompare(b));
}

/* ---------------- modo ---------------- */
function modoInicial() {
  const q = new URLSearchParams(location.search);
  if (q.has("tv") || location.hash === "#tv") return "tv";
  if (location.hash === "#gestao") return "admin";
  try { return localStorage.getItem("painel-modo") || "tv"; } catch (e) { return "tv"; }
}
let mode = modoInicial();
function setMode(m) { if (m === "admin" && !podeGerir()) m = "tv"; mode = m; try { localStorage.setItem("painel-modo", m); } catch (e) { } render(); }

/* ================= ENTRADA ================= */
function telaEntrada(estado, msg) {
  const e = $("#entrada");
  if (estado === "verificar") {
    e.innerHTML = `<div class="login"><h1>Confirme o seu e-mail</h1>
      <p>Enviámos um link de confirmação para <b>${esc(email)}</b>. Abra-o (veja também o spam) e volte aqui.</p>
      <div class="row"><button class="btn pri" type="button" data-a="ja">Já confirmei</button><button class="btn" type="button" data-a="reenviar">Reenviar link</button><button class="btn ghost" type="button" data-a="sair">Sair</button></div>
      <div class="msg" id="lmsg">${esc(msg || "")}</div></div>`;
  } else if (estado === "sem") {
    e.innerHTML = `<div class="login"><h1>Acesso pendente</h1>
      <p>A conta <b>${esc(email)}</b> ainda não tem acesso ao painel. Peça ao orientador para a incluir em <b>Gestão → Acessos</b> (como gestor ou como TV) e depois recarregue esta página.</p>
      <div class="row"><button class="btn pri" type="button" data-a="recarregar">Recarregar</button><button class="btn ghost" type="button" data-a="sair">Sair</button></div></div>`;
  } else {
    e.innerHTML = `<form class="login" id="flogin"><h1>Painel do laboratório</h1>
      <p>Entre com a mesma conta que usa no Caderno de Orientação. A TV usa uma conta própria, só de leitura.</p>
      <div class="f"><label for="l-email">E-mail</label><input id="l-email" type="email" autocomplete="username" required></div>
      <div class="f"><label for="l-senha">Senha</label><input id="l-senha" type="password" autocomplete="current-password" minlength="6" required></div>
      <div class="row"><button class="btn pri" type="submit">Entrar</button><button class="btn" type="button" data-a="criar">Criar conta</button></div>
      <div class="links"><button class="linkbtn" type="button" data-a="esqueci">Esqueci a senha</button><a class="linkbtn" href="../">Abrir o Caderno</a></div>
      <div class="msg" id="lmsg">${esc(msg || "")}</div></form>`;
  }
  mostrar("entrada");
}
function lmsg(t, err) { const m = $("#lmsg"); if (m) { m.textContent = t; m.className = "msg" + (err ? " err" : ""); } }
function erroAuth(e) {
  const c = e && e.code || "";
  if (/invalid-credential|wrong-password|user-not-found/.test(c)) return "E-mail ou senha incorretos.";
  if (c.includes("email-already-in-use")) return "Já existe uma conta com este e-mail. Use “Entrar”.";
  if (c.includes("weak-password")) return "A senha precisa de pelo menos 6 caracteres.";
  if (c.includes("too-many-requests")) return "Muitas tentativas. Espere alguns minutos.";
  if (c.includes("unauthorized-domain")) return "Este endereço não está autorizado no Firebase (Authentication → Domínios autorizados).";
  return "Não foi possível entrar. Verifique a ligação e tente de novo.";
}

/* ================= PAPEL E DADOS ================= */
async function detectarPapel() {
  if (email === DONO) return "dono";
  let editor = false;
  try { await getDoc(doc(db, "config", "acesso")); editor = true; } catch (e) { }
  if (editor) return "editor";
  try {
    const s = await getDoc(doc(db, "lab", "acesso")); const a = s.exists() ? s.data() : {};
    if ((a.gestores || []).map(x => x.toLowerCase()).includes(email)) return "gestor";
    if ((a.tv || []).map(x => x.toLowerCase()).includes(email)) return "tv";
  } catch (e) { }
  return "sem";
}
function assinar() {
  unsubs.forEach(u => u()); unsubs = [];
  for (const g of GRUPOS) unsubs.push(onSnapshot(collection(db, "lab", g, "itens"), s => { S[g] = s.docs.map(d => ({ ...d.data(), id: d.id })); render(); }, e => console.warn(g, e)));
  unsubs.push(onSnapshot(doc(db, "lab", "config"), s => { const prev = CFG.rotacaoSeg; if (s.exists()) CFG = { ...CFG, ...s.data() }; if (prev !== CFG.rotacaoSeg) startRotation(); render(); }, e => console.warn(e)));
  unsubs.push(onSnapshot(doc(db, "lab", "resumo"), s => { RES = s.exists() ? s.data() : null; render(); }, e => console.warn(e)));
  if (papel === "dono") unsubs.push(onSnapshot(doc(db, "lab", "acesso"), s => { ACESSO = { gestores: [], tv: [], ...(s.exists() ? s.data() : {}) }; if (mode === "admin") render(); }, e => console.warn(e)));
}

onAuthStateChanged(auth, async u => {
  unsubs.forEach(x => x()); unsubs = [];
  user = u; email = (u?.email || "").toLowerCase();
  if (!u) { papel = "loading"; telaEntrada("login"); return; }
  if (!u.emailVerified) { telaEntrada("verificar"); return; }
  papel = await detectarPapel();
  if (papel === "sem") { telaEntrada("sem"); return; }
  if (!podeGerir()) mode = "tv";
  assinar();
  if (ehEditor()) atualizarSeAntigo(db, email, 60).then(f => f && toast("Dados do Caderno atualizados")).catch(() => { });
  render(); startRotation();
});

/* ================= PAINEL TV ================= */
let rotIdx = 0, rotTimer = null, slides = [];
function openTasks() {
  const ord = { alta: 0, "média": 1, baixa: 2 };
  return S.tarefas.filter(t => t.status !== "concluída").sort((a, b) => {
    const la = (days(a.prazo) ?? 99) < 0, lb = (days(b.prazo) ?? 99) < 0;
    return (lb - la) || (ord[a.prioridade] ?? 3) - (ord[b.prioridade] ?? 3) || cmpDate(a.prazo, b.prazo);
  });
}
function aniversariantes(soHoje) {
  const d = today(), m = d.getMonth() + 1, dia = d.getDate(), out = [];
  for (const a of (RES?.aniversarios || [])) if (a.mes === m && (!soHoje || a.dia === dia)) out.push({ nome: a.nome, dia: a.dia, info: a.nivel });
  for (const p of S.equipe) { const x = /^(\d{1,2})\/(\d{1,2})/.exec(p.aniversario || ""); if (x && +x[2] === m && (!soHoje || +x[1] === dia)) out.push({ nome: p.nome, dia: +x[1], info: p.funcao || "" }); }
  return out.sort((a, b) => a.dia - b.dia);
}
function eventos() {
  const t = iso(today());
  const doCaderno = (RES?.marcos || []).filter(m => m.data >= t).map(m => ({ tipo: m.rotulo, pessoa: m.nome, titulo: m.titulo, data: m.data, hora: "", local: "", cad: 1 }));
  const extra = S.agenda.filter(e => e.data && e.data >= t);
  return [...doCaderno, ...extra].sort((a, b) => cmpDate(a.data, b.data) || (a.hora || "").localeCompare(b.hora || ""));
}
function tvTasks() {
  const open = openTasks(), late = open.filter(t => (days(t.prazo) ?? 1) < 0).length, hi = open.filter(t => t.prioridade === "alta").length;
  const lowStock = S.estoque.filter(low), maxT = lowStock.length ? 4 : 6;
  const rows = open.slice(0, maxT).map(t => {
    const d = days(t.prazo); let cls = "", txt = t.prazo ? fshort(t.prazo) : "sem prazo";
    if (d !== null) { if (d < 0) { cls = "late"; txt = `atrasada ${-d}d`; } else if (d === 0) { cls = "late"; txt = "hoje"; } else if (d <= 3) { cls = "soon"; txt = d === 1 ? "amanhã" : `em ${d} dias`; } }
    return `<div class="task"><span class="dot ${PRIO[t.prioridade] || ""}" title="prioridade ${esc(t.prioridade)}"></span>
      <div class="tt">${esc(t.titulo)}</div><div class="due ${cls}">${esc(txt)}</div>
      <div class="who">${esc(t.responsavel || "sem responsável")}${t.categoria ? " · " + esc(t.categoria) : ""}</div>
      <div class="st">${t.status && t.status !== "a fazer" ? `<span class="chip ${STC[t.status] || ""}">${esc(t.status)}</span>` : ""}</div></div>`;
  }).join("");
  return `<section class="panel grow"><div class="ph"><h2>Pendências</h2><span class="meta">${open.length} abertas</span></div>
    <div class="summary">${late ? `<span class="chip crit">${late} atrasada${late > 1 ? "s" : ""}</span>` : ""}${hi ? `<span class="chip warn">${hi} prioridade alta</span>` : ""}</div>
    ${rows || `<div class="empty">Nenhuma pendência aberta.</div>`}
    ${open.length > maxT ? `<div class="more">+ ${open.length - maxT} outras pendências</div>` : ""}</section>
    ${lowStock.length ? `<section class="panel"><div class="ph"><h2>Repor estoque</h2><span class="meta">abaixo do mínimo</span></div>
      <div class="stock">${lowStock.slice(0, 5).map(s => `<span>${esc(s.item)}</span><span class="q">${esc(s.quantidade)}/${esc(s.minimo)} ${esc(s.unidade || "")}</span>`).join("")}</div></section>` : ""}`;
}
function tvAgenda() {
  const t = iso(today()), evs = eventos().slice(0, 3);
  const rows = evs.map(e => {
    const d = days(e.data);
    return `<div class="ev"><div class="cd ${d <= 7 ? "now" : ""}"><b>${d === 0 ? "HOJE" : d}</b><small>${d === 0 ? fshort(e.data) : d === 1 ? "dia" : "dias"}</small></div>
      <div><span class="chip ${/defesa|qualifica|TCC|semin[aá]rio de IC/i.test(e.tipo) ? "warn" : "blue"}">${esc(e.tipo)}</span>
      <div class="who" style="margin-top:.3em">${esc(e.pessoa)}</div>
      ${e.titulo ? `<div class="ti">${esc(e.titulo)}</div>` : ""}
      <div class="wh">${esc(fdate(e.data, { weekday: "short", day: "2-digit", month: "short" }))}${e.hora ? " · " + esc(e.hora) : ""}${e.local ? " · " + esc(e.local) : ""}</div></div></div>`;
  }).join("");
  const bk = S.reservas.filter(r => r.data === t).sort(SCHEMA.reservas.sort);
  const ordem = ["fora de uso", "em manutenção", "uso restrito", "operacional"];
  const eqs = S.equipamentos.slice().sort((a, b) => ordem.indexOf(a.status) - ordem.indexOf(b.status));
  const down = eqs.filter(e => e.status === "fora de uso" || e.status === "em manutenção").length;
  const curto = { "em manutenção": "manutenção", "uso restrito": "restrito" };
  return `<section class="panel grow"><div class="ph"><h2>Agenda do grupo</h2><span class="meta">próximos eventos</span></div>
    ${rows || `<div class="empty">Nenhum evento agendado.</div>`}</section>
    <section class="panel"><div class="ph"><h2>Equipamentos</h2><span class="meta">${eqs.length - down}/${eqs.length} disponíveis</span></div>
      <div class="equip">${eqs.slice(0, 10).map(e => `<div class="eq" title="${esc(e.status)}"><span class="dot ${EQ[e.status] || ""}"></span><span>${esc(e.nome)}${e.status && e.status !== "operacional" ? ` <span style="color:var(--ink3)">— ${esc(curto[e.status] || e.status)}</span>` : ""}</span></div>`).join("") || `<div class="empty">Sem equipamentos cadastrados.</div>`}</div>
      <div class="bk"><span class="eyebrow" style="grid-column:1/-1">Reservas de hoje</span>
      ${bk.length ? bk.slice(0, 4).map(r => `<span class="h">${esc(r.inicio || "")}–${esc(r.fim || "")}</span><span>${esc(r.equipamento)} <span class="n">· ${esc(r.pessoa)}</span></span>`).join("") : `<span class="n" style="grid-column:1/-1">Nenhuma reserva para hoje.</span>`}</div>
    </section>`;
}
function buildSlides() {
  const out = [], t = iso(today());
  const pubs = (RES?.publicacoes || []).slice(0, 4);
  if (pubs.length) out.push({ k: "Publicações do grupo", html: pubs.map(p => `<div class="item"><h3>${esc(p.titulo)}</h3>${p.autores?.length ? `<p>${esc(p.autores.join(", "))}</p>` : ""}<div class="src">${esc(p.veiculo)}${p.data ? " · " + esc(fdate(p.data, { month: "short", year: "numeric" })) : ""}${p.doi ? " · doi " + esc(p.doi) : ""}</div></div>`).join("") });
  const cong = (RES?.congressos || []).slice(0, 4);
  if (cong.length) out.push({ k: "O grupo em congressos", html: cong.map(c => `<div class="item"><h3>${esc(c.veiculo || c.titulo)}</h3><p>${esc(c.autores?.join(", ") || "")}${c.veiculo && c.titulo ? " — " + esc(c.titulo) : ""}</p><div class="src">${esc(c.tipo)}${c.data ? " · " + esc(fdate(c.data)) : ""}${c.data && c.data < t ? ' · <span class="tag">realizado</span>' : ""}</div></div>`).join("") });
  const confs = S.conferencias.filter(c => (c.fim || c.inicio || "9999") >= t).sort(SCHEMA.conferencias.sort).slice(0, 4);
  if (confs.length) out.push({ k: "Conferências e prazos", html: confs.map(c => {
    const d = c.deadline ? days(c.deadline) : null;
    const dl = d !== null && d >= 0 ? `<span class="chip ${d <= 30 ? "crit" : "blue"}">prazo em ${d} dia${d === 1 ? "" : "s"}</span>` : "";
    const ano = pd(c.inicio)?.getFullYear() || "";
    return `<div class="item conf"><h3>${esc(c.nome)}</h3><p>${esc(c.local)}${c.inicio ? " · " + esc(fshort(c.inicio)) + (c.fim ? "–" + esc(fshort(c.fim)) : "") + " " + ano : ""}</p>
      <div class="dl"><span class="src" style="margin:0">${esc(c.deadlineLabel || "")}${c.deadline ? " · " + esc(fdate(c.deadline)) : ""}</span>${dl}</div></div>`;
  }).join("") });
  const prem = RES?.premios || [];
  if (prem.length) out.push({ k: "Prêmios e distinções", html: prem.slice(0, 4).map(p => `<div class="item"><h3>${esc(p.titulo)}</h3><p>${esc(p.autores?.join(", ") || "")}</p><div class="src">${esc(p.veiculo)}${p.data ? " · " + esc(fdate(p.data, { month: "short", year: "numeric" })) : ""}</div></div>`).join("") });
  const news = S.mural.filter(m => m.tipo === "Notícia da área").sort((a, b) => cmpDate(b.data, a.data)).slice(0, 3);
  if (news.length) out.push({ k: "Notícias da área", html: news.map(n => `<div class="item"><h3>${esc(n.titulo)}</h3>${n.texto ? `<p>${esc(n.texto)}</p>` : ""}<div class="src">${esc(n.fonte || "")}${n.data ? " · " + esc(fshort(n.data)) : ""}</div></div>`).join("") });
  const ufsc = S.mural.filter(m => m.tipo === "UFSC").sort((a, b) => cmpDate(b.data, a.data)).slice(0, 3);
  if (ufsc.length) out.push({ k: "Informes da UFSC", html: ufsc.map(n => `<div class="item"><h3>${esc(n.titulo)}</h3>${n.texto ? `<p>${esc(n.texto)}</p>` : ""}<div class="src">${esc(n.fonte || "")}</div></div>`).join("") });
  const cur = S.mural.filter(m => m.tipo === "Curiosidade");
  if (cur.length) { const c = cur[Math.floor(Date.now() / 36e5) % cur.length]; out.push({ k: "Curiosidade científica", html: `<div class="big-fact"><h3>${esc(c.titulo)}</h3>${c.texto ? `<p>${esc(c.texto)}</p>` : ""}</div>` }); }
  const bd = aniversariantes(false);
  if (bd.length) out.push({ k: "Aniversariantes do mês", html: bd.map(p => `<div class="item"><h3>${esc(p.nome)}</h3><div class="src">${String(p.dia).padStart(2, "0")}/${String(today().getMonth() + 1).padStart(2, "0")} · ${esc(p.info)}</div></div>`).join("") });
  return out;
}
function tvRot() {
  slides = buildSlides(); if (rotIdx >= slides.length) rotIdx = 0;
  const s = slides[rotIdx];
  return `<section class="panel rot" style="--rot:${Math.max(5, +CFG.rotacaoSeg || 15)}s">
    <div class="rot-tabs">${slides.map((_, i) => `<i class="${i === rotIdx ? "on" : i < rotIdx ? "done" : ""}"></i>`).join("")}</div>
    ${s ? `<div class="ph"><h2>${esc(s.k)}</h2><span class="meta">${rotIdx + 1}/${slides.length}</span></div><div class="slide">${s.html}</div>` : `<div class="empty">Cadastre conferências e itens do mural na Gestão; publicações e congressos vêm do Caderno.</div>`}
  </section>`;
}
function renderRot() { const c = $("#rotcol"); if (c) c.innerHTML = tvRot(); }
function composicao() {
  const c = RES?.contagem || {}; const curto = { "Iniciação científica": "IC", "Estágio": "estágio", "Mestrado": "mestrado", "Doutorado": "doutorado", "Pós-doutorado": "pós-doc" };
  const partes = Object.entries(c).map(([k, v]) => `${v} ${curto[k] || k}`);
  const tot = Object.values(c).reduce((a, b) => a + b, 0);
  return tot ? `${tot} orientandos · ${partes.join(" · ")}` : "";
}
function renderTV() {
  const inc = CFG.ultimoIncidente ? Math.max(0, -days(CFG.ultimoIncidente)) : null;
  const avisos = S.mural.filter(m => m.tipo === "Aviso");
  const hoje = aniversariantes(true), comp = composicao();
  $("#tv").innerHTML = `
    <header class="tv-top">
      <div class="brand"><h1>${esc(CFG.labNome)}</h1><p>${esc(CFG.labSub)}${comp ? ` · <span style="color:var(--ink3)">${esc(comp)}</span>` : ""}</p>
        ${hoje.length ? `<div class="bday">Parabéns, ${esc(hoje.map(p => p.nome.split(" ")[0]).join(" e "))}! Feliz aniversário.</div>` : ""}</div>
      ${inc !== null ? `<div class="safety"><b>${inc}</b><span>dias sem acidentes</span></div>` : "<div></div>"}
      <div class="clock"><div class="t" id="clk"></div><div class="d" id="clkd"></div></div>
    </header>
    <main class="tv-grid">
      <div class="col">${tvTasks()}</div>
      <div class="col">${tvAgenda()}</div>
      <div class="col" id="rotcol">${tvRot()}</div>
    </main>
    <footer class="ticker"><span class="lab">Avisos</span><div class="track"><div class="run" style="--dur:${Math.max(30, avisos.reduce((n, a) => n + (a.titulo || "").length, 0) * 0.28)}s">${avisos.map(a => `<span>${esc(a.titulo)}</span>`).join("") || "<span>Sem avisos no momento</span>"}</div></div></footer>`;
  tick();
}
function tick() {
  const n = new Date(), c = $("#clk"), d = $("#clkd"); if (!c) return;
  c.textContent = n.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const s = n.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }); d.textContent = s.charAt(0).toUpperCase() + s.slice(1);
}
function startRotation() { clearInterval(rotTimer); rotTimer = setInterval(() => { if (mode !== "tv") return; rotIdx = (rotIdx + 1) % Math.max(1, slides.length); renderRot(); }, Math.max(5, +CFG.rotacaoSeg || 15) * 1000); }

/* ================= GESTÃO ================= */
let tab = "tarefas", hideDone = true, editing = null;
function counts(c) {
  if (c === "tarefas") { const o = openTasks(), late = o.filter(t => (days(t.prazo) ?? 1) < 0).length; return `<span class="n ${late ? "alert" : ""}">${o.length}${late ? ` · ${late}!` : ""}</span>`; }
  if (c === "estoque") { const l = S.estoque.filter(low).length; return `<span class="n ${l ? "alert" : ""}">${S.estoque.length}${l ? ` · ${l}↓` : ""}</span>`; }
  return `<span class="n">${S[c].length}</span>`;
}
function cell(c, f, r) {
  const v = r[f], def = SCHEMA[c].fields.find(x => x.k === f);
  if (def && def.t === "date") {
    if (c === "tarefas" && f === "prazo" && v && r.status !== "concluída" && days(v) < 0) return `<span class="mono" style="color:var(--crit);font-weight:600">${esc(fdate(v))}</span>`;
    if (c === "conferencias" && f === "deadline" && v) { const d = days(v); return `<span class="mono">${esc(fdate(v))}</span> <span class="muted">${d >= 0 ? `(${d}d)` : "(encerrado)"}</span>`; }
    return `<span class="mono">${esc(fdate(v))}</span>`;
  }
  if (f === "prioridade") return v ? `<span class="chip ${PRIO[v] || ""}">${esc(v)}</span>` : "";
  if (f === "status" && c === "tarefas") return v ? `<span class="chip ${STC[v] || ""}">${esc(v)}</span>` : "";
  if (f === "status" && c === "equipamentos") return v ? `<span class="chip ${EQ[v] || ""}">${esc(v)}</span>` : "";
  if (c === "estoque" && f === "quantidade") return `<span class="mono" style="${low(r) ? "color:var(--crit);font-weight:600" : ""}">${esc(v)}</span>`;
  return esc(v);
}
function renderAdmin() {
  let body;
  if (tab === "caderno") body = renderCaderno();
  else if (tab === "config") body = renderCfg();
  else if (tab === "acessos") body = renderAcessos();
  else {
    const sc = SCHEMA[tab]; let rows = S[tab].slice().sort(sc.sort);
    if (tab === "tarefas" && hideDone) rows = rows.filter(r => r.status !== "concluída");
    const sugerir = (tab === "conferencias" || tab === "mural") && !S[tab].length;
    body = `<div class="sec-head"><div><h2>${sc.label}</h2><p>${sc.desc}</p></div>
      <div class="tools">
        ${tab === "tarefas" ? `<label><input type="checkbox" id="hideDone" ${hideDone ? "checked" : ""}> Ocultar concluídas</label>` : ""}
        ${sugerir ? `<button class="btn" type="button" data-act="sugestoes">Carregar sugestões iniciais</button>` : ""}
        <button class="btn pri" type="button" data-act="new">+ Adicionar ${sc.one}</button></div></div>
      <div class="tbl-wrap"><table><thead><tr>${sc.cols.map(f => `<th>${esc(sc.fields.find(x => x.k === f).l)}</th>`).join("")}<th></th></tr></thead>
      <tbody>${rows.length ? rows.map(r => `<tr class="${tab === "tarefas" && r.status === "concluída" ? "done" : ""}">${sc.cols.map(f => `<td>${cell(tab, f, r)}</td>`).join("")}
        <td class="act">${tab === "tarefas" && r.status !== "concluída" ? `<button class="btn sm" type="button" data-act="done" data-id="${esc(r.id)}">Concluir</button> ` : ""}<button class="btn sm ghost" type="button" data-act="edit" data-id="${esc(r.id)}">Editar</button><button class="btn sm ghost danger" type="button" data-act="del" data-id="${esc(r.id)}">Excluir</button></td></tr>`).join("")
        : `<tr><td colspan="${sc.cols.length + 1}" class="muted" style="padding:22px 12px">Nada cadastrado ainda. Use “Adicionar ${sc.one}”.</td></tr>`}</tbody></table></div>`;
  }
  const papelTxt = { dono: "orientador", editor: "co-editor", gestor: "gestor do painel" }[papel] || "";
  $("#admin").innerHTML = `<div class="a-wrap">
    <header class="a-head"><div><h1>${esc(CFG.labNome)} · Gestão</h1><p>${esc(email)} · ${papelTxt}</p></div>
      <div class="tools"><a class="btn" href="../">Caderno</a><button class="btn" type="button" data-act="sair">Sair</button><button class="btn pri" type="button" data-act="tv">Abrir painel da TV</button></div></header>
    <div class="a-body">
      <nav class="tabs" role="tablist">${GRUPOS.map(c => `<button type="button" role="tab" aria-selected="${tab === c}" data-tab="${c}"><span>${SCHEMA[c].label}</span>${counts(c)}</button>`).join("")}
        <hr><button type="button" role="tab" aria-selected="${tab === "caderno"}" data-tab="caderno"><span>Do Caderno</span><span class="n">auto</span></button>
        <button type="button" role="tab" aria-selected="${tab === "config"}" data-tab="config"><span>Configurações</span></button>
        ${papel === "dono" ? `<button type="button" role="tab" aria-selected="${tab === "acessos"}" data-tab="acessos"><span>Acessos</span></button>` : ""}</nav>
      <section>${body}</section>
    </div></div>`;
}
function renderCaderno() {
  const r = RES; const quando = r?.atualizadoEm ? new Date(r.atualizadoEm).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : null;
  const n = k => (r?.[k] || []).length;
  return `<div class="sec-head"><div><h2>Dados do Caderno</h2><p>Estas informações vêm sozinhas do Caderno de Orientação sempre que o orientador ou um co-editor abre o Caderno ou este painel (no máximo uma vez por hora). Para corrigir algo, edite no Caderno.</p></div>
    ${ehEditor() ? `<div class="tools"><button class="btn pri" type="button" data-act="resumo">Atualizar agora</button></div>` : ""}</div>
    <div class="cad-box">
      <div class="muted">${quando ? `Última atualização: <b>${esc(quando)}</b>${r.atualizadoPor ? " por " + esc(r.atualizadoPor) : ""}` : "Ainda não houve nenhuma atualização. O orientador ou um co-editor precisa de abrir o Caderno ou este painel uma vez."}</div>
      <div class="cad-grid">
        <div><b>${n("membros")}</b><span>orientandos ativos</span></div>
        <div><b>${n("marcos")}</b><span>defesas e qualificações previstas</span></div>
        <div><b>${n("publicacoes")}</b><span>publicações recentes</span></div>
        <div><b>${n("congressos")}</b><span>participações em congressos</span></div>
        <div><b>${n("aniversarios")}</b><span>aniversários cadastrados</span></div>
      </div>
      ${n("marcos") ? `<div><div class="eyebrow" style="margin:6px 0">Próximos marcos</div>${r.marcos.slice(0, 8).map(m => `<div>${esc(fdate(m.data))} — <b>${esc(m.rotulo)}</b> · ${esc(m.nome)}</div>`).join("")}</div>` : ""}
      <p class="help" style="margin:0">Para a TV só vão: nome, dia e mês do aniversário (nunca o ano), marcos de defesa/qualificação, publicações com status “Publicado” e participações em congressos. Fichas, notas e contactos ficam no Caderno.</p>
    </div>`;
}
function renderCfg() {
  const ro = !podeGerir();
  return `<div class="sec-head"><div><h2>Configurações</h2><p>Identidade do painel e comportamento da exibição contínua.</p></div></div>
  <form class="cfg" id="cfgForm">
    <div class="fgrid">
      <div class="f"><label for="c-labNome">Nome / sigla do laboratório</label><input id="c-labNome" name="labNome" value="${esc(CFG.labNome)}" ${ro ? "disabled" : ""}></div>
      <div class="f"><label for="c-rot">Tempo de cada quadro rotativo (s)</label><input id="c-rot" name="rotacaoSeg" type="number" min="5" max="120" value="${esc(CFG.rotacaoSeg)}"></div>
      <div class="f wide"><label for="c-labSub">Subtítulo</label><input id="c-labSub" name="labSub" value="${esc(CFG.labSub)}"></div>
      <div class="f"><label for="c-inc">Data do último acidente</label><input id="c-inc" name="ultimoIncidente" type="date" value="${esc(CFG.ultimoIncidente)}"></div>
      <div class="f"><label for="c-ex">Dados de exemplo do Caderno</label><label style="display:flex;gap:8px;align-items:center;font-weight:400"><input id="c-ex" name="incluirExemplos" type="checkbox" ${CFG.incluirExemplos ? "checked" : ""}> mostrar no painel</label></div>
    </div>
    <div><button class="btn pri" type="submit">Salvar configurações</button></div>
  </form>
  <div class="help" style="margin-top:22px">
    <h3 style="font-size:20px;margin-bottom:6px">Como usar na TV</h3>
    <p>No computador ou TV box ligado à televisão, abra <code>${esc(location.origin + location.pathname)}?tv</code>, entre com a conta da TV e clique em “Tela cheia” (o botão aparece ao mover o rato). A sessão fica guardada: depois de desligar e ligar, o painel volta sozinho. Tudo se atualiza em tempo real, e a página recarrega sozinha de madrugada para apanhar versões novas.</p>
  </div>`;
}
function renderAcessos() {
  return `<div class="sec-head"><div><h2>Acessos</h2><p>Só o orientador vê e altera esta lista. Os co-editores do Caderno já gerem o painel automaticamente.</p></div></div>
  <form class="cfg" id="acForm">
    <div class="f"><label for="ac-g">Gestores do painel <span class="hint">— um e-mail por linha. Editam pendências, agenda, equipamentos, reservas, estoque, mural e configurações. Não veem nenhuma ficha do Caderno.</span></label>
      <textarea id="ac-g" rows="4">${esc((ACESSO.gestores || []).join("\n"))}</textarea></div>
    <div class="f"><label for="ac-t">Contas da TV <span class="hint">— só leitura do painel. Ex.: uma conta criada só para a TV do laboratório.</span></label>
      <textarea id="ac-t" rows="2">${esc((ACESSO.tv || []).join("\n"))}</textarea></div>
    <p class="help" style="margin:0">A pessoa cria a conta em “Criar conta” na página de entrada do painel (ou do Caderno), com este mesmo e-mail, e confirma o link recebido.</p>
    <div><button class="btn pri" type="submit">Salvar acessos</button></div>
  </form>`;
}

/* ---------- formulário ---------- */
function openForm(c, rec) {
  const sc = SCHEMA[c]; editing = { c, id: rec && rec.id || null };
  const r = rec ? { ...rec } : {}; if (!rec) { if (c === "tarefas") { r.status = "a fazer"; r.prioridade = "média"; } if (c === "reservas") r.data = iso(today()); }
  $("#dlg").innerHTML = `<form class="dlg" id="recForm">
    <h3>${rec ? "Editar" : "Adicionar"} ${sc.one}</h3>
    <div class="fgrid">${sc.fields.map(f => {
      const id = "f-" + f.k, v = r[f.k] ?? ""; let input;
      if (f.t === "select") input = `<select id="${id}" name="${f.k}"><option value=""></option>${f.o.map(o => `<option ${o === v ? "selected" : ""}>${esc(o)}</option>`).join("")}</select>`;
      else if (f.t === "textarea") input = `<textarea id="${id}" name="${f.k}">${esc(v)}</textarea>`;
      else if (f.t === "member") input = `<input id="${id}" name="${f.k}" list="dl-mem" value="${esc(v)}" autocomplete="off">`;
      else if (f.t === "equip") input = `<input id="${id}" name="${f.k}" list="dl-eq" value="${esc(v)}" autocomplete="off">`;
      else input = `<input id="${id}" name="${f.k}" type="${f.t}" value="${esc(v)}" ${f.t === "number" ? 'step="any"' : ""} ${f.hint ? `placeholder="${esc(f.hint)}"` : ""}>`;
      return `<div class="f ${f.wide ? "wide" : ""}"><label for="${id}">${esc(f.l)}${f.req ? " *" : ""}</label>${input}</div>`;
    }).join("")}</div>
    <datalist id="dl-mem">${membros().map(m => `<option value="${esc(m)}">`).join("")}</datalist>
    <datalist id="dl-eq">${S.equipamentos.map(e => e.nome).sort().map(m => `<option value="${esc(m)}">`).join("")}</datalist>
    <div class="err" id="ferr"></div>
    <div class="dlg-foot"><button class="btn ghost" type="button" data-act="cancel">Cancelar</button><button class="btn pri" type="submit">Salvar</button></div>
  </form>`;
  $("#dlg").showModal(); const first = $("#dlg input,#dlg select"); first && first.focus();
}
async function saveRec(e) {
  e.preventDefault();
  const { c, id } = editing, sc = SCHEMA[c], fd = new FormData(e.target), rec = {};
  for (const f of sc.fields) { let v = (fd.get(f.k) ?? "").toString().trim(); if (f.t === "number") v = v === "" ? "" : Number(v); rec[f.k] = v; }
  const miss = sc.fields.filter(f => f.req && (rec[f.k] === "" || rec[f.k] == null));
  if (miss.length) { $("#ferr").textContent = "Preencha: " + miss.map(f => f.l).join(", ") + "."; return; }
  if (c === "reservas" && rec.inicio && rec.fim) {
    if (rec.fim <= rec.inicio) { $("#ferr").textContent = "O horário de fim precisa ser depois do início."; return; }
    const clash = S.reservas.find(r => r.id !== id && r.equipamento === rec.equipamento && r.data === rec.data && r.inicio && r.fim && r.inicio < rec.fim && rec.inicio < r.fim);
    if (clash) { $("#ferr").textContent = `Conflito: ${clash.pessoa} já reservou ${clash.equipamento} das ${clash.inicio} às ${clash.fim}.`; return; }
  }
  rec.atualizadoPor = email; rec.atualizadoEm = new Date().toISOString();
  const btn = e.submitter; if (btn) btn.disabled = true;
  try {
    if (id) await setDoc(doc(db, "lab", c, "itens", id), rec); else await addDoc(collection(db, "lab", c, "itens"), rec);
    $("#dlg").close(); toast(id ? "Alterações salvas" : "Adicionado");
  } catch (err) { $("#ferr").textContent = errMsg(err); if (btn) btn.disabled = false; }
}

/* ---------- eventos ---------- */
document.addEventListener("click", async e => {
  const b = e.target.closest("[data-act],[data-tab],[data-a]"); if (!b) return;
  if (b.dataset.tab) { tab = b.dataset.tab; renderAdmin(); return; }
  const a = b.dataset.a;
  if (a) {
    try {
      if (a === "criar") {
        const em = $("#l-email").value.trim(), se = $("#l-senha").value;
        if (!em || se.length < 6) return lmsg("Escreva o e-mail e uma senha com pelo menos 6 caracteres.", 1);
        const c = await createUserWithEmailAndPassword(auth, em, se); await sendEmailVerification(c.user);
      } else if (a === "esqueci") {
        const em = $("#l-email").value.trim(); if (!em) return lmsg("Escreva o seu e-mail acima.", 1);
        await sendPasswordResetEmail(auth, em); lmsg("Enviámos um link para redefinir a senha.");
      } else if (a === "reenviar") { await sendEmailVerification(auth.currentUser); lmsg("Link reenviado."); }
      else if (a === "ja") { await auth.currentUser.reload(); await auth.currentUser.getIdToken(true); if (auth.currentUser.emailVerified) location.reload(); else lmsg("Ainda não aparece como confirmado. Abra o link do e-mail e tente de novo.", 1); }
      else if (a === "sair") await signOut(auth);
      else if (a === "recarregar") location.reload();
    } catch (err) { lmsg(erroAuth(err), 1); }
    return;
  }
  const act = b.dataset.act, id = b.dataset.id;
  if (act === "tv") setMode("tv");
  else if (act === "sair") { await signOut(auth); }
  else if (act === "new") openForm(tab, null);
  else if (act === "edit") openForm(tab, S[tab].find(r => r.id === id));
  else if (act === "cancel") $("#dlg").close();
  else if (act === "del") {
    if (!confirm("Excluir este registo?")) return;
    try { await deleteDoc(doc(db, "lab", tab, "itens", id)); toast("Excluído"); } catch (err) { toast(errMsg(err)); }
  } else if (act === "done") {
    const r = S.tarefas.find(x => x.id === id); if (!r) return;
    const { id: _i, ...body } = r;
    try { await setDoc(doc(db, "lab", "tarefas", "itens", id), { ...body, status: "concluída", atualizadoPor: email, atualizadoEm: new Date().toISOString() }); toast("Pendência concluída"); } catch (err) { toast(errMsg(err)); }
  } else if (act === "sugestoes") {
    try { const bt = writeBatch(db); for (const it of SUGESTOES[tab]) bt.set(doc(collection(db, "lab", tab, "itens")), { ...it, atualizadoPor: email }); await bt.commit(); toast("Sugestões carregadas — edite ou exclua à vontade"); } catch (err) { toast(errMsg(err)); }
  } else if (act === "resumo") {
    b.disabled = true; b.textContent = "A atualizar…";
    try { await gravarResumo(db, email); toast("Dados do Caderno atualizados"); } catch (err) { toast(errMsg(err)); }
    b.disabled = false; b.textContent = "Atualizar agora";
  }
});
document.addEventListener("change", e => { if (e.target.id === "hideDone") { hideDone = e.target.checked; renderAdmin(); } });
document.addEventListener("submit", async e => {
  if (e.target.id === "flogin") {
    e.preventDefault(); lmsg("A entrar…");
    try { await signInWithEmailAndPassword(auth, $("#l-email").value.trim(), $("#l-senha").value); } catch (err) { lmsg(erroAuth(err), 1); }
  }
  if (e.target.id === "recForm") saveRec(e);
  if (e.target.id === "cfgForm") {
    e.preventDefault(); const fd = new FormData(e.target);
    const next = { labNome: fd.get("labNome") || CFG.labNome, labSub: fd.get("labSub") || "", rotacaoSeg: Math.min(120, Math.max(5, +fd.get("rotacaoSeg") || 15)), ultimoIncidente: fd.get("ultimoIncidente") || "", incluirExemplos: !!fd.get("incluirExemplos") };
    try { const mudouEx = next.incluirExemplos !== !!CFG.incluirExemplos; await setDoc(doc(db, "lab", "config"), next); toast("Configurações salvas"); if (mudouEx && ehEditor()) gravarResumo(db, email).catch(() => { }); } catch (err) { toast(errMsg(err)); }
  }
  if (e.target.id === "acForm") {
    e.preventDefault();
    const lista = id => $(id).value.split(/[\s,;]+/).map(x => x.trim().toLowerCase()).filter(x => x.includes("@"));
    try { await setDoc(doc(db, "lab", "acesso"), { gestores: lista("#ac-g"), tv: lista("#ac-t") }); toast("Acessos salvos"); } catch (err) { toast(errMsg(err)); }
  }
});
$("#btnAdmin").onclick = () => setMode("admin");
$("#btnFull").onclick = async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch (e) { toast("Use F11 para tela cheia."); } };
let hideT; document.addEventListener("mousemove", () => { if (mode !== "tv" || $("#tv").hidden) return; const c = $("#tvctl"); c.classList.add("show"); document.body.style.cursor = ""; clearTimeout(hideT); hideT = setTimeout(() => { c.classList.remove("show"); document.body.style.cursor = "none"; }, 2500); });
window.addEventListener("hashchange", () => { if (location.hash === "#tv") setMode("tv"); if (location.hash === "#gestao") setMode("admin"); });

/* ---------------- render ---------------- */
function mostrar(qual) {
  $("#carregando").hidden = true;
  $("#entrada").hidden = qual !== "entrada"; $("#tv").hidden = qual !== "tv"; $("#tvctl").hidden = qual !== "tv"; $("#admin").hidden = qual !== "admin";
  $("#btnAdmin").hidden = !podeGerir();
  document.body.style.background = qual === "tv" ? "#0C1116" : ""; if (qual !== "tv") document.body.style.cursor = "";
}
let rq = false;
function render() {
  if (papel === "loading" || papel === "sem") return;
  if (rq) return; rq = true;
  requestAnimationFrame(() => { rq = false; if (mode === "tv") { mostrar("tv"); renderTV(); } else { mostrar("admin"); renderAdmin(); } });
}
setInterval(tick, 1000);
setInterval(() => { if (mode === "tv" && !$("#tv").hidden) renderTV(); }, 60000);
// Recarrega a página uma vez por dia (madrugada) para apanhar versões novas do painel.
let dia = iso(today());
setInterval(() => { const d = iso(today()); if (d !== dia) { dia = d; if (mode === "tv") location.reload(); else render(); } }, 60000);
