'use strict';
// Modo nuvem (site): login, loja por código de convite e dados no Supabase.
// Sem config (programa de Windows), este arquivo não faz nada e tudo fica no aparelho.

const nuvem = (() => {
  const cfg = window.TAXAS_NUVEM;
  if (!cfg || !cfg.supabaseUrl) return null;
  if (/COLE/.test(cfg.supabaseUrl) || !window.supabase) {
    // site publicado antes de o Supabase da loja existir
    $('porta').hidden = false; document.body.classList.add('na-porta');
    $('portaLogin').hidden = false;
    $('portaLogin').innerHTML = '<h1>Falta configurar</h1><p>O site ainda não está ligado ao banco de dados da loja. Preencha a URL e a chave do Supabase em config.js.</p>';
    return null;
  }
  const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);
  const st = { sessao: null, loja: null, canal: null, timerConfig: null, timerVendas: null, enviandoConfig: false };
  const CACHE = 'taxas.nuvem.v1';

  // ---------- conversão entre o banco e o formato do app ----------
  const paraApp = (r) => {
    const x = { id: r.id, d: r.data, v: +r.valor, t: +r.taxa, p: r.parcela, m: r.maquina, c: Date.parse(r.criado_em) || 0 };
    if (r.bandeira) x.b = r.bandeira;
    return x;
  };
  const paraBanco = (x) => ({ id: x.id, loja_id: st.loja.id, data: x.d, valor: x.v, taxa: x.t, parcela: x.p, maquina: x.m, bandeira: x.b || null });

  const msg = (e) => {
    const t = String(e?.message || e || '');
    if (/Invalid login credentials/i.test(t)) return 'E-mail ou senha errados.';
    if (/Email not confirmed/i.test(t)) return 'Falta confirmar o e-mail: abra a mensagem que enviamos e clique no link.';
    if (/already registered/i.test(t)) return 'Esse e-mail já tem conta. Use "Já tenho conta".';
    if (/Password should be at least/i.test(t)) return 'A senha precisa ter pelo menos 6 caracteres.';
    if (/Failed to fetch|NetworkError|network/i.test(t)) return 'Sem conexão com a internet. Tente de novo.';
    if (/rate limit/i.test(t)) return 'Muitas tentativas seguidas. Espere um minuto.';
    return t || 'Algo deu errado. Tente de novo.';
  };

  // ---------- telas de entrada ----------
  function porta(id) {
    for (const t of ['portaLogin', 'portaSenha', 'portaLoja']) $(t).hidden = t !== id;
    $('porta').hidden = !id;
    document.body.classList.toggle('na-porta', !!id);
    if (id) setTimeout(() => $(id).querySelector('input')?.focus(), 0);
  }

  let cadastro = false;
  $('loginAlternar').onclick = () => {
    cadastro = !cadastro;
    $('loginTit').textContent = cadastro ? 'Criar sua conta' : 'Entrar';
    $('loginBtn').textContent = cadastro ? 'Criar conta' : 'Entrar';
    $('loginAlternar').textContent = cadastro ? 'Já tenho conta' : 'Criar conta';
    $('loginSenha').autocomplete = cadastro ? 'new-password' : 'current-password';
    $('loginErro').textContent = '';
  };
  $('portaLogin').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('loginEmail').value.trim(), password = $('loginSenha').value, b = $('loginBtn');
    b.disabled = true; $('loginErro').textContent = '';
    try {
      if (cadastro) {
        const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname } });
        if (error) throw error;
        if (!data.session) { $('loginErro').textContent = 'Conta criada. Abra o e-mail de confirmação e depois volte para entrar.'; return; }
      } else {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) { $('loginErro').textContent = msg(err); } finally { b.disabled = false; }
  });
  $('loginEsqueci').onclick = async () => {
    const email = $('loginEmail').value.trim();
    if (!email) { $('loginErro').textContent = 'Escreva seu e-mail acima e clique de novo em "Esqueci a senha".'; return; }
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    $('loginErro').textContent = error ? msg(error) : 'Enviamos um link para trocar a senha no seu e-mail.';
  };
  $('portaSenha').addEventListener('submit', async (e) => {
    e.preventDefault();
    const { error } = await sb.auth.updateUser({ password: $('novaSenha').value });
    if (error) { $('senhaErro').textContent = msg(error); return; }
    toast('Senha trocada');
    abrirLoja();
  });
  $('portaLoja').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('lojaErro').textContent = '';
    const { error } = await sb.rpc('entrar_na_loja', { p_codigo: $('lojaCodigo').value });
    if (error) { $('lojaErro').textContent = msg(error); return; }
    abrirLoja();
  });
  $('sair').onclick = () => sb.auth.signOut();
  $('portaSair').onclick = () => sb.auth.signOut();

  // ---------- cópia no aparelho: abre na hora, mesmo antes da internet responder ----------
  function lerCache() {
    try { const c = JSON.parse(localStorage.getItem(CACHE)); return c && c.user === st.sessao?.user?.id ? c : null; } catch (e) { return null; }
  }
  function gravarCache() {
    try { localStorage.setItem(CACHE, JSON.stringify({ user: st.sessao?.user?.id, loja: st.loja, db })); } catch (e) { /* sem espaço: segue sem cópia */ }
  }
  function limparCache() { try { localStorage.removeItem(CACHE); } catch (e) { /* nada a limpar */ } }

  // ---------- carregar ----------
  async function todasVendas(lojaId) {
    const out = [];
    for (let de = 0; ; de += 1000) {
      const { data, error } = await sb.from('vendas').select('id,data,valor,taxa,parcela,maquina,bandeira,criado_em')
        .eq('loja_id', lojaId).order('data').order('criado_em').range(de, de + 999);
      if (error) throw error;
      out.push(...data);
      if (data.length < 1000) return out;
    }
  }

  function aplicarConfig(conf) {
    db.taxas = conf?.taxas || structuredClone(TAXAS_OFICIAIS);
    db.taxasBand = conf?.taxasBand || {};
    db.bandExtra = conf?.bandExtra || [];
    db.ver = conf?.ver || TAXAS_VER;
    registrarExtras();
  }

  async function abrirLoja() {
    const c = lerCache();
    if (c?.loja) { st.loja = c.loja; db = c.db; registrarExtras(); entrar(); }
    const { data: membros, error } = await sb.from('membros').select('loja_id').eq('user_id', st.sessao.user.id).limit(1);
    if (error) { if (!c) { porta('portaLoja'); $('lojaErro').textContent = msg(error); } return; }
    if (!membros.length) { porta('portaLoja'); return; }
    try {
      const { data: loja, error: e2 } = await sb.from('lojas').select('id,nome,codigo,config').eq('id', membros[0].loja_id).single();
      if (e2) throw e2;
      st.loja = { id: loja.id, nome: loja.nome, codigo: loja.codigo };
      const vendas = await todasVendas(loja.id);
      db = { vendas: vendas.map(paraApp) };
      aplicarConfig(loja.config);
      // loja nova: grava as taxas de partida
      if (!loja.config?.taxas) enviarConfig();
      gravarCache();
      entrar(true);
      ouvir();
    } catch (err) {
      toast(c ? 'Sem conexão: mostrando a última cópia deste computador' : msg(err));
    }
  }

  function entrar(atualizou) {
    porta(null);
    $('conta').hidden = false;
    $('contaEmail').textContent = st.sessao?.user?.email || '';
    $('contaCodigo').textContent = st.loja?.codigo || '';
    const aberta = document.querySelector('.view.on')?.id.replace('v-', '') || 'inicio';
    if (!atualizou || !document.querySelector('tr.editando')) abrir(aberta);
  }

  // ---------- tempo real: o que outro computador fizer aparece aqui ----------
  function ouvir() {
    if (st.canal) sb.removeChannel(st.canal);
    st.canal = sb.channel('loja-' + st.loja.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vendas', filter: `loja_id=eq.${st.loja.id}` }, () => recarregarVendas())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'lojas', filter: `id=eq.${st.loja.id}` }, (p) => {
        if (st.enviandoConfig || st.timerConfig) return; // a mudança é nossa
        aplicarConfig(p.new.config); gravarCache(); redesenhar();
      })
      .subscribe();
  }
  function recarregarVendas() {
    clearTimeout(st.timerVendas);
    st.timerVendas = setTimeout(async () => {
      if (!st.loja) return;
      try { db.vendas = (await todasVendas(st.loja.id)).map(paraApp); gravarCache(); redesenhar(); } catch (e) { /* tenta na próxima mudança */ }
    }, 700);
  }
  function redesenhar() {
    if (document.querySelector('tr.editando') || (typeof tour !== 'undefined' && tour.k)) return; // não atrapalha quem está editando
    const aberta = document.querySelector('.view.on')?.id.replace('v-', '');
    if (aberta && aberta !== 'lancar') abrir(aberta); else if (aberta === 'lancar') renderRecentes();
  }

  // ---------- gravar ----------
  function enviarConfig() {
    clearTimeout(st.timerConfig);
    st.timerConfig = setTimeout(async () => {
      st.timerConfig = null;
      if (!st.loja) return;
      st.enviandoConfig = true;
      const config = { taxas: db.taxas, taxasBand: db.taxasBand, bandExtra: db.bandExtra, ver: db.ver };
      const { error } = await sb.from('lojas').update({ config }).eq('id', st.loja.id);
      setTimeout(() => { st.enviandoConfig = false; }, 1500);
      if (error) toast('As taxas não foram salvas na nuvem: ' + msg(error));
    }, 500);
  }

  async function venda(acao, x) {
    if (!st.loja) return;
    gravarCache();
    let r;
    if (acao === 'nova') r = await sb.from('vendas').insert(paraBanco(x));
    else if (acao === 'alterada') r = await sb.from('vendas').update(paraBanco(x)).eq('id', x.id);
    else r = await sb.from('vendas').delete().eq('id', x);
    if (r.error) {
      toast((acao === 'nova' ? 'A venda não foi salva: ' : 'A alteração não foi salva: ') + msg(r.error));
      recarregarVendas(); // volta ao que está no banco
    }
  }

  async function iniciar() {
    sb.auth.onAuthStateChange((evento, sessao) => {
      if (evento === 'PASSWORD_RECOVERY') { st.sessao = sessao; porta('portaSenha'); return; }
      const antes = st.sessao?.user?.id;
      st.sessao = sessao;
      if (evento === 'SIGNED_OUT') { sairLimpo(); return; }
      if (evento === 'SIGNED_IN' && antes !== sessao?.user?.id) setTimeout(abrirLoja, 0);
    });
    const { data } = await sb.auth.getSession();
    st.sessao = data.session;
    if (!st.sessao) { porta('portaLogin'); return; }
    abrirLoja();
  }

  function sairLimpo() {
    clearTimeout(st.timerConfig); clearTimeout(st.timerVendas); st.timerConfig = st.timerVendas = null;
    limparCache();
    if (st.canal) { sb.removeChannel(st.canal); st.canal = null; }
    st.loja = null;
    db = { vendas: [], taxas: structuredClone(TAXAS_OFICIAIS), taxasBand: {}, bandExtra: [], ver: TAXAS_VER };
    $('conta').hidden = true;
    porta('portaLogin');
  }

  return { iniciar, enviarConfig, venda, gravarCache, sb };
})();

if (nuvem) nuvem.iniciar();
