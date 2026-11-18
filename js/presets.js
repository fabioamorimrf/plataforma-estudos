// Sugestões do método Sniper (adapte à vontade).

// Fila sugerida para ENEM começando do zero (planilha do curso).
export const ENEM_SUBJECTS = [
  'Matemática',
  'Redação',
  'Biologia',
  'Química',
  'Física',
  'História',
  'Geografia Humana',
  'Geografia Física',
  'Linguagens',
  'Filosofia',
  'Sociologia',
  'Inglês',
];

// Matemática em 3 grupos, por incidência no ENEM.
export const MATH_TOPICS = [
  {
    group: 1,
    topics: [
      'Matemática básica',
      'Razão e proporção',
      'Porcentagem',
      'Aritmética simples',
      'Regra de 3',
      'Escala',
      'Estatística: interpretação de gráficos',
      'Média aritmética e ponderada',
      'Mediana e moda',
      'Função afim',
      'Função quadrática',
      'Visualização espacial e projeção ortogonal',
    ],
  },
  {
    group: 2,
    topics: [
      'Geometria plana',
      'Trigonometria',
      'Matemática financeira',
      'Conjuntos numéricos',
      'Geometria espacial',
      'Função exponencial',
      'Função logarítmica',
      'Função circular',
      'Sequências: PA',
      'Sequências: PG',
    ],
  },
  {
    group: 3,
    topics: ['Geometria analítica', 'Álgebra', 'Probabilidade', 'Sistemas lineares', 'Análise combinatória'],
  },
];

// Tarefas sugeridas por fase (Fórmula Sniper).
export const PHASE_TASKS = {
  1: ['Assistir à aula do assunto', 'Fazer 10 a 15 questões da lista', 'Lista Sniper dos assuntos já vistos'],
  2: ['Assunto novo: aula e questões', 'Questões de prova antiga', 'Lista Sniper (opcional)'],
  3: ['Fazer prova antiga', 'Corrigir e analisar os erros', 'Refazer as questões erradas'],
};

export const PALETTE = ['#6d4fd8', '#e0567a', '#2f9e6b', '#e08a1e', '#2f7fd8', '#a14fd8', '#c2483b', '#1f9fae', '#7a8a1e', '#d8519d', '#4f6bd8', '#8a6b3b'];
