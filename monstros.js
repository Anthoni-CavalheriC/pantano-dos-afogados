// Fichas dos monstros da missão (transcritas do PDF "Ordem 2 — Playtest Beta, Missão 1 e 2").
// [d8] vira o ícone do dado. O texto usa HTML simples (<b>, <i>).
window.MONSTROS = {
  afogado: {
    nome: "Afogado",
    pv: 10,
    arte: ["img/afogado-1.webp", "img/afogado-2.webp"], // cada afogado sorteia uma
    multiplos: true, // dá para adicionar vários
    atributos: [["Físico", 8], ["Mente", 4], ["Emoção", 4]],
    pericias: "Atletismo [d8], Luta [d6]",
    lema: "Uma forma rastejante coberta de lama e vegetação, com a pele tão encharcada que, em vários pontos, se desfez. Dos buracos que se abriram, assim como de sua boca e olhos, verte água e lodo.",
    estrategia: "A estratégia de um afogado é simples: se ele estiver perto de uma fonte d’água, avança na direção da pessoa mais próxima, tenta feri-la (ataque Garras) e afogá-la (ataque Afogar). Caso contrário, simplesmente tenta espancá-la até a morte (ataque Garras).",
    acoes: [
      "<b>Corpo a corpo.</b> Afogar [d8]+[d6] <i>(veja abaixo)</i>.",
      "<b>Corpo a corpo.</b> Garras [d8]+[d6] <i>(dano RA+1)</i>.",
    ],
    habilidades: [
      "<b>Afogar.</b> O afogado agarra e empurra a vítima contra a água. Enquanto estiver agarrada, a vítima só pode tentar escapar (não pode fazer outras ações) e perde [d6] PV no final de cada rodada.",
      "<span class='item'><i>Escapar.</i> Na fase de ataque corpo a corpo, a vítima faz um teste de Acrobacia ou Luta (à sua escolha) oposto ao teste de Luta do afogado. A vítima sofre uma redução de passo no teste. Se vencer, se solta (não sofre dano no final desta rodada e pode agir normalmente a partir da próxima). Se perder, pode tentar de novo na próxima rodada. Outros personagens podem gastar suas ações para salvar a vítima, fazendo o mesmo teste (mas sem sofrer a redução de passo).</span>",
      "O afogado só pode usar esta habilidade se estiver perto de um corpo d’água e, enquanto estiver agarrando uma vítima, não pode fazer outras ações.",
    ],
  },

  aughisk: {
    nome: "Aughisk",
    pv: 40,
    arte: "img/aughisk-arte.webp",
    multiplos: false, // só um
    atributos: [["Físico", 10], ["Mente", 6], ["Emoção", 8]],
    pericias: "Atletismo [d10], Luta [d10], Percepção [d10]",
    lema: "Em sua primeira aparição para uma pessoa, Aughisk se apresenta como um belíssimo cavalo branco, iluminado, convidando a futura vítima a montá-lo. Se ela o fizer, como muitos fizeram, encontra seu fim se afogando nas águas do pântano, incapaz de se libertar do lombo da criatura. Caso contrário, desperta a fúria de Aughisk, conhecendo sua verdadeira forma: um cavalo descarnado, seus músculos expostos e pulsantes. Do lombo do cavalo, fundido a ele como ferro derretido, cresce o torso de um homem também descarnado, os ossos das costelas aparecendo por baixo da pele rasgada. Os olhos — tanto os equinos quanto os humanos — são poços negros.",
    estrategia: "O aughisk é uma criatura sádica e violenta de Morte e Medo, e sua estratégia reflete seu temperamento. Na 1ª rodada, ele normalmente faz um ataque corpo a corpo contra o personagem mais forte que puder alcançar. Na 2ª rodada, faz uma investida equina. Na 3ª rodada, começa a conjurar a Enxurrada da Morte. Na 4ª rodada, termina de conjurar o ritual. Na 5ª rodada, reinicia o ciclo com os ataques corpo a corpo.",
    acoes: [
      "<b>Corpo a corpo.</b> Espada (teste 2[d10], dano RA+4).",
      "<b>Corpo a corpo.</b> Coice (teste 2[d10], dano RA+3).",
    ],
    habilidades: [
      "<b>Investida equina.</b> Na fase de suporte, o aughisk avança na direção de um personagem, visando usar o peso de seu corpo para esmagá-lo. O personagem pode gastar sua ação para esquivar (por exemplo, pulando para o lado ou para trás de um obstáculo). Na fase de ataque corpo a corpo, o aughisk alcança o personagem, fazendo um teste de Atletismo (2d10) oposto ao teste de Acrobacia dele (que recebe +1d6 se tentou esquivar). Se o aughisk ganhar, causa RA+3 de dano de impacto e deixa o personagem atordoado por 1 rodada e caído.",
      "<b>Enxurrada de morte.</b> Esta habilidade gasta duas ações do aughisk, ambas na fase de suporte. Na primeira ação, ele ergue os braços e faz as águas ao redor da ilhota começarem a borbulhar… Na segunda, ele termina de conjurar o ritual, invocando uma onda de água escura e fétida que varre a ilhota. Todos os personagens precisam fazer um teste de Acrobacia (DT 13). Quem passar sofre 1d6 pontos de dano. Quem falhar sofre 2d6 pontos de dano e fica caído. Um personagem que gaste sua ação procurando abrigo contra a água, enquanto o aughisk ainda está na primeira ação, recebe +1d6 em seu teste de Acrobacia e, se passar, não sofre dano.",
      "<b>Presença aterradora.</b> No início da cena, todas as pessoas vendo o aughisk sofrem 2d6 pontos de dano emocional, Disciplina (DT 10) reduz à metade, NEX 35%+ evita.",
      "<b>Tributo mortal.</b> Se o aughisk começar uma rodada com 20 ou menos PV, todos os afogados que estejam na ilhota gastam sua ação na fase de suporte caminhando até ele. Os afogados explodem em lodo preto, que então é absorvido pelo aughisk. O aughisk recupera 10 PV por afogado destruído dessa forma.",
      "<b>Enigma de medo.</b> A manifestação está ligada à tocha (originalmente usada pelo monge para guiar os viajantes pelo pântano, e mais tarde pelos bandidos para atrair as vítimas para a emboscada) e ao crânio do cavalo que gerou o massacre entre os bandidos e a subsequente lenda — o esqueleto se decompôs, mas o crânio persiste, escondido em um buraco à frente da árvore sinistra que verte lodo negro. Se o crânio do cavalo que deu origem à manifestação for destruído, o aughisk fica atordoado por 1 rodada (exceto se já estiver atordoado) e perde sua redução de dano.",
    ],
  },
};
