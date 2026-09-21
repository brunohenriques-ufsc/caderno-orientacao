// ============================================================================
//  LIGAÇÃO CADERNO → PAINEL
//  Carregado pela página do Caderno (uma linha no fim de docs/index.html).
//  Quando o orientador ou um co-editor abre o Caderno, atualiza o resumo
//  que o painel da TV mostra (no máximo uma vez por hora). Para alunos e
//  coorientadores não faz nada. Não altera nenhum dado do Caderno.
// ============================================================================
import { getApps } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { atualizarSeAntigo } from "./resumo.js";

let tentativas = 0;
const espera = setInterval(() => {
  const apps = getApps();
  if (!apps.length) { if (++tentativas > 120) clearInterval(espera); return; }   // desiste após 60 s
  clearInterval(espera);
  const app = apps[0], auth = getAuth(app), db = getFirestore(app);
  let feito = false;
  onAuthStateChanged(auth, async u => {
    if (!u || !u.emailVerified || feito) return;
    feito = true;
    try { if (await atualizarSeAntigo(db, (u.email || "").toLowerCase())) console.info("[painel] resumo atualizado"); }
    catch (e) { /* não é editor ou sem rede: o painel mantém o último resumo */ }
  });
}, 500);
