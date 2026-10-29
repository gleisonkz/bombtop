# Transporte de frente e caminhada de costas

Correção dos dois novos exemplos enviados pelo usuário. O transporte frontal (poses das linhas 11 e 14) foi regenerado em uma única sequência de seis poses para manter a mesma referência facial. A caminhada de costas (linha 5) foi regenerada por completo para não virar o rosto nos três últimos quadros.

As articulações de cabeça vêm das proporções do A1, deslocadas até o pescoço de cada pose; as orelhas não herdam o afastamento excessivo do esqueleto antigo. Na vista de costas, nariz e olhos ficam atrás da cabeça no mapa de profundidade. O PixelLab desenha todos os quadros; não há edição de rosto ou membros por script.

`jobs.json` contém os dois jobs; `requests.json` registra as poses enviadas; `raw/` conserva os PNGs nativos de 128×160. `before/` conserva as 12 poses substituídas. O empacotamento mantém as repetições e a grade existentes. A versão de produção do jogo permanece preservada.

`corrected-preview.png` mostra os seis quadros de transporte e os seis de caminhada de costas, na mesma ordem dos exemplos. `walk-preview.gif` mostra frente, perfil e costas após a correção.
