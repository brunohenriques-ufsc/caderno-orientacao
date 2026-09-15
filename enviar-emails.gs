/**
 * Caderno de Orientação — envio automático dos e-mails da fila.
 *
 * Este script corre no Google Apps Script (script.google.com), de hora em hora,
 * e envia pelo Gmail as mensagens que o Caderno colocou na coleção "mail".
 * Não precisa do plano pago do Firebase.
 *
 * CONFIGURAÇÃO (uma só vez) — ver o guia, secção "Notificações":
 *  1. No Caderno, crie uma conta para o robô (ex.: caderno.robo@gmail.com),
 *     confirme o e-mail e acrescente-a em Configurações → Acessos (co-editores).
 *  2. Em script.google.com → Novo projeto → cole este ficheiro.
 *  3. Em Definições do projeto → Propriedades do script, crie:
 *        PROJECT_ID  → o ID do projeto Firebase (ex.: caderno-orientacao-1a2b3)
 *        API_KEY     → a apiKey que está em docs/config.js
 *        ROBO_EMAIL  → o e-mail da conta do robô
 *        ROBO_SENHA  → a senha dessa conta
 *  4. Execute uma vez a função enviarFila (autorize o acesso ao Gmail).
 *  5. Acionadores → Adicionar acionador → enviarFila → A tempo → De hora a hora.
 *
 * Limite do Gmail: 100 destinatários por dia em contas @gmail.com e 1500 em
 * contas Google Workspace. O Caderno gera poucas mensagens por dia.
 */

var P = PropertiesService.getScriptProperties();
var BASE = 'https://firestore.googleapis.com/v1/projects/' + P.getProperty('PROJECT_ID') + '/databases/(default)/documents';

function enviarFila() {
  var token = autenticar();
  var docs = listar('mail', token);
  var enviados = 0, erros = 0;
  docs.forEach(function (d) {
    var f = d.fields || {};
    if (f.delivery && f.delivery.mapValue && f.delivery.mapValue.fields &&
        f.delivery.mapValue.fields.state && f.delivery.mapValue.fields.state.stringValue === 'SUCCESS') return;
    var para = ((f.to || {}).arrayValue || {}).values || [];
    var msg = ((f.message || {}).mapValue || {}).fields || {};
    var assunto = (msg.subject || {}).stringValue || '(sem assunto)';
    var texto = (msg.text || {}).stringValue || '';
    var destinos = para.map(function (v) { return v.stringValue; }).filter(String).join(',');
    if (!destinos) return;
    try {
      GmailApp.sendEmail(destinos, assunto, texto);
      marcar(d.name, 'SUCCESS', '', token);
      enviados++;
    } catch (e) {
      marcar(d.name, 'ERROR', String(e).slice(0, 300), token);
      erros++;
    }
  });
  Logger.log('enviados: ' + enviados + ' | erros: ' + erros + ' | na fila: ' + docs.length);
}

/** Entra com a conta do robô e devolve o token de acesso. */
function autenticar() {
  var r = UrlFetchApp.fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + P.getProperty('API_KEY'), {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    payload: JSON.stringify({ email: P.getProperty('ROBO_EMAIL'), password: P.getProperty('ROBO_SENHA'), returnSecureToken: true })
  });
  var body = JSON.parse(r.getContentText());
  if (!body.idToken) throw new Error('Não foi possível entrar com a conta do robô: ' + r.getContentText());
  return body.idToken;
}

/** Lista os documentos de uma coleção (até 200). */
function listar(colecao, token) {
  var docs = [], pagina = '';
  do {
    var r = UrlFetchApp.fetch(BASE + '/' + colecao + '?pageSize=100' + (pagina ? '&pageToken=' + pagina : ''), {
      headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true
    });
    if (r.getResponseCode() !== 200) throw new Error('Firestore: ' + r.getContentText());
    var body = JSON.parse(r.getContentText());
    docs = docs.concat(body.documents || []);
    pagina = body.nextPageToken || '';
  } while (pagina && docs.length < 200);
  return docs;
}

/** Regista o resultado do envio no próprio documento. */
function marcar(nome, estado, erro, token) {
  var url = 'https://firestore.googleapis.com/v1/' + nome + '?updateMask.fieldPaths=delivery';
  UrlFetchApp.fetch(url, {
    method: 'patch', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify({
      fields: { delivery: { mapValue: { fields: {
        state: { stringValue: estado },
        time: { stringValue: new Date().toISOString() },
        error: { stringValue: erro || '' }
      } } } }
    })
  });
}
