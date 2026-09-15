// Caderno de Orientação — aplicação (orientador, co-editores e orientandos).
import * as D from "./data.js";
import { FIREBASE_CONFIG, ORIENTADOR_EMAIL, NOME_LABORATORIO, PERMITIR_GOOGLE, USAR_UPLOAD, NOTIFICACOES } from "./config.js";

/* =========================================================================
   CONFIGURAÇÃO PADRÃO (o orientador pode alterar em "Configurações")
   ========================================================================= */
const DEFAULT_CFG = {
  ordemNiveis: ["Iniciação científica", "Estágio", "Mestrado", "Doutorado", "Pós-doutorado"],
  niveis: {
    "Iniciação científica": { curto: "IC", duracao: 12, metaExp: 0.85, inicioEscrita: 0.6,
      marcos: [{ tipo: "Início", quando: 0 }, { tipo: "Relatório parcial", quando: 6 }, { tipo: "Relatório final / seminário de IC", quando: "fim" }] },
    "Estágio": { curto: "Estágio", duracao: 5, metaExp: 0.9, inicioEscrita: 0.7,
      marcos: [{ tipo: "Início", quando: 0 }, { tipo: "Plano de atividades assinado", quando: 0.5 }, { tipo: "Relatório de estágio", quando: "fim-7" }, { tipo: "Término", quando: "fim" }] },
    "Mestrado": { curto: "Mestrado", duracao: 24, metaExp: 0.75, inicioEscrita: 0.5,
      marcos: [{ tipo: "Matrícula / início", quando: 0 }, { tipo: "Proficiência em língua", quando: 9 }, { tipo: "Créditos em disciplinas", quando: 12 },
        { tipo: "Qualificação / defesa de projeto", quando: 15 }, { tipo: "Defesa", quando: "fim-15" }, { tipo: "Depósito da versão final", quando: "fim" }] },
    "Doutorado": { curto: "Doutorado", duracao: 48, metaExp: 0.8, inicioEscrita: 0.55,
      marcos: [{ tipo: "Matrícula / início", quando: 0 }, { tipo: "Proficiência em língua", quando: 9 }, { tipo: "Créditos em disciplinas", quando: 18 },
        { tipo: "Exame de qualificação", quando: 24 }, { tipo: "Estágio de docência", quando: 30 }, { tipo: "Defesa", quando: "fim-15" }, { tipo: "Depósito da versão final", quando: "fim" }] },
    "Pós-doutorado": { curto: "Pós-doc", duracao: 24, metaExp: 0.85, inicioEscrita: 0.4,
      marcos: [{ tipo: "Início", quando: 0 }, { tipo: "Relatório anual", quando: 12 }, { tipo: "Relatório final", quando: "fim" }] },
  },
  tiposMarco: ["Matrícula / início", "Início", "Créditos em disciplinas", "Proficiência em língua", "Qualificação / defesa de projeto",
    "Exame de qualificação", "Estágio de docência", "Doutorado sanduíche", "Prorrogação de prazo", "Relatório parcial", "Relatório anual",
    "Relatório final / seminário de IC", "Relatório de estágio", "Plano de atividades assinado", "Renovação da bolsa", "Defesa",
    "Depósito da versão final", "Relatório final", "Término"],
  statusProd: ["Em redação", "Submetido", "Em revisão", "Aceito", "Publicado"],
  tiposProd: ["Artigo em periódico", "Artigo de revisão", "Trabalho em congresso", "Resumo em anais", "Participação em congresso",
    "Capítulo de livro", "Livro", "Patente", "Trabalho de conclusão de curso (TCC)", "Dissertação", "Tese", "Relatório técnico",
    "Prêmio ou distinção", "Outro"],
  alertas: { diasSemReuniao: 30, diasPrazo: 180, escritaMin: 60, diasBolsa: 90, toleranciaProjecao: 60 },
  notif: { marcoDias: 15, bolsaDias: 30, semAtualizacaoDias: 45, avisarAprovacao: true, avisarNovaAtualizacao: true, resumoSemanal: true, assinatura: "" },
};
const SITUACOES = ["Ativo", "Concluído", "Trancado", "Desligado"];
const TIPOS_REG = ["Reunião", "Atualização do aluno", "Nota"];
const CORES_NIVEL = ["var(--lv-ic)", "var(--lv-est)", "var(--lv-me)", "var(--lv-do)", "var(--lv-pd)"];

/* =========================================================================
   ESTADO
   ========================================================================= */
const S = {
  user: null, email: "", role: "loading",
  cfg: structuredClone(DEFAULT_CFG), acesso: { editores: [] },
  projetos: [], orientandos: [], producoes: [], registos: [], atualizacoes: [], notas: {}, mail: [],
  loaded: {}, view: "painel", group: "nivel", cardGroup: "projeto",
  f: { q: "", nivel: "", projeto: "", tematica: "", situacao: "Ativo" },
  drawer: null, unsubs: [],
};

/* =========================================================================
   UTILITÁRIOS
   ========================================================================= */
