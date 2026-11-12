// O Pântano dos Afogados — nome -> faixa de personagens -> ficha em tela cheia -> jogar.
(function () {
  const $ = (id) => document.getElementById(id);
  const CHAVE_NOME = "mesa-rpg:nome";

  const cfg = window.CONFIG || {};
  const banco = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseChavePublica);
  const PERSONAGENS = window.PERSONAGENS;

  let escolhas = {};       // { personagem_id: nome_do_jogador }
  let nomeJogador = "";
  let tela = "nome";       // "nome" | "escolha" | "ficha"
  let abertoId = null;
  let pagina = "ficha";    // "ficha" | "historia"
  let confirmando = false; // primeiro clique em "Jogar" pede confirmação
  let mestre = false;      // modo mestre: vê tudo, nunca fica preso, não escolhe
  let extras = {};         // { personagem_id: { segredo, pv, pd } } — ficha interativa
  let interativo = false;  // ficha do jogador já "despertou" nesta visita
  let segredoAchado = false; // botão secreto já apareceu nesta visita

  // ---------- Banco ----------
  async function carregarEscolhas() {
    const { data, error } = await banco.from("escolhas").select("personagem_id, jogador, segredo, pv, pd");
    if (error) { console.error(error); return false; }
    escolhas = {};
    const novos = {};
    for (const linha of data) {
      escolhas[linha.personagem_id] = linha.jogador;
      novos[linha.personagem_id] = { segredo: !!linha.segredo, pv: linha.pv, pd: linha.pd };
      // enquanto o jogador está mexendo nos contadores, vale o valor local
      if (salvando && extras[linha.personagem_id]) {
        novos[linha.personagem_id].pv = extras[linha.personagem_id].pv;
        novos[linha.personagem_id].pd = extras[linha.personagem_id].pd;
      }
      if (extras[linha.personagem_id] && extras[linha.personagem_id].segredo) novos[linha.personagem_id].segredo = true;
    }
    extras = novos;
    return true;
  }

  async function registrarEscolha(personagemId) {
    const { error } = await banco.from("escolhas").insert({ personagem_id: personagemId, jogador: nomeJogador });
    if (!error) return null;
    if (error.code === "23505") {
      return String(error.message).includes("jogador")
        ? "Já existe uma escolha com o nome " + nomeJogador + "."
        : "Que pena! Outra pessoa escolheu esse personagem um instante antes de você.";
    }
    console.error(error);
    return "Não foi possível confirmar agora. Tente de novo.";
  }

  // salva segredo/PV/PD do próprio jogador (função do banco que só mexe na linha dele)
  let salvando = null;
  function salvarFicha(id, campos, imediato) {
    clearTimeout(salvando);
    const envia = async () => {
      const e = extras[id] || {};
      const { error } = await banco.rpc("atualizar_ficha", {
        p_personagem: id, p_jogador: nomeJogador,
        p_segredo: campos.segredo ?? null, p_pv: e.pv ?? null, p_pd: e.pd ?? null,
      });
      if (error) console.error(error);
      salvando = null;
    };
    if (imediato) envia(); else salvando = setTimeout(envia, 500);
  }

  // ---------- Ajudantes ----------
  const mesmoNome = (a, b) => (a || "").trim().toLowerCase() === (b || "").trim().toLowerCase();
  const porId = (id) => PERSONAGENS.find((p) => p.id === id);
  const meuId = () => PERSONAGENS.map((p) => p.id).find((id) => escolhas[id] && mesmoNome(escolhas[id], nomeJogador)) || null;
  const img = (id, tipo) => "img/" + id + "-" + tipo + ".webp";
  const preCarregar = (src) => { const i = new Image(); i.src = src; };

  function mostrar(qual) {
    tela = qual;
    $("tela-nome").hidden = qual !== "nome";
    $("tela-escolha").hidden = qual !== "escolha";
    $("tela-ficha").hidden = qual !== "ficha";
  }

  // Decide a tela certa: quem já escolheu fica preso na própria ficha.
  function atualizar() {
    if (mestre) {
      if (tela === "ficha" && abertoId) { mostrar("ficha"); return desenharFicha(); }
      mostrar("escolha");
      return desenharFaixa();
    }
    if (!nomeJogador) return mostrar("nome");
    const meu = meuId();
    if (meu) {
      if (abertoId !== meu) { abertoId = meu; pagina = "ficha"; }
      mostrar("ficha");
      return desenharFicha();
    }
    if (tela === "ficha" && abertoId && escolhas[abertoId]) {
      // alguém escolheu este personagem enquanto a ficha estava aberta
      avisar(porId(abertoId).nome + " acabou de ser escolhido por " + escolhas[abertoId] + ".");
      abertoId = null; confirmando = false;
    }
    if (tela === "ficha" && abertoId) { mostrar("ficha"); return desenharFicha(); }
    mostrar("escolha");
    desenharFaixa();
  }

  // aviso rápido na tela de escolha
  let avisoTempo = 0;
  function avisar(texto) {
    const el = $("aviso");
    el.textContent = texto;
    el.hidden = false;
    clearTimeout(avisoTempo);
    avisoTempo = setTimeout(() => { el.hidden = true; }, 6000);
  }

  // ---------- Tela 1: nome ----------
  const campoNome = $("campo-nome");
  campoNome.addEventListener("input", () => { $("botao-nome").disabled = !campoNome.value.trim(); });
  $("form-nome").addEventListener("submit", async (e) => {
    e.preventDefault();
    const nome = campoNome.value.trim().slice(0, 40);
    if (!nome) return;
    await entrar(nome);
  });

  async function entrar(nome) {
    nomeJogador = nome;
    try { localStorage.setItem(CHAVE_NOME, nome); } catch {}
    $("nome-jogador").textContent = nome;
    await carregarEscolhas();
    tela = "escolha";
    atualizar();
  }

  $("botao-trocar-nome").addEventListener("click", () => {
    try { localStorage.removeItem(CHAVE_NOME); } catch {}
    nomeJogador = ""; abertoId = null;
    campoNome.value = ""; $("botao-nome").disabled = true;
    mostrar("nome");
    campoNome.focus();
  });

  // ---------- Tela 2: faixa de personagens ----------
  function desenharResumoMestre() {
    const livres = PERSONAGENS.filter((p) => !escolhas[p.id]);
    const total = PERSONAGENS.length, feitos = total - livres.length;
    $("mestre-contagem").textContent = feitos + " de " + total + " personagens escolhidos";
    $("mestre-faltam").textContent = livres.length
      ? "Ainda livres: " + livres.map((p) => p.nome).join(", ")
      : "Todos os personagens foram escolhidos.";
    $("mestre-faltam").classList.toggle("completo", !livres.length);
  }

  function desenharFaixa() {
    if (mestre) desenharResumoMestre();
    const faixa = $("faixa");
    faixa.innerHTML = "";
    for (const p of PERSONAGENS) {
      const dono = escolhas[p.id];
      const painel = document.createElement("button");
      painel.type = "button";
      painel.className = "painel" + (dono ? " tomado" : "");
      painel.setAttribute("aria-label", p.nome + " " + p.sobrenome + (dono ? " — escolhido por " + dono : ""));

      const foto = document.createElement("img");
      foto.src = img(p.id, "retrato");
      foto.alt = "";
      painel.append(foto);

      if (!dono && mestre) {
        const selo = document.createElement("span");
        selo.className = "selo livre";
        selo.textContent = "Livre";
        painel.append(selo);
      }
      if (dono) {
        const selo = document.createElement("span");
        selo.className = "selo";
        selo.innerHTML = "<small>Escolhido por</small>";
        selo.append(dono);
        painel.append(selo);
      }

      const legenda = document.createElement("span");
      legenda.className = "painel-legenda";
      legenda.innerHTML = '<span class="painel-nome"></span><span class="painel-sobrenome"></span><span class="painel-classe"></span>';
      legenda.children[0].textContent = p.nome;
      legenda.children[1].textContent = (p.titulo ? p.titulo + ", " : "") + p.sobrenome;
      legenda.children[2].textContent = p.classe + " · " + p.origem;
      const nivel = document.createElement("span");
      nivel.className = "nivel";
      nivel.innerHTML = "<small>Nível</small><b></b>";
      nivel.querySelector("b").textContent = p.nivel;
      legenda.prepend(nivel);
      painel.append(legenda);

      painel.addEventListener("mouseenter", () => {
        const f = window.FICHAS[p.id].ficha;
        preCarregar(f.deco); if (f.arte) preCarregar(f.arte.src);
      }, { once: true });
      if (dono && !mestre) {
        // já escolhido: o jogador não pode abrir a ficha
        painel.classList.add("bloqueado");
        painel.setAttribute("aria-disabled", "true");
        painel.tabIndex = -1;
      } else {
        painel.addEventListener("click", () => abrirFicha(p.id));
      }
      faixa.append(painel);
    }
  }

  // ---------- Tela 3: ficha ----------
  function abrirFicha(id) {
    if (!mestre && escolhas[id]) return;
    abertoId = id; pagina = "ficha"; confirmando = false;
    $("ficha-erro").hidden = true;
    mostrar("ficha");
    desenharFicha();
    preCarregar(window.FICHAS[id].historia.deco);
  }

  // Página montada em HTML (ficha.js). Remonta só quando muda personagem ou página.
  let montada = null, montadaChave = "";
  function montarPagina(p) {
    const chave = p.id + ":" + pagina;
    if (chave === montadaChave && montada) return;
    montadaChave = chave;
    const dados = window.FICHAS[p.id][pagina];
    const arteFicha = window.FICHAS[p.id].ficha.arte;
    montada = window.montarPaginaFicha($("palco"), dados, {
      // botão Jogar no peito do personagem (na ficha); na história, no mesmo canto
      depois: (info) => {
        camadaSecreta(p, info);
        const { arte } = info;
        const acao = $("acao");
        if (arte) {
          const l = +arte.dataset.l, w = +arte.dataset.w;
          Object.assign(acao.style, { left: l + w * 0.3 + "px", width: Math.max(130, w * 0.5) + "px", right: "auto", bottom: "max(48px, 8vh)" });
        } else if (arteFicha) {
          acao.removeAttribute("style");
        }
      },
    });
  }
  // ---------- Segredo: nome por 5 s -> botão -> fumaça -> ficha interativa ----------
  function camadaSecreta(p, info) {
    const { camada, localizar, s } = info;
    camada.querySelectorAll(".zona-segredo, .botao-segredo, .contador").forEach((e) => e.remove());
    const marcos = window.FICHAS[p.id].ficha.marcos;
    if (mestre || pagina !== "ficha" || meuId() !== p.id || !marcos) return;
    const ext = extras[p.id] || {};

    // zona invisível sobre o nome principal (só enquanto o segredo não foi descoberto)
    if (!ext.segredo && !interativo && marcos.nome) {
      const r = localizar(marcos.nome);
      const zona = document.createElement("div");
      zona.className = "zona-segredo";
      Object.assign(zona.style, { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px" });
      let timer = 0;
      const comeca = () => { clearTimeout(timer); timer = setTimeout(() => { segredoAchado = true; montada.layout(); }, 5000); };
      const para = () => clearTimeout(timer);
      zona.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") comeca(); });
      zona.addEventListener("pointerleave", para);
      zona.addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse") comeca(); });
      zona.addEventListener("pointerup", (e) => { if (e.pointerType !== "mouse") para(); });
      zona.addEventListener("pointercancel", para);
      zona.addEventListener("contextmenu", (e) => e.preventDefault());
      camada.append(zona);

      if (segredoAchado) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "botao-segredo";
        b.textContent = "Despertar";
        Object.assign(b.style, { left: r.left + r.width * 0.15 + "px", top: r.top + r.height + 6 + "px" });
        b.addEventListener("click", () => {
          extras[p.id] = { ...(extras[p.id] || {}), segredo: true };
          salvarFicha(p.id, { segredo: true }, true);
          despertar();
        });
        camada.append(b);
      }
    }

    // ficha interativa: contadores de PV e PD sobre os blocos originais
    if (interativo) {
      for (const chave of ["pv", "pd"]) {
        const m = marcos[chave];
        if (!m) continue;
        const outro = marcos[chave === "pv" ? "pd" : "pv"];
        const loc0 = localizar(m.rotulo);
        let u1 = loc0.deco ? loc0.deco.u1 : m.valor.u1 + 120;
        if (outro && Math.abs(outro.rotulo.v0 - m.rotulo.v0) < 10 && outro.rotulo.u0 > m.rotulo.u0) u1 = Math.min(u1, outro.rotulo.u0 - 6);
        const caixa = { u0: m.rotulo.u0 - 5, v0: m.valor.v0 - 8, u1, v1: m.valor.v1 + 8 };
        const r = localizar({ ...caixa, u1: m.rotulo.u1 });
        const largura = (caixa.u1 - caixa.u0) * s, altura = (caixa.v1 - caixa.v0) * s;
        const atual = ext[chave] ?? m.max;

        const c = document.createElement("div");
        c.className = "contador";
        Object.assign(c.style, { left: r.left + "px", top: r.top + "px", width: largura + "px", height: altura + "px",
          // cabe na largura do bloco (rótulo, −, valor, + ocupam ~10,4 em)
          fontSize: Math.min(altura * 0.42, largura / 10.4) + "px" });
        const pct = (v) => Math.round((v / m.max) * 100) + "%";
        c.innerHTML = '<span class="contador-rotulo">' + chave.toUpperCase() + '</span>' +
          '<button type="button" class="contador-menos" aria-label="Diminuir ' + chave.toUpperCase() + '">−</button>' +
          '<span class="contador-valor"><b>' + atual + '</b>/' + m.max + '</span>' +
          '<button type="button" class="contador-mais" aria-label="Aumentar ' + chave.toUpperCase() + '">+</button>' +
          '<span class="contador-barra"><i style="width:' + pct(atual) + '"></i></span>';
        const muda = (delta) => {
          const e = extras[p.id] || (extras[p.id] = {});
          const antes = e[chave] ?? m.max;
          const novo = Math.max(0, Math.min(m.max, antes + delta));
          if (novo === antes) return;
          e[chave] = novo;
          c.querySelector(".contador-valor b").textContent = novo;
          c.querySelector(".contador-barra i").style.width = pct(novo);
          salvarFicha(p.id, {});
        };
        c.querySelector(".contador-menos").addEventListener("click", () => muda(-1));
        c.querySelector(".contador-mais").addEventListener("click", () => muda(+1));
        camada.append(c);
      }
    }
  }

  // fumaça cobre a tela; no meio dela a ficha vira interativa
  function despertar() {
    const nevoa = document.createElement("div");
    nevoa.className = "fumaca";
    for (let i = 0; i < 22; i++) {
      const f = document.createElement("span");
      const tam = 30 + Math.random() * 45;
      f.style.left = Math.random() * 100 + "%";
      f.style.top = Math.random() * 100 + "%";
      f.style.width = tam + "vmax";
      f.style.height = tam + "vmax";
      f.style.animationDelay = Math.random() * 0.35 + "s";
      f.style.setProperty("--dx", (Math.random() - 0.5) * 30 + "vmax");
      f.style.setProperty("--dy", (Math.random() - 0.5) * 20 - 10 + "vmax");
      nevoa.append(f);
    }
    document.body.append(nevoa);
    setTimeout(() => {
      interativo = true; segredoAchado = false;
      if (montada) montada.layout();
      desenharFicha();
    }, 1300);
    setTimeout(() => nevoa.remove(), 3400);
  }

  let quadro = 0;
  window.addEventListener("resize", () => {
    cancelAnimationFrame(quadro);
    quadro = requestAnimationFrame(() => { if (montada && tela === "ficha") montada.layout(); });
  });
  if (document.fonts) document.fonts.ready.then(() => { if (montada && tela === "ficha") montada.layout(); });

  $("botao-voltar").addEventListener("click", () => {
    abertoId = null; confirmando = false;
    mostrar("escolha");
    desenharFaixa();
  });
  $("aba-ficha").addEventListener("click", () => { pagina = "ficha"; desenharFicha(); });
  $("aba-historia").addEventListener("click", () => { pagina = "historia"; desenharFicha(); });
  document.addEventListener("keydown", (e) => {
    if (tela !== "ficha") return;
    if (e.key === "ArrowRight") { pagina = "historia"; desenharFicha(); }
    if (e.key === "ArrowLeft") { pagina = "ficha"; desenharFicha(); }
    if (e.key === "Escape" && (mestre || !meuId())) $("botao-voltar").click();
  });

  function desenharFicha() {
    const p = porId(abertoId);
    if (!p) return;
    montarPagina(p);
    $("aba-ficha").setAttribute("aria-selected", String(pagina === "ficha"));
    $("aba-historia").setAttribute("aria-selected", String(pagina === "historia"));
    $("tela-ficha").dataset.pagina = pagina;

    const dono = escolhas[p.id];
    const meu = mestre ? null : meuId();
    const status = $("ficha-status");
    const jogar = $("botao-jogar");
    const cancelar = $("botao-cancelar");
    $("botao-voltar").hidden = Boolean(meu);
    if (mestre) {
      // o mestre só observa: mostra o dono (ou "Livre") e nunca o botão Jogar
      cancelar.hidden = true;
      jogar.hidden = true;
      status.textContent = dono ? "Escolhido por " + dono : "Ainda livre";
      status.className = "status " + (dono ? "ocupado" : "livre");
      return;
    }
    jogar.classList.toggle("confirmando", confirmando);
    cancelar.hidden = !confirmando;

    if (meu === p.id) {
      const ext = extras[p.id] || {};
      if (ext.segredo && !interativo) {
        // já descobriu o segredo: "Seu personagem" vira o botão Jogar
        status.textContent = "";
        status.className = "status";
        jogar.hidden = false;
        jogar.disabled = false;
        jogar.textContent = "Jogar";
      } else {
        status.textContent = "Seu personagem";
        status.className = "status meu";
        jogar.hidden = true;
      }
    } else if (dono) {
      status.textContent = "Escolhido por " + dono;
      status.className = "status ocupado";
      jogar.hidden = true;
    } else {
      status.textContent = confirmando ? "Essa escolha não pode ser desfeita." : "";
      status.className = "status";
      jogar.hidden = false;
      jogar.disabled = false;
      jogar.textContent = confirmando ? "Confirmar: jogar com " + p.nome : "Jogar com " + p.nome;
    }
  }

  $("botao-cancelar").addEventListener("click", () => { confirmando = false; desenharFicha(); });

  $("botao-jogar").addEventListener("click", async () => {
    if (mestre || !abertoId) return;
    if (meuId()) {
      if (meuId() === abertoId && (extras[abertoId] || {}).segredo && !interativo) despertar();
      return;
    }
    if (!confirmando) { confirmando = true; return desenharFicha(); }
    const jogar = $("botao-jogar");
    jogar.disabled = true;
    jogar.textContent = "Confirmando...";
    $("ficha-erro").hidden = true;
    const falha = await registrarEscolha(abertoId);
    await carregarEscolhas();
    confirmando = false;
    if (falha) { $("ficha-erro").textContent = falha; $("ficha-erro").hidden = false; }
    atualizar();
  });

  // ---------- Atualização automática ----------
  setInterval(async () => {
    if ((!nomeJogador && !mestre) || document.hidden) return;
    const antes = JSON.stringify(escolhas);
    if (!(await carregarEscolhas())) return;
    if (JSON.stringify(escolhas) !== antes) atualizar();
  }, 3000);

  // ---------- Modo mestre ----------
  // Abra o site com ?mestre=SENHA. A senha é conferida pelo SHA-256 guardado no config.js.
  async function sha256(txt) {
    const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(txt));
    return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  async function verificarMestre() {
    const senha = new URLSearchParams(location.search).get("mestre");
    if (senha === null || !cfg.senhaMestreSha256 || !window.crypto?.subtle) return false;
    return (await sha256(senha.trim())) === cfg.senhaMestreSha256;
  }
  async function entrarComoMestre() {
    mestre = true;
    document.body.classList.add("modo-mestre");
    $("barra-ola").hidden = true;
    $("resumo-mestre").hidden = false;
    await carregarEscolhas();
    tela = "escolha";
    atualizar();
  }

  // ---------- Início ----------
  (async () => {
    if (await verificarMestre()) return entrarComoMestre();
    // senha errada: abre o site normal de jogador, sem avisar nada
    let salvo = "";
    try { salvo = localStorage.getItem(CHAVE_NOME) || ""; } catch {}
    if (salvo) entrar(salvo);
    else { mostrar("nome"); campoNome.focus(); }
  })();
})();
