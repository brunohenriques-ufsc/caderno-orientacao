// ============================================================================
//  RESUMO DO CADERNO PARA O PAINEL DO LABORATÓRIO
//  Lê as fichas e a produção do Caderno (só quem é orientador ou co-editor
//  consegue) e grava em lab/resumo apenas o que pode ir para a TV:
//  nomes, aniversário (dia/mês, nunca o ano), próximas defesas e
//  qualificações, publicações e participações em congressos.
// ============================================================================
import {
  collection, getDocs, doc, getDoc, setDoc
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const TIPOS_PUB = new Set(["Artigo em periódico", "Artigo de revisão", "Trabalho em congresso", "Resumo em anais",
  "Capítulo de livro", "Livro", "Patente"]);
const TIPOS_CONGRESSO = new Set(["Participação em congresso", "Trabalho em congresso", "Resumo em anais"]);
const MARCOS_PAINEL = /defesa|qualifica|semin[aá]rio/i;
const MARCOS_FORA = /dep[oó]sito/i;

const isoDe = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const somaDias = (n) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + n); return isoDe(d); };

export function rotuloMarco(tipo, nivel) {
  if (/^defesa$/i.test(tipo)) return nivel === "Mestrado" ? "Defesa de mestrado" : nivel === "Doutorado" ? "Defesa de doutorado" : "Defesa";
  if (/qualifica/i.test(tipo)) return nivel === "Doutorado" ? "Qualificação de doutorado" : nivel === "Mestrado" ? "Qualificação de mestrado" : "Qualificação";
  if (/semin/i.test(tipo)) return "Seminário de IC";
  return tipo;
}

export async function calcularResumo(db, { incluirExemplos = false } = {}) {
  const [os, ps] = await Promise.all([getDocs(collection(db, "orientandos")), getDocs(collection(db, "producoes"))]);
  const todos = os.docs.map(d => ({ id: d.id, ...d.data() })).filter(o => incluirExemplos || !o.exemplo);
  const nomeDe = Object.fromEntries(todos.map(o => [o.id, o.nome || ""]));
  const ativos = todos.filter(o => o.situacao === "Ativo");
  const prods = ps.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => incluirExemplos || !p.exemplo);
  const hoje = somaDias(0), ontem = somaDias(-1), daquiUmAno = somaDias(365);

  const aniversarios = ativos.map(o => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(o.nascimento || "");
    return m ? { nome: o.nome, dia: +m[3], mes: +m[2], nivel: o.nivel || "" } : null;
  }).filter(Boolean);

  const marcos = [];
  for (const o of ativos) for (const m of (o.marcos || [])) {
    if (m.realizada || !m.prevista || !MARCOS_PAINEL.test(m.tipo || "") || MARCOS_FORA.test(m.tipo || "")) continue;
    if (m.prevista < ontem || m.prevista > daquiUmAno) continue;
    marcos.push({ nome: o.nome, nivel: o.nivel || "", tipo: m.tipo, rotulo: rotuloMarco(m.tipo, o.nivel), data: m.prevista, titulo: o.titulo || "" });
  }
  marcos.sort((a, b) => a.data.localeCompare(b.data));

  const autoresDe = p => (p.autores || []).map(a => nomeDe[a]).filter(Boolean);
  const limitePub = somaDias(-540);
  const publicacoes = prods.filter(p => p.status === "Publicado" && TIPOS_PUB.has(p.tipo) && (p.data || "") >= limitePub)
    .sort((a, b) => (b.data || "").localeCompare(a.data || "")).slice(0, 15)
    .map(p => ({ titulo: p.titulo || "", tipo: p.tipo, veiculo: p.veiculo || "", data: p.data || "", doi: p.doi || "", autores: autoresDe(p) }));

  const limiteCong = somaDias(-45);
  const congressos = prods.filter(p => TIPOS_CONGRESSO.has(p.tipo) && (p.data || "") >= limiteCong)
    .sort((a, b) => (a.data || "").localeCompare(b.data || "")).slice(0, 12)
    .map(p => ({ titulo: p.titulo || "", tipo: p.tipo, veiculo: p.veiculo || "", data: p.data || "", status: p.status || "", autores: autoresDe(p) }));

  const limitePremio = somaDias(-365);
  const premios = prods.filter(p => p.tipo === "Prêmio ou distinção" && (p.data || "") >= limitePremio)
    .map(p => ({ titulo: p.titulo || "", veiculo: p.veiculo || "", data: p.data || "", autores: autoresDe(p) }));

  const contagem = {};
  for (const o of ativos) contagem[o.nivel || "Outro"] = (contagem[o.nivel || "Outro"] || 0) + 1;

  return {
    aniversarios, marcos, publicacoes, congressos, premios, contagem,
    membros: ativos.map(o => ({ nome: o.nome, nivel: o.nivel || "" })).sort((a, b) => a.nome.localeCompare(b.nome)),
    hoje
  };
}

// Grava lab/resumo. Devolve o resumo gravado.
export async function gravarResumo(db, email) {
  let incluirExemplos = false;
  try { const c = await getDoc(doc(db, "lab", "config")); incluirExemplos = !!(c.exists() && c.data().incluirExemplos); } catch (e) { /* segue com o padrão */ }
  const r = await calcularResumo(db, { incluirExemplos });
  const dados = { ...r, atualizadoEm: new Date().toISOString(), atualizadoPor: email || "" };
  await setDoc(doc(db, "lab", "resumo"), dados);
  return dados;
}

// Atualiza o resumo se tiver mais de `maxMin` minutos. Só funciona para
// orientador e co-editores; para os outros falha em silêncio.
export async function atualizarSeAntigo(db, email, maxMin = 60) {
  const atual = await getDoc(doc(db, "lab", "resumo"));
  const quando = atual.exists() ? Date.parse(atual.data().atualizadoEm || "") : 0;
  if (quando && Date.now() - quando < maxMin * 60000) return false;
  await getDoc(doc(db, "config", "acesso"));          // lança erro se não for editor
  await gravarResumo(db, email);
  return true;
}
