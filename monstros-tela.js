// Modo mestre: lista de monstros (Aughisk + afogados) com PV editável, e ficha de cada monstro.
// Leitura direto da tabela "monstros"; mudanças pelas funções do banco que conferem a senha do mestre.
(function () {
  const $ = (id) => document.getElementById(id);
  const M = window.MONSTROS;
  let ctx = null;          // { banco, senha, aoVoltar }
  let lista = [];          // [{ id, tipo, nome, pv }]
  let abertoId = null;     // monstro com a ficha aberta
  let aba = "ficha";       // "ficha" (combate) | "descricao"
  let pendentes = 0;       // salvamentos em andamento (não recarrega por cima)
  let relogio = 0;
  const salvarTimers = {};

  const dados = (t) => t.replace(/\[d(\d+)\]/g, (_, n) => window.svgDado(n, "dado"));
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const ordenar = (a, b) => (a.tipo === b.tipo ? a.id - b.id : a.tipo === "aughisk" ? -1 : 1);

  function mostrar(qual) {
    $("tela-monstros").hidden = qual !== "lista";
    $("tela-monstro").hidden = qual !== "ficha";
    if (qual) { $("tela-escolha").hidden = true; $("tela-ficha").hidden = true; $("tela-nome").hidden = true; }
  }

  async function carregar() {
    const { data, error } = await ctx.banco.from("monstros").select("id, tipo, nome, pv");
    if (error) { console.error(error); return; }
    lista = data.sort(ordenar);
  }

  async function chamar(funcao, args) {
    pendentes++;
    const { data, error } = await ctx.banco.rpc(funcao, { p_senha: ctx.senha, ...args });
    pendentes--;
    if (error) { console.error(error); alert("Não foi possível salvar: " + error.message); return null; }
    return data;
  }

  // ---------- PV ----------
  function controlesPV(m) {
    const max = M[m.tipo].pv;
    return `<div class="pv-monstro">
        <span class="pv-rotulo">PV</span>
        <span class="pv-valor"><b>${m.pv}</b>/${max}</span>
        <span class="pv-barra"><i style="width:${Math.round((m.pv / max) * 100)}%"></i></span>
      </div>
      <div class="pv-botoes">
        <button type="button" data-d="-5">−5</button><button type="button" data-d="-1">−1</button>
        <button type="button" data-d="1">+1</button><button type="button" data-d="5">+5</button>
      </div>`;
  }
  function ligarPV(raiz, m, aoMudar) {
    raiz.querySelectorAll(".pv-botoes button").forEach((b) => b.addEventListener("click", (e) => {
      e.stopPropagation();
      const max = M[m.tipo].pv;
      const novo = Math.max(0, Math.min(max, m.pv + Number(b.dataset.d)));
      if (novo === m.pv) return;
      m.pv = novo;
      aoMudar();
      clearTimeout(salvarTimers[m.id]);
      pendentes++;
      salvarTimers[m.id] = setTimeout(async () => { pendentes--; await chamar("monstro_pv", { p_id: m.id, p_pv: m.pv }); }, 400);
    }));
  }
  function pintarPV(raiz, m) {
    const max = M[m.tipo].pv;
    raiz.querySelector(".pv-valor b").textContent = m.pv;
    raiz.querySelector(".pv-barra i").style.width = Math.round((m.pv / max) * 100) + "%";
    raiz.classList.toggle("derrotado", m.pv === 0);
  }

  // ---------- Lista ----------
  function desenharLista() {
    const caixa = $("lista-monstros");
    caixa.innerHTML = "";
    for (const m of lista) {
      const d = M[m.tipo];
      const card = document.createElement("div");
      card.className = "monstro-card" + (m.tipo === "aughisk" ? " chefe" : "") + (m.pv === 0 ? " derrotado" : "");
      card.innerHTML = `
        <button type="button" class="monstro-abrir" aria-label="Abrir ficha de ${esc(m.nome)}">
          <img src="${d.arte}" alt="">
          <span class="monstro-nome">${esc(m.nome)}</span>
          <span class="monstro-selo">Derrotado</span>
        </button>
        <div class="monstro-controles">${controlesPV(m)}</div>
        ${d.multiplos ? '<button type="button" class="monstro-remover" title="Remover este afogado">Remover</button>' : ""}`;
      card.querySelector(".monstro-abrir").addEventListener("click", () => abrirFicha(m.id));
      ligarPV(card, m, () => pintarPV(card, m));
      const rem = card.querySelector(".monstro-remover");
      if (rem) {
        rem.addEventListener("click", async () => {
          // primeiro clique pede confirmação
          if (!rem.classList.contains("confirmar")) {
            rem.classList.add("confirmar"); rem.textContent = "Confirmar remoção";
            setTimeout(() => { rem.classList.remove("confirmar"); rem.textContent = "Remover"; }, 3000);
            return;
          }
          lista = lista.filter((x) => x.id !== m.id);
          desenharLista();
          await chamar("monstro_remover", { p_id: m.id });
        });
      }
      caixa.append(card);
    }
    const novo = document.createElement("button");
    novo.type = "button";
    novo.className = "monstro-novo";
    novo.innerHTML = '<span>+</span>Adicionar afogado';
    novo.addEventListener("click", async () => {
      novo.disabled = true;
      const criado = await chamar("monstro_criar", { p_tipo: "afogado" });
      if (criado) { lista.push(criado); lista.sort(ordenar); }
      desenharLista();
    });
    caixa.append(novo);
  }

  // ---------- Ficha do monstro ----------
  function abrirFicha(id) {
    abertoId = id;
    aba = "ficha";
    mostrar("ficha");
    desenharFicha();
  }
  function desenharFicha() {
    const m = lista.find((x) => x.id === abertoId);
    if (!m) { abertoId = null; mostrar("lista"); return desenharLista(); }
    const d = M[m.tipo];
    const raiz = $("ficha-monstro");
    raiz.className = "ficha-monstro" + (m.pv === 0 ? " derrotado" : "") + " tipo-" + m.tipo;
    raiz.innerHTML = `
      <div class="fm-texto">
        <div class="fm-cabeca">
          <h2 class="fm-nome">${esc(m.nome)}</h2>
          <div class="fm-pv">${controlesPV(m)}</div>
        </div>
        ${aba === "ficha" ? `
        <p class="fm-atributos">${d.atributos.map(([n, v]) => `<span><b>${n}</b> ${window.svgDado(v, "dado")}</span>`).join("")}</p>
        <p class="fm-pericias">${dados(d.pericias)}</p>
        <h3 class="rotulo"><span>Ações</span></h3>
        ${d.acoes.map((a) => `<p>${dados(a)}</p>`).join("")}
        <h3 class="rotulo"><span>Habilidades</span></h3>
        ${d.habilidades.map((h) => `<p>${dados(h)}</p>`).join("")}` : `
        <h3 class="rotulo"><span>Descrição</span></h3>
        <p class="fm-lema">${esc(d.lema)}</p>
        <h3 class="rotulo"><span>Estratégia</span></h3>
        <p>${esc(d.estrategia)}</p>`}
      </div>
      <img class="fm-arte" src="${d.arte}" alt="">`;
    $("aba-m-ficha").setAttribute("aria-selected", String(aba === "ficha"));
    $("aba-m-descricao").setAttribute("aria-selected", String(aba === "descricao"));
    ligarPV(raiz.querySelector(".fm-pv"), m, () => {
      pintarPV(raiz.querySelector(".fm-pv"), m);
      raiz.classList.toggle("derrotado", m.pv === 0);
    });
    ajustarTexto();
  }

  // maior letra que cabe na coluna de texto, sem rolagem
  function ajustarTexto() {
    const t = document.querySelector(".fm-texto");
    if (!t) return;
    let lo = 10, hi = 30;
    for (let i = 0; i < 12; i++) {
      const meio = (lo + hi) / 2;
      t.style.fontSize = meio + "px";
      if (t.scrollHeight <= t.clientHeight + 1) lo = meio; else hi = meio;
    }
    t.style.fontSize = lo + "px";
  }
  window.addEventListener("resize", () => { if (!$("tela-monstro").hidden) ajustarTexto(); });

  // ---------- Entrada / saída ----------
  $("botao-voltar-personagens").addEventListener("click", () => {
    clearInterval(relogio);
    mostrar(null);
    $("tela-monstros").hidden = true;
    ctx.aoVoltar();
  });
  $("botao-voltar-monstros").addEventListener("click", () => { abertoId = null; mostrar("lista"); desenharLista(); });
  $("aba-m-ficha").addEventListener("click", () => { aba = "ficha"; desenharFicha(); });
  $("aba-m-descricao").addEventListener("click", () => { aba = "descricao"; desenharFicha(); });

  window.abrirMonstros = async (contexto) => {
    ctx = contexto;
    mostrar("lista");
    await carregar();
    desenharLista();
    clearInterval(relogio);
    relogio = setInterval(async () => {
      if (pendentes || document.hidden || ($("tela-monstros").hidden && $("tela-monstro").hidden)) return;
      const antes = JSON.stringify(lista);
      await carregar();
      if (JSON.stringify(lista) === antes) return;
      if (!$("tela-monstros").hidden) desenharLista(); else desenharFicha();
    }, 4000);
  };
})();
