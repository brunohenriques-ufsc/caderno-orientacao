# Caderno de Orientação — guia de instalação e uso

Ferramenta web para cadastrar, acompanhar e interagir com orientandos de iniciação científica,
estágio, mestrado, doutorado e pós-doutorado: marcos do ciclo de estudos, andamento experimental
e da escrita, **projeção de conclusão face aos prazos**, produção científica, reuniões e
indicadores consolidados por projeto e por temática.

Funciona com duas contas gratuitas: **Firebase** (base de dados e login) e **GitHub** (guarda o
código e publica a página). Não é preciso instalar nada no computador nem usar linha de comando.

---

## 1. O que cada pessoa vê

| | Orientador (dono) | Co-editor | Orientando |
|---|---|---|---|
| Painel, projetos, produção | sim | sim | apenas a própria ficha |
| Fichas de todos | ver e editar | ver e editar | não |
| A própria ficha | — | — | ver (progresso, marcos, produção, reuniões) |
| Alterar dados | tudo | tudo | envia atualização para aprovação |
| Dados de contacto próprios (matrícula, curso, celular, e-mail alternativo) | ver e editar | ver e editar | **edita diretamente**, sem aprovação |
| Produção científica | ver, criar e editar | ver, criar e editar | vê a sua; regista nova (com DOI e documentos) para aprovação |
| Reuniões e notas privadas | sim | sim | vê só os registos da própria ficha; notas privadas nunca |
| Configurações e acessos | sim | configurações | não |

As permissões são garantidas no servidor pelo ficheiro `firestore.rules`, não apenas pela
interface: mesmo que alguém tente aceder por fora da página, o Firebase recusa.

---

## 2. Antes de começar

- Uma conta Google (para o Firebase) — pode ser a institucional ou pessoal.
- Uma conta GitHub (gratuita) — <https://github.com/signup>.
- A pasta deste projeto (`caderno-orientacao`) descompactada no computador.

Ficheiros do projeto:

```
caderno-orientacao/
├── docs/                 ← a página publicada
│   ├── index.html
│   ├── app.js            ← a aplicação
│   ├── data.js           ← ligação ao Firebase
│   ├── config.js         ← ÚNICO ficheiro que precisa de editar
│   └── exemplo.json      ← laboratório fictício para experimentar
├── firestore.rules       ← regras de segurança (copiar para o Firebase)
├── storage.rules         ← regras dos anexos (só se ativar o envio de ficheiros)
├── enviar-emails.gs      ← script do Google que envia a fila de e-mails (opcional)
├── firebase.json         ← só para quem usar o Firebase Hosting (opcional)
└── README.md             ← este guia
```

---

## 3. Passo 1 — criar o projeto no Firebase (≈ 10 minutos)

1. Abra <https://console.firebase.google.com> e clique em **Criar um projeto**.
   Nome: `caderno-orientacao`. Pode **desativar** o Google Analytics.
2. No menu **Criação → Authentication**, clique em **Vamos começar** e ative o provedor
   **E-mail/senha** (o primeiro da lista). Guarde.
3. Ainda em Authentication, separador **Settings → Domínios autorizados**: mais tarde, no passo 2,
   volte aqui para adicionar o endereço do GitHub Pages (`SEU-UTILIZADOR.github.io`).
4. No menu **Criação → Firestore Database**, clique em **Criar banco de dados**:
   - Local: **southamerica-east1 (São Paulo)** — mantém os dados no Brasil.
   - Modo: **produção** (as regras do passo seguinte substituem as padrão).
5. Abra o separador **Regras**, apague o que estiver lá, cole **todo** o conteúdo do ficheiro
   `firestore.rules` e clique em **Publicar**.
   - Se usar outro e-mail, troque `bruno.henriques@ufsc.br` na linha `function orientadorEmail()`.
6. No ícone de engrenagem (canto superior esquerdo) → **Configurações do projeto** → secção
   **Seus apps** → botão **</>** (Web):
   - Apelido: `caderno`; **não** marque o Firebase Hosting.
   - O Firebase mostra um bloco `const firebaseConfig = { ... }`. **Copie-o**; é usado no passo 3.

---

## 4. Passo 2 — publicar a página no GitHub Pages (≈ 10 minutos)

