// ============================================================================
//  CONFIGURAÇÃO DO CADERNO DE ORIENTAÇÃO
//  Edite apenas este ficheiro depois de criar o projeto no Firebase.
//  (Guia: ver README.md, passo 3.)
// ============================================================================

// 1) Cole aqui o objeto "firebaseConfig" que o Firebase mostra em
//    Configurações do projeto → Geral → Seus apps → App da Web.
//    Estes valores NÃO são secretos: a proteção dos dados é feita pelas
//    regras de segurança (ficheiro firestore.rules).
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyC4qlRzQvdEDGl_PEgyt3Sc4guR4wIwmqY",
  authDomain: "caderno-orientacao-56ab3.firebaseapp.com",
  projectId: "caderno-orientacao-56ab3",
  storageBucket: "caderno-orientacao-56ab3.firebasestorage.app",
  messagingSenderId: "1065965615801",
  appId: "1:1065965615801:web: 2421d0b4f46bfc113af968"
};

// 2) E-mail do orientador (dono do Caderno). Tem de ser o MESMO e-mail
//    escrito no ficheiro firestore.rules.
export const ORIENTADOR_EMAIL = "bruno.henriques@ufsc.br";

// 3) Nome que aparece no topo da página.
export const NOME_LABORATORIO = "Caderno de Orientação";

// 4) Mostrar o botão "Entrar com Google"? (só funciona para contas Google;
//    ative também o provedor Google no Firebase → Authentication).
export const PERMITIR_GOOGLE = false;

// 5) Anexar ficheiros às produções (certificados, PDFs). Exige ativar o
//    Cloud Storage no Firebase, que hoje só está disponível no plano Blaze
//    (ver o guia, secção "Documentos anexados"). Com false, ficam só os links.
export const USAR_UPLOAD = false;

// 6) Gerar automaticamente a fila de lembretes por e-mail.
export const NOTIFICACOES = true;
