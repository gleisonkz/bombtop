# Bombtop — identidade visual dos personagens

Esta pasta guarda os conceitos e as referências da família visual dos personagens. Os sprites utilizados pelo jogo continuam em `apps/client/public/sprites/`.

## Direção visual v0.1

- Referência de linguagem: `references/bomberman-card-reference.png` (cartão ilustrado de Bomberman). Usar apenas como inspiração de proporções e leitura; desenhar personagens e detalhes originais.
- Arquétipo: herói de ação de brinquedo, simpático e energético, com silhueta arredondada e compacta.
- Cabeça/capacete grande: aproximadamente 40–45% da altura visível. Face em visor/máscara expressiva, olhos simples e legíveis.
- Corpo curto e robusto, ombros arredondados, mãos/luvas grandes, pernas curtas e botas largas. Pés firmes no mesmo plano.
- Contorno escuro contínuo, grandes formas e poucos detalhes pequenos; volumes destacados por até três valores por material, sem gradientes fotográficos.
- Projeção 3/4 levemente frontal, corpo inteiro, expressão determinada e amigável. A escala e a pose devem parecer da mesma linha de bonecos entre personagens.
- A identidade individual muda pela paleta, símbolo original, roupa, capacete e acessórios; as proporções, acabamento, luz e volume seguem o mesmo padrão.
- Conceito de apresentação: ilustração limpa, personagem isolado, fundo transparente. Sem texto, cenário, moldura, logo ou acessórios cortados.

## Piloto

`base-character.png` é o primeiro teste dessa linguagem, um **herói genérico original** usado para validar proporção e acabamento. Não é um sprite de produção, não substitui nenhum personagem e não deve ser conectado ao renderer antes de aprovar o estilo.

O prompt reutilizável está em `PROMPT-BASE.md`. Para gerar cada personagem, mantenha o bloco de regras fixas e substitua somente as variáveis de identidade. Depois de aprovar a linguagem, derivar os sprites na grade e nos anchors reais de `apps/client/src/render/sprites.ts`, preservando quadros de animação e perspectiva.
