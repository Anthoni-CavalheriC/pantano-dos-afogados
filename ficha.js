// Monta uma página da ficha (ficha ou história) em HTML a partir de window.FICHAS.
//
// Como funciona:
// - Elementos decorativos (nome, atributos, perícias, títulos, barras...) são recortes da
//   camada original do PDF: mantêm a letra e o desenho exatos e a proporção.
// - Textos corridos são HTML de verdade (Barlow, a fonte das fichas).
// - Verticalmente tudo escala igual (pela altura da janela). Horizontalmente, a parte com
//   texto ganha a largura que sobra da tela; a arte do personagem mantém a proporção.
//   Assim cada coisa continua no mesmo lugar, mas o texto tem mais largura e pode crescer.
// - O tamanho da letra é o maior que faz todos os blocos caberem nas suas caixas.
(function () {
  const MOLDURA = 40;   // espaço da moldura da janela (px)

  function limites(pag) {
    const todos = [...pag.elementos.map(([u0, v0, u1, v1]) => ({ u0, v0, u1, v1 })), ...pag.textos];
    if (pag.arte) todos.push(pag.arte);
    return {
      u0: Math.min(...todos.map((c) => c.u0)) - 10,
      u1: Math.min(880, Math.max(...todos.map((c) => c.u1)) + 6),
      v0: Math.min(...todos.map((c) => c.v0)) - 8,
      v1: Math.min(615, Math.max(...todos.map((c) => c.v1)) + 8),
      // onde termina a parte "esticável" (texto); depois disso, só a arte
      corte: pag.arte ? Math.max(...pag.textos.map((t) => t.u1)) + 6 : null,
    };
  }

  // Calcula a transformação página -> tela
  function escala(pag, W, H) {
    const b = limites(pag);
    const esq = MOLDURA, dir = W - MOLDURA, topo = MOLDURA * 0.85;
    const base = pag.arte ? H : H - MOLDURA * 0.85; // a arte pode encostar embaixo
    const sy = (base - topo) / (b.v1 - b.v0);
    const corte = b.corte && b.corte < b.u1 ? b.corte : b.u1;
    let kx = ((dir - esq) - (b.u1 - corte) * sy) / (corte - b.u0);
    let s = sy, ox = esq, oy = topo;
    if (kx < sy) {
      // janela estreita: escala uniforme, centralizada
      s = Math.min((dir - esq) / (b.u1 - b.u0), (base - topo) / (b.v1 - b.v0));
      kx = s;
      ox = esq + ((dir - esq) - (b.u1 - b.u0) * s) / 2;
      oy = topo + ((base - topo) - (b.v1 - b.v0) * s) / 2;
    }
    const X = (u) => ox + (u <= corte ? (u - b.u0) * kx : (corte - b.u0) * kx + (u - corte) * s);
    const Y = (v) => oy + (v - b.v0) * s;
    return { X, Y, s, kx, corte, b };
  }

  // Espaço livre de cada bloco de texto: estende para a direita e para baixo até o próximo
  // elemento (título, outro texto, borda da coluna), sem invadir nada.
  function espacoLivre(pag) {
    const b = limites(pag);
    const obst = [
      ...pag.elementos.map(([u0, v0, u1, v1]) => ({ u0, v0, u1, v1 })),
      ...pag.textos.map((t) => ({ u0: t.u0, v0: t.v0, u1: t.u1, v1: t.v1, ref: t })),
    ];
    const limiteDir = b.corte ? b.corte - 2 : b.u1 - 14;
    const cruzaV = (a, o) => o.v0 < a.v1 - 1 && o.v1 > a.v0 + 1;
    const cruzaU = (a, o) => o.u0 < a.u1 - 1 && o.u1 > a.u0 + 1;
    return pag.textos.map((t) => {
      const caixa = { u0: t.u0, v0: t.v0, u1: t.u1, v1: t.v1 };
      // direita
      let dir = Math.max(t.u1, limiteDir);
      for (const o of obst) if (o.ref !== t && o.u0 >= t.u1 - 1 && cruzaV(caixa, o)) dir = Math.min(dir, o.u0 - 5);
      caixa.u1 = Math.max(t.u1, dir);
      // baixo (linhas das relações ficam do tamanho delas)
      if (!t.wak) {
        let baixo = b.v1 - 6;
        for (const o of obst) if (o.ref !== t && o.v0 >= t.v1 - 1 && cruzaU(caixa, o)) baixo = Math.min(baixo, o.v0 - 7);
        caixa.v1 = Math.max(t.v1, baixo);
      }
      return caixa;
    });
  }

  // Coluna de habilidades como um fluxo: títulos (recortes originais) e textos na mesma
  // ordem e coluna, mas o espaço que sobra num bloco pode ser usado pelos outros.
  function separarFluxo(pag) {
    if (!pag.arte) return null;               // só na página da ficha
    const corpo = pag.textos.filter((t) => !t.wak);
    if (!corpo.length) return null;
    const b = limites(pag);
    const colU0 = Math.min(...corpo.map((t) => t.u0));
    const principais = corpo.filter((t) => t.u0 <= colU0 + 15);
    const ini = Math.min(...principais.map((t) => t.v0));
    const fim = b.v1 - 6;
    const dir = b.corte - 2;
    const textos = principais.filter((t) => t.v0 >= ini);
    const elementos = pag.elementos
      .map(([u0, v0, u1, v1], i) => ({ u0, v0, u1, v1, i }))
      .filter((e) => e.v0 >= ini - 2 && e.u0 >= colU0 - 15 && e.u1 <= b.corte + 12 && e.v1 <= fim);
    const itens = [...textos.map((t) => ({ tipo: "texto", t, v0: t.v0, v1: t.v1, u0: t.u0 })),
                   ...elementos.map((e) => ({ tipo: "deco", e, v0: e.v0, v1: e.v1, u0: e.u0 }))]
      .sort((a, b2) => a.v0 - b2.v0);
    return { colU0, ini, fim, dir, itens, textos: new Set(textos), elementos: new Set(elementos.map((e) => e.i)) };
  }

  // Ícone de dado em SVG: forma do dado (d4 triângulo, d6 quadrado, d8 losango, d10, d12, d20)
  // com o número centralizado — nítido em qualquer tamanho.
  const FORMAS = {
    // [forma, y da linha de base do número, tamanho do número]
    4: ['<polygon points="12,0.5 23.8,22.5 0.2,22.5"/>', 20, 11],
    6: ['<rect x="1" y="1" width="22" height="22" rx="3"/>', 17.4, 15],
    8: ['<polygon points="12,0 24,12 12,24 0,12"/>', 16.7, 13],
    10: ['<polygon points="12,0 24,9.5 12,24 0,9.5"/>', 15.6, 12.5],
    12: ['<polygon points="12,0.5 23.5,8.8 19.3,23 4.7,23 0.5,8.8"/>', 17.3, 12.5],
    20: ['<polygon points="12,0.5 23,6.3 23,17.7 12,23.5 1,17.7 1,6.3"/>', 16.8, 12.5],
  };
  function svgDado(n, classe) {
    const [forma, y, tam] = FORMAS[n] || FORMAS[6];
    const t = String(n).length > 1 ? tam * 0.78 : tam;
    return `<svg class="${classe}" viewBox="0 0 24 24" aria-label="d${n}" role="img">${forma}` +
      `<text x="12" y="${y}" font-size="${t}" text-anchor="middle">${n}</text></svg>`;
  }
  const trocarDados = (el) => el.querySelectorAll("span.dado").forEach((d) => {
    const n = d.textContent.trim();
    d.outerHTML = svgDado(n, "dado");
  });

  function montar(alvo, pag, opcoes) {
    const livres = espacoLivre(pag);
    const fluxo = separarFluxo(pag);
    alvo.innerHTML = "";
    const camada = document.createElement("div");
    camada.className = "pagina-ficha";
    alvo.append(camada);

    let arte = null;
    if (pag.arte) {
      arte = document.createElement("img");
      arte.className = "pf-arte";
      arte.src = pag.arte.src;
      arte.alt = "";
      camada.append(arte);
    }

    const sprite = (el) => { el.className = "pf-deco"; el.style.backgroundImage = `url("${pag.deco}")`; return el; };

    const decos = [];
    pag.elementos.forEach(([u0, v0, u1, v1], i) => {
      if (fluxo && fluxo.elementos.has(i)) return;
      const d = sprite(document.createElement("div"));
      camada.append(d);
      decos.push({ el: d, u0, v0, u1, v1 });
    });

    // Grupos de elementos decorativos próximos (nome + classe + nível; atributos + PV/PD +
    // perícias...): cada grupo se move como um bloco só, mantendo a arrumação do PDF.
    // Faixas/linhas finas acompanham a largura; títulos alinhados a um texto seguem o texto.
    for (const d of decos) {
      // faixas/linhas bem finas (sublinhado, faixa das relações) acompanham a largura
      d.fino = (d.u1 - d.u0) / (d.v1 - d.v0) > 20;
      // título de habilidade: baixo e logo acima de um texto alinhado
      d.solto = d.fino || ((d.v1 - d.v0) < 26 &&
        pag.textos.some((t) => Math.abs(t.u0 - d.u0) < 20 && t.v0 >= d.v0 - 4 && t.v0 - d.v1 < 25));
      d.grupo = { u0: d.u0, membros: [d] };
    }
    const juntaveis = decos.filter((d) => !d.solto);
    const perto = (a, b2) => {
      const gapU = Math.max(a.u0, b2.u0) - Math.min(a.u1, b2.u1);
      const gapV = Math.max(a.v0, b2.v0) - Math.min(a.v1, b2.v1);
      return (gapV < 0 && gapU < 45) || (gapU < 0 && gapV < 15);
    };
    let mudou = true;
    while (mudou) {
      mudou = false;
      for (const a of juntaveis) for (const b2 of juntaveis) {
        if (a.grupo === b2.grupo || !perto(a, b2)) continue;
        const g = a.grupo, h = b2.grupo;
        for (const m of h.membros) { m.grupo = g; g.membros.push(m); }
        g.u0 = Math.min(g.u0, h.u0);
        mudou = true;
      }
    }

    const textos = [];
    pag.textos.forEach((t, i) => {
      if (fluxo && fluxo.textos.has(t)) return;
      const d = document.createElement("div");
      d.className = "pf-texto" + (t.wak ? " pf-linha" : "");
      d.innerHTML = t.html;
      trocarDados(d);
      camada.append(d);
      textos.push({ el: d, ...t, livre: livres[i] });
    });

    // Perícias: lista em texto (o título "PERÍCIAS" continua sendo o recorte original)
    let caixaPer = null;
    if (pag.pericias) {
      caixaPer = document.createElement("div");
      caixaPer.className = "pf-pericias";
      caixaPer.innerHTML = pag.pericias.itens.map((p) =>
        `<span class="per-nome">${p.nome}</span>${svgDado(p.dado, "dado-p")}<span class="per-mais">+</span>` +
        `${svgDado(p.dadoAtributo, "dado-p menor")}<span class="per-attr">${p.atributo}</span>`).join("");
      camada.append(caixaPer);
    }

    let caixaFluxo = null, itensFluxo = [];
    if (fluxo) {
      caixaFluxo = document.createElement("div");
      caixaFluxo.className = "pf-fluxo";
      camada.append(caixaFluxo);
      itensFluxo = fluxo.itens.map((it) => {
        let el;
        if (it.tipo === "texto") {
          el = document.createElement("div");
          el.className = "pf-texto pf-no-fluxo";
          el.innerHTML = it.t.html;
          trocarDados(el);
        } else {
          el = sprite(document.createElement("div"));
          el.classList.add("pf-no-fluxo");
        }
        caixaFluxo.append(el);
        return { ...it, el };
      });
    }

    function layout() {
      const W = alvo.clientWidth, H = alvo.clientHeight;
      const { X, Y, s, kx, corte } = escala(pag, W, H);

      if (arte) {
        const a = pag.arte;
        const w = (a.u1 - a.u0) * s, h = (a.v1 - a.v0) * s;
        const direita = X(Math.min(a.u1, 880));
        Object.assign(arte.style, { left: direita - w + "px", top: Y(a.v0) + "px", width: w + "px", height: h + "px" });
        arte.dataset.l = direita - w; arte.dataset.w = w;
      }

      const posSprite = (el, d, sx, sy2) => Object.assign(el.style, {
        width: (d.u1 - d.u0) * sx + "px", height: (d.v1 - d.v0) * sy2 + "px",
        backgroundSize: `${880 * sx}px ${615 * sy2}px`,
        backgroundPosition: `${-d.u0 * sx}px ${-d.v0 * sy2}px`,
      });

      for (const d of decos) {
        const sx = d.fino ? (X(d.u1) - X(d.u0)) / (d.u1 - d.u0) : s;
        // membros de um grupo mantêm a arrumação original em relação ao início do grupo
        const left = d.fino ? X(d.u0) : X(d.grupo.u0) + (d.u0 - d.grupo.u0) * s;
        posSprite(d.el, d, sx, s);
        d.left = left;
        Object.assign(d.el.style, { left: left + "px", top: Y(d.v0) + "px" });
      }

      for (const t of textos) {
        const c = t.livre;
        Object.assign(t.el.style, {
          left: X(c.u0) + "px", top: Y(c.v0) - t.size * s * 0.12 + "px",
          width: X(c.u1) - X(c.u0) + "px",
          height: (c.v1 - c.v0) * s + t.size * s * (c.v1 > t.v1 + 2 ? 0 : 0.3) + "px",
        });
      }

      if (caixaFluxo) {
        Object.assign(caixaFluxo.style, {
          left: X(fluxo.colU0) + "px", top: Y(fluxo.ini) - 10 * s * 0.12 + "px",
          width: X(fluxo.dir) - X(fluxo.colU0) + "px",
          // termina acima da moldura de baixo da janela
          height: Math.min((fluxo.fim - fluxo.ini) * s, H - MOLDURA - 8 - Y(fluxo.ini)) + "px",
        });
      }

      const corpo = textos.filter((t) => !t.wak), linhas = textos.filter((t) => t.wak);
      const cabeEm = (lista) => lista.every((t) => t.el.scrollHeight <= t.el.clientHeight + 1 && t.el.scrollWidth <= t.el.clientWidth + 1);

      // aplica um ganho g ao corpo do texto (inclusive ao fluxo)
      const aplicaCorpo = (g) => {
        for (const t of corpo) t.el.style.fontSize = t.size * s * g + "px";
        let ant = null;
        const gt = Math.min(g, 1.35);   // títulos crescem um pouco menos que o texto
        for (const it of itensFluxo) {
          const gap = ant ? Math.max(0, it.v0 - ant.v1) * s * g : 0;
          if (it.tipo === "texto") {
            Object.assign(it.el.style, { fontSize: it.t.size * s * g + "px", marginTop: gap + "px",
              marginLeft: (it.u0 - fluxo.colU0) * s + "px" });
          } else {
            posSprite(it.el, it.e, s * gt, s * gt);
            Object.assign(it.el.style, { marginTop: gap + "px", marginLeft: (it.u0 - fluxo.colU0) * s * gt + "px" });
          }
          ant = it;
        }
      };
      const cabeCorpo = () => cabeEm(corpo) && (!caixaFluxo ||
        (caixaFluxo.scrollHeight <= caixaFluxo.clientHeight + 1 && caixaFluxo.scrollWidth <= caixaFluxo.clientWidth + 1));

      const ajusta = (aplica, cabe) => {
        let lo = 0.5, hi = 2.6;
        aplica(1);
        if (!cabe()) hi = 1;
        for (let i = 0; i < 14; i++) {
          const m = (lo + hi) / 2;
          aplica(m);
          if (cabe()) lo = m; else hi = m;
        }
        aplica(lo);
        return lo;
      };
      const g = ajusta(aplicaCorpo, cabeCorpo);

      if (caixaPer) {
        const per = pag.pericias;
        // título "PERÍCIAS": elemento logo acima da lista
        const titulo = decos.filter((d) => d.v1 <= per.v0 + 4 && d.u1 > per.u0 && d.u0 < per.u1)
          .sort((a, b2) => b2.v1 - a.v1)[0];
        const left = titulo ? titulo.left + (per.u0 - titulo.u0) * s - 6 : X(per.u0);
        const top = Y(per.v0) - 2;
        const limiteDir = fluxo ? X(fluxo.colU0) - 16 : left + (per.u1 - per.u0) * s * 1.6;
        Object.assign(caixaPer.style, {
          left: left + "px", top: top + "px",
          width: Math.max(40, limiteDir - left) + "px", height: H - MOLDURA - 8 - top + "px",
        });
        const base = 9 * s;
        const tamanho = (k) => { caixaPer.style.fontSize = base * k + "px"; };
        const cabePer = () => caixaPer.scrollHeight <= caixaPer.clientHeight + 1 && caixaPer.scrollWidth <= caixaPer.clientWidth + 1;
        ajusta(tamanho, cabePer);
      }
      if (linhas.length) {
        ajusta((g2) => { for (const t of linhas) t.el.style.fontSize = t.size * s * Math.min(g2, g) + "px"; }, () => cabeEm(linhas));
      }
      camada.dataset.ganho = g.toFixed(2);
      // Onde um ponto da página (ex.: o nome, o bloco de PV) aparece na tela: usa o elemento
      // decorativo que o contém, para acompanhar exatamente a posição do desenho.
      const localizar = (c) => {
        const cx = (c.u0 + c.u1) / 2, cy = (c.v0 + c.v1) / 2;
        const dentro = (e) => e.u0 <= cx && cx <= e.u1 && e.v0 <= cy && cy <= e.v1;
        // procura o elemento decorativo (solto, em grupo ou dentro da coluna em fluxo) que contém o ponto
        const cands = [
          ...decos.filter((e) => !e.fino).map((e) => ({ e, el: e.el })),
          ...itensFluxo.filter((it) => it.tipo === "deco").map((it) => ({ e: it.e, el: it.el })),
        ];
        const achado = cands.find((k) => dentro(k.e));
        if (achado) {
          const base = camada.getBoundingClientRect(), r = achado.el.getBoundingClientRect();
          const esc = r.width / (achado.e.u1 - achado.e.u0);
          return { left: r.left - base.left + (c.u0 - achado.e.u0) * esc, top: r.top - base.top + (c.v0 - achado.e.v0) * esc,
                   width: (c.u1 - c.u0) * esc, height: (c.v1 - c.v0) * esc, s: esc,
                   deco: { u0: achado.e.u0, v0: achado.e.v0, u1: achado.e.u1, v1: achado.e.v1 } };
        }
        return { left: X(c.u0), top: Y(c.v0), width: (c.u1 - c.u0) * s, height: (c.v1 - c.v0) * s, s, deco: null };
      };
      if (opcoes && opcoes.depois) opcoes.depois({ X, Y, s, kx, arte, localizar, camada });
    }

    layout();
    return { layout };
  }

  window.montarPaginaFicha = montar;
  window.svgDado = svgDado;
})();
