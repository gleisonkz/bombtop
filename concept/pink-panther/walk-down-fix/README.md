# Pantera — caminhada para baixo

O seletor de quadros já apontava para a linha 3 correta. A arte anterior começava com poses paradas e virava de lado nos últimos passos. A correção regenera somente os seis quadros dessa linha pelo PixelLab `skeleton-v3`, template `walking`, direção `south`, no mesmo personagem aprovado.

Job: `3fea86c1-268c-4fe0-af09-e543b144e631`. Os PNGs nativos de 192×192 ficam em `generated/`. A âncora comum (100;164) mantém a cabeça na mesma altura da pose parada quando empacotada na âncora do jogo (112;208). Não houve escala, edição de feições ou síntese de membros por script; apenas o empacotamento nativo.

`before.png` e os manifestos anteriores conservam a versão rejeitada. `candidate.png` substitui somente a linha 3; as outras 16 linhas foram verificadas como idênticas pixel a pixel. `walk-preview.gif` mostra o novo ciclo. O manifesto principal agora aponta para as seis fontes corrigidas.

A folha foi aplicada no worktree atual e na cópia de execução em `D:/Programação/Jogos/New folder/bombtop`. A porta 5173 foi conferida por hash HTTP e serve a URL versionada `sprites/panther.png?v=walk-down-2d1a8089`. Passaram oito testes do empacotador e 126 testes de sprites na cópia de execução.
