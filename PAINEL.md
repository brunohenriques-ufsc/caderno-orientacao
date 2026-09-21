# Painel do Laboratório — guia de instalação e uso

Painel para a TV do laboratório e área de gestão, publicado junto com o Caderno de Orientação
(mesmo GitHub Pages, mesmo projeto Firebase). Não depende de nenhuma conta do Claude.

- **TV:** `https://brunohenriques-ufsc.github.io/caderno-orientacao/painel/?tv`
- **Gestão:** `https://brunohenriques-ufsc.github.io/caderno-orientacao/painel/#gestao`

---

## 1. O que o painel mostra

| Área da TV | De onde vem |
|---|---|
| Pendências e “repor estoque” | Gestão do painel (Pendências, Estoque) |
| Agenda do grupo | **Caderno** (marcos de defesa, qualificação e seminário de IC ainda não realizados) + Agenda extra (palestras, seminários, reuniões) |
| Equipamentos e reservas de hoje | Gestão do painel |
| Publicações do grupo | **Caderno** (produções com status “Publicado”, últimos 18 meses) |
| O grupo em congressos | **Caderno** (participação/trabalho em congresso, resumo em anais) |
| Conferências e prazos da área | Gestão do painel (Conferências) |
| Notícias, UFSC, curiosidades, avisos | Gestão do painel (Mural) |
| Aniversariantes e “Parabéns” do dia | **Caderno** (data de nascimento, só dia/mês) + Equipe (outros) |
| Composição do grupo | **Caderno** (orientandos ativos por nível) |

**Privacidade:** o painel nunca lê as fichas diretamente. Quando o orientador ou um co-editor abre
o Caderno (ou o painel), é gravado um resumo em `lab/resumo` com apenas: nome, nível, dia e mês do
aniversário, marcos de defesa/qualificação, publicações e congressos. Notas, reuniões, contactos,
bolsas e progresso ficam no Caderno. Dados de exemplo do Caderno não aparecem, a menos que se
marque a opção em Configurações.

## 2. Quem faz o quê

| | Orientador | Co-editor do Caderno | Gestor do painel | Conta da TV |
|---|---|---|---|---|
| Ver o painel | sim | sim | sim | sim |
| Editar pendências, agenda, equipamentos, reservas, estoque, mural, configurações | sim | sim | sim | não |
| Atualizar o resumo do Caderno | sim (automático) | sim (automático) | não | não |
| Ver fichas do Caderno | sim | sim | **não** | **não** |
| Definir gestores e contas da TV | sim | não | não | não |

As permissões são garantidas no servidor pelas regras do Firebase (`firestore.rules`).

---

## 3. Instalação (≈ 15 minutos)

### Passo 1 — enviar os ficheiros para o GitHub

No repositório `caderno-orientacao`:

1. **Add file → Upload files** e arraste:
   - a pasta `docs/painel` inteira (arraste a **pasta**, não só o conteúdo, para dentro de `docs/`
     — ou abra a pasta `docs` no GitHub antes e arraste a pasta `painel` para lá);
   - o `docs/index.html` (substitui o atual — a única mudança é **uma linha** no fim que carrega
     `painel/sync.js`);
   - o `firestore.rules`, o `README.md` e este `PAINEL.md`, na raiz.
2. **Commit changes**. Em 1–2 minutos o painel está no ar.

### Passo 2 — atualizar as regras do Firebase

1. Firebase → **Firestore Database → Regras**.
2. Apague tudo, cole **todo** o novo `firestore.rules` e clique em **Publicar**.
   As regras antigas do Caderno estão iguais; foi acrescentado só o bloco
   “PAINEL DO LABORATÓRIO”, antes de “Tudo o resto: fechado”.

### Passo 3 — primeiro acesso

1. Abra o **Caderno** uma vez com a sua conta (isto grava o primeiro resumo).
2. Abra o **painel** (`…/painel/#gestao`). Entra com a mesma conta, sem nova senha.
3. Em **Conferências** e **Mural**, use **Carregar sugestões iniciais** (congressos da área e
   informes reais de setembro de 2026) e ajuste.
4. Cadastre **Equipamentos**, **Estoque** e as **Pendências** atuais.

### Passo 4 — dar acesso ao responsável do laboratório

1. Em **Gestão → Acessos**, escreva o e-mail dele em **Gestores do painel** e salve.
2. Ele abre o painel, clica **Criar conta** com esse e-mail, confirma o link recebido e entra.
   (Se ele já tiver conta no Caderno, usa a mesma.)

> Se preferir que ele também edite o Caderno inteiro, acrescente-o como co-editor no Caderno
> (Configurações → Acessos). Co-editores já são gestores do painel automaticamente.

### Passo 5 — preparar a TV

1. Crie uma conta só para a TV (ex.: `tv.labmateriais@gmail.com`) e ponha-a em
   **Acessos → Contas da TV**.
2. No computador/TV box ligado à televisão, abra `…/painel/?tv`, entre com essa conta e clique em
   **Tela cheia** (aparece ao mover o rato). Se o navegador bloquear, use F11.
3. A sessão fica guardada. O painel atualiza-se em tempo real e recarrega sozinho de madrugada.
4. Dica: configure o navegador para abrir essa página ao iniciar e desative a suspensão de ecrã.

---

## 4. Como o resumo do Caderno se mantém atualizado

- Sempre que o orientador ou um co-editor **abre o Caderno ou o painel**, o resumo é refeito se
  tiver mais de 1 hora. Na prática, isto dá uma atualização diária sem fazer nada.
- Em **Gestão → Do Caderno** vê-se a data da última atualização e há o botão **Atualizar agora**.
- Se ninguém com acesso ao Caderno o abrir durante vários dias, o painel continua a mostrar o
  último resumo (as contagens regressivas continuam certas; só novidades do Caderno esperam).

## 5. Ficheiros

```
docs/painel/
├── index.html   ← página do painel (TV + gestão)
├── painel.css   ← aparência
├── painel.js    ← aplicação
├── resumo.js    ← recorte do Caderno que vai para a TV
└── sync.js      ← carregado pelo Caderno para atualizar o resumo
```

Dados no Firestore: `lab/config`, `lab/acesso`, `lab/resumo` e `lab/<grupo>/itens/<id>` para
tarefas, agenda, conferências, mural, equipamentos, reservas, estoque e equipe.

## 6. Problemas comuns

| Sintoma | Causa provável |
|---|---|
| “Acesso pendente” | O e-mail não está em Acessos (gestores ou TV), ou foi escrito diferente. |
| Painel sem publicações/defesas | Ninguém com acesso ao Caderno o abriu desde a instalação; abra o Caderno ou use “Atualizar agora”. |
| “Sem permissão” ao salvar | As novas regras não foram publicadas no Firebase (passo 2). |
| Login não funciona | O domínio `brunohenriques-ufsc.github.io` precisa de estar em Authentication → Domínios autorizados (já está, se o Caderno funciona). |