1. Em <https://github.com/new> crie um repositório com o nome `caderno-orientacao`.
   Pode ser **público** (o GitHub Pages gratuito exige repositório público). Isto expõe apenas o
   código, nunca os dados dos alunos: estes ficam no Firebase, protegidos por login.
2. Na página do repositório, clique em **Add file → Upload files** e arraste **o conteúdo** da
   pasta do projeto (a pasta `docs`, o `firestore.rules`, o `firebase.json` e o `README.md`).
   Confirme em **Commit changes**.
3. Vá a **Settings → Pages**:
   - *Source*: **Deploy from a branch**
   - *Branch*: `main` e pasta **`/docs`** → **Save**.
4. Ao fim de 1–2 minutos, a página fica em
   `https://SEU-UTILIZADOR.github.io/caderno-orientacao/`.
5. Volte ao Firebase → **Authentication → Settings → Domínios autorizados** → **Adicionar domínio**
   e escreva `SEU-UTILIZADOR.github.io`. Sem este passo, o login não funciona.

---

## 5. Passo 3 — configurar a ligação (2 minutos)

No GitHub, abra `docs/config.js`, clique no lápis (**Edit**) e:

1. Substitua o bloco `FIREBASE_CONFIG` pelos valores copiados no passo 1.6
   (mantenha a palavra `export const FIREBASE_CONFIG =` no início).
2. Confirme o `ORIENTADOR_EMAIL` — tem de ser **igual** ao e-mail escrito em `firestore.rules`.
3. **Commit changes**. Um minuto depois, a página já está ligada à base de dados.

---

## 6. Passo 4 — primeiro acesso

1. Abra o endereço da página e clique em **Criar conta**, com o e-mail do orientador.
2. Confirme o e-mail pelo link que recebe (veja também a pasta de spam) e entre.
3. Como a base está vazia, a página oferece **Carregar dados de exemplo** — um laboratório
   fictício com 14 orientandos, útil para experimentar. Pode removê-lo depois em
   **Relatórios e cópias → Remover dados de exemplo**.
4. Antes de cadastrar gente real, reveja as **Configurações**: duração de cada ciclo, marcos
   automáticos, metas usadas na projeção e regras dos alertas.

### Dar acesso a um orientando

1. Em **Orientandos → + Novo orientando**, preencha a ficha e, sobretudo, o **e-mail de acesso**.
2. Envie ao aluno o endereço da página. Ele cria a conta **com esse mesmo e-mail**, confirma-a e
   passa a ver a própria ficha.
3. O aluno pode **Enviar atualização** (andamento, marco concluído, trabalho novo, texto). O pedido
   aparece em **Atualizações**; ao aprovar, a ficha muda e fica um registo no histórico.

### Dados que o próprio aluno preenche

Na página do aluno há o quadro **Os meus dados**: matrícula, curso/programa, celular (opcional) e
e-mail de contacto alternativo (opcional). São os únicos campos que ele altera diretamente — as
regras de segurança do Firebase impedem qualquer outra alteração na ficha, mesmo por fora da
página. O e-mail de acesso só o orientador muda, porque é ele que liga a conta à ficha.

### Co-editores

Em **Configurações → Acessos**, acrescente os e-mails (um por linha) de quem pode editar tudo —
por exemplo, um coorientador ou o técnico do laboratório. Eles criam conta da mesma forma.

---

## 7. Como funciona a projeção

Para cada orientando, a ficha mostra duas frentes — **trabalho experimental** e **escrita** — com:

- **Plano (linha tracejada):** do início até a meta de conclusão de cada frente.
  - O experimental deve estar concluído a X% do ciclo (padrão: 75% no mestrado, 80% no doutorado).
  - A escrita começa a Y% do ciclo e termina 30 dias antes da defesa — ou do prazo final, se não
    houver defesa marcada.
  - **Se o orientador definir as datas na ficha** (campos “Meta: experimental concluído” e
    “Meta: escrita concluída”), são essas que valem. Na falta delas, valem as estimativas acima, e a
    ficha diz sempre qual das duas está a ser usada.
  - O prazo final é o “Término previsto” da ficha; se estiver vazio, é estimado pela duração do
    nível (Configurações).
