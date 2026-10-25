# Bombtop — identidade dos personagens v1

A referência visual aprovada é [Bomber em voo](bomber/menu-flight-source.png). Seus nove desenhos estabelecem o acabamento atual: ilustração arcade 2D premium, volumes de brinquedo arredondados, sombreamento suave, gradientes controlados, reflexos limpos e contornos escuros contínuos. Não é pixel art. A versão v1 substitui as restrições de v0.1 sobre acabamento limitado a dois ou três valores.

## Invariantes da família

Cabeça grande, torso compacto, ombros arredondados, pernas curtas e robustas, luvas grandes e botas largas. Como alvo aproximado para uma pose neutra em pé, a cabeça ocupa 40–45% da altura corporal, excluindo chama e extensões da capa. As poses de voo têm encurtamento de perspectiva e não servem para medir literalmente essa razão. Preserve a mesma construção anatômica em frente, direita e costas; esquerda pode espelhar a direita conforme o renderer.

Luz principal superior esquerda/frontal; contorno externo mais forte que linhas internas. Metal pintado tem reflexos pequenos e limpos, armadura tem brilho acetinado, tecido tem dobras amplas menos brilhantes. Gradientes suaves são permitidos e desejados. A silhueta deve continuar legível na escala real do jogo. Cores, capacete, olhos, roupas, símbolo e acessórios distinguem cada personagem; não são invariantes da família.

## Identidade exclusiva do Bomber

Cabeça esférica de bomba preta; dois olhos âmbar estreitos e inclinados com núcleo claro; pavio superior aceso em colar dourado; armadura violeta; luvas vermelhas; capa vermelha; botas violetas com detalhes dourados; pequeno emblema hexagonal dourado no peito. Costas mostram a parte posterior da cabeça e a capa, sem olhos ou emblema atravessando o corpo. Capa, pavio e chama permanecem ligados ao personagem e não deixam fragmentos. Outros personagens não precisam repetir nenhum desses traços exclusivos.

As cores hexadecimais do [JSON reutilizável](characters.identity.json) são aproximações de direção de arte estimadas visualmente, não amostras exatas nem paleta obrigatória de toda a família.

## Contrato de produção: master separado do runtime

| Uso | Célula | Grade | Dimensões | Âncora / altura corporal |
| --- | --- | --- | --- | --- |
| Master compilado | 208 × 288 | 9 × 19 | 1872 × 5472 | (104, 280) / 200 px |
| Gameplay runtime | 104 × 144 | 9 × 18 | 936 × 2592 | (52, 140) / 100 px |
| Fonte de menu aprovada | 384 × 384 | 3 × 3 | 1152 × 1152 | pivô de voo registrado |
| Menu runtime | 256 × 256 | 3 × 3 | 768 × 768 | pivô de voo correspondente |

Gameplay mantém escala 0,22: corpo nominal de 22 px. O master é fonte de autoria, não textura de execução. Recortar e reduzir **cada quadro separadamente com Lanczos**, depois montar o atlas, evita mistura com vizinhos e preserva o orçamento de memória/GPU móvel. O ganho visual vem de novos desenhos detalhados; ampliar desenhos antigos não é regeneração. A arte aprovada do menu permanece preservada.

Linhas base zero: 0–2 parado (4 quadros/direção); 3–5 andando (6); 6 tonto (6); 7 derrota/queda/explosão/fumaça (7); 8–10 especial (9); 11–13 carregando parado (4); 14–16 carregando andando (6); 17 celebração (8); 18 inventário das nove poses de voo. Os grupos direcionais seguem frente/direita/costas. Somente linhas 0–17 entram no atlas de gameplay. Células excedentes ficam transparentes. Bombas carregadas são objetos do renderer; os braços precisam estar erguidos sem bomba incorporada.

## Reutilização e aceitação

Anexar os pixels da referência aprovada é obrigatório ao gerar ou editar arte; mencionar seu caminho não transmite a imagem. Para outro personagem, manter a família e substituir o bloco de identidade; aprovar o conceito individual antes de derivar animações. Usar [PROMPT-BASE](PROMPT-BASE.md) e os campos separados de família/identidade do JSON.

Exigir RGBA com transparência real, curvas antialias limpas, margens por célula, âncoras estáveis e vistas coerentes. Rejeitar matte, checkerboard pintado, sombras de chão, texto, recortes, restos de quadros vizinhos e poses idênticas vendidas como animação nova. Confirmar diferenças reais entre quadros e leitura no runtime reduzido.

Este documento registra a identidade aprovada e o contrato refinado solicitado. Não certifica que os arquivos finais já tenham sido regenerados: o coordenador deve verificar dimensões, alpha, inventário, âncoras, exportação e integração reais antes de declarar produção concluída.

## Contexto histórico

[Cartão de referência](references/bomberman-card-reference.png) e [referência histórica de identidade](references/bomb-identity-2026.png) permanecem como contexto. O piloto textual “Bombtop Vanguard” de v0.1 era exploratório; não é a referência de acabamento aprovada, e não há arquivo base-character.png nesta pasta. Não copiar marcas, roupas ou personagens licenciados.
