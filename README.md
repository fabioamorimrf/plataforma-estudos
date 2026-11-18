# Plataforma de Estudos

Site de estudos com o método Sniper de Questões: calendário semanal, Lista Sniper por matéria e revisões espaçadas com registro de acertos. Funciona no celular e no computador, com login e sincronização pelo Firebase.

## O que tem

- **Hoje**: revisões que vencem hoje (e atrasadas), estudo do dia e contagem regressiva para a prova.
- **Semana**: uma coluna por dia com os cartões das matérias. Arraste para reorganizar; cada cartão tem a sua lista de tarefas.
- **Matérias**: ordem da Fila, fase automática (Fase 2 com 60% dos assuntos vistos, Fase 3 com 80%) e Lista Sniper em três colunas: Para estudar, Já vi, Para treinar mais.
- **Revisões**: ao mover um assunto para "Já vi", você escolhe a dificuldade e as revisões começam.

| Dificuldade | Intervalos (dias entre revisões) |
| --- | --- |
| Difícil | 1, 2, 4, 7, 14, 21, 30, 45, 60 |
| Médio | 1, 3, 7, 21, 30, 45, 60 |
| Fácil | 3, 7, 21, 45, 60 |

Depois da trilha, manutenção a cada 75 dias. Em cada revisão você registra os acertos: abaixo de 50% volta ao início e vai para "Para treinar mais"; de 50 a 79% repete o intervalo; de 80 a 89% avança; 90% ou mais pula um intervalo. As revisões nunca passam de 3 dias antes da prova e respeitam o limite diário definido em Ajustes.

## Configuração do Firebase (uma vez)

1. **Authentication > Método de login**: ative **Google** e **E-mail/senha**.
2. **Authentication > Configurações > Domínios autorizados**: adicione `fabioamorimrf.github.io`.
3. **Firestore Database > Regras**: cole o conteúdo de [`firestore.rules`](firestore.rules) e clique em **Publicar**.

A configuração do app Web fica em [`js/firebase-config.js`](js/firebase-config.js). Se o `apiKey` ficar vazio, o site funciona em modo local (dados só no navegador).

## Publicar no GitHub Pages

**Settings > Pages > Build and deployment**: Source "Deploy from a branch", branch `main`, pasta `/ (root)`. O site fica em `https://fabioamorimrf.github.io/plataforma-estudos/`.

## Estrutura

- `index.html`, `css/style.css`: página e visual (tema claro e escuro).
- `js/app.js`: telas e interações.
- `js/store.js`: login e dados (Firestore com cache offline, ou localStorage no modo local).
- `js/srs.js`: regras de revisão espaçada.
- `js/presets.js`: Fila do ENEM, assuntos de Matemática em 3 grupos e tarefas por fase.
- `tests/`: testes das regras de revisão (`node --test tests/*.test.mjs`).

Não há etapa de build: é só HTML, CSS e JavaScript.