- **Realizado (linha cheia):** o histórico de andamento. Cada vez que o orientador move os
  cursores, ou aprova uma atualização do aluno, fica um ponto novo.
- **Projeção (linha pontilhada):** o ritmo recente projetado até aos 100%. O ritmo é a tendência
  linear dos registos dos últimos 180 dias (com pelo menos dois registos separados por 30 dias);
  na falta deles, usa-se o ritmo médio desde o início. Quando não há avanço, a ficha diz isso em
  vez de inventar uma data.
- **Estado:** *Adiantado*, *No prazo* (até 30 dias da meta), *Atenção* (até 90 dias depois),
  *Atrasado* (mais de 90) ou *Ritmo insuficiente*.

A frase do topo compara a conclusão projetada com o prazo final e diz quantos meses de folga ou de
atraso existem. É uma projeção linear e simples de auditar — não uma previsão estatística: serve
para conversar com o aluno, não para o julgar.

---

## 8. Produção científica e documentos

Cada orientando tem, na própria página, o quadro **A minha produção**: a lista do que já está
cadastrado e o formulário **Registar uma produção nova**, com título, tipo (artigo, trabalho ou
participação em congresso, resumo em anais, capítulo, livro, TCC, dissertação, tese, patente,
relatório técnico, prêmio), situação, periódico/evento/editora, local, data, **DOI ou link** e
observações. O registo entra em **Atualizações** e só passa para a produção do laboratório depois
da sua aprovação.

**Documentos (certificados, PDFs, comprovantes)** — duas formas:

1. **Por link (funciona já, sem custo):** o aluno cola o endereço do documento no Drive, no
   repositório institucional ou o DOI. É o modo predefinido.
2. **Por upload (exige o plano Blaze):** desde setembro de 2024 o Cloud Storage do Firebase só é
   ativado em projetos no plano pay-as-you-go. Se optar por ele:
   - No Firebase, menu **Criação → Storage**, ative o serviço;
   - cole o ficheiro `storage.rules` em **Storage → Regras** (troque o e-mail, como nas outras
     regras);
   - em `docs/config.js`, ponha `USAR_UPLOAD = true` e confirme que o `storageBucket` está
     preenchido.
   - Cada pessoa passa a poder anexar ficheiros até 10 MB, na sua própria pasta.

## 9. Notificações por e-mail

O Caderno **gera sozinho as mensagens** e guarda-as numa fila (a coleção `mail`, visível em
**Relatórios e cópias → Fila de e-mails**). O que é gerado, com os prazos definidos por si em
**Configurações → Notificações**:

- ao aluno: marco a aproximar-se (padrão: 15 dias antes), marco em atraso (uma vez por mês),
  bolsa a terminar (30 dias antes), “atualize o seu andamento” quando passa muito tempo sem
  registos (45 dias), e aviso quando o senhor aprova uma atualização dele;
- a si: aviso quando um aluno envia uma atualização e um resumo semanal do laboratório.

A geração corre sozinha uma vez por dia, quando o senhor (ou um co-editor) abre o Caderno, e
também no botão **Gerar agora**. Falta só escolher **quem envia** a fila:

### Opção A — script do Google (grátis, recomendado)

Usa o ficheiro `enviar-emails.gs`, que corre no Google Apps Script de hora a hora e envia pelo
Gmail. Passos (uma só vez, ≈ 15 minutos):

1. No Caderno, crie uma conta para o “robô” (por exemplo `caderno.robo@gmail.com`), confirme o
   e-mail e acrescente-a em **Configurações → Acessos**.
2. Em <https://script.google.com> → **Novo projeto** → cole o conteúdo de `enviar-emails.gs`.
3. Em **Definições do projeto → Propriedades do script**, crie `PROJECT_ID`, `API_KEY` (a mesma de
   `config.js`), `ROBO_EMAIL` e `ROBO_SENHA`.
4. Execute a função `enviarFila` uma vez e autorize o acesso ao Gmail.
5. Em **Acionadores**, adicione um acionador de tempo: `enviarFila`, *de hora a hora*.

Limite do Gmail: 100 destinatários por dia numa conta `@gmail.com` (1500 numa conta Workspace) —
muito acima do que um laboratório gera.

