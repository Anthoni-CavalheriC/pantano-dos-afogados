# O Pântano dos Afogados

Site para os jogadores escolherem os personagens prontos da sessão de RPG
(Ballynyr · Irlanda, ano 890). Cada personagem só pode ser escolhido por uma pessoa.

- **Jogadores:** abrem o site, digitam o nome, escolhem o personagem e clicam em *Jogar*.
- **Mestre:** abre o site com `?mestre=SENHA` no fim do endereço para ver quem escolheu cada personagem.

As escolhas ficam guardadas no Supabase (`config.js`). As fichas são montadas a partir do PDF
com `ferramentas/extrair_fichas.py`, que gera `fichas.js` e as imagens da pasta `img/`.
