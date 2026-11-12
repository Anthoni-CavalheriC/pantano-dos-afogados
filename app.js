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

  // ---------- Banco ----------
  async function carregarEscolhas() {
    const { data, error } = await banco.from("escolhas").select("personagem_id, jogador");
    if (error) { console.error(error); return false; }
    escolhas = {};
    for (const linha of data) escolhas[linha.personagem_id] = linha.jogador;
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
    if (tela === "ficha" && abertoId) { mostrar("ficha"); return desenharFicha(); }
    mostrar("escolha");
    desenharFaixa();
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
      painel.addEventListener("click", () => abrirFicha(p.id));
      faixa.append(painel);
    }
  }

  // ---------- Tela 3: ficha ----------
  function abrirFicha(id) {
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
      depois: ({ arte }) => {
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
      status.textContent = "Seu personagem";
      status.className = "status meu";
      jogar.hidden = true;
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
    if (mestre || !abertoId || meuId()) return;
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