### Opção B — extensão do Firebase (exige plano Blaze)

Instale a extensão **Trigger Email from Firestore**, aponte-a para a coleção `mail` e ligue um
serviço de envio (Brevo, SendGrid, Mailgun ou o SMTP da UFSC). Fica tudo dentro do Firebase, sem
script externo; em troca, o projeto passa ao plano pay-as-you-go (cartão exigido, com as mesmas
quotas gratuitas — vale a pena definir um limite de gastos).

### Sem nenhuma das opções

A fila continua útil: cada mensagem tem o botão **Escrever**, que abre o seu programa de e-mail já
preenchido. O mesmo vale para os **Lembretes por e-mail**, na mesma aba, que montam a mensagem com
a situação de cada orientando.

## 10. Cópias de segurança

**O que já funciona, sem custo:**

- **E-mails do próprio Firebase:** confirmação de conta e recuperação de senha, automáticos e
  gratuitos.
- **Lembretes preparados pelo Caderno:** em **Relatórios e cópias → Lembretes por e-mail**, cada
  orientando ativo tem um botão *Escrever*. O Caderno monta a mensagem com a situação real —
  percentagens, próximo marco, última reunião, projeção e pendências — e abre o seu programa de
  e-mail já preenchido; basta rever e enviar. Há também *Copiar texto* e um botão para escrever a
  todos os ativos de uma vez (em cópia oculta).
- **Ao entrar na página**, o aluno vê a própria situação, o que está atrasado e o que foi aprovado.

**Envio verdadeiramente automático** (por exemplo: avisar o aluno 15 dias antes de um marco, ou
avisá-lo quando o senhor aprova uma atualização) **exige sair do plano gratuito**:

| Caminho | O que é preciso | Custo realista |
|---|---|---|
| Firebase Blaze + extensão *Trigger Email from Firestore* | Mudar o projeto para o plano Blaze (pay-as-you-go, exige cartão) e ligar um serviço de envio (SendGrid, Brevo, Mailgun ou o SMTP da UFSC) | O Blaze mantém as mesmas quotas gratuitas; um laboratório deste tamanho fica dentro delas, pagando praticamente nada. O risco é teórico: sem limite de gastos configurado, um erro pode gerar custo |
| Google Apps Script agendado | Um script que lê os dados e envia pelo Gmail, sem cartão, mas com configuração adicional (conta de serviço) e sujeito aos limites diários do Gmail | Zero |

Se quiser seguir por um destes caminhos, peça: dá para preparar o script de envio e os modelos das
mensagens (marco a aproximar-se, bolsa a terminar, sem atualização há X semanas, atualização
aprovada, resumo semanal para o orientador).


O plano gratuito do Firebase **não faz cópias automáticas**. Em **Relatórios e cópias**:

- **Baixar cópia completa (.json)** — faça isto uma vez por mês e guarde o ficheiro (Drive, pasta
  do laboratório).
- **Restaurar a partir de cópia** — repõe o conteúdo do ficheiro (grava por cima dos registos com
  o mesmo identificador; não apaga o que existir a mais).
- **Exportar CSV** — orientandos, marcos, produção e reuniões, para o Excel e para relatórios à
  CAPES, ao CNPq ou à coordenação do programa.

---

## 11. Alterar o Caderno mais tarde

- **Sem programar:** listas, níveis, marcos automáticos, metas e regras dos alertas mudam em
  **Configurações**.
- **Com alteração de código:** peça a alteração numa conversa com o Claude (ou a alguém com noções
  de programação). Os ficheiros alterados são enviados para o GitHub — pela interface web, em
  *Edit* / *Upload files* — e o GitHub Pages republica sozinho em 1–2 minutos.
- Se uma alteração mexer em `firestore.rules`, é preciso colar de novo o ficheiro em
  **Firebase → Firestore → Regras → Publicar**.
- O GitHub guarda todas as versões: qualquer alteração pode ser revertida.

---

## 12. Limites, custos e privacidade

- **Custo: zero** no plano gratuito (Spark) do Firebase, incluindo as notificações pela opção A: 1 GiB de dados, 50 mil leituras e 20 mil
  gravações por dia e 50 mil utilizadores por mês. Um laboratório com dezenas de pessoas usa uma
  fração mínima disto. O GitHub Pages também é gratuito.