const $ = (s, r = document) => r.querySelector(s);
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pad = n => String(n).padStart(2, "0");
const todayISO = (() => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; })();
const toUTC = s => { const [y, m, d] = s.split("-").map(Number); return Date.UTC(y, m - 1, d); };
const days = (a, b) => Math.round((toUTC(b) - toUTC(a)) / 864e5);
const fmt = s => s ? s.slice(0, 10).split("-").reverse().join("/") : "—";
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const fmtMes = s => s ? `${MESES[Number(s.slice(5, 7)) - 1]}/${s.slice(0, 4)}` : "—";
const fmtCurto = s => s ? `${s.slice(5, 7)}/${s.slice(0, 4)}` : "—";
const isoUTC = dt => `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
const addDays = (s, n) => isoUTC(new Date(toUTC(s) + n * 864e5));
const addMonths = (s, m) => { const [y, mo, d] = s.split("-").map(Number); const w = Math.floor(m), extra = Math.round((m - w) * 30);
  const dt = new Date(Date.UTC(y, mo - 1 + w, d)); dt.setUTCDate(dt.getUTCDate() + extra); return isoUTC(dt); };
const maxD = (...a) => a.filter(Boolean).sort().pop();
const minD = (...a) => a.filter(Boolean).sort()[0];
const pct = v => Math.max(0, Math.min(100, Math.round(Number(v) || 0)));
const clamp = v => Math.max(0, Math.min(100, v));
const limpo = o => JSON.parse(JSON.stringify(o));
const isEd = () => S.role === "editor";
const isDono = () => S.email === ORIENTADOR_EMAIL.toLowerCase();
const proj = id => S.projetos.find(p => p.id === id);
const ori = id => S.orientandos.find(o => o.id === id);
const niveis = () => S.cfg.ordemNiveis;
const corNivel = n => CORES_NIVEL[niveis().indexOf(n)] || "var(--faint)";
const curto = n => S.cfg.niveis[n]?.curto || n;
const lv = n => `<span class="lv" style="--c:${corNivel(n)}">${esc(curto(n))}</span>`;
const ativos = () => S.orientandos.filter(o => o.situacao === "Ativo");
const pendentesDe = id => S.atualizacoes.filter(u => u.orientandoId === id);
const producoesDe = id => S.producoes.filter(p => (p.autores || []).includes(id));
const nivelCfg = o => S.cfg.niveis[o.nivel] || { duracao: 24, metaExp: 0.75, inicioEscrita: 0.5, marcos: [] };
function tematicas() { const s = new Set(); S.projetos.forEach(p => p.tematica && s.add(p.tematica)); S.orientandos.forEach(o => o.tematica && s.add(o.tematica)); return [...s].sort((a, b) => a.localeCompare(b, "pt")); }
function toast(msg) { const r = $("#toast-root"); r.innerHTML = `<div class="toast">${esc(msg)}</div>`; clearTimeout(toast.t); toast.t = setTimeout(() => r.innerHTML = "", 2800); }
function baixar(nome, conteudo, tipo) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = Object.assign(document.createElement("a"), { href: url, download: nome }); document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
async function write(fn, ok) {
  try { await fn(); if (ok) toast(ok); return true; }
  catch (e) { console.error(e); toast(e?.code === "permission-denied" ? "Sem permissão para esta alteração." : "Não foi possível guardar. Verifique a ligação e tente de novo."); return false; }
}

/* =========================================================================
   REGRAS DO DOMÍNIO: marcos, alertas, histórico e projeção
   ========================================================================= */
function marcoStatus(m) {
  if (m.realizada) return "feito";
  if (!m.prevista) return "semdata";
  const dd = days(todayISO, m.prevista);
  if (dd < 0) return "atrasado";
  if (dd <= 60) return "proximo";
  return "previsto";
}
const MS_LABEL = { feito: "Realizado", atrasado: "Atrasado", proximo: "Próximo", previsto: "Previsto", semdata: "Sem data" };
const MS_PILL = { feito: "ok", atrasado: "crit", proximo: "warn", previsto: "", semdata: "" };
function ultimoRegisto(id) { let u = null; for (const r of S.registos) if (r.orientandoId === id && (!u || r.data > u)) u = r.data; return u; }
function proximoMarco(o) { return (o.marcos || []).filter(m => !m.realizada && m.prevista).sort((a, b) => a.prevista.localeCompare(b.prevista))[0] || null; }
function prazoDe(o) { return o.prazo || (o.inicio ? addDays(addMonths(o.inicio, nivelCfg(o).duracao), -1) : null); }
function tempoDecorrido(o) {
  const pz = prazoDe(o); if (!o.inicio || !pz) return null;
  const tot = days(o.inicio, pz); if (tot <= 0) return null;
  return Math.max(0, Math.min(1, days(o.inicio, o.fim || todayISO) / tot));
}
function gerarMarcos(nivel, inicio, prazo) {
  return (S.cfg.niveis[nivel]?.marcos || []).map(({ tipo, quando }) => {
    const q = String(quando);
    const d = /^fim/.test(q) ? addDays(prazo, -(Number(q.slice(4)) || 0)) : addMonths(inicio, Number(q) || 0);
    return { id: "m" + Math.random().toString(36).slice(2, 9), tipo, prevista: d, realizada: Number(q) === 0 ? inicio : "", obs: "" };
  });
}
// Acrescenta (ou substitui o do dia) um ponto ao histórico de andamento.
function comHistorico(o, exp, esc_) {
  const h = (o.historico || []).filter(p => p.d !== todayISO);
  h.push({ d: todayISO, e: pct(exp), w: pct(esc_) });
  h.sort((a, b) => a.d.localeCompare(b.d));
  return h.slice(-240);
}
function inclinacao(pts) {           // regressão linear: % por dia
  const x0 = toUTC(pts[0].d), xs = pts.map(p => (toUTC(p.d) - x0) / 864e5), ys = pts.map(p => p.v);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0, den = 0; xs.forEach((x, i) => { num += (x - mx) * (ys[i] - my); den += (x - mx) ** 2; });
  return den ? num / den : null;
}
/* Projeção de cada frente de trabalho (experimental e escrita).
   Metas: as datas definidas pelo orientador na ficha; na falta, estimadas a partir
   do nível (Configurações): experimental concluído a X% do ciclo; escrita começa a Y%
   do ciclo e termina 30 dias antes da defesa (ou do prazo final).
   Ritmo: tendência linear dos registos dos últimos 180 dias (≥2 pontos, ≥30 dias);
   na falta, ritmo médio desde o início. */
function projecao(o) {
  if (!o.inicio) return null;
  const nc = nivelCfg(o);
  const prazo = prazoDe(o), prazoFonte = o.prazo ? "orientador" : "estimado";
  const total = Math.max(1, days(o.inicio, prazo));
  const defesa = (o.marcos || []).find(m => m.tipo === "Defesa" && m.prevista)?.prevista || null;
  const metaExp = o.metaExpData || addDays(o.inicio, Math.round(nc.metaExp * total));
  const metaExpFonte = o.metaExpData ? "orientador" : `estimada: ${Math.round(nc.metaExp * 100)}% do ciclo`;
  const metaEsc = o.metaEscritaData || addDays(defesa || prazo, -30);
  const metaEscFonte = o.metaEscritaData ? "orientador" : defesa ? "estimada: 30 dias antes da defesa" : "estimada: 30 dias antes do prazo";
  let iniEsc = addDays(o.inicio, Math.round(nc.inicioEscrita * total));
  if (iniEsc >= metaEsc) iniEsc = addDays(metaEsc, -Math.max(30, Math.round(total * 0.25)));
  if (iniEsc < o.inicio) iniEsc = o.inicio;
  const ref = o.fim && o.fim < todayISO ? o.fim : todayISO;
  const hist = (o.historico || []).slice().sort((a, b) => a.d.localeCompare(b.d)).filter(p => p.d <= ref);

  const esperado = (k, d) => {
    if (k === "exp") { const T = days(o.inicio, metaExp); return T <= 0 ? 100 : clamp(days(o.inicio, d) / T * 100); }
    if (d <= iniEsc) return 0;
    const T = days(iniEsc, metaEsc); return T <= 0 ? 100 : clamp(days(iniEsc, d) / T * 100);
  };
  const track = k => {
    const cur = pct(k === "exp" ? o.progExp : o.progEscrita);
    const meta = k === "exp" ? metaExp : metaEsc;
    let pts = hist.map(p => ({ d: p.d, v: pct(k === "exp" ? p.e : p.w) }));
    if (!pts.length || pts[pts.length - 1].v !== cur) pts.push({ d: ref, v: cur });
    let v = null, fonte = "";
    const rec = pts.filter(p => p.d >= addDays(ref, -180));
    if (rec.length >= 2 && days(rec[0].d, rec[rec.length - 1].d) >= 30) {
      const s = inclinacao(rec);
      if (s != null && s > 0) { v = s; fonte = `tendência dos últimos ${rec.length} registos (180 dias)`; }
      else if (s != null) { v = 0; fonte = `sem avanço nos últimos ${rec.length} registos`; }
    }
    if (v == null) {
      const primeiro = pts.find(p => p.v > 0)?.d;
      const base = k === "exp" ? o.inicio : minD(iniEsc < ref ? iniEsc : null, primeiro) || o.inicio;
      const dd = days(base, ref);
      v = dd >= 30 && cur > 0 ? cur / dd : 0;
      fonte = k === "exp" ? "ritmo médio desde o início (poucos registos)" : "ritmo médio desde o início da escrita (poucos registos)";
    }
    const concluido = cur >= 100;
    let proj = !concluido && v > 0.0005 ? addDays(ref, Math.ceil((100 - cur) / v)) : null;
    let lento = false;
    if (proj && proj > addMonths(prazo, 60)) { proj = null; lento = true; }   // ritmo tão baixo que a data não tem significado
    const atraso = proj ? days(meta, proj) : null;
    const st = concluido ? "concluido" : !proj ? "semritmo" : atraso <= -30 ? "adiantado" : atraso <= 30 ? "noprazo" : atraso <= 90 ? "atencao" : "atrasado";
    const esp = Math.round(esperado(k, ref));
    return { k, cur, meta, pts, v, fonte, proj, atraso, st, esp, desvio: cur - esp, lento, estagnado: v === 0 && cur < 100 };
  };
  const exp = track("exp"), esc_ = track("esc");
  const fimProj = exp.st === "concluido" && esc_.st === "concluido" ? ref : (exp.proj || esc_.proj) ? maxD(exp.proj, esc_.proj) : null;
  return { prazo, prazoFonte, defesa, metaExp, metaExpFonte, metaEsc, metaEscFonte, iniEsc, ref, esperado, exp, esc: esc_, fimProj,
    folga: fimProj ? days(fimProj, prazo) : null };
}
const ST_TXT = { concluido: ["Concluído", "ok"], adiantado: ["Adiantado", "ok"], noprazo: ["No prazo", "ok"], atencao: ["Atenção", "warn"], atrasado: ["Atrasado", "crit"], semritmo: ["Ritmo insuficiente", "warn"] };
function piorEstado(P) {
  if (!P) return null;
  const ordem = ["atrasado", "atencao", "semritmo", "noprazo", "adiantado", "concluido"];
  return [P.exp.st, P.esc.st].sort((a, b) => ordem.indexOf(a) - ordem.indexOf(b))[0];
}
function mesesTxt(d) { const m = Math.round(Math.abs(d) / 30); return m <= 1 ? `${Math.abs(d)} dias` : `${m} meses`; }

function alertas(o) {
  if (o.situacao !== "Ativo") return [];
  const A = S.cfg.alertas, a = [];
  for (const m of (o.marcos || []).filter(m => marcoStatus(m) === "atrasado")) a.push({ sev: "crit", txt: `${m.tipo} atrasado (${fmt(m.prevista)})` });
  const u = ultimoRegisto(o.id);
  if (!u) a.push({ sev: "warn", txt: "Nenhuma reunião registada" });
  else { const d = days(u, todayISO); if (d > A.diasSemReuniao) a.push({ sev: "warn", txt: `Sem reunião há ${d} dias` }); }
  const pz = prazoDe(o);
  if ((o.nivel === "Mestrado" || o.nivel === "Doutorado") && pz) {
    const d = days(todayISO, pz);
    if (d <= A.diasPrazo && pct(o.progEscrita) < A.escritaMin) a.push({ sev: d <= 90 ? "crit" : "warn", txt: `Prazo em ${d} dias · escrita ${pct(o.progEscrita)}%` });
  }
  if (o.bolsaFim) { const d = days(todayISO, o.bolsaFim); if (d >= 0 && d <= A.diasBolsa) a.push({ sev: "warn", txt: `Bolsa termina em ${d} dias` }); }
  const P = projecao(o);
  if (P) {
    if (P.folga != null && P.folga < 0) a.push({ sev: P.folga < -90 ? "crit" : "warn", txt: `Projeção: conclusão ≈ ${fmtMes(P.fimProj)}, ${mesesTxt(P.folga)} após o prazo` });
    else if (P.exp.atraso != null && P.exp.atraso > A.toleranciaProjecao && P.exp.cur < 90) a.push({ sev: "warn", txt: `Projeção: experimental ${mesesTxt(P.exp.atraso)} após a meta` });
    const decorrido = tempoDecorrido(o) || 0;
    if ((P.exp.estagnado || P.exp.lento) && decorrido > 0.3) a.push({ sev: "warn", txt: P.exp.estagnado ? "Sem avanço registado no experimental" : "Experimental avança muito devagar" });
    if ((P.esc.estagnado || P.esc.lento) && todayISO > P.iniEsc) a.push({ sev: "warn", txt: P.esc.estagnado ? "Sem avanço registado na escrita" : "Escrita avança muito devagar" });
  }
  return a;
}

/* =========================================================================
   AUTENTICAÇÃO
   ========================================================================= */
function telaAuth(modo, msg = "") {
  S.role = "loading";
  const app = $("#app");
  const titulo = { login: "Entrar", registo: "Criar conta", senha: "Recuperar senha", verificar: "Confirme o seu e-mail" }[modo];
  let corpo = "";
  if (modo === "login") corpo = `
    <label>E-mail<input type="email" id="a-email" autocomplete="email"></label>
    <label>Senha<input type="password" id="a-senha" autocomplete="current-password"></label>
    <button class="btn primary" id="a-go">Entrar</button>
    ${PERMITIR_GOOGLE ? `<button class="btn" id="a-google">Entrar com Google</button>` : ""}
    <div class="links"><button data-modo="registo">Criar conta</button><button data-modo="senha">Esqueci a senha</button></div>`;
  if (modo === "registo") corpo = `
    <p class="muted small" style="margin:0">Use o mesmo e-mail que o orientador cadastrou na sua ficha.</p>
    <label>Nome<input type="text" id="a-nome" autocomplete="name"></label>
    <label>E-mail<input type="email" id="a-email" autocomplete="email"></label>
    <label>Senha (mínimo 8 caracteres)<input type="password" id="a-senha" autocomplete="new-password"></label>
    <button class="btn primary" id="a-go">Criar conta</button>
    <div class="links"><button data-modo="login">Já tenho conta</button></div>`;
  if (modo === "senha") corpo = `
    <label>E-mail<input type="email" id="a-email" autocomplete="email"></label>
    <button class="btn primary" id="a-go">Enviar link de recuperação</button>
    <div class="links"><button data-modo="login">Voltar</button></div>`;
  if (modo === "verificar") corpo = `
    <p style="margin:0">Enviámos um link de confirmação para <b>${esc(S.user?.email)}</b>. Abra-o (veja também o spam) e depois clique abaixo.</p>
    <button class="btn primary" id="a-go">Já confirmei</button>
    <div class="links"><button id="a-reenviar">Reenviar e-mail</button><button id="a-sair">Sair</button></div>`;
  app.innerHTML = `<div class="auth"><h1>${esc(NOME_LABORATORIO)}</h1><h2 style="font-size:17px">${titulo}</h2>${corpo}<p class="msg-err" id="a-msg">${esc(msg)}</p>
    <p class="muted small" style="margin:0">Projeto Firebase: <span class="mono">${esc(FIREBASE_CONFIG.projectId || "(não configurado)")}</span></p></div>`;
  app.querySelectorAll("[data-modo]").forEach(b => b.onclick = () => telaAuth(b.dataset.modo));
  const m = $("#a-msg"), v = id => ($("#" + id)?.value || "").trim();
  const ERROS = {
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/wrong-password": "E-mail ou senha incorretos.",
    "auth/user-not-found": "E-mail ou senha incorretos.",
    "auth/email-already-in-use": "Já existe uma conta com este e-mail. Use “Entrar”.",
    "auth/weak-password": "A senha precisa de pelo menos 8 caracteres.",
    "auth/password-does-not-meet-requirements": "A senha não cumpre os requisitos definidos no Firebase.",
    "auth/invalid-email": "E-mail inválido.",
    "auth/too-many-requests": "Muitas tentativas seguidas. Aguarde alguns minutos.",
    "auth/popup-closed-by-user": "A janela foi fechada antes de concluir.",
    "auth/operation-not-allowed": "O provedor “E-mail/senha” não está ativo. No Firebase: Authentication → Sign-in method → ativar E-mail/senha.",
    "auth/configuration-not-found": "O Authentication ainda não foi iniciado neste projeto, ou o provedor “E-mail/senha” não está ativo (Firebase → Authentication → Vamos começar).",
    "auth/admin-restricted-operation": "A criação de contas está bloqueada no projeto (Authentication → Settings → User actions).",
    "auth/unauthorized-domain": "O endereço desta página não está autorizado (Authentication → Settings → Domínios autorizados).",
    "auth/api-key-not-valid.-please-pass-a-valid-api-key.": "A apiKey em config.js não é válida para este projeto.",
    "auth/invalid-api-key": "A apiKey em config.js não é válida para este projeto.",
    "auth/network-request-failed": "Não foi possível falar com o Firebase: verifique a ligação à internet, a VPN, o bloqueador de anúncios ou extensões do navegador.",
    "auth/internal-error": "Erro interno do Firebase — confirme se a configuração em config.js corresponde a este projeto.",
  };
  const erroAuth = e => {
    console.error("Falha de autenticação:", e);
    const cod = e?.code || (e?.message || "").slice(0, 80) || "desconhecido";
    return (ERROS[cod] || "Não foi possível concluir.") + `  [${cod}]`;
  };
  const go = $("#a-go");
  const enter = e => { if (e.key === "Enter") go.click(); };
  app.querySelectorAll("input").forEach(i => i.addEventListener("keydown", enter));
  if (modo === "login") go.onclick = async () => { m.textContent = ""; go.disabled = true; try { await D.login(v("a-email"), $("#a-senha").value); } catch (e) { m.textContent = erroAuth(e); } go.disabled = false; };
  if (modo === "registo") go.onclick = async () => {
    if ($("#a-senha").value.length < 8) { m.textContent = "A senha precisa de pelo menos 8 caracteres."; return; }
    go.disabled = true; try { await D.registar(v("a-email"), $("#a-senha").value, v("a-nome")); } catch (e) { m.textContent = erroAuth(e); } go.disabled = false; };
  if (modo === "senha") go.onclick = async () => { try { await D.redefinirSenha(v("a-email")); m.className = "msg-ok"; m.textContent = "Se o e-mail estiver registado, receberá um link em instantes."; } catch (e) { m.textContent = erroAuth(e); } };
  if (modo === "verificar") {
    go.onclick = async () => { const u = await D.recarregarUtilizador(); if (u?.verified) aoAutenticar(u); else m.textContent = "Ainda não aparece como confirmado. Abra o link do e-mail e tente de novo."; };
    $("#a-reenviar").onclick = async () => { try { await D.reenviarVerificacao(); m.className = "msg-ok"; m.textContent = "E-mail reenviado."; } catch (e) { m.textContent = erroAuth(e); } };
    $("#a-sair").onclick = () => D.sair();
  }
  if ($("#a-google")) $("#a-google").onclick = async () => { try { await D.entrarGoogle(); } catch (e) { m.textContent = erroAuth(e); } };
}

async function aoAutenticar(u) {
  S.unsubs.forEach(f => { try { f(); } catch (_) {} }); S.unsubs = []; S.loaded = {};
  Object.assign(S, { projetos: [], orientandos: [], producoes: [], registos: [], atualizacoes: [], notas: {} });
  S.user = u;
  if (!u) return telaAuth("login");
  if (!u.verified) return telaAuth("verificar");
  S.email = u.email;
  let ed = isDono();
  if (!ed) { const ac = await D.lerUmaVez("config", "acesso"); ed = !!(ac && (ac.editores || []).map(x => x.toLowerCase()).includes(S.email)); }
  S.role = ed ? "editor" : "aluno";
  S.view = ed ? "painel" : "meu";
  subscrever();
  render();
}

function subscrever() {
  const on = (col, filtro, key) => S.unsubs.push(D.watch(col, filtro, docs => {
    if (key === "notas") { const m = {}; docs.forEach(d => m[d.id] = d); S.notas = m; }
    else S[key] = docs;
    S.loaded[key] = true; render();
  }, e => { console.warn(col, e); S.loaded[key] = true; render(); }));
  S.unsubs.push(D.watchDoc("config", "geral", d => { S.cfg = mesclarCfg(d); S.loaded.cfg = true; render(); }, () => { S.loaded.cfg = true; render(); }));
  on("projetos", null, "projetos");
  on("producoes", null, "producoes");
  if (isEd()) {
    on("orientandos", null, "orientandos"); on("registos", null, "registos"); on("atualizacoes", null, "atualizacoes"); on("notas", null, "notas");
    if (NOTIFICACOES) { on("mail", null, "mail"); talvezGerarLembretes(); }
    if (isDono()) S.unsubs.push(D.watchDoc("config", "acesso", d => { S.acesso = d || { editores: [] }; }, () => {}));
  } else {
    on("orientandos", ["email", "==", S.email], "orientandos");
    on("registos", ["alunoEmail", "==", S.email], "registos");
    on("atualizacoes", ["alunoEmail", "==", S.email], "atualizacoes");
  }
}
function mesclarCfg(d) {
  const c = structuredClone(DEFAULT_CFG);
  if (!d) return c;
  for (const k of ["tiposMarco", "statusProd", "tiposProd", "ordemNiveis"]) if (Array.isArray(d[k]) && d[k].length) c[k] = d[k];
  if (d.alertas) Object.assign(c.alertas, d.alertas);
  if (d.notif) Object.assign(c.notif, d.notif);
  if (d.niveis) for (const [n, v] of Object.entries(d.niveis)) c.niveis[n] = { ...(c.niveis[n] || {}), ...v };
  return c;
}

/* =========================================================================
   ESTRUTURA DA PÁGINA
   ========================================================================= */
const VIEWS_ED = [["painel", "Painel"], ["orientandos", "Orientandos"], ["grupos", "Projetos e temáticas"], ["producao", "Produção"],
  ["atualizacoes", "Atualizações"], ["relatorios", "Relatórios e cópias"], ["config", "Configurações"]];

function render() {
  if (S.role === "loading" || !S.user) return;
  const app = $("#app");
  if (!app.querySelector("main")) {
    app.innerHTML = `<header class="top">
      <div class="brand"><h1>${esc(NOME_LABORATORIO)}</h1><p id="subtitle"></p></div>
      <div style="margin-left:auto;display:flex;flex-direction:column;align-items:flex-end">
        <div class="userbox"><span>${esc(S.user.nome || S.email)}</span><span class="pill ${isEd() ? "acc" : ""}">${isEd() ? (isDono() ? "orientador" : "co-editor") : "orientando"}</span><button class="btn ghost small" id="sair">Sair</button></div>
        ${isEd() ? `<nav class="tabs" role="tablist" aria-label="Secções">${VIEWS_ED.map(([k, t]) => `<button role="tab" data-view="${k}">${t}${k === "atualizacoes" ? ` <span id="atu-count" class="count"></span>` : ""}</button>`).join("")}</nav>` : ""}
      </div></header><main id="main"></main>`;
    $("#sair").onclick = () => D.sair();
    app.querySelectorAll("nav.tabs button").forEach(b => b.onclick = () => { S.view = b.dataset.view; render(); });
  }
  app.querySelectorAll("nav.tabs button").forEach(b => b.setAttribute("aria-selected", String(b.dataset.view === S.view)));
  if ($("#atu-count")) $("#atu-count").textContent = S.atualizacoes.length ? String(S.atualizacoes.length) : "";
  const n = ativos().length;
  $("#subtitle").textContent = isEd() ? `${n} orientando${n === 1 ? "" : "s"} ativo${n === 1 ? "" : "s"} · ${S.projetos.length} projeto${S.projetos.length === 1 ? "" : "s"} · hoje ${fmt(todayISO)}` : `Hoje ${fmt(todayISO)}`;
  const main = $("#main");
  const precisa = isEd() ? ["cfg", "orientandos", "projetos", "producoes", "registos"] : ["cfg", "orientandos"];
  if (!precisa.every(k => S.loaded[k])) { main.innerHTML = `<div class="banner">A carregar os dados…</div>`; return; }
  const ae = document.activeElement, keep = ae && main.contains(ae) && ae.id ? { id: ae.id, a: ae.selectionStart, b: ae.selectionEnd } : null;
  if (keep && S.view === "config") return;           // não apagar o formulário de configurações em edição
  if (!isEd()) main.innerHTML = vMeu();
  else {
    const topo = S.atualizacoes.length && S.view !== "atualizacoes" ? `<div class="banner"><span>${S.atualizacoes.length} atualização${S.atualizacoes.length > 1 ? "ões" : ""} de orientandos aguardando aprovação.</span><button class="btn small" data-goto="atualizacoes">Rever agora</button></div>` : "";
    const vazio = !S.orientandos.length && !S.projetos.length && S.view === "painel" ? vBoasVindas() : "";
    main.innerHTML = topo + (vazio || { painel: vPainel, orientandos: vOrientandos, grupos: vGrupos, producao: vProducao, atualizacoes: vAtualizacoes, relatorios: vRelatorios, config: vConfig }[S.view]());
  }
  bindMain();
  if (keep) { const el = document.getElementById(keep.id); if (el) { el.focus(); try { if (keep.a != null) el.setSelectionRange(keep.a, keep.b); } catch (_) {} } }
  renderDrawer(false);
}

function vBoasVindas() {
  return `<section class="panel" style="max-width:720px"><h2>Bem-vindo ao Caderno de Orientação</h2>
    <p>A base de dados está vazia. Pode começar de duas formas:</p>
    <div class="actions"><button class="btn primary" data-act-main="exemplo">Carregar dados de exemplo</button><button class="btn" data-new="orientando">Cadastrar o primeiro orientando</button></div>
    <p class="muted small">Os dados de exemplo são fictícios e ficam marcados; pode removê-los depois em “Relatórios e cópias”. Antes de convidar os alunos, reveja as <b>Configurações</b> (níveis, duração dos ciclos e marcos automáticos).</p></section>`;
}

/* =========================================================================
   PAINEL (orientador)
   ========================================================================= */
function vPainel() {
  const at = ativos();
  const porNivel = niveis().map(n => [n, at.filter(o => o.nivel === n).length]);
  const comAlerta = at.map(o => [o, alertas(o)]).filter(([, a]) => a.length)
    .sort((a, b) => (b[1].filter(x => x.sev === "crit").length - a[1].filter(x => x.sev === "crit").length) || b[1].length - a[1].length);
  const atrasados = at.flatMap(o => (o.marcos || []).filter(m => marcoStatus(m) === "atrasado")).length;
  const lim6 = addMonths(todayISO, 6), lim90 = addDays(todayISO, 90), ano = todayISO.slice(0, 4);
  const defesas = at.flatMap(o => (o.marcos || []).filter(m => m.tipo === "Defesa" && !m.realizada && m.prevista >= todayISO && m.prevista <= lim6).map(m => ({ o, m })));
  const pubAno = S.producoes.filter(p => p.status === "Publicado" && (p.data || "").startsWith(ano)).length;
  const proximos = at.flatMap(o => (o.marcos || []).filter(m => !m.realizada && m.prevista && m.prevista <= lim90).map(m => ({ o, m }))).sort((a, b) => a.m.prevista.localeCompare(b.m.prevista));
  const emRisco = at.filter(o => ["atrasado", "atencao"].includes(piorEstado(projecao(o)))).length;
  const lvbar = porNivel.filter(([, c]) => c).map(([n, c]) => `<span style="--c:${corNivel(n)};flex:${c}" title="${esc(n)}: ${c}"></span>`).join("");
  const lvleg = porNivel.map(([n, c]) => `<span class="lv small" style="--c:${corNivel(n)}">${esc(curto(n))} <b class="num">${c}</b></span>`).join("");
  const SP = S.cfg.statusProd, pipeMax = Math.max(1, ...SP.map(s => S.producoes.filter(p => p.status === s).length));
  return `
  <section class="stats" aria-label="Resumo">
    <div class="stat wide"><span class="k">Orientandos ativos</span><span class="v">${at.length}</span><div class="lvbar">${lvbar}</div><div class="lvlegend">${lvleg}</div></div>
    <div class="stat"><span class="k">Precisam de atenção</span><span class="v ${comAlerta.length ? "warn" : ""}">${comAlerta.length}</span><span class="d">com pelo menos um alerta</span></div>
    <div class="stat"><span class="k">Projeção em risco</span><span class="v ${emRisco ? "warn" : ""}">${emRisco}</span><span class="d">ritmo atual não cumpre as metas</span></div>
    <div class="stat"><span class="k">Marcos atrasados</span><span class="v ${atrasados ? "crit" : ""}">${atrasados}</span><span class="d">data prevista já passou</span></div>
    <div class="stat"><span class="k">Defesas em 6 meses</span><span class="v">${defesas.length}</span><span class="d">${defesas.map(x => esc(x.o.nome.split(" ")[0])).join(", ") || "nenhuma prevista"}</span></div>
    <div class="stat"><span class="k">Publicações em ${ano}</span><span class="v">${pubAno}</span><span class="d">${S.producoes.filter(p => p.status !== "Publicado").length} em andamento</span></div>
  </section>
  <div class="grid g2" style="margin-bottom:18px">
    <section class="panel"><h2>Precisam de atenção <span class="sub">marcos, reuniões, prazos, bolsas e projeção</span></h2>
      <div class="list">${comAlerta.length ? comAlerta.map(([o, a]) => `
        <div class="li" data-open="${esc(o.id)}" tabindex="0" role="button"><span class="nm">${esc(o.nome)}</span>${lv(o.nivel)}
          <div class="tags">${a.map(x => `<span class="pill ${x.sev}">${esc(x.txt)}</span>`).join("")}</div></div>`).join("") : `<p class="empty">Nenhum alerta. Todos os orientandos ativos estão em dia.</p>`}</div>
    </section>
    <section class="panel"><h2>Próximos 90 dias <span class="sub">marcos pendentes, incluindo atrasados</span></h2>
      <div class="list">${proximos.length ? proximos.map(({ o, m }) => { const st = marcoStatus(m); return `
        <div class="li" data-open="${esc(o.id)}" tabindex="0" role="button"><span><span class="nm">${esc(m.tipo)}</span> <span class="muted">· ${esc(o.nome)}</span></span><span class="date">${fmt(m.prevista)}</span>
          <div class="tags">${lv(o.nivel)} ${st === "atrasado" ? `<span class="pill crit">atrasado há ${-days(todayISO, m.prevista)} dias</span>` : `<span class="pill ${MS_PILL[st]}">em ${days(todayISO, m.prevista)} dias</span>`}</div></div>`; }).join("") : `<p class="empty">Nenhum marco nos próximos 90 dias.</p>`}</div>
    </section>
  </div>
  <section class="panel" style="margin-bottom:18px">
    <h2>Ciclo de estudos <span class="sub">do início ao término previsto · clique numa linha para abrir a ficha</span>
      <span class="seg" style="margin-left:auto" role="group" aria-label="Agrupar por">${[["nivel", "Nível"], ["projeto", "Projeto"], ["tematica", "Temática"]].map(([k, t]) => `<button data-group="${k}" aria-pressed="${S.group === k}">${t}</button>`).join("")}</span></h2>
    ${gantt(at)}
  </section>
  <section class="panel"><h2>Produção científica <span class="sub">todos os trabalhos cadastrados, por status</span></h2>
    <div class="pipe">${SP.map(s => { const c = S.producoes.filter(p => p.status === s).length; return `<div class="row"><span>${esc(s)}</span><div class="track"><span style="width:${c / pipeMax * 100}%"></span></div><b class="num">${c}</b></div>`; }).join("")}</div>
  </section>`;
}

function gantt(list) {
  if (!list.length) return `<p class="empty">Nenhum orientando ativo.</p>`;
  const ini = list.map(o => o.inicio).filter(Boolean).sort()[0] || todayISO;
  const fim = list.map(prazoDe).filter(Boolean).sort().pop() || todayISO;
  const y0 = Number(ini.slice(0, 4)), y1 = Number(fim.slice(0, 4)) + 1, t0 = Date.UTC(y0, 0, 1), t1 = Date.UTC(y1, 0, 1);
  const X = s => ((toUTC(s) - t0) / (t1 - t0) * 100);
  const years = []; for (let y = y0; y < y1; y++) years.push(y);
  const key = { nivel: o => o.nivel, projeto: o => proj(o.projetoId)?.sigla || "Sem projeto", tematica: o => o.tematica || "Sem temática" }[S.group];
  const order = S.group === "nivel" ? niveis().slice().reverse() : [...new Set(list.map(key))].sort((a, b) => a.localeCompare(b, "pt"));
  const rows = [];
  for (const g of order) {
    const os = list.filter(o => key(o) === g).sort((a, b) => (a.inicio || "").localeCompare(b.inicio || ""));
    if (!os.length) continue;
    rows.push(`<div class="g-group"><b>${esc(g)}</b><span class="muted small">${os.length}</span></div>`);
    for (const o of os) {
      const c = corNivel(o.nivel), pz = prazoDe(o) || todayISO;
      const L = X(o.inicio || todayISO), W = Math.max(.6, X(pz) - L), td = tempoDecorrido(o) || 0;
      const dots = (o.marcos || []).filter(m => m.prevista || m.realizada).map(m => { const st = marcoStatus(m), d = m.realizada || m.prevista;
        return `<span class="g-dot ${st}" style="left:${X(d)}%" title="${esc(m.tipo)} — ${MS_LABEL[st]} ${fmt(d)}"></span>`; }).join("");
      rows.push(`<div class="g-row" data-open="${esc(o.id)}" tabindex="0" role="button" aria-label="${esc(o.nome)}: ${fmt(o.inicio)} a ${fmt(pz)}">
        <div class="g-name" style="--c:${c}"><i></i>${esc(o.nome)}</div>
        <div class="g-track"><div class="g-bar" style="--c:${c};left:${L}%;width:${W}%"><div class="fill" style="width:${td * 100}%"></div></div>${dots}</div></div>`);
    }
  }
  return `<div class="gantt-wrap"><div class="gantt">
    <div class="g-head"><div></div><div class="g-track">${years.map(y => `<span class="g-year" style="left:${X(y + "-01-01")}%">${y}</span>`).join("")}<span class="g-today-lbl" style="left:${X(todayISO)}%">hoje</span></div></div>
    <div class="g-grid">${years.map(y => `<div class="g-yl" style="left:${X(y + "-01-01")}%"></div>`).join("")}<div class="g-today" style="left:${X(todayISO)}%"></div></div>
    ${rows.join("")}</div></div>
  <div class="g-legend"><span><span class="g-dot" style="position:static"></span>marco previsto</span><span><span class="g-dot feito" style="position:static"></span>realizado</span>
    <span><span class="g-dot atrasado" style="position:static"></span>atrasado</span><span>Parte preenchida da barra = tempo já decorrido do ciclo</span><span style="color:var(--margin)">│ hoje</span></div>`;
}

/* =========================================================================
   ORIENTANDOS (lista)
   ========================================================================= */
function filtrar() {
  const f = S.f, q = f.q.trim().toLowerCase();
  return S.orientandos.filter(o => (!f.nivel || o.nivel === f.nivel) && (!f.projeto || o.projetoId === f.projeto) && (!f.tematica || o.tematica === f.tematica)
    && (!f.situacao || o.situacao === f.situacao) && (!q || [o.nome, o.titulo, o.email, o.coorientador, o.programa].join(" ").toLowerCase().includes(q)))
    .sort((a, b) => niveis().indexOf(b.nivel) - niveis().indexOf(a.nivel) || a.nome.localeCompare(b.nome, "pt"));
}
function sel(id, opts, val, all) { return `<select id="${id}" aria-label="${esc(all)}"><option value="">${esc(all)}</option>${opts.map(o => { const [v, t] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${v === val ? "selected" : ""}>${esc(t)}</option>`; }).join("")}</select>`; }
function vOrientandos() {
  const list = filtrar();
  return `
  <div class="filters">
    <input type="search" id="f-q" placeholder="Buscar por nome, título, programa…" value="${esc(S.f.q)}">
    ${sel("f-nivel", niveis(), S.f.nivel, "Todos os níveis")}${sel("f-projeto", S.projetos.map(p => [p.id, p.sigla]), S.f.projeto, "Todos os projetos")}
    ${sel("f-tematica", tematicas(), S.f.tematica, "Todas as temáticas")}${sel("f-situacao", SITUACOES, S.f.situacao, "Todas as situações")}
    <button class="btn primary" data-new="orientando">+ Novo orientando</button>
  </div>
  <div class="tbl-wrap"><table>
    <thead><tr><th>Orientando</th><th>Nível</th><th>Projeto</th><th>Ciclo</th><th>Progresso</th><th>Projeção</th><th>Próximo marco</th><th>Última reunião</th><th>Alertas</th></tr></thead>
    <tbody>${list.length ? list.map(o => {
      const pm = proximoMarco(o), u = ultimoRegisto(o.id), a = alertas(o), td = tempoDecorrido(o), P = o.situacao === "Ativo" ? projecao(o) : null, pe = piorEstado(P);
      return `<tr data-open="${esc(o.id)}" class="${o.situacao !== "Ativo" ? "concl" : ""}" tabindex="0">
        <td><b>${esc(o.nome)}</b><div class="t">${esc(o.titulo)}</div>${o.email ? "" : `<div><span class="pill warn">sem e-mail de acesso</span></div>`}</td>
        <td>${lv(o.nivel)}${o.situacao !== "Ativo" ? `<div><span class="pill">${esc(o.situacao)}</span></div>` : ""}</td>
        <td><span class="mono small">${esc(proj(o.projetoId)?.sigla || "—")}</span><div class="t">${esc(o.tematica || "")}</div></td>
        <td><span class="date">${fmtCurto(o.inicio)} → ${fmtCurto(o.fim || prazoDe(o))}</span>${td != null ? `<div class="t">${Math.round(td * 100)}% do tempo</div>` : ""}</td>
        <td><div class="bars"><span>Experim.</span><div class="mini"><span style="width:${pct(o.progExp)}%;--c:var(--c-exp)"></span></div><span class="num">${pct(o.progExp)}%</span>
          <span>Escrita</span><div class="mini"><span style="width:${pct(o.progEscrita)}%;--c:var(--c-esc)"></span></div><span class="num">${pct(o.progEscrita)}%</span></div></td>
        <td>${pe ? `<span class="pill ${ST_TXT[pe][1]}">${ST_TXT[pe][0]}</span>${P.fimProj ? `<div class="t">fim ≈ ${fmtMes(P.fimProj)}</div>` : ""}` : `<span class="muted">—</span>`}</td>
        <td>${pm ? `${esc(pm.tipo)}<div class="date">${fmt(pm.prevista)}</div>` : `<span class="muted">—</span>`}</td>
        <td><span class="date">${u ? fmt(u) : "—"}</span>${pendentesDe(o.id).length ? `<div><span class="pill warn">atualização pendente</span></div>` : ""}</td>
        <td>${a.length ? a.map(x => `<span class="pill ${x.sev}" style="margin:0 4px 4px 0">${esc(x.txt)}</span>`).join("") : `<span class="pill ok">em dia</span>`}</td></tr>`; }).join("")
      : `<tr><td colspan="9" class="empty">Nenhum orientando corresponde aos filtros.</td></tr>`}</tbody>
  </table></div><p class="muted small">${list.length} de ${S.orientandos.length} orientandos.</p>`;
}

/* =========================================================================
   PROJETOS E TEMÁTICAS
   ========================================================================= */
function vGrupos() {
  const byProj = S.cardGroup === "projeto";
  const groups = byProj ? S.projetos.map(p => ({ key: p.id, titulo: p.sigla, sub: p.nome, p, membros: S.orientandos.filter(o => o.projetoId === p.id) }))
    : tematicas().map(t => ({ key: t, titulo: t, sub: S.projetos.filter(p => p.tematica === t).map(p => p.sigla).join(" · ") || "—", membros: S.orientandos.filter(o => o.tematica === t) }));
  return `
  <div class="filters"><span class="seg" role="group" aria-label="Agrupar por"><button data-cg="projeto" aria-pressed="${byProj}">Por projeto</button><button data-cg="tematica" aria-pressed="${!byProj}">Por temática</button></span>
    <span class="muted small">Indicadores consolidados de cada ${byProj ? "projeto" : "temática (linha de pesquisa)"}.</span>
    <button class="btn primary" style="margin-left:auto" data-new="projeto">+ Novo projeto</button></div>
  <div class="cards">${groups.map(g => {
    const at = g.membros.filter(o => o.situacao === "Ativo"), ids = new Set(g.membros.map(o => o.id));
    const prods = byProj ? S.producoes.filter(p => p.projetoId === g.key) : S.producoes.filter(p => (p.autores || []).some(a => ids.has(a)));
    const pub = prods.filter(p => p.status === "Publicado").length;
    const atr = at.flatMap(o => (o.marcos || []).filter(m => marcoStatus(m) === "atrasado")).length;
    const risco = at.filter(o => ["atrasado", "atencao"].includes(piorEstado(projecao(o)))).length;
    const media = k => at.length ? Math.round(at.reduce((s, o) => s + pct(o[k]), 0) / at.length) : 0;
    return `<article class="gcard">
      <div><div style="display:flex;gap:10px;align-items:baseline;flex-wrap:wrap"><h3>${esc(g.titulo)}</h3>${g.p ? `<span class="pill acc">${esc(g.p.tematica)}</span>` : ""}
        ${g.p ? `<button class="btn ghost small" style="margin-left:auto" data-editproj="${esc(g.p.id)}">Editar</button>` : ""}</div>
        <div class="meta">${esc(g.sub)}</div>${g.p ? `<div class="meta">${esc(g.p.financiador || "")} · <span class="mono">${fmtCurto(g.p.inicio)} → ${fmtCurto(g.p.fim)}</span></div>` : ""}</div>
      <div class="kpis"><div><b>${at.length}</b><small>ativos</small></div><div><b>${pub}</b><small>publicados</small></div>
        <div><b style="${risco ? "color:var(--warn)" : ""}">${risco}</b><small>proj. em risco</small></div><div><b style="${atr ? "color:var(--crit)" : ""}">${atr}</b><small>marcos atras.</small></div></div>
      <div class="lvlegend">${niveis().map(n => { const c = at.filter(o => o.nivel === n).length; return c ? `<span class="lv small" style="--c:${corNivel(n)}">${esc(curto(n))} <b class="num">${c}</b></span>` : ""; }).join("")}</div>
      <div class="bars" style="grid-template-columns:110px 1fr 34px"><span>Experimental (média)</span><div class="mini"><span style="width:${media("progExp")}%;--c:var(--c-exp)"></span></div><span class="num">${media("progExp")}%</span>
        <span>Escrita (média)</span><div class="mini"><span style="width:${media("progEscrita")}%;--c:var(--c-esc)"></span></div><span class="num">${media("progEscrita")}%</span></div>
      <div class="members">${g.membros.sort((a, b) => niveis().indexOf(b.nivel) - niveis().indexOf(a.nivel)).map(o => `<button data-open="${esc(o.id)}"><span>${esc(o.nome)} ${o.situacao !== "Ativo" ? `<span class="pill">${esc(o.situacao)}</span>` : ""}</span>${lv(o.nivel)}</button>`).join("") || `<span class="empty">Sem orientandos.</span>`}</div>
    </article>`; }).join("") || `<p class="empty">Nenhum projeto cadastrado.</p>`}</div>`;
}

/* =========================================================================
   PRODUÇÃO
   ========================================================================= */
function vProducao() {
  return `
  <div class="filters"><span class="muted small">Artigos, congressos, capítulos, patentes, dissertações e teses. Clique num cartão para editar ou mudar o status.</span>
    <button class="btn primary" style="margin-left:auto" data-new="producao">+ Nova produção</button></div>
  <div class="kanban">${S.cfg.statusProd.map(s => { const ps = S.producoes.filter(p => p.status === s).sort((a, b) => (b.data || "").localeCompare(a.data || ""));
    return `<div class="col"><h3><span>${esc(s)}</span><span class="num">${ps.length}</span></h3>
      ${ps.map(p => `<div class="pcard" data-editprod="${esc(p.id)}" tabindex="0" role="button"><span class="ti">${esc(p.titulo)}</span><span class="ve">${esc(p.veiculo || "")}</span>
        <span class="small muted">${(p.autores || []).map(a => esc(ori(a)?.nome || "?")).join(", ")}</span>
        <span style="display:flex;gap:6px;flex-wrap:wrap"><span class="pill">${esc(p.tipo)}</span>${p.projetoId ? `<span class="pill acc">${esc(proj(p.projetoId)?.sigla || "")}</span>` : ""}${p.data ? `<span class="date">${fmt(p.data)}</span>` : ""}${(p.anexos || []).length ? `<span class="pill">📎 ${p.anexos.length}</span>` : ""}${p.doi ? `<span class="pill">DOI</span>` : ""}</span></div>`).join("") || `<span class="empty">—</span>`}</div>`; }).join("")}</div>`;
}

/* =========================================================================
   ATUALIZAÇÕES (aprovação pelo orientador)
   ========================================================================= */
function resumoMudancas(u, o) {
  const L = [];
  if (u.progExp != null) L.push(`Trabalho experimental: <span class="arrow">${o ? pct(o.progExp) : "?"}% → ${pct(u.progExp)}%</span>`);
  if (u.progEscrita != null) L.push(`Escrita: <span class="arrow">${o ? pct(o.progEscrita) : "?"}% → ${pct(u.progEscrita)}%</span>`);
  if (u.marcoTipo) L.push(`Marco concluído: <b>${esc(u.marcoTipo)}</b> em <span class="arrow">${fmt(u.marcoData)}</span>`);
  if (u.prodStatus) { const p = S.producoes.find(x => x.id === u.prodStatus.id); L.push(`Status de “${esc(p?.titulo || "trabalho")}”: <span class="arrow">${esc(p?.status || "?")} → ${esc(u.prodStatus.status)}</span>`); }
  if (u.prodNova) L.push(`Produção nova: <b>${esc(u.prodNova.titulo)}</b> · ${esc(u.prodNova.tipo)} · ${esc(u.prodNova.status)}${u.prodNova.veiculo ? ` · <i>${esc(u.prodNova.veiculo)}</i>` : ""}${u.prodNova.local ? ` · ${esc(u.prodNova.local)}` : ""}${u.prodNova.data ? ` · ${fmt(u.prodNova.data)}` : ""}${u.prodNova.doi ? ` · ${esc(u.prodNova.doi)}` : ""}`);
  if ((u.anexos || []).length) L.push(`Documentos anexados: ${u.anexos.map(a => `<a href="${esc(a.url)}" target="_blank" rel="noopener noreferrer">${esc(a.nome)}</a>`).join(", ")}`);
  return L;
}
function vAtualizacoes() {
  const L = S.atualizacoes.slice().sort((a, b) => (a.enviadoEm || "").localeCompare(b.enviadoEm || ""));
  return `<section class="panel"><h2>Atualizações pendentes <span class="sub">enviadas pelos orientandos — aprovar aplica as mudanças à ficha e cria um registo no histórico</span></h2>
    ${L.length ? `<div class="grid" style="gap:12px">${L.map(u => { const o = ori(u.orientandoId), muds = resumoMudancas(u, o);
      return `<article class="upd"><div class="h"><b>${o ? esc(o.nome) : "Ficha removida"}</b>${o ? lv(o.nivel) : ""}<span class="date">${fmt(u.enviadoEm)}</span>
          <span class="muted small">enviado por ${esc(u.nomeInformado || u.alunoEmail)}</span></div>
        ${muds.length ? `<div class="diff">${muds.map(x => `<div>${x}</div>`).join("")}</div>` : ""}
        ${u.texto ? `<blockquote>${esc(u.texto)}</blockquote>` : ""}
        <div class="actions"><button class="btn primary" data-approve="${esc(u.id)}" ${o ? "" : "disabled"}>Aprovar e aplicar</button><button class="btn" data-open="${esc(u.orientandoId)}" ${o ? "" : "disabled"}>Ver ficha</button><button class="btn danger" data-discard="${esc(u.id)}">Descartar</button></div>
      </article>`; }).join("")}</div>` : `<p class="empty">Nenhuma atualização pendente.</p>`}</section>`;
}
async function aprovar(id, btn) {
  const u = S.atualizacoes.find(x => x.id === id), o = u && ori(u.orientandoId); if (!o) return;
  btn.disabled = true;
  const exp = u.progExp != null ? pct(u.progExp) : pct(o.progExp), escr = u.progEscrita != null ? pct(u.progEscrita) : pct(o.progEscrita);
  const patch = { atualizadoEm: new Date().toISOString() };
  if (u.progExp != null || u.progEscrita != null) Object.assign(patch, { progExp: exp, progEscrita: escr, historico: comHistorico(o, exp, escr) });
  if (u.marcoTipo) {
    const marcos = (o.marcos || []).map(m => ({ ...m }));
    const alvo = marcos.find(m => m.id === u.marcoId) || marcos.find(m => !m.realizada && m.tipo === u.marcoTipo);
    if (alvo) alvo.realizada = u.marcoData || todayISO;
    else marcos.push({ id: "m" + Date.now().toString(36), tipo: u.marcoTipo, prevista: u.marcoData || todayISO, realizada: u.marcoData || todayISO, obs: "incluído por atualização do orientando" });
    patch.marcos = marcos;
  }
  const muds = resumoMudancas(u, o).map(x => x.replace(/<[^>]+>/g, ""));
  const ops = [{ op: "update", col: "orientandos", id: o.id, dados: patch }];
  if (u.prodStatus && S.producoes.some(p => p.id === u.prodStatus.id)) ops.push({ op: "update", col: "producoes", id: u.prodStatus.id, dados: { status: u.prodStatus.status, ...(u.prodStatus.status !== "Em redação" ? { data: todayISO } : {}) } });
  if (u.prodNova) ops.push({ op: "set", col: "producoes", id: D.novoId("producoes"), dados: limpo({ titulo: u.prodNova.titulo, tipo: u.prodNova.tipo || "Outro",
    status: u.prodNova.status || "Em redação", veiculo: u.prodNova.veiculo || "", local: u.prodNova.local || "", descricao: u.prodNova.descricao || "",
    data: u.prodNova.data || (u.prodNova.status === "Em redação" ? "" : todayISO), autores: [o.id], projetoId: o.projetoId || "", doi: u.prodNova.doi || "", anexos: u.anexos || [] }) });
  ops.push({ op: "set", col: "registos", id: D.novoId("registos"), dados: { orientandoId: o.id, alunoEmail: o.email || "", data: (u.enviadoEm || todayISO).slice(0, 10), tipo: "Atualização do aluno", autor: u.nomeInformado || "Orientando",
    texto: [u.texto, muds.length ? "Mudanças aprovadas: " + muds.join("; ") : ""].filter(Boolean).join("\n"), encaminhamentos: "" } });
  ops.push({ op: "delete", col: "atualizacoes", id });
  const ok = await write(() => D.lote(ops), `Ficha de ${o.nome} atualizada.`);
  if (!ok) { btn.disabled = false; return; }
  if (NOTIFICACOES && S.cfg.notif.avisarAprovacao && emailDe(o))
    enfileirar(`aprov_${id}`, emailDe(o), "A sua atualização foi aprovada", [`Olá, ${o.nome.split(" ")[0]},`, "",
      "O orientador aprovou a atualização que enviou" + (muds.length ? ":" : "."), ...muds.map(x => "• " + x), "", "A sua ficha já está atualizada:"], { orientandoId: o.id, tipo: "aprovacao" }).catch(() => {});
}

/* =========================================================================
   RELATÓRIOS, EXPORTAÇÃO E CÓPIAS DE SEGURANÇA
   ========================================================================= */
function vRelatorios() {
  const nEx = ["orientandos", "projetos", "producoes", "registos"].reduce((s, k) => s + S[k].filter(x => x.exemplo).length, 0);
  return `<div class="grid g2">
    <section class="panel"><h2>Exportar para Excel</h2>
      <p class="muted small" style="margin-top:0">Ficheiros CSV (separados por ponto e vírgula) que abrem diretamente no Excel — úteis para relatórios à CAPES, ao CNPq ou à coordenação.</p>
      <div class="list">${[["orientandos", "Orientandos", "com progresso, projeção, bolsa, prazos e alertas"], ["marcos", "Marcos do ciclo de estudos", "um marco por linha, com status"], ["producao", "Produção científica", "com autores, veículo e status"], ["registos", "Registos de reuniões", "datas, resumos e encaminhamentos"]]
        .map(([k, t, d]) => `<div class="li" style="cursor:default"><span><b>${t}</b><div class="muted small">${d}</div></span><button class="btn" data-csv="${k}">Baixar CSV</button></div>`).join("")}</div>
    </section>
    <section class="panel"><h2>Cópia de segurança</h2>
      <p class="muted small" style="margin-top:0">O plano gratuito do Firebase não guarda cópias automáticas. Baixe uma cópia completa uma vez por mês e guarde-a (por exemplo, no seu Drive).</p>
      <div class="actions"><button class="btn primary" data-act-main="backup">Baixar cópia completa (.json)</button>
        <label class="btn" for="imp-file">Restaurar a partir de cópia…</label><input type="file" id="imp-file" accept="application/json,.json" hidden></div>
      <p class="muted small">Restaurar grava por cima dos registos com o mesmo identificador e acrescenta os que faltam; não apaga nada.</p>
      <div id="imp-msg" class="small"></div>
      <h2 style="margin-top:18px">Dados de exemplo</h2>
      ${nEx ? `<p class="muted small" style="margin-top:0">Há ${nEx} registos de exemplo (fictícios) na base.</p><button class="btn danger" data-act-main="rm-exemplo">Remover dados de exemplo</button>`
        : `<p class="muted small" style="margin-top:0">Carregue um laboratório fictício para experimentar as funcionalidades.</p><button class="btn" data-act-main="exemplo">Carregar dados de exemplo</button>`}
    </section>${vLembretes()}${NOTIFICACOES ? vFila() : ""}</div>`;
}
function assuntoCorpo(o) {
  const P = o.situacao === "Ativo" ? projecao(o) : null, a = alertas(o), pm = proximoMarco(o), u = ultimoRegisto(o.id);
  const L = [`Olá, ${o.nome.split(" ")[0]},`, "",
    "Passando para acompanhar o andamento do seu trabalho. Situação no Caderno de Orientação nesta data:", "",
    `• Trabalho experimental: ${pct(o.progExp)}%  |  Escrita: ${pct(o.progEscrita)}%`,
    `• Término previsto: ${fmt(prazoDe(o))}`];
  if (pm) L.push(`• Próximo marco: ${pm.tipo} em ${fmt(pm.prevista)}`);
  if (u) L.push(`• Última reunião registada: ${fmt(u)}`); else L.push("• Ainda não há reuniões registadas");
  if (P && P.fimProj) L.push(`• No ritmo atual, conclusão projetada em ${fmtMes(P.fimProj)}${P.folga < 0 ? ` (${mesesTxt(P.folga)} depois do prazo)` : ` (${mesesTxt(P.folga)} de folga)`}`);
  if (a.length) { L.push("", "Pontos a resolver:"); a.forEach(x => L.push(`• ${x.txt}`)); }
  L.push("", `Por favor, atualize o seu andamento no Caderno de Orientação: ${location.origin + location.pathname}`, "", "Abraço,");
  return { assunto: `Acompanhamento da orientação — ${o.nome}`, corpo: L.join("\n") };
}
function vLembretes() {
  const at = ativos().filter(o => o.email || o.emailContato);
  const comAlerta = at.map(o => [o, alertas(o)]).sort((x, y) => y[1].length - x[1].length);
  const todos = at.map(o => o.emailContato || o.email).join(",");
  return `<section class="panel"><h2>Lembretes por e-mail <span class="sub">o texto é montado com a situação atual; o envio abre o seu programa de e-mail</span></h2>
    <p class="muted small" style="margin-top:0">O plano gratuito do Firebase não envia e-mails automaticamente (ver o guia, secção “Notificações”). Aqui o Caderno prepara a mensagem e o senhor só confirma o envio.</p>
    <div class="actions" style="margin-bottom:12px"><button class="btn" data-mailall="${esc(todos)}">Escrever a todos os ativos (${at.length})</button></div>
    <div class="list">${comAlerta.map(([o, a]) => `<div class="li" style="cursor:default">
      <span><b>${esc(o.nome)}</b> ${lv(o.nivel)}<div class="muted small">${esc(o.emailContato || o.email)}${a.length ? " · " + a.map(x => esc(x.txt)).join(" · ") : " · em dia"}</div></span>
      <span class="actions"><button class="btn small" data-mail="${esc(o.id)}">Escrever</button><button class="btn small" data-copy="${esc(o.id)}">Copiar texto</button></span></div>`).join("") || `<p class="empty">Nenhum orientando ativo com e-mail cadastrado.</p>`}</div></section>`;
}
function csv(rows) { return "﻿" + rows.map(r => r.map(v => { const s = String(v ?? ""); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(";")).join("\r\n"); }
function exportarCSV(k) {
  const P = id => proj(id)?.sigla || "";
  let rows;
  if (k === "orientandos") rows = [["Nome", "E-mail", "Nível", "Situação", "Programa", "Projeto", "Temática", "Título", "Coorientador", "Bolsa", "Fim da bolsa", "Início", "Término previsto", "Término real", "Progresso experimental (%)", "Progresso escrita (%)", "Conclusão projetada", "Estado da projeção", "Última reunião", "Alertas"],
    ...S.orientandos.map(o => { const Pj = o.situacao === "Ativo" ? projecao(o) : null, pe = piorEstado(Pj);
      return [o.nome, o.email, o.nivel, o.situacao, o.programa, P(o.projetoId), o.tematica, o.titulo, o.coorientador, o.bolsa, o.bolsaFim ? fmt(o.bolsaFim) : "", fmt(o.inicio), fmt(prazoDe(o)), o.fim ? fmt(o.fim) : "", pct(o.progExp), pct(o.progEscrita), Pj?.fimProj ? fmt(Pj.fimProj) : "", pe ? ST_TXT[pe][0] : "", ultimoRegisto(o.id) ? fmt(ultimoRegisto(o.id)) : "", alertas(o).map(a => a.txt).join(" | ")]; })];
  if (k === "marcos") rows = [["Orientando", "Nível", "Projeto", "Marco", "Data prevista", "Data realizada", "Status", "Observações"], ...S.orientandos.flatMap(o => (o.marcos || []).map(m => [o.nome, o.nivel, P(o.projetoId), m.tipo, fmt(m.prevista), m.realizada ? fmt(m.realizada) : "", MS_LABEL[marcoStatus(m)], m.obs || ""]))];
  if (k === "producao") rows = [["Título", "Tipo", "Periódico / evento", "Status", "Data", "Autores (orientandos)", "Projeto", "DOI / link"], ...S.producoes.map(p => [p.titulo, p.tipo, p.veiculo, p.status, p.data ? fmt(p.data) : "", (p.autores || []).map(a => ori(a)?.nome || a).join(", "), P(p.projetoId), p.doi || ""])];
  if (k === "registos") rows = [["Data", "Orientando", "Tipo", "Resumo", "Encaminhamentos", "Registado por"], ...S.registos.slice().sort((a, b) => b.data.localeCompare(a.data)).map(r => [fmt(r.data), ori(r.orientandoId)?.nome || "", r.tipo, r.texto, r.encaminhamentos, r.autor])];
  baixar(`${k}_${todayISO}.csv`, csv(rows), "text/csv;charset=utf-8");
}
function copiaCompleta() {
  const cols = {};
  for (const k of ["projetos", "orientandos", "producoes", "registos", "atualizacoes"]) cols[k] = Object.fromEntries(S[k].map(({ id, ...d }) => [id, d]));
  cols.notas = Object.fromEntries(Object.entries(S.notas).map(([id, { id: _, ...d }]) => [id, d]));
  cols.config = { geral: S.cfg, ...(isDono() ? { acesso: S.acesso } : {}) };
  baixar(`caderno-orientacao_copia_${todayISO}.json`, JSON.stringify({ formato: "caderno-orientacao", versao: 1, exportadoEm: new Date().toISOString(), colecoes: cols }, null, 1), "application/json");
}
async function importarColecoes(dados, msgEl) {
  if (dados?.formato !== "caderno-orientacao" || !dados.colecoes) { msgEl.textContent = "Este ficheiro não é uma cópia do Caderno de Orientação."; msgEl.style.color = "var(--crit)"; return false; }
  const ops = [];
  for (const [col, docs] of Object.entries(dados.colecoes)) {
    if (!["projetos", "orientandos", "producoes", "registos", "atualizacoes", "notas", "config"].includes(col)) continue;
    for (const [id, d] of Object.entries(docs || {})) { if (col === "config" && id === "acesso" && !isDono()) continue; ops.push({ op: "set", col, id, dados: limpo(d) }); }
  }
  msgEl.textContent = `A gravar ${ops.length} registos…`; msgEl.style.color = "";
  const ok = await write(() => D.lote(ops), `${ops.length} registos gravados.`);
  msgEl.textContent = ok ? `Concluído: ${ops.length} registos gravados.` : "A importação falhou.";
  return ok;
}
async function carregarExemplo(btn) {
  if (btn) btn.disabled = true;
  try { const r = await fetch("exemplo.json", { cache: "no-store" }); const d = await r.json();
    await importarColecoes(d, { set textContent(v) { toast(v); }, style: {} });
  } catch (e) { toast("Não foi possível carregar o ficheiro de exemplo."); }
  if (btn) btn.disabled = false;
}
async function removerExemplo(btn) {
  if (btn.dataset.confirm !== "1") { btn.dataset.confirm = "1"; btn.textContent = "Confirmar remoção"; return; }
  const ops = [];
  for (const k of ["orientandos", "projetos", "producoes", "registos"]) S[k].filter(x => x.exemplo).forEach(x => ops.push({ op: "delete", col: k, id: x.id }));
  Object.entries(S.notas).filter(([, n]) => n.exemplo).forEach(([id]) => ops.push({ op: "delete", col: "notas", id }));
  S.atualizacoes.filter(u => u.id === "uexemplo1").forEach(u => ops.push({ op: "delete", col: "atualizacoes", id: u.id }));
  await write(() => D.lote(ops), "Dados de exemplo removidos.");
}

/* =========================================================================
   CONFIGURAÇÕES
   ========================================================================= */
const marcosParaTexto = ms => (ms || []).map(m => `${m.tipo} | ${m.quando}`).join("\n");
function textoParaMarcos(t) {
  return t.split("\n").map(l => l.trim()).filter(Boolean).map(l => { const [tipo, q = "0"] = l.split("|").map(x => x.trim());
    const quando = /^fim(-\d+)?$/.test(q) ? q : (Number(q.replace(",", ".")) || 0); return { tipo, quando }; }).filter(m => m.tipo);
}
function vConfig() {
  const c = S.cfg, A = c.alertas;
  return `<div class="grid" style="gap:18px">
  <section class="panel"><h2>Níveis e metas <span class="sub">usados para criar marcos automáticos e para estimar metas quando o orientador não as define na ficha</span></h2>
    <div class="cfg-lv">${niveis().map((n, i) => { const v = c.niveis[n] || {}; return `<div class="box" data-nivel="${esc(n)}">
      <h3>${lv(n)} <span class="muted small" style="font-weight:400">${esc(n)}</span></h3>
      <div class="cfg-grid">
        <label>Duração do ciclo (meses)<input type="number" min="1" max="120" id="cf-dur-${i}" value="${v.duracao ?? 24}"></label>
        <label>Experimental concluído até (% do ciclo)<input type="number" min="5" max="100" id="cf-exp-${i}" value="${Math.round((v.metaExp ?? .75) * 100)}"></label>
        <label>Início da escrita (% do ciclo)<input type="number" min="0" max="95" id="cf-esc-${i}" value="${Math.round((v.inicioEscrita ?? .5) * 100)}"></label>
      </div>
      <label>Marcos automáticos <span class="hint">um por linha: “Tipo | meses após o início” ou “Tipo | fim-15” (15 dias antes do prazo)</span>
        <textarea id="cf-mar-${i}" rows="6">${esc(marcosParaTexto(v.marcos))}</textarea></label></div>`; }).join("")}</div>
  </section>
  <section class="panel"><h2>Regras dos alertas</h2>
    <div class="cfg-grid">
      <label>Alerta “sem reunião” após (dias)<input type="number" id="cf-a1" value="${A.diasSemReuniao}"></label>
      <label>Mestrado/doutorado: prazo em menos de (dias)<input type="number" id="cf-a2" value="${A.diasPrazo}"></label>
      <label>… com escrita abaixo de (%)<input type="number" id="cf-a3" value="${A.escritaMin}"></label>
      <label>Bolsa termina em menos de (dias)<input type="number" id="cf-a4" value="${A.diasBolsa}"></label>
      <label>Tolerância da projeção (dias após a meta)<input type="number" id="cf-a5" value="${A.toleranciaProjecao}"></label>
    </div></section>
  <section class="panel"><h2>Notificações automáticas <span class="sub">as mensagens entram numa fila; quem as envia é o serviço configurado no guia</span></h2>
    <div class="cfg-grid">
      <label>Avisar o aluno quantos dias antes de um marco<input type="number" id="cf-n1" value="${c.notif.marcoDias}"></label>
      <label>Avisar quantos dias antes do fim da bolsa<input type="number" id="cf-n2" value="${c.notif.bolsaDias}"></label>
      <label>Cobrar atualização após quantos dias sem registo<input type="number" id="cf-n3" value="${c.notif.semAtualizacaoDias}"></label>
      <label>Assinatura das mensagens<input type="text" id="cf-n4" value="${esc(c.notif.assinatura || "")}" placeholder="ex.: Prof. Bruno Henriques — Laboratório X"></label>
    </div>
    <div class="actions" style="margin-top:10px">
      <label class="small" style="flex-direction:row;align-items:center;gap:6px;color:var(--ink)"><input type="checkbox" id="cf-n5" ${c.notif.avisarAprovacao ? "checked" : ""}> avisar o aluno quando aprovo uma atualização</label>
      <label class="small" style="flex-direction:row;align-items:center;gap:6px;color:var(--ink)"><input type="checkbox" id="cf-n6" ${c.notif.avisarNovaAtualizacao ? "checked" : ""}> avisar-me quando um aluno envia uma atualização</label>
      <label class="small" style="flex-direction:row;align-items:center;gap:6px;color:var(--ink)"><input type="checkbox" id="cf-n7" ${c.notif.resumoSemanal ? "checked" : ""}> enviar-me um resumo semanal</label>
    </div></section>
  <section class="panel"><h2>Listas</h2>
    <div class="cfg-grid">
      <label>Tipos de marco <span class="hint">um por linha</span><textarea id="cf-tm" rows="10">${esc(c.tiposMarco.join("\n"))}</textarea></label>
      <label>Status da produção <span class="hint">pela ordem das colunas</span><textarea id="cf-sp" rows="10">${esc(c.statusProd.join("\n"))}</textarea></label>
      <label>Tipos de produção<textarea id="cf-tp" rows="10">${esc(c.tiposProd.join("\n"))}</textarea></label>
    </div></section>
  ${isDono() ? `<section class="panel"><h2>Acessos <span class="sub">co-editores têm os mesmos poderes que o orientador, exceto gerir esta lista</span></h2>
    <label class="cfg-grid" style="display:block"><span class="small muted">E-mails de co-editores (um por linha) — por exemplo, um coorientador ou técnico do laboratório</span>
      <textarea id="cf-ed" rows="4" style="margin-top:6px">${esc((S.acesso.editores || []).join("\n"))}</textarea></label>
    <p class="muted small">Os orientandos não precisam de estar nesta lista: entram com o e-mail cadastrado na respetiva ficha.</p></section>` : ""}
  <div class="actions"><button class="btn primary" data-act-main="save-cfg">Guardar configurações</button><button class="btn" data-act-main="reset-cfg">Repor valores padrão</button></div>
  </div>`;
}
async function guardarCfg() {
  const n = v => Number($("#" + v).value), linhas = id => $("#" + id).value.split("\n").map(s => s.trim()).filter(Boolean);
  const cfg = structuredClone(S.cfg);
  niveis().forEach((nv, i) => { cfg.niveis[nv] = { ...cfg.niveis[nv], duracao: Math.max(1, n(`cf-dur-${i}`) || 24), metaExp: Math.min(1, Math.max(.05, n(`cf-exp-${i}`) / 100)),
    inicioEscrita: Math.min(.95, Math.max(0, n(`cf-esc-${i}`) / 100)), marcos: textoParaMarcos($(`#cf-mar-${i}`).value) }; });
  cfg.alertas = { diasSemReuniao: n("cf-a1") || 30, diasPrazo: n("cf-a2") || 180, escritaMin: n("cf-a3") || 60, diasBolsa: n("cf-a4") || 90, toleranciaProjecao: n("cf-a5") || 60 };
  cfg.tiposMarco = linhas("cf-tm"); cfg.statusProd = linhas("cf-sp"); cfg.tiposProd = linhas("cf-tp");
  cfg.notif = { marcoDias: n("cf-n1") || 15, bolsaDias: n("cf-n2") || 30, semAtualizacaoDias: n("cf-n3") || 45, assinatura: $("#cf-n4").value.trim(),
    avisarAprovacao: $("#cf-n5").checked, avisarNovaAtualizacao: $("#cf-n6").checked, resumoSemanal: $("#cf-n7").checked };
  const ops = [{ op: "set", col: "config", id: "geral", dados: limpo(cfg) }];
  if (isDono() && $("#cf-ed")) ops.push({ op: "set", col: "config", id: "acesso", dados: { editores: linhas("cf-ed").map(e => e.toLowerCase()) } });
  document.activeElement?.blur();
  await write(() => D.lote(ops), "Configurações guardadas.");
}

/* =========================================================================
   PAINEL DE PROGRESSO E PROJEÇÃO (ficha do orientando)
   ========================================================================= */
function painelProgresso(o) {
  const P = projecao(o);
  if (!P) return `<p class="empty">Indique a data de início para ver o progresso e a projeção.</p>`;
  const card = (t, nome, cor) => {
    const [stTxt, stCls] = ST_TXT[t.st];
    const metaFonte = t.k === "exp" ? P.metaExpFonte : P.metaEscFonte;
    const desv = t.desvio === 0 ? "igual ao esperado" : `${t.desvio > 0 ? "+" : "−"}${Math.abs(t.desvio)} p.p. face ao esperado`;
    return `<div class="pc"><span class="t"><i style="--c:${cor}"></i>${nome}<span class="pill ${stCls}" style="margin-left:auto">${stTxt}</span></span>
      <span class="big">${t.cur}%</span>
      <div class="row"><span>Esperado hoje</span><b>${t.esp}% <span class="muted">(${desv})</span></b></div>
      <div class="row"><span>Meta de conclusão</span><b>${fmt(t.meta)}</b></div>
      <div class="row"><span>Conclusão projetada</span><b>${t.st === "concluido" ? "concluído" : t.proj ? `${fmtMes(t.proj)}${t.atraso != null ? ` <span class="muted">(${t.atraso > 0 ? mesesTxt(t.atraso) + " depois" : t.atraso < 0 ? mesesTxt(t.atraso) + " antes" : "na meta"})</span>` : ""}` : t.lento ? "ritmo muito baixo para projetar" : "sem registos suficientes"}</b></div>
      <span class="fonte">Meta ${metaFonte === "orientador" ? "definida pelo orientador" : esc(metaFonte)} · ritmo: ${esc(t.fonte)}</span></div>`;
  };
  let ver = "", verCls = "";
  if (o.situacao !== "Ativo") { ver = `Ciclo ${o.situacao.toLowerCase()}${o.fim ? ` em ${fmt(o.fim)}` : ""}.`; }
  else if (P.fimProj) {
    const f = P.folga;
    ver = `Prazo final: <b>${fmt(P.prazo)}</b> (${P.prazoFonte === "orientador" ? "definido pelo orientador" : `estimado: ${nivelCfg(o).duracao} meses de ${esc(o.nivel.toLowerCase())}`}). `
      + (f >= 0 ? `No ritmo atual, o trabalho fica concluído por volta de <b>${fmtMes(P.fimProj)}</b>, com ${mesesTxt(f)} de folga.` : `No ritmo atual, o trabalho só fica concluído por volta de <b>${fmtMes(P.fimProj)}</b>, ${mesesTxt(f)} depois do prazo.`);
    verCls = f >= 30 ? "ok" : f >= 0 ? "warn" : "crit";
  } else {
    const parado = [P.exp, P.esc].filter(t => t.estagnado || t.lento);
    ver = `Prazo final: <b>${fmt(P.prazo)}</b>. ` + (parado.length
      ? `O andamento ${parado.length === 2 ? "avança" : parado[0].k === "exp" ? "do experimental avança" : "da escrita avança"} demasiado devagar nos registos recentes para projetar uma data de conclusão.`
      : "Ainda não há registos suficientes para projetar a conclusão — a projeção melhora à medida que o andamento é atualizado.");
    verCls = "warn";
  }
  return `<div class="prog">
    <div class="veredito ${verCls}">${ver}</div>
    <div class="pcards">${card(P.exp, "Trabalho experimental", "var(--c-exp)")}${card(P.esc, "Escrita", "var(--c-esc)")}</div>
    <div class="legend"><span><span class="sw" style="--c:var(--ink)"></span>realizado</span><span><span class="sw dash" style="--c:var(--ink)"></span>plano (metas)</span>
      <span><span class="sw dot" style="--c:var(--ink)"></span>projeção no ritmo atual</span><span><span class="sw" style="--c:var(--c-exp)"></span>experimental</span><span><span class="sw" style="--c:var(--c-esc)"></span>escrita</span>
      <span style="color:var(--margin)">│ hoje</span></div>
    <div class="chart-wrap" data-chart="${esc(o.id)}">${grafico(o, P)}<div class="tip" hidden></div></div>
    <details class="dados"><summary>Ver registos de andamento (${(o.historico || []).length})</summary>
      <div class="tbl-wrap" style="margin-top:8px"><table><thead><tr><th>Data</th><th>Experimental</th><th>Escrita</th></tr></thead>
        <tbody>${(o.historico || []).slice().reverse().map(p => `<tr style="cursor:default"><td class="date">${fmt(p.d)}</td><td class="num">${p.e}%</td><td class="num">${p.w}%</td></tr>`).join("") || `<tr><td colspan="3" class="empty">Sem registos — o histórico começa na próxima atualização do andamento.</td></tr>`}</tbody></table></div>
    </details></div>`;
}
function grafico(o, P) {
  const W = 680, H = 282, ml = 44, mr = 18, mt = 22, mb = 54, iw = W - ml - mr, ih = H - mt - mb;
  const t0 = o.inicio;
  let t1 = maxD(P.prazo, P.ref, P.metaExp, P.metaEsc);
  const projMax = maxD(P.exp.proj, P.esc.proj);          // só alarga o eixo se a projeção estiver perto
  if (projMax && projMax <= addMonths(t1, 6)) t1 = maxD(t1, projMax);
  t1 = addDays(t1, Math.max(15, Math.round(days(t0, t1) * 0.03)));
  const span = Math.max(1, days(t0, t1));
  const X = d => ml + Math.max(0, Math.min(1, days(t0, d) / span)) * iw, Y = v => mt + ih - v / 100 * ih;
  const g = [];
  for (const v of [0, 25, 50, 75, 100]) g.push(`<line class="gl" x1="${ml}" x2="${W - mr}" y1="${Y(v)}" y2="${Y(v)}"/><text class="ax" x="${ml - 6}" y="${Y(v) + 3.5}" text-anchor="end">${v}%</text>`);
  const meses = days(t0, t1) / 30.4, passo = meses <= 10 ? 1 : meses <= 30 ? 3 : meses <= 60 ? 6 : 12;
  let [ty, tm] = [Number(t0.slice(0, 4)), Number(t0.slice(5, 7))];
  tm = Math.ceil(tm / passo) * passo + 1; if (passo === 12) tm = 1;
  while (tm > 12) { tm -= 12; ty++; }
  for (let k = 0; k < 40; k++) {
    const d = `${ty}-${pad(tm)}-01`; if (d > t1) break;
    if (d >= t0) g.push(`<line class="gl" x1="${X(d)}" x2="${X(d)}" y1="${mt + ih}" y2="${mt + ih + 4}"/><text class="ax" x="${X(d)}" y="${mt + ih + 16}" text-anchor="middle">${passo === 12 ? ty : `${MESES[tm - 1]}/${String(ty).slice(2)}`}</text>`);
    tm += passo; while (tm > 12) { tm -= 12; ty++; }
  }
  // prazo, metas e hoje
  const lx = d => Math.max(ml + 30, Math.min(W - mr - 30, X(d)));
  g.push(`<line x1="${X(P.prazo)}" x2="${X(P.prazo)}" y1="${mt - 6}" y2="${mt + ih}" stroke="var(--ink)" stroke-width="1.2" stroke-dasharray="2 3"/><text class="lbl" x="${lx(P.prazo)}" y="${mt - 9}" text-anchor="middle">prazo ${fmtCurto(P.prazo)}</text>`);
  g.push(`<line x1="${X(P.ref)}" x2="${X(P.ref)}" y1="${mt}" y2="${mt + ih}" stroke="var(--margin)" stroke-width="2"/>`);
  // marcos no eixo
  for (const m of (o.marcos || []).filter(m => m.prevista || m.realizada)) { const d = m.realizada || m.prevista; if (d < t0 || d > t1) continue;
    const st = marcoStatus(m), x = X(d), y = mt + ih;
    g.push(`<rect x="${x - 4}" y="${y - 4}" width="8" height="8" transform="rotate(45 ${x} ${y})" fill="${st === "feito" ? "var(--ink)" : st === "atrasado" ? "var(--crit)" : "var(--surface)"}" stroke="${st === "atrasado" ? "var(--crit)" : "var(--ink)"}" stroke-width="1.3" data-tip="${esc(m.tipo)} — ${MS_LABEL[st]} ${fmt(d)}"/>`); }
  const linha = (pts, cor, extra = "") => `<polyline fill="none" stroke="${cor}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" ${extra} points="${pts.map(([d, v]) => `${X(d).toFixed(1)},${Y(v).toFixed(1)}`).join(" ")}"/>`;
  const plano = k => {
    const pts = k === "exp" ? [[t0, 0], [P.metaExp, 100], [t1, 100]] : [[t0, 0], [P.iniEsc, 0], [P.metaEsc, 100], [t1, 100]];
    return linha(pts, k === "exp" ? "var(--c-exp)" : "var(--c-esc)", `stroke-dasharray="6 5" opacity=".55"`);
  };
  g.push(plano("exp"), plano("esc"));
  const serie = (t, cor, nome) => {
    const pts = [[t0, 0], ...t.pts.map(p => [p.d, p.v])];
    let s = linha(pts, cor);
    if (t.st !== "concluido" && t.proj) {
      const fimX = t.proj <= t1 ? t.proj : t1;
      const vFim = t.proj <= t1 ? 100 : t.cur + t.v * days(P.ref, t1);
      s += linha([[P.ref, t.cur], [fimX, Math.min(100, vFim)]], cor, `stroke-dasharray="1.5 4" stroke-width="2.6"`);
      if (t.proj <= t1) s += `<circle cx="${X(t.proj)}" cy="${Y(100)}" r="4.5" fill="var(--surface)" stroke="${cor}" stroke-width="2" data-tip="${nome}: conclusão projetada ${fmtMes(t.proj)}"/>`;
    }
    s += t.pts.map(p => `<circle cx="${X(p.d)}" cy="${Y(p.v)}" r="4" fill="${cor}" stroke="var(--surface)" stroke-width="2" data-tip="${nome}: ${p.v}% em ${fmt(p.d)}"/>`).join("");
    const last = t.pts[t.pts.length - 1];
    s += `<text class="lbl" x="${X(last.d) - 8}" y="${Y(last.v) - 8}" text-anchor="end">${last.v}%</text>`;
    return s;
  };
  g.push(serie(P.exp, "var(--c-exp)", "Experimental"), serie(P.esc, "var(--c-esc)", "Escrita"));
  g.push(`<text class="ax" x="${lx(P.ref)}" y="${mt + ih + 32}" text-anchor="middle" style="fill:var(--margin)">${P.ref === todayISO ? "hoje" : "fim do ciclo"}</text>`);
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Progresso de ${esc(o.nome)}: experimental ${P.exp.cur}%, escrita ${P.esc.cur}%, prazo ${fmt(P.prazo)}">${g.join("")}</svg>`;
}
function bindChart(root) {
  root.querySelectorAll(".chart-wrap").forEach(w => {
    const tip = w.querySelector(".tip");
    w.querySelectorAll("[data-tip]").forEach(el => {
      el.style.cursor = "default";
      el.addEventListener("mouseenter", () => { const r = el.getBoundingClientRect(), wr = w.getBoundingClientRect();
        tip.textContent = el.dataset.tip; tip.style.left = (r.left + r.width / 2 - wr.left + w.scrollLeft) + "px"; tip.style.top = (r.top - wr.top) + "px"; tip.hidden = false; });
      el.addEventListener("mouseleave", () => tip.hidden = true);
    });
  });
}

/* =========================================================================
   PÁGINA DO ORIENTANDO ("O meu trabalho")
   ========================================================================= */
function vMeu() {
  const minhas = S.orientandos.slice().sort((a, b) => (a.situacao === "Ativo" ? 0 : 1) - (b.situacao === "Ativo" ? 0 : 1));
  if (!minhas.length) return `<section class="panel" style="max-width:640px"><h2>Ainda não há ficha associada a ${esc(S.email)}</h2>
    <p>Peça ao seu orientador para cadastrar este e-mail na sua ficha. Assim que o fizer, esta página mostra o seu trabalho automaticamente.</p></section>`;
  return `<div class="page">${minhas.map(o => {
    const p = proj(o.projetoId), pend = pendentesDe(o.id), regs = S.registos.filter(r => r.orientandoId === o.id).sort((a, b) => b.data.localeCompare(a.data));
    const marcos = (o.marcos || []).slice().sort((x, y) => (x.prevista || "9").localeCompare(y.prevista || "9")), prods = producoesDe(o.id);
    return `<section class="panel"><h2 style="font-size:22px">${esc(o.nome)} ${lv(o.nivel)} ${p ? `<span class="pill acc">${esc(p.sigla)}</span>` : ""}</h2>
      <p class="muted" style="margin-top:-6px">${esc(o.titulo || "")}</p>${painelProgresso(o)}</section>
    <section class="panel"><h2>Os meus dados <span class="sub">preencha e guarde — estes são os campos que pode alterar diretamente</span></h2>
      <div class="form">
        ${field("Matrícula", "d-mat-" + o.id, o.matricula)}
        ${field("Curso / programa", "d-prog-" + o.id, o.programa)}
        ${field("Celular / WhatsApp (opcional)", "d-tel-" + o.id, o.telefone, "tel", false, 'placeholder="(48) 9 9999-9999"')}
        ${field("E-mail de contacto alternativo (opcional)", "d-econ-" + o.id, o.emailContato, "email")}
        <div class="actions full"><button class="btn primary" data-savedata="${esc(o.id)}">Guardar os meus dados</button>
          <span class="muted small">E-mail de acesso: <span class="mono">${esc(o.email)}</span> — para o trocar, fale com o orientador.</span></div>
      </div></section>
    ${o.situacao === "Ativo" ? `<section class="panel"><h2>Enviar atualização <span class="sub">o orientador revê e aprova antes de a ficha mudar</span></h2>
      ${pend.length ? `<div class="pending-note" style="margin-bottom:12px">${pend.length} atualização${pend.length > 1 ? "ões" : ""} aguardando aprovação:
        ${pend.map(u => `<div class="actions" style="margin-top:6px"><span class="date">${fmt(u.enviadoEm)}</span><span class="small">${esc((u.texto || "").slice(0, 80))}${(u.texto || "").length > 80 ? "…" : ""}</span><button class="btn small" data-cancel-upd="${esc(u.id)}">Cancelar envio</button></div>`).join("")}</div>` : ""}
      ${formEnviar(o)}</section>` : ""}
    <div class="grid g2">
      <section class="panel"><h2>Marcos do ciclo de estudos</h2><div class="list">${marcos.map(m => { const st = marcoStatus(m); return `<div class="li" style="cursor:default"><span>${esc(m.tipo)}</span>
        <span class="pill ${MS_PILL[st]}">${m.realizada ? `feito ${fmt(m.realizada)}` : `${MS_LABEL[st].toLowerCase()} · ${fmt(m.prevista)}`}</span></div>`; }).join("") || `<p class="empty">Sem marcos cadastrados.</p>`}</div></section>
      <section class="panel"><h2>A minha produção <span class="sub">artigos, congressos, livros, TCC, prêmios…</span></h2>
        ${prods.length ? `<div class="list">${prods.map(x => `<div class="li" style="cursor:default"><span><b>${esc(x.titulo)}</b>
          <div class="muted small"><i>${esc(x.veiculo || "")}</i>${x.local ? " · " + esc(x.local) : ""} · ${esc(x.tipo)}${x.doi ? ` · <a href="${esc(x.doi.startsWith("http") ? x.doi : "https://doi.org/" + x.doi)}" target="_blank" rel="noopener noreferrer">DOI/link</a>` : ""}</div>
          ${(x.anexos || []).length ? anexosHTML("v-" + x.id, x.anexos, false) : ""}</span><span class="pill ${x.status === "Publicado" ? "ok" : ""}">${esc(x.status)}</span></div>`).join("")}</div>` : `<p class="empty">Nenhuma produção cadastrada.</p>`}
        ${o.situacao === "Ativo" ? `<details class="dados" style="margin-top:12px" ${S.abrirProd === o.id ? "open" : ""}><summary>Registar uma produção nova (vai para aprovação do orientador)</summary>
          ${formProdAluno(o)}</details>` : ""}</section>
    </div>
    <section class="panel"><h2>Histórico de reuniões e atualizações</h2>${regs.map(r => `<div class="reg"><div class="h"><span class="date">${fmt(r.data)}</span><span class="pill">${esc(r.tipo)}</span><span>${esc(r.autor || "")}</span></div>
      <p>${esc(r.texto)}</p>${r.encaminhamentos ? `<div class="enc"><b>Encaminhamentos:</b> ${esc(r.encaminhamentos)}</div>` : ""}</div>`).join("") || `<p class="empty">Nenhum registo ainda.</p>`}</section>
    <section class="panel"><h2>Dados</h2><dl class="kv">
      <dt>Programa / curso</dt><dd>${esc(o.programa || "—")}</dd><dt>Projeto</dt><dd>${p ? `${esc(p.sigla)} — ${esc(p.nome)}` : "—"}</dd>
      <dt>Temática</dt><dd>${esc(o.tematica || "—")}</dd><dt>Coorientação</dt><dd>${esc(o.coorientador || "—")}</dd>
      <dt>Bolsa / vínculo</dt><dd>${esc(o.bolsa || "—")}${o.bolsaFim ? ` <span class="date">até ${fmt(o.bolsaFim)}</span>` : ""}</dd>
      <dt>Ciclo</dt><dd><span class="date">${fmt(o.inicio)} → ${fmt(prazoDe(o))}</span></dd></dl></section>`; }).join("")}</div>`;
}
function formProdAluno(o) {
  const k = o.id, ch = "prodaluno-" + o.id;
  return `<div class="form" style="margin-top:10px">
    <label class="full">Título<input type="text" id="q-tit-${k}" placeholder="título do trabalho, apresentação ou livro"></label>
    <label>Tipo<select id="q-tipo-${k}">${S.cfg.tiposProd.map(x => `<option>${esc(x)}</option>`).join("")}</select></label>
    <label>Situação<select id="q-status-${k}">${S.cfg.statusProd.map(x => `<option>${esc(x)}</option>`).join("")}</select></label>
    <label class="full">Periódico, evento ou editora<input type="text" id="q-veic-${k}" placeholder="ex.: Chemosphere · XXV Congresso Brasileiro de Química"></label>
    <label>Local (cidade / país)<input type="text" id="q-local-${k}" placeholder="opcional"></label>
    <label>Data<input type="date" id="q-data-${k}"></label>
    <label class="full">DOI ou link<input type="text" id="q-doi-${k}" placeholder="10.1016/j.xxx.2026.01.001 ou https://…"></label>
    <label class="full">Observações<textarea id="q-desc-${k}" placeholder="tipo de apresentação, coautores externos, prêmio recebido…" style="min-height:60px"></textarea></label>
    <div class="full"><span class="small muted">Documentos (certificado, comprovante, PDF do trabalho)</span>${anexosHTML(ch, null, true)}</div>
    <div class="actions full"><button class="btn primary" data-sendprod="${esc(o.id)}">Enviar para aprovação</button><span class="msg-err" id="q-msg-${k}"></span></div></div>`;
}
async function enviarProducao(id) {
  const o = ori(id); if (!o) return;
  const g = k => ($(`#q-${k}-${id}`)?.value ?? "").trim();
  if (!g("tit")) { $(`#q-msg-${id}`).textContent = "Informe o título."; return; }
  const ch = "prodaluno-" + id;
  const u = { orientandoId: o.id, alunoEmail: S.email, nomeInformado: S.user.nome || o.nome, enviadoEm: new Date().toISOString(),
    progExp: null, progEscrita: null, marcoId: "", marcoTipo: "", marcoData: "", prodStatus: null,
    prodNova: { titulo: g("tit"), tipo: g("tipo"), status: g("status"), veiculo: g("veic"), local: g("local"), data: g("data"), doi: g("doi"), descricao: g("desc") },
    anexos: anexosDe(ch), texto: g("desc") ? `Produção registada pelo orientando: ${g("desc")}` : "" };
  if (await write(() => D.gravar("atualizacoes", D.novoId("atualizacoes"), limpo(u)), "Produção enviada para aprovação.")) { S.anexosTmp[ch] = []; S.abrirProd = id; }
}
function formEnviar(o) {
  const pend = (o.marcos || []).filter(m => !m.realizada).sort((a, b) => (a.prevista || "9").localeCompare(b.prevista || "9"));
  const prods = producoesDe(o.id).filter(p => p.status !== "Publicado"), k = o.id;
  return `<div class="form" data-enviar="${esc(o.id)}">
    <div class="full slider"><label for="u-exp-${k}">Trabalho experimental</label><input type="range" id="u-exp-${k}" min="0" max="100" step="5" value="${pct(o.progExp)}"><span class="num" id="u-exp-${k}-v">${pct(o.progExp)}%</span></div>
    <div class="full slider"><label for="u-esc-${k}">Escrita</label><input type="range" id="u-esc-${k}" min="0" max="100" step="5" value="${pct(o.progEscrita)}"><span class="num" id="u-esc-${k}-v">${pct(o.progEscrita)}%</span></div>
    <label>Marco concluído<select id="u-marco-${k}"><option value="">Nenhum</option>${pend.map(m => `<option value="${esc(m.id)}">${esc(m.tipo)} (prev. ${fmt(m.prevista)})</option>`).join("")}</select></label>
    <label>Data em que foi concluído<input type="date" id="u-mdata-${k}" value="${todayISO}"></label>
    ${prods.length ? `<label>Mudança de status de um trabalho<select id="u-pid-${k}"><option value="">Nenhuma</option>${prods.map(p => `<option value="${esc(p.id)}">${esc(p.titulo.slice(0, 60))} (${esc(p.status)})</option>`).join("")}</select></label>
    <label>Novo status<select id="u-pst-${k}">${S.cfg.statusProd.map(x => `<option>${esc(x)}</option>`).join("")}</select></label>` : ""}
    <label class="full">Trabalho novo — título (opcional)<input type="text" id="u-ptit-${k}"></label>
    <label>Tipo<select id="u-ptipo-${k}">${S.cfg.tiposProd.map(x => `<option>${esc(x)}</option>`).join("")}</select></label>
    <label>Status<select id="u-pstat-${k}">${S.cfg.statusProd.map(x => `<option>${esc(x)}</option>`).join("")}</select></label>
    <label class="full">Periódico / evento<input type="text" id="u-pveic-${k}"></label>
    <label class="full">O que fez desde a última atualização<textarea id="u-texto-${k}" placeholder="Experimentos realizados, resultados, dificuldades, próximos passos…"></textarea></label>
    <div class="actions full"><button class="btn primary" data-send="${esc(o.id)}">Enviar para aprovação</button><span class="msg-err" id="u-msg-${k}"></span></div></div>`;
}
async function enviarAtualizacao(id) {
  const o = ori(id); if (!o) return;
  const g = s => ($(`#${s}-${id}`)?.value ?? "").trim();
  const exp = Number(g("u-exp")), escr = Number(g("u-esc")), m = (o.marcos || []).find(x => x.id === g("u-marco"));
  const u = { orientandoId: o.id, alunoEmail: S.email, nomeInformado: S.user.nome || o.nome, enviadoEm: new Date().toISOString(),
    progExp: exp !== pct(o.progExp) ? exp : null, progEscrita: escr !== pct(o.progEscrita) ? escr : null,
    marcoId: m ? m.id : "", marcoTipo: m ? m.tipo : "", marcoData: m ? (g("u-mdata") || todayISO) : "",
    prodStatus: g("u-pid") ? { id: g("u-pid"), status: g("u-pst") } : null,
    prodNova: g("u-ptit") ? { titulo: g("u-ptit"), tipo: g("u-ptipo"), status: g("u-pstat"), veiculo: g("u-pveic") } : null, texto: g("u-texto") };
  if (!u.texto && u.progExp == null && u.progEscrita == null && !u.marcoId && !u.prodStatus && !u.prodNova) { $(`#u-msg-${id}`).textContent = "Nada para enviar: altere algum campo ou descreva o que fez."; return; }
  await write(() => D.gravar("atualizacoes", D.novoId("atualizacoes"), limpo(u)), "Atualização enviada ao orientador.");
  if (NOTIFICACOES && S.cfg.notif.avisarNovaAtualizacao)
    enfileirar(`nova_${Date.now().toString(36)}`, ORIENTADOR_EMAIL, `Atualização enviada por ${o.nome}`,
      [`${o.nome} enviou uma atualização no Caderno de Orientação.`, u.texto ? "" : "", u.texto || "", "", "Reveja e aprove em Atualizações:"], { orientandoId: o.id, tipo: "nova-atualizacao" }).catch(() => {});
}


/* =========================================================================
   ANEXOS (links sempre; ficheiros quando o Cloud Storage está ativo)
   ========================================================================= */
const MAX_ANEXO = 10 * 1024 * 1024;
S.anexosTmp = {};
const anexosDe = ch => (S.anexosTmp[ch] ||= []);
function anexosHTML(ch, lista, editavel) {
  const L = lista || anexosDe(ch);
  return `<div class="anexos" data-anexosbox="${esc(ch)}">
    ${L.map((a, i) => `<span class="anexo"><a href="${esc(a.url)}" target="_blank" rel="noopener noreferrer">${esc(a.nome)}</a>
      ${a.tamanho ? `<span class="muted small">${Math.round(a.tamanho / 1024)} KB</span>` : `<span class="muted small">link</span>`}
      ${editavel ? `<button class="btn ghost small" data-rmanexo="${i}" data-ch="${esc(ch)}" title="Remover" aria-label="Remover anexo">✕</button>` : ""}</span>`).join("")
      || `<span class="muted small">Sem anexos.</span>`}
    ${editavel ? `<div class="anexo-add">
      ${USAR_UPLOAD ? `<label class="btn small" for="file-${esc(ch)}">Anexar ficheiro</label><input type="file" id="file-${esc(ch)}" data-ch="${esc(ch)}" multiple hidden>` : ""}
      <input type="url" id="link-${esc(ch)}" placeholder="https://… (Drive, repositório, DOI)" style="flex:1 1 220px">
      <button class="btn small" data-addlink="${esc(ch)}">Adicionar link</button>
      <span class="muted small" id="anexo-msg-${esc(ch)}"></span></div>` : ""}</div>`;
}
function pintarAnexos(ch) {
  const box = document.querySelector(`[data-anexosbox="${CSS.escape(ch)}"]`);
  if (!box) return;
  box.outerHTML = anexosHTML(ch, null, true);
  bindAnexos(document, ch);
}
function bindAnexos(root, ch) {
  const msg = t => { const el = root.querySelector(`#anexo-msg-${CSS.escape(ch)}`); if (el) el.textContent = t; };
  const add = root.querySelector(`[data-addlink="${CSS.escape(ch)}"]`);
  if (add) add.onclick = () => {
    const inp = root.querySelector(`#link-${CSS.escape(ch)}`), url = (inp.value || "").trim();
    if (!/^https?:\/\//i.test(url)) { msg("Cole um endereço que comece por http:// ou https://"); return; }
    anexosDe(ch).push({ nome: url.replace(/^https?:\/\//, "").slice(0, 60), url, link: true });
    inp.value = ""; msg(""); pintarAnexos(ch);
  };
  root.querySelectorAll(`[data-rmanexo][data-ch="${CSS.escape(ch)}"]`).forEach(b => b.onclick = () => { anexosDe(ch).splice(Number(b.dataset.rmanexo), 1); pintarAnexos(ch); });
  const f = root.querySelector(`#file-${CSS.escape(ch)}`);
  if (f) f.onchange = async () => {
    for (const file of [...f.files]) {
      if (file.size > MAX_ANEXO) { msg(`“${file.name}” tem mais de 10 MB.`); continue; }
      msg(`A enviar ${file.name}…`);
      try {
        const caminho = `anexos/${S.email}/${Date.now()}_${file.name.replace(/[^\w.\-]+/g, "_")}`;
        const url = await D.enviarFicheiro(file, caminho);
        anexosDe(ch).push({ nome: file.name, url, caminho, tamanho: file.size });
        msg(""); pintarAnexos(ch);
      } catch (e) { console.error(e); msg("Não foi possível enviar o ficheiro. Verifique se o Cloud Storage está ativo."); }
    }
    f.value = "";
  };
}

/* =========================================================================
   NOTIFICAÇÕES: fila de e-mails (compatível com a extensão Trigger Email)
   ========================================================================= */
function assinatura() { return S.cfg.notif.assinatura || "Caderno de Orientação"; }
function enderecoApp() { return location.origin + location.pathname; }
function emailDe(o) { return (o.emailContato || o.email || "").trim(); }
async function enfileirar(id, para, assunto, linhas, extra = {}) {
  if (!para) return false;
  const existe = await D.lerUmaVez("mail", id);
  if (existe && Object.keys(existe).length) return false;       // já foi criado antes
  await D.gravar("mail", id, limpo({ to: [para], message: { subject: assunto, text: linhas.concat(["", enderecoApp(), "", assinatura()]).join("\n") },
    criadoEm: new Date().toISOString(), ...extra }));
  return true;
}
async function gerarLembretes(manual) {
  if (!isEd() || !NOTIFICACOES) return 0;
  const N = S.cfg.notif;
  let n = 0;
  for (const o of ativos()) {
    const para = emailDe(o); if (!para) continue;
    const nome = o.nome.split(" ")[0];
    for (const m of (o.marcos || []).filter(m => !m.realizada && m.prevista)) {
      const d = days(todayISO, m.prevista);
      if (d >= 0 && d <= N.marcoDias)
        n += await enfileirar(`marco_${o.id}_${m.id}`, para, `Lembrete: ${m.tipo} em ${fmt(m.prevista)}`,
          [`Olá, ${nome},`, "", `Faltam ${d} dias para: ${m.tipo} (${fmt(m.prevista)}).`, "", "Se já concluiu, envie a atualização no Caderno de Orientação para o orientador aprovar:"], { orientandoId: o.id, tipo: "marco" }) ? 1 : 0;
      if (d < 0)
        n += await enfileirar(`atraso_${o.id}_${m.id}_${todayISO.slice(0, 7)}`, para, `Marco em atraso: ${m.tipo}`,
          [`Olá, ${nome},`, "", `O marco “${m.tipo}” estava previsto para ${fmt(m.prevista)} e ainda não foi registado como concluído.`, "", "Se já aconteceu, registe no Caderno; se não, fale com o orientador sobre uma nova data:"], { orientandoId: o.id, tipo: "atraso" }) ? 1 : 0;
    }
    if (o.bolsaFim) { const d = days(todayISO, o.bolsaFim);
      if (d >= 0 && d <= N.bolsaDias) n += await enfileirar(`bolsa_${o.id}_${o.bolsaFim}`, para, `A sua bolsa termina em ${fmt(o.bolsaFim)}`,
        [`Olá, ${nome},`, "", `A bolsa (${o.bolsa || "vínculo atual"}) termina em ${fmt(o.bolsaFim)}, daqui a ${d} dias.`, "", "Vale a pena falar com o orientador sobre renovação ou próximos passos."], { orientandoId: o.id, tipo: "bolsa" }) ? 1 : 0;
    }
    const ult = ultimoRegisto(o.id), ultH = (o.historico || []).slice(-1)[0]?.d;
    const ref = maxD(ult, ultH);
    if (!ref || days(ref, todayISO) > N.semAtualizacaoDias)
      n += await enfileirar(`semupd_${o.id}_${todayISO.slice(0, 7)}`, para, "Atualize o andamento do seu trabalho",
        [`Olá, ${nome},`, "", ref ? `A última atualização do seu andamento foi em ${fmt(ref)}.` : "Ainda não há nenhuma atualização de andamento registada.", "",
         "Entre no Caderno de Orientação e envie o ponto da situação (experimental, escrita, marcos concluídos e produção):"], { orientandoId: o.id, tipo: "sem-atualizacao" }) ? 1 : 0;
  }
  if (N.resumoSemanal) {
    const semana = (() => { const d = new Date(); const jan = new Date(Date.UTC(d.getFullYear(), 0, 1)); return `${d.getFullYear()}-S${Math.ceil(((d - jan) / 864e5 + jan.getUTCDay() + 1) / 7)}`; })();
    const risco = ativos().filter(o => ["atrasado", "atencao"].includes(piorEstado(projecao(o))));
    const linhas = [`Resumo do laboratório — ${fmt(todayISO)}`, "", `Orientandos ativos: ${ativos().length}`,
      `Com alertas: ${ativos().filter(o => alertas(o).length).length}`, `Projeção em risco: ${risco.length}${risco.length ? " (" + risco.map(o => o.nome).join(", ") + ")" : ""}`,
      `Atualizações à espera de aprovação: ${S.atualizacoes.length}`, "", "Detalhe no Caderno:"];
    n += await enfileirar(`resumo_${semana}`, S.email, "Resumo semanal da orientação", linhas, { tipo: "resumo" }) ? 1 : 0;
  }
  await D.gravar("sistema", "lembretes", { ultimaGeracao: new Date().toISOString(), porEmail: S.email });
  if (manual) toast(n ? `${n} mensagem${n > 1 ? "s" : ""} adicionada${n > 1 ? "s" : ""} à fila.` : "Nada de novo para enviar.");
  return n;
}
async function talvezGerarLembretes() {
  if (!isEd() || !NOTIFICACOES || S.lembretesFeitos) return;
  S.lembretesFeitos = true;
  const st = await D.lerUmaVez("sistema", "lembretes");
  if (st && st.ultimaGeracao && st.ultimaGeracao.slice(0, 10) === todayISO) return;
  try { await gerarLembretes(false); } catch (e) { console.warn("lembretes", e); }
}
function vFila() {
  const pend = S.mail.filter(m => !m.delivery || !["SUCCESS", "ERROR"].includes(m.delivery?.state));
  const env = S.mail.filter(m => m.delivery?.state === "SUCCESS").slice(-10);
  return `<section class="panel"><h2>Fila de e-mails <span class="sub">mensagens geradas automaticamente pelas regras de notificação</span>
      <span style="margin-left:auto" class="actions"><button class="btn small" data-act-main="gerar-lembretes">Gerar agora</button></span></h2>
    <p class="muted small" style="margin-top:0">Quem envia esta fila é o serviço que instalar (extensão do Firebase ou o script do Google) — ver o guia, secção “Notificações”. Enquanto não configurar nenhum, use o botão <b>Escrever</b> para enviar do seu próprio e-mail.</p>
    <div class="list">${pend.length ? pend.map(m => `<div class="li" style="cursor:default">
      <span><b>${esc(m.message?.subject || "(sem assunto)")}</b><div class="muted small">para ${esc((m.to || []).join(", "))} · ${fmt((m.criadoEm || "").slice(0, 10))}</div></span>
      <span class="actions"><button class="btn small" data-mailfila="${esc(m.id)}">Escrever</button><button class="btn small danger" data-rmmail="${esc(m.id)}">Remover</button></span>
      <details class="dados" style="grid-column:1/-1"><summary>Ver texto</summary><pre style="white-space:pre-wrap;font-size:12.5px;margin:6px 0 0">${esc(m.message?.text || "")}</pre></details>
    </div>`).join("") : `<p class="empty">Nada pendente na fila.</p>`}</div>
    ${env.length ? `<p class="muted small" style="margin-top:10px">Últimas enviadas: ${env.map(m => esc(m.message?.subject)).join(" · ")}</p>` : ""}</section>`;
}

/* =========================================================================
   LIGAÇÕES DE EVENTOS (vista principal)
   ========================================================================= */
function bindMain() {
  const m = $("#main");
  m.querySelectorAll("[data-open]").forEach(el => { const go = () => el.dataset.open && openDrawer({ type: "ori", id: el.dataset.open });
    el.addEventListener("click", go); el.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } }); });
  m.querySelectorAll("[data-group]").forEach(b => b.onclick = () => { S.group = b.dataset.group; render(); });
  m.querySelectorAll("[data-cg]").forEach(b => b.onclick = () => { S.cardGroup = b.dataset.cg; render(); });
  m.querySelectorAll("[data-new]").forEach(b => b.onclick = () => openDrawer({ type: "new-" + b.dataset.new }));
  m.querySelectorAll("[data-editproj]").forEach(b => b.onclick = e => { e.stopPropagation(); openDrawer({ type: "proj", id: b.dataset.editproj }); });
  m.querySelectorAll("[data-editprod]").forEach(el => { const go = () => openDrawer({ type: "prod", id: el.dataset.editprod }); el.onclick = go; el.onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); go(); } }; });
  m.querySelectorAll("[data-csv]").forEach(b => b.onclick = () => exportarCSV(b.dataset.csv));
  m.querySelectorAll("[data-mail]").forEach(b => b.onclick = () => { const o = ori(b.dataset.mail), { assunto, corpo } = assuntoCorpo(o);
    location.href = `mailto:${encodeURIComponent(o.emailContato || o.email)}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`; });
  m.querySelectorAll("[data-copy]").forEach(b => b.onclick = async () => { const o = ori(b.dataset.copy), { assunto, corpo } = assuntoCorpo(o);
    try { await navigator.clipboard.writeText(assunto + "\n\n" + corpo); toast("Texto copiado."); } catch (_) { toast("Não foi possível copiar neste navegador."); } });
  m.querySelectorAll("[data-mailall]").forEach(b => b.onclick = () => { location.href = `mailto:?bcc=${encodeURIComponent(b.dataset.mailall)}&subject=${encodeURIComponent("Atualização do andamento no Caderno de Orientação")}&body=${encodeURIComponent(["Olá,", "", "Peço que entrem no Caderno de Orientação e atualizem o andamento do trabalho (experimental, escrita, marcos concluídos e produção):", location.origin + location.pathname, "", "Obrigado."].join("\n"))}`; });
  m.querySelectorAll("[data-goto]").forEach(b => b.onclick = () => { S.view = b.dataset.goto; render(); });
  m.querySelectorAll("[data-approve]").forEach(b => b.onclick = () => aprovar(b.dataset.approve, b));
  m.querySelectorAll("[data-discard]").forEach(b => b.onclick = async () => { if (b.dataset.confirm !== "1") { b.dataset.confirm = "1"; b.textContent = "Confirmar descarte"; return; }
    await write(() => D.apagar("atualizacoes", b.dataset.discard), "Atualização descartada."); });
  m.querySelectorAll("[data-cancel-upd]").forEach(b => b.onclick = () => write(() => D.apagar("atualizacoes", b.dataset.cancelUpd), "Envio cancelado."));
  m.querySelectorAll("[data-send]").forEach(b => b.onclick = () => enviarAtualizacao(b.dataset.send));
  m.querySelectorAll("[data-sendprod]").forEach(b => b.onclick = () => enviarProducao(b.dataset.sendprod));
  m.querySelectorAll("[data-mailfila]").forEach(b => b.onclick = () => { const x = S.mail.find(y => y.id === b.dataset.mailfila); if (!x) return;
    location.href = `mailto:${encodeURIComponent((x.to || []).join(","))}?subject=${encodeURIComponent(x.message?.subject || "")}&body=${encodeURIComponent(x.message?.text || "")}`; });
  m.querySelectorAll("[data-rmmail]").forEach(b => b.onclick = () => write(() => D.apagar("mail", b.dataset.rmmail), "Removido da fila."));
  m.querySelectorAll("[data-anexosbox]").forEach(box => bindAnexos(m, box.dataset.anexosbox));
  m.querySelectorAll("[data-savedata]").forEach(b => b.onclick = async () => {
    const id = b.dataset.savedata, g = k => ($(`#d-${k}-${id}`)?.value ?? "").trim();
    await write(() => D.alterar("orientandos", id, { matricula: g("mat"), programa: g("prog"), telefone: g("tel"), emailContato: g("econ").toLowerCase(), atualizadoEm: new Date().toISOString() }), "Dados guardados."); });
  m.querySelectorAll("[data-enviar] input[type=range]").forEach(s => s.oninput = () => { const out = $("#" + s.id + "-v"); if (out) out.textContent = s.value + "%"; });
  const acts = { exemplo: carregarExemplo, "rm-exemplo": removerExemplo, backup: copiaCompleta, "save-cfg": guardarCfg, "gerar-lembretes": () => gerarLembretes(true),
    "reset-cfg": async b => { if (b.dataset.confirm !== "1") { b.dataset.confirm = "1"; b.textContent = "Confirmar reposição"; return; } await write(() => D.gravar("config", "geral", limpo(DEFAULT_CFG)), "Valores padrão repostos."); } };
  m.querySelectorAll("[data-act-main]").forEach(b => b.onclick = () => acts[b.dataset.actMain]?.(b));
  const f = $("#imp-file", m);
  if (f) f.onchange = async () => { const file = f.files[0]; if (!file) return; try { await importarColecoes(JSON.parse(await file.text()), $("#imp-msg")); } catch (e) { $("#imp-msg").textContent = "Não foi possível ler o ficheiro."; } f.value = ""; };
  const q = $("#f-q");
  if (q) { q.oninput = () => { S.f.q = q.value; render(); }; ["nivel", "projeto", "tematica", "situacao"].forEach(k => $("#f-" + k).onchange = e => { S.f[k] = e.target.value; render(); }); }
  bindChart(m);
}

/* =========================================================================
   PAINEL LATERAL (ficha e formulários do orientador)
   ========================================================================= */
function openDrawer(d) { S.drawer = { ...d, edit: d.type.startsWith("new") }; renderDrawer(true); }
function closeDrawer() { S.drawer = null; $("#drawer-root").innerHTML = ""; }
document.addEventListener("keydown", e => { if (e.key === "Escape" && S.drawer) closeDrawer(); });
document.addEventListener("focusout", () => setTimeout(() => { if (S.drawerStale && !(document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))) { S.drawerStale = false; renderDrawer(false); } }, 50));

function renderDrawer(force) {
  const root = $("#drawer-root");
  if (!S.drawer || !isEd()) { root.innerHTML = ""; return; }
  const dr = root.querySelector(".drawer");
  if (!force && dr && dr.contains(document.activeElement) && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { S.drawerStale = true; return; }
  if (!force && S.drawer.edit) return;
  const scroll = dr ? dr.querySelector(".dbody")?.scrollTop : 0;
  const kept = {}; if (!force && dr) ["r-data", "r-tipo", "r-texto", "r-enc", "n-texto"].forEach(id => { const el = dr.querySelector("#" + id); if (el) kept[id] = el.value; });
  const d = S.drawer; let head = "", body = "";
  if (d.type === "ori") { const o = ori(d.id); if (!o) { closeDrawer(); return; } [head, body] = d.edit ? formOrientando(o) : fichaOrientando(o); }
  else if (d.type === "new-orientando") [head, body] = formOrientando(null);
  else if (d.type === "proj" || d.type === "new-projeto") [head, body] = formProjeto(d.type === "proj" ? proj(d.id) : null);
  else if (d.type === "prod" || d.type === "new-producao") [head, body] = formProducao(d.type === "prod" ? S.producoes.find(p => p.id === d.id) : null);
  root.innerHTML = `<div class="scrim" data-close></div><aside class="drawer" role="dialog" aria-modal="true" aria-label="Detalhes">
    <div class="dhead">${head}<button class="btn ghost x" data-close aria-label="Fechar">✕</button></div><div class="dbody">${body}</div></aside>`;
  root.querySelectorAll("[data-close]").forEach(b => b.onclick = closeDrawer);
  for (const [id, val] of Object.entries(kept)) { const el = root.querySelector("#" + id); if (el) el.value = val; }
  if (!force && scroll) root.querySelector(".dbody").scrollTop = scroll;
  bindDrawer();
  if (force) root.querySelector(".drawer .x").focus();
}

function fichaOrientando(o) {
  const p = proj(o.projetoId), td = tempoDecorrido(o), a = alertas(o), pend = pendentesDe(o.id);
  const marcos = (o.marcos || []).map((m, i) => ({ ...m, i })).sort((x, y) => (x.prevista || "9").localeCompare(y.prevista || "9"));
  const regs = S.registos.filter(r => r.orientandoId === o.id).sort((x, y) => y.data.localeCompare(x.data)), prods = producoesDe(o.id);
  const head = `<div><h2>${esc(o.nome)}</h2><div class="actions" style="margin-top:6px">${lv(o.nivel)}<span class="pill ${o.situacao === "Ativo" ? "ok" : ""}">${esc(o.situacao)}</span>${p ? `<span class="pill acc">${esc(p.sigla)}</span>` : ""}</div></div>`;
  const body = `
    ${a.length ? `<div class="actions">${a.map(x => `<span class="pill ${x.sev}">${esc(x.txt)}</span>`).join("")}</div>` : ""}
    ${pend.length ? `<div class="pending-note">${pend.length} atualização pendente enviada por este orientando. <button class="btn small" data-act="goto-atu">Rever</button></div>` : ""}
    <section class="dsec"><h3>Progresso e projeção</h3>${painelProgresso(o)}</section>
    <section class="dsec"><h3>Atualizar andamento</h3>
      <div class="slider"><label for="s-exp">Trabalho experimental</label><input type="range" id="s-exp" min="0" max="100" step="5" value="${pct(o.progExp)}"><span class="num" id="s-exp-v">${pct(o.progExp)}%</span></div>
      <div class="slider"><label for="s-esc">Escrita (${o.nivel === "Doutorado" ? "tese" : o.nivel === "Mestrado" ? "dissertação" : "relatório/artigo"})</label><input type="range" id="s-esc" min="0" max="100" step="5" value="${pct(o.progEscrita)}"><span class="num" id="s-esc-v">${pct(o.progEscrita)}%</span></div>
      <p class="muted small" style="margin:4px 0 0">Cada alteração fica registada no histórico e alimenta a projeção.</p></section>
    <section class="dsec"><h3>Dados <button class="btn small" data-act="edit">Editar dados e prazos</button></h3><dl class="kv">
      <dt>E-mail de acesso</dt><dd>${o.email ? esc(o.email) : `<span class="pill warn">sem e-mail — o aluno não consegue entrar</span>`}</dd>
      <dt>Matrícula</dt><dd>${esc(o.matricula || "—")}</dd>
      <dt>Contacto</dt><dd>${esc(o.telefone || "—")}${o.emailContato ? ` · ${esc(o.emailContato)}` : ""}</dd>
      <dt>Título</dt><dd>${esc(o.titulo || "—")}</dd><dt>Programa / curso</dt><dd>${esc(o.programa || "—")}</dd>
      <dt>Projeto</dt><dd>${p ? `${esc(p.sigla)} — ${esc(p.nome)}` : "—"}</dd><dt>Temática</dt><dd>${esc(o.tematica || "—")}</dd>
      <dt>Coorientação</dt><dd>${esc(o.coorientador || "—")}</dd><dt>Bolsa / vínculo</dt><dd>${esc(o.bolsa || "—")}${o.bolsaFim ? ` <span class="date">até ${fmt(o.bolsaFim)}</span>` : ""}</dd>
      <dt>Ciclo</dt><dd><span class="date">${fmt(o.inicio)} → ${fmt(prazoDe(o))}</span>${o.prazo ? "" : ` <span class="muted small">(prazo estimado)</span>`}${o.fim ? ` · concluído em <span class="date">${fmt(o.fim)}</span>` : ""}${td != null ? ` <span class="muted small">(${Math.round(td * 100)}% do tempo)</span>` : ""}</dd>
      <dt>Metas do orientador</dt><dd>Experimental: ${o.metaExpData ? fmt(o.metaExpData) : `<span class="muted">estimada</span>`} · Escrita: ${o.metaEscritaData ? fmt(o.metaEscritaData) : `<span class="muted">estimada</span>`}</dd></dl></section>
    <section class="dsec"><h3>Marcos do ciclo de estudos <button class="btn small" data-act="add-marco">+ Marco</button></h3>
      <div class="mtable"><div class="mrow mhead"><span></span><span>Marco</span><span>Previsto</span><span>Realizado</span><span></span></div>
        ${marcos.map(m => { const st = marcoStatus(m); return `<div class="mrow" data-i="${m.i}"><span class="dia ${st}" title="${MS_LABEL[st]}"></span>
          <span class="nm2"><select data-m="tipo" id="m-tipo-${m.i}" aria-label="Tipo de marco">${[...new Set([m.tipo, ...S.cfg.tiposMarco])].map(t => `<option ${t === m.tipo ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></span>
          <input type="date" data-m="prevista" id="m-prev-${m.i}" value="${esc(m.prevista || "")}" aria-label="Data prevista"><input type="date" data-m="realizada" id="m-real-${m.i}" value="${esc(m.realizada || "")}" aria-label="Data realizada">
          <button class="btn ghost" data-delm="${m.i}" aria-label="Remover marco" title="Remover">✕</button></div>`; }).join("") || `<p class="empty">Sem marcos cadastrados.</p>`}</div></section>
    <section class="dsec"><h3>Produção científica <button class="btn small" data-act="add-prod">+ Produção</button></h3>
      ${prods.length ? `<div class="list">${prods.map(x => `<div class="li" data-editprod="${esc(x.id)}"><span><b>${esc(x.titulo)}</b>
        <div class="muted small"><i>${esc(x.veiculo || "")}</i>${x.local ? " · " + esc(x.local) : ""} · ${esc(x.tipo)}${x.doi ? " · " + esc(x.doi) : ""}${(x.anexos || []).length ? ` · ${x.anexos.length} documento(s)` : ""}</div></span>
        <span class="pill ${x.status === "Publicado" ? "ok" : x.status === "Aceito" ? "acc" : ""}">${esc(x.status)}</span></div>`).join("")}</div>` : `<p class="empty">Nenhuma produção cadastrada.</p>`}</section>
    <section class="dsec"><h3>Reuniões e registos</h3>
      <div class="form" style="margin-bottom:14px"><label>Data<input type="date" id="r-data" value="${todayISO}"></label><label>Tipo<select id="r-tipo">${TIPOS_REG.map(t => `<option>${t}</option>`).join("")}</select></label>
        <label class="full">O que foi discutido / feito<textarea id="r-texto" placeholder="Resultados, dificuldades, decisões…"></textarea></label>
        <label class="full">Encaminhamentos<input type="text" id="r-enc" placeholder="Próximos passos e prazos"></label>
        <div class="actions full"><button class="btn primary" data-act="add-reg">Registar</button><span class="muted small">O orientando vê os registos da própria ficha.</span></div></div>
      ${regs.map(r => `<div class="reg"><div class="h"><span class="date">${fmt(r.data)}</span><span class="pill">${esc(r.tipo)}</span><span>${esc(r.autor || "")}</span>
        <button class="btn ghost small" style="margin-left:auto;padding:2px 6px" data-delreg="${esc(r.id)}">Apagar</button></div><p>${esc(r.texto)}</p>${r.encaminhamentos ? `<div class="enc"><b>Encaminhamentos:</b> ${esc(r.encaminhamentos)}</div>` : ""}</div>`).join("") || `<p class="empty">Nenhum registo ainda.</p>`}</section>
    <section class="dsec"><h3>Notas privadas do orientador</h3><p class="muted small" style="margin:0 0 6px">Visíveis apenas para o orientador e co-editores.</p>
      <textarea id="n-texto" placeholder="Observações pessoais sobre este orientando">${esc(S.notas[o.id]?.texto || "")}</textarea>
      <div class="actions" style="margin-top:6px"><button class="btn" data-act="save-nota">Guardar nota</button></div></section>`;
  return [head, body];
}
function field(lbl, id, val, type = "text", full = false, extra = "") { return `<label class="${full ? "full" : ""}">${lbl}<input type="${type}" id="${id}" value="${esc(val || "")}" ${extra}></label>`; }
function fsel(lbl, id, opts, val, full = false, blank = "") { return `<label class="${full ? "full" : ""}">${lbl}<select id="${id}">${blank !== null ? `<option value="">${esc(blank)}</option>` : ""}${opts.map(o => { const [v, t] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${v === val ? "selected" : ""}>${esc(t)}</option>`; }).join("")}</select></label>`; }
function formOrientando(o) {
  const n = !o; o = o || { nivel: "Mestrado", situacao: "Ativo", inicio: todayISO };
  const head = `<div><h2>${n ? "Novo orientando" : "Editar dados e prazos"}</h2>${n ? `<p class="muted small" style="margin:4px 0 0">Os marcos são criados automaticamente a partir do nível e das datas (ajustáveis depois).</p>` : ""}</div>`;
  const body = `<div class="form">
    ${field("Nome completo", "e-nome", o.nome, "text", true)}
    ${field("E-mail de acesso do aluno", "e-email", o.email, "email", true, 'placeholder="o aluno entra no Caderno com este e-mail"')}
    ${fsel("Nível", "e-nivel", niveis(), o.nivel, false, null)}${fsel("Situação", "e-sit", SITUACOES, o.situacao, false, null)}
    ${field("Curso / programa", "e-prog", o.programa, "text", true)}${field("Título do trabalho", "e-tit", o.titulo, "text", true)}
    ${field("Matrícula", "e-mat", o.matricula)}${field("Celular / WhatsApp", "e-tel", o.telefone, "text", false, 'placeholder="opcional"')}
    ${field("E-mail de contacto (alternativo)", "e-econ", o.emailContato, "email", true, 'placeholder="opcional — o de acesso é o de cima"')}
    ${fsel("Projeto", "e-proj", S.projetos.map(p => [p.id, p.sigla + " — " + p.nome]), o.projetoId, true, "Sem projeto")}
    <label>Temática<input type="text" id="e-tem" list="dl-tem" value="${esc(o.tematica || "")}" placeholder="herdada do projeto se vazia"><datalist id="dl-tem">${tematicas().map(t => `<option value="${esc(t)}">`).join("")}</datalist></label>
    ${field("Coorientador(a)", "e-coo", o.coorientador)}
    ${field("Bolsa / vínculo", "e-bolsa", o.bolsa, "text", false, 'placeholder="ex.: CAPES – DS, CNPq – PIBIC"')}${field("Fim da bolsa", "e-bfim", o.bolsaFim, "date")}
    <fieldset class="full" style="border:1px solid var(--line);border-radius:8px;padding:10px 12px;display:grid;grid-template-columns:1fr 1fr;gap:12px"><legend class="small muted">Prazos e metas (deixe vazio para usar a estimativa do nível)</legend>
      ${field("Início", "e-ini", o.inicio, "date")}${field("Término previsto (prazo)", "e-prazo", o.prazo, "date")}
      ${field("Meta: experimental concluído", "e-mexp", o.metaExpData, "date")}${field("Meta: escrita concluída", "e-mesc", o.metaEscritaData, "date")}
      ${field("Término real (conclusão)", "e-fim", o.fim, "date")}</fieldset>
  </div>
  <div class="actions"><button class="btn primary" data-act="save-ori">${n ? "Cadastrar orientando" : "Guardar alterações"}</button><button class="btn" data-act="${n ? "close" : "cancel-edit"}">Cancelar</button>
    ${n ? "" : `<button class="btn danger" style="margin-left:auto" data-act="del-ori">Excluir orientando</button>`}</div><p id="form-msg" class="small" style="color:var(--crit)"></p>`;
  return [head, body];
}
function formProjeto(p) {
  const n = !p; p = p || {};
  return [`<h2>${n ? "Novo projeto" : "Editar projeto"}</h2>`, `<div class="form">
    ${field("Sigla", "j-sigla", p.sigla)}<label>Temática<input type="text" id="j-tem" list="dl-tem2" value="${esc(p.tematica || "")}"><datalist id="dl-tem2">${tematicas().map(t => `<option value="${esc(t)}">`).join("")}</datalist></label>
    ${field("Nome do projeto", "j-nome", p.nome, "text", true)}${field("Financiador", "j-fin", p.financiador)}${field("Processo / nº", "j-proc", p.processo)}
    ${field("Início", "j-ini", p.inicio, "date")}${field("Fim", "j-fim", p.fim, "date")}<label class="full">Descrição<textarea id="j-desc">${esc(p.descricao || "")}</textarea></label></div>
    <div class="actions"><button class="btn primary" data-act="save-proj">${n ? "Criar projeto" : "Guardar"}</button><button class="btn" data-act="close">Cancelar</button>
      ${n ? "" : `<button class="btn danger" style="margin-left:auto" data-act="del-proj">Excluir projeto</button>`}</div><p id="form-msg" class="small" style="color:var(--crit)"></p>`];
}
function formProducao(p) {
  const n = !p; p = p || { status: S.cfg.statusProd[0], tipo: S.cfg.tiposProd[0], autores: S.drawer?.autor ? [S.drawer.autor] : [] };
  const autores = new Set(p.autores || []);
  const ch = "prod-" + (p.id || "novo");
  if (!S.anexosTmp[ch]) S.anexosTmp[ch] = (p.anexos || []).slice();
  return [`<h2>${n ? "Nova produção" : "Editar produção"}</h2>`, `<div class="form">
    <label class="full">Título<textarea id="p-tit" style="min-height:52px">${esc(p.titulo || "")}</textarea></label>
    ${fsel("Tipo", "p-tipo", S.cfg.tiposProd, p.tipo, false, null)}${fsel("Status", "p-status", S.cfg.statusProd, p.status, false, null)}
    ${field("Periódico, evento ou editora", "p-veic", p.veiculo, "text", true)}${field("Data (submissão / publicação / evento)", "p-data", p.data, "date")}
    ${field("Local (cidade / país)", "p-local", p.local)}
    ${fsel("Projeto", "p-proj", S.projetos.map(x => [x.id, x.sigla]), p.projetoId, false, "Sem projeto")}${field("DOI / link", "p-doi", p.doi, "text", true)}
    <label class="full">Observações<textarea id="p-desc" style="min-height:52px">${esc(p.descricao || "")}</textarea></label>
    <div class="full"><span class="small muted">Documentos</span>${anexosHTML(ch, null, true)}</div>
    <fieldset class="full" style="border:1px solid var(--line);border-radius:8px;padding:8px 12px"><legend class="small muted">Orientandos autores</legend>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:4px">${S.orientandos.slice().sort((a, b) => a.nome.localeCompare(b.nome, "pt")).map(o => `<label style="flex-direction:row;align-items:center;gap:6px;font-weight:400;color:var(--ink)"><input type="checkbox" id="pa-${esc(o.id)}" data-autor="${esc(o.id)}" ${autores.has(o.id) ? "checked" : ""}>${esc(o.nome)}</label>`).join("")}</div></fieldset></div>
    <div class="actions"><button class="btn primary" data-act="save-prod">${n ? "Cadastrar" : "Guardar"}</button><button class="btn" data-act="close">Cancelar</button>
      ${n ? "" : `<button class="btn danger" style="margin-left:auto" data-act="del-prod">Excluir</button>`}</div><p id="form-msg" class="small" style="color:var(--crit)"></p>`];
}

function bindDrawer() {
  const root = $("#drawer-root"), d = S.drawer, v = id => ($("#" + id)?.value ?? "").trim();
  root.querySelectorAll("[data-editprod]").forEach(el => el.onclick = () => openDrawer({ type: "prod", id: el.dataset.editprod }));
  const confirmar = b => { if (b.dataset.confirm === "1") return true; b.dataset.confirm = "1"; b.textContent = "Confirmar"; return false; };
  const acts = {
    close: closeDrawer,
    edit: () => { S.drawer.edit = true; renderDrawer(true); },
    "cancel-edit": () => { S.drawer.edit = false; renderDrawer(true); },
    "goto-atu": () => { closeDrawer(); S.view = "atualizacoes"; render(); },
    "add-prod": () => openDrawer({ type: "new-producao", autor: d.id }),
    "save-ori": async () => {
      const nome = v("e-nome"); if (!nome) { $("#form-msg").textContent = "Informe o nome do orientando."; return; }
      const email = v("e-email").toLowerCase();
      if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { $("#form-msg").textContent = "E-mail inválido."; return; }
      const nivel = v("e-nivel"), inicio = v("e-ini") || todayISO, prazoInf = v("e-prazo");
      const prazoMarcos = prazoInf || addDays(addMonths(inicio, S.cfg.niveis[nivel]?.duracao || 24), -1), projetoId = v("e-proj");
      const data = { nome, email, nivel, situacao: v("e-sit"), programa: v("e-prog"), titulo: v("e-tit"), projetoId, tematica: v("e-tem") || proj(projetoId)?.tematica || "",
        matricula: v("e-mat"), telefone: v("e-tel"), emailContato: v("e-econ").toLowerCase(),
        coorientador: v("e-coo"), bolsa: v("e-bolsa"), bolsaFim: v("e-bfim"), inicio, prazo: prazoInf, metaExpData: v("e-mexp"), metaEscritaData: v("e-mesc"), fim: v("e-fim"), atualizadoEm: new Date().toISOString() };
      if (d.type === "new-orientando") {
        const id = D.novoId("orientandos");
        if (await write(() => D.gravar("orientandos", id, { ...data, progExp: 0, progEscrita: 0, historico: [], marcos: gerarMarcos(nivel, inicio, prazoMarcos) }), "Orientando cadastrado.")) openDrawer({ type: "ori", id });
      } else {
        const o = ori(d.id), ops = [{ op: "update", col: "orientandos", id: d.id, dados: data }];
        if (o && (o.email || "") !== email) {       // manter o acesso do aluno aos registos antigos
          S.registos.filter(r => r.orientandoId === d.id).forEach(r => ops.push({ op: "update", col: "registos", id: r.id, dados: { alunoEmail: email } }));
          S.atualizacoes.filter(u => u.orientandoId === d.id).forEach(u => ops.push({ op: "delete", col: "atualizacoes", id: u.id }));
        }
        if (await write(() => D.lote(ops), "Dados guardados.")) { S.drawer.edit = false; renderDrawer(true); }
      }
    },
    "del-ori": async b => { if (!confirmar(b)) return;
      const ops = [{ op: "delete", col: "orientandos", id: d.id }, { op: "delete", col: "notas", id: d.id }];
      S.registos.filter(r => r.orientandoId === d.id).forEach(r => ops.push({ op: "delete", col: "registos", id: r.id }));
      S.atualizacoes.filter(u => u.orientandoId === d.id).forEach(u => ops.push({ op: "delete", col: "atualizacoes", id: u.id }));
      if (await write(() => D.lote(ops), "Orientando excluído.")) closeDrawer(); },
    "add-marco": async () => { const o = ori(d.id); await write(() => D.alterar("orientandos", d.id, { marcos: [...(o.marcos || []), { id: "m" + Date.now().toString(36), tipo: S.cfg.tiposMarco[0] || "Marco", prevista: addMonths(todayISO, 1), realizada: "", obs: "" }] }), "Marco adicionado — ajuste o tipo e a data."); renderDrawer(true); },
    "add-reg": async () => {
      const texto = v("r-texto"); if (!texto) { $("#r-texto").focus(); toast("Escreva o que foi discutido."); return; }
      const o = ori(d.id), tipo = v("r-tipo");
      await write(() => D.gravar("registos", D.novoId("registos"), { orientandoId: d.id, alunoEmail: o.email || "", data: v("r-data") || todayISO, tipo, texto, encaminhamentos: v("r-enc"), autor: tipo === "Atualização do aluno" ? "Orientando" : "Orientador" }), "Registo adicionado.");
      renderDrawer(true); },
    "save-nota": () => write(() => D.gravar("notas", d.id, { texto: v("n-texto"), atualizadoEm: new Date().toISOString() }), "Nota guardada."),
    "save-proj": async () => {
      const sigla = v("j-sigla"); if (!sigla) { $("#form-msg").textContent = "Informe a sigla do projeto."; return; }
      const data = { sigla, nome: v("j-nome"), tematica: v("j-tem"), financiador: v("j-fin"), processo: v("j-proc"), inicio: v("j-ini"), fim: v("j-fim"), descricao: v("j-desc") };
      if (await write(() => D.gravar("projetos", d.type === "proj" ? d.id : D.novoId("projetos"), data), "Projeto guardado.")) closeDrawer(); },
    "del-proj": async b => {
      if (S.orientandos.some(o => o.projetoId === d.id)) { $("#form-msg").textContent = "Há orientandos ligados a este projeto. Mude-os de projeto antes de excluir."; return; }
      if (!confirmar(b)) return; if (await write(() => D.apagar("projetos", d.id), "Projeto excluído.")) closeDrawer(); },
    "save-prod": async () => {
      const titulo = v("p-tit"); if (!titulo) { $("#form-msg").textContent = "Informe o título."; return; }
      const autores = [...root.querySelectorAll("[data-autor]:checked")].map(x => x.dataset.autor);
      const data = { titulo, tipo: v("p-tipo"), status: v("p-status"), veiculo: v("p-veic"), local: v("p-local"), descricao: v("p-desc"),
        data: v("p-data"), projetoId: v("p-proj"), doi: v("p-doi"), autores, anexos: anexosDe("prod-" + (d.type === "prod" ? d.id : "novo")) };
      if (await write(() => D.gravar("producoes", d.type === "prod" ? d.id : D.novoId("producoes"), limpo(data)), "Produção guardada.")) { S.anexosTmp["prod-novo"] = []; closeDrawer(); } },
    "del-prod": async b => { if (!confirmar(b)) return; if (await write(() => D.apagar("producoes", d.id), "Produção excluída.")) closeDrawer(); },
  };
  root.querySelectorAll("[data-act]").forEach(b => b.onclick = () => acts[b.dataset.act]?.(b));
  root.querySelectorAll("[data-anexosbox]").forEach(box => bindAnexos(root, box.dataset.anexosbox));
  [["s-exp", "progExp"], ["s-esc", "progEscrita"]].forEach(([id, k]) => { const s = $("#" + id); if (!s) return;
    s.oninput = () => $("#" + id + "-v").textContent = s.value + "%";
    s.onchange = () => { const o = ori(d.id), exp = k === "progExp" ? Number(s.value) : pct(o.progExp), escr = k === "progEscrita" ? Number(s.value) : pct(o.progEscrita);
      write(() => D.alterar("orientandos", d.id, { progExp: exp, progEscrita: escr, historico: comHistorico(o, exp, escr), atualizadoEm: new Date().toISOString() }), "Andamento atualizado."); }; });
  root.querySelectorAll(".mrow[data-i] [data-m]").forEach(inp => inp.onchange = () => {
    const i = Number(inp.closest(".mrow").dataset.i), o = ori(d.id);
    write(() => D.alterar("orientandos", d.id, { marcos: (o.marcos || []).map((m, j) => j === i ? { ...m, [inp.dataset.m]: inp.value } : m) }), "Marco atualizado."); });
  root.querySelectorAll("[data-delm]").forEach(b => b.onclick = async () => { const i = Number(b.dataset.delm), o = ori(d.id);
    await write(() => D.alterar("orientandos", d.id, { marcos: (o.marcos || []).filter((_, j) => j !== i) }), "Marco removido."); renderDrawer(true); });
  root.querySelectorAll("[data-delreg]").forEach(b => b.onclick = async () => { if (!confirmar(b)) return; await write(() => D.apagar("registos", b.dataset.delreg), "Registo apagado."); renderDrawer(true); });
  bindChart(root);
}

/* =========================================================================
   ARRANQUE
   ========================================================================= */
(function arrancar() {
  if (!FIREBASE_CONFIG || String(FIREBASE_CONFIG.apiKey).includes("COLE_AQUI")) {
    $("#app").innerHTML = `<div class="auth"><h1>${esc(NOME_LABORATORIO)}</h1><p>Falta configurar a ligação ao Firebase.</p>
      <p class="muted small">Edite o ficheiro <span class="mono">docs/config.js</span> e cole o objeto <span class="mono">firebaseConfig</span> do seu projeto (Guia, passo 3).</p></div>`;
    return;
  }
  try { D.init(FIREBASE_CONFIG); } catch (e) { console.error(e); $("#app").innerHTML = `<div class="auth"><h1>${esc(NOME_LABORATORIO)}</h1><p class="msg-err">A configuração do Firebase em config.js parece inválida.</p></div>`; return; }
  D.onAuth(u => aoAutenticar(u));
})();
