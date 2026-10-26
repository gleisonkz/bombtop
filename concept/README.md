# Bombtop — conceitos e identidade visual

A família visual **v1** segue a arte de menu aprovada em [bomber/menu-flight-source.png](bomber/menu-flight-source.png): arcade 2D premium, proporções compactas de brinquedo, gradientes suaves controlados, reflexos limpos e contorno escuro contínuo. Sem aparência pixelada.

- [CHARACTER-IDENTITY.md](CHARACTER-IDENTITY.md): invariantes da família, identidade exclusiva do Bomber e critérios de aceitação.
- [characters.identity.json](characters.identity.json): contrato reutilizável estruturado, referências relativas a esta pasta, materiais, paleta aproximada, workflow e grades separadas de master/runtime.
- [PROMPT-BASE.md](PROMPT-BASE.md): prompt v1 para gerar outros personagens sem copiar os traços exclusivos do Bomber.
- [CHARACTER-RECIPE.md](CHARACTER-RECIPE.md): roteiro de integração de regras, sprites, sons e telas para novos personagens.
- [bomber/README.md](bomber/README.md): documentação operacional do Bomber; verificar sua sincronização com a exportação final.

O contrato refinado usa master 1872 × 5472 (9 × 19 células de 208 × 288) e mantém gameplay runtime 936 × 2592 (9 × 18 células de 104 × 144), escala 0,22, corpo 100 px e âncora (52, 140). Cada quadro master é reduzido individualmente com Lanczos antes de montar o atlas. O menu aprovado continua fonte 1152 × 1152 e runtime 768 × 768, ambos 3 × 3. Novos desenhos fornecem o detalhe; ampliar arte antiga não atende ao pedido.

O master regenerado contém 117 poses e possui verificações de imagem reproduzíveis.
O lobby, guia e pódio usam o atlas HD `bomber-menu-atlas.png` (1872 × 5184), com
escala 0,11 e filtro suave; a arena mantém o atlas menor e filtragem linear.
A mega bomba especial tem arte própria em `bombs/mega-bomber.png`, com olhos âmbar
ameaçadores e reforços violetas, documentada também em [BOMB-IDENTITY.md](BOMB-IDENTITY.md).
Fontes ficam em concept; texturas usadas pelo jogo ficam em apps/client/public/sprites.

## Histórico

[Cartão de proporções](references/bomberman-card-reference.png) e [identidade histórica](references/bomb-identity-2026.png) permanecem como contexto. A versão v0.1 e seu piloto textual Bombtop Vanguard antecedem a aprovação atual; o arquivo base-character.png não existe nesta pasta. A restrição antiga a dois/três valores de sombra foi substituída pelo acabamento suave aprovado. Usar referências históricas apenas como inspiração, sem copiar personagens ou marcas licenciados.