- **Dados no Brasil:** escolhendo a região São Paulo, os dados ficam em território nacional.
- **Dados pessoais (LGPD):** a base guarda nomes, e-mails, vínculos e notas sobre pessoas. Use-a
  apenas para a gestão acadêmica, avise os orientandos de que a ficha existe e do que ela contém,
  não escreva nas notas privadas nada que não possa mostrar ao próprio aluno se ele pedir, e apague
  as fichas quando deixarem de ser necessárias.
- **Quem vê o quê:** ver a tabela da secção 1. O aluno nunca vê fichas de colegas, nem as notas
  privadas do orientador.

---

## 13. Problemas comuns

A mensagem de erro na tela de entrada termina sempre com o **código técnico** entre parênteses
retos (por exemplo `[auth/operation-not-allowed]`). É esse código que identifica o problema:

| Código | Causa e solução |
|---|---|
| `auth/operation-not-allowed` ou `auth/configuration-not-found` | O provedor **E-mail/senha** não está ativo. No Firebase: **Authentication → Vamos começar → Sign-in method → E-mail/senha → Ativar**. |
| `auth/admin-restricted-operation` | A criação de contas está bloqueada: **Authentication → Settings → User actions → permitir criação**. |
| `auth/invalid-api-key` ou `auth/api-key-not-valid…` | O bloco `FIREBASE_CONFIG` em `docs/config.js` não corresponde ao projeto. Copie-o de novo (Configurações do projeto → Seus apps). |
| `auth/network-request-failed` | Ligação bloqueada: VPN, bloqueador de anúncios ou extensão do navegador. Tente noutro navegador ou numa janela anónima. |
| `auth/unauthorized-domain` | Falta acrescentar `SEU-UTILIZADOR.github.io` em **Authentication → Settings → Domínios autorizados**. |
| `auth/email-already-in-use` | Já existe conta com esse e-mail: use **Entrar** ou **Esqueci a senha**. |
| `auth/weak-password` | Use pelo menos 8 caracteres. |

Por baixo do formulário aparece também o nome do projeto Firebase em uso — se disser
“(não configurado)” ou um projeto diferente do seu, o `docs/config.js` ainda não foi atualizado
(ou o GitHub Pages ainda não republicou; aguarde um minuto e recarregue com Ctrl+F5).

| Sintoma | O que fazer |
|---|---|
| “Falta configurar a ligação ao Firebase” | O `docs/config.js` ainda tem `COLE_AQUI`; refaça o passo 3. |
| O login falha com erro de domínio | Adicione `SEU-UTILIZADOR.github.io` em Authentication → Settings → Domínios autorizados. |
| O e-mail de confirmação não chega | Veja o spam; use **Reenviar e-mail** na tela de confirmação. |
| “Sem permissão para esta alteração” | O e-mail usado não é o do orientador nem está na lista de co-editores; confirme também que `firestore.rules` foi publicado com o e-mail certo. |
| O aluno entra e vê “ainda não há ficha associada” | O e-mail da conta dele tem de ser exatamente o e-mail cadastrado na ficha (sem maiúsculas diferentes ou espaços). |
| A página não atualiza depois de um commit | Espere 1–2 minutos e recarregue com Ctrl+F5 (ou ⌘+Shift+R). |

---

## 14. Alternativas de alojamento

- **Firebase Hosting** (em vez do GitHub Pages): com o Node.js instalado, `npm install -g
  firebase-tools`, `firebase login`, `firebase deploy` na pasta do projeto (o `firebase.json` já
  está pronto, servindo a pasta `docs` e as regras).
- **Servidor da UFSC:** a página é composta só por ficheiros estáticos, portanto pode ser servida
  por qualquer servidor web da universidade, continuando a usar o Firebase para dados e login. Para
  ter também a base de dados dentro da UFSC é preciso uma máquina virtual da SeTIC (abrir chamado
  de análise de demanda de serviços de nuvem) e substituir a camada `docs/data.js` por uma base
  própria — um trabalho de adaptação que pode ser pedido depois.
