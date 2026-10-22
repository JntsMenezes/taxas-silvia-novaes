'use strict';
// "Como usar": passos escritos e uma demonstração na própria tela (cursor, destaque e legenda).
// A demonstração só mostra e digita nos campos; não salva nada e devolve os campos como estavam.

const TOURS = {
  maquina: {
    titulo: 'Cadastrar uma máquina',
    passos: [
      { tela: 'taxas', alvo: '#novaMaq', texto: 'Na tela Taxas (F5), escreva o nome da máquina nova no campo "Nova máquina".', digita: 'Stone' },
      { tela: 'taxas', alvo: '#formMaq .btn', texto: 'Clique em Acrescentar. A máquina ganha uma coluna na tabela, com todas as parcelas em branco.' },
      { tela: 'taxas', alvo: '#tabTaxas thead th:nth-child(2)', texto: 'Cada coluna é uma máquina. O X ao lado do nome exclui a máquina (pede dois cliques). As vendas antigas dela continuam no histórico.' },
      { tela: 'taxas', alvo: '#tabTaxas tbody tr:nth-child(3) td:nth-child(2) input', texto: 'Clique na célula e digite a taxa em %. Vale vírgula ou ponto: 3,15 ou 3.15.', digita: '3,15' },
      { tela: 'taxas', alvo: '#tabTaxas tbody tr:nth-child(9) td:nth-child(2) input', texto: 'Parcela que a máquina não aceita fica em branco. Ela não aparece no lançamento nem no simulador.' },
    ],
  },
  bandeira: {
    titulo: 'Taxa diferente por bandeira',
    passos: [
      { tela: 'taxas', alvo: '#tBand [data-k="TODAS"]', texto: 'Em "Todas as bandeiras" fica a taxa padrão de cada máquina. Ela vale para qualquer bandeira.', clica: true },
      { tela: 'taxas', alvo: '#tBand [data-k="ELO"]', texto: 'Se uma bandeira cobra diferente, clique nela. Aqui, o Elo.', clica: true },
      { tela: 'taxas', alvo: '#tabTaxas tbody tr:nth-child(3) td:nth-child(2) input', texto: 'O número apagado é a taxa padrão. Digite só a taxa que muda para essa bandeira.', digita: '4,10' },
      { tela: 'taxas', alvo: '#tabTaxas tbody tr:nth-child(3) td:nth-child(2) input', texto: 'Uma célula preenchida fica dourada. Para voltar à taxa padrão, apague o número.' },
      { tela: 'taxas', alvo: '#novaBand', texto: 'Bandeira que não está na lista? Escreva o nome em "Nova bandeira" e clique em Acrescentar. Ela ganha um selo com as iniciais.', digita: 'Cabal' },
      { tela: 'taxas', alvo: '#tBand [data-k="TODAS"]', texto: 'Pronto. Volte para "Todas as bandeiras" para ver a tabela padrão.', clica: true },
    ],
  },
  lancar: {
    titulo: 'Lançar uma venda',
    passos: [
      { tela: 'lancar', alvo: '#fData', texto: 'Na tela Lançar venda (F2), a data já vem com o dia de hoje. Troque se a venda for de outro dia.' },
      { tela: 'lancar', alvo: '#fValor', texto: 'Digite o valor da venda. Embaixo aparece como o programa entendeu, para conferir.', digita: '350,00' },
      { tela: 'lancar', alvo: '#fMaquina', texto: 'Escolha a máquina em que a venda passou.' },
      { tela: 'lancar', alvo: '#fParcela', texto: 'Escolha a parcela. Só aparecem as parcelas que a máquina aceita.' },
      { tela: 'lancar', alvo: '#fBand', texto: 'Escolha a bandeira do cartão. O programa lembra a última que você usou.' },
      { tela: 'lancar', alvo: '#fTaxa', texto: 'A taxa em R$ vem calculada pela tabela. Se a máquina cobrou outro valor, corrija aqui.' },
      { tela: 'lancar', alvo: '#fSalvar', texto: 'Clique em Salvar venda ou aperte Enter. A venda aparece na lista ao lado.' },
    ],
  },
  corrigir: {
    titulo: 'Corrigir ou excluir uma venda',
    passos: [
      { tela: 'vendas', alvo: '#mesVendas', texto: 'Na tela Vendas (F4), escolha o mês da venda.' },
      { tela: 'vendas', alvo: '#lista [data-acao="editar"]', texto: 'Clique em Editar. A linha vira campos: troque data, máquina, parcela, bandeira, valor ou taxa. Enter salva e Esc cancela.' },
      { tela: 'vendas', alvo: '#lista [data-acao="excluir"]', texto: 'Excluir pede dois cliques: o primeiro troca o botão para Confirmar.' },
      { tela: 'vendas', alvo: '#exportar', texto: 'Exportar CSV salva todas as vendas num arquivo que abre no Excel. Use como cópia de segurança.' },
    ],
  },
  simular: {
    titulo: 'Descobrir a máquina mais barata',
    passos: [
      { tela: 'simular', alvo: '#sValor', texto: 'Na tela Qual máquina usar (F3), digite o valor da venda.', digita: '800' },
      { tela: 'simular', alvo: '#sParcela', texto: 'Escolha em quantas vezes o cliente quer pagar.' },
      { tela: 'simular', alvo: '#sBand', texto: 'Escolha a bandeira do cartão do cliente.' },
      { tela: 'simular', alvo: '#sRank', texto: 'A lista mostra as máquinas da mais barata para a mais cara, com a taxa e quanto a loja recebe.' },
    ],
  },
};

const ORDEM = ['maquina', 'bandeira', 'lancar', 'corrigir', 'simular'];

function renderAjuda() {
  $('listaAjuda').innerHTML = ORDEM.map((k, n) => {
    const t = TOURS[k];
    return `<section class="topico">
      <div class="topico-cab"><h2>${t.titulo}</h2>
        <button class="btn ghost assistir" data-tour="${k}"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11l9-5.5z"/></svg>Assistir</button></div>
      <ol>${t.passos.map((p) => `<li>${p.texto}</li>`).join('')}</ol>
    </section>`;
  }).join('');
}

$('listaAjuda').addEventListener('click', (e) => {
  const b = e.target.closest('[data-tour]'); if (b) tour.iniciar(b.dataset.tour);
});

const tour = {
  k: null, i: 0, tocando: true, timer: null, guardados: [], ger: 0,
  iniciar(k) {
    this.k = k; this.i = 0; this.tocando = true; this.guardados = [];
    this.estadoAntes = { tabB: typeof tabB !== 'undefined' ? tabB : null };
    $('tour').hidden = false;
    document.body.classList.add('em-tour');
    this.mostrar();
    $('tourProx').focus();
  },
  fechar() {
    clearTimeout(this.timer);
    this.ger++;
    // devolve os campos digitados como estavam
    for (const [el, v] of this.guardados) { el.value = v; el.dispatchEvent(new Event('input')); }
    this.guardados = [];
    if (this.estadoAntes?.tabB && typeof tabB !== 'undefined' && tabB !== this.estadoAntes.tabB) { tabB = this.estadoAntes.tabB; renderTaxas(); }
    $('tour').hidden = true;
    document.body.classList.remove('em-tour');
    this.k = null;
    abrir('ajuda');
  },
  mostrar() {
    clearTimeout(this.timer);
    const ger = ++this.ger;
    const passos = TOURS[this.k].passos, p = passos[this.i];
    if (!document.getElementById('v-' + p.tela).classList.contains('on')) abrir(p.tela);
    const el = document.querySelector(p.alvo);
    $('tourTitulo').textContent = `${TOURS[this.k].titulo} · ${this.i + 1} de ${passos.length}`;
    $('tourTexto').textContent = p.texto;
    $('tourAnt').disabled = this.i === 0;
    $('tourProx').textContent = this.i === passos.length - 1 ? 'Concluir' : 'Próximo';
    $('tourPausa').textContent = this.tocando ? 'Pausar' : 'Continuar';
    if (!el) { this.posicionar(null); this.agendar(); return; }
    el.scrollIntoView({ block: 'center', behavior: 'instant' });
    // temporizador em vez de requestAnimationFrame: janela coberta por outra não recebe quadros e a demonstração parava
    setTimeout(() => {
      if (ger !== this.ger) return;
      this.posicionar(el);
      if (p.clica) setTimeout(() => { if (ger === this.ger) { el.click(); setTimeout(() => this.posicionar(document.querySelector(p.alvo)), 30); } }, 700);
      if (p.digita && 'value' in el) this.digitar(el, p.digita, ger);
      this.agendar();
    }, 30);
  },
  digitar(el, txt, ger) {
    if (!this.guardados.some(([e]) => e === el)) this.guardados.push([el, el.value]);
    el.value = '';
    let n = 0;
    const passo = () => {
      if (ger !== this.ger) return; // passo trocado ou demonstração fechada
      el.value = txt.slice(0, ++n);
      el.dispatchEvent(new Event('input'));
      if (n < txt.length) setTimeout(passo, reduzido() ? 0 : 90);
    };
    setTimeout(passo, reduzido() ? 0 : 650);
  },
  agendar() {
    if (!this.tocando) return;
    const p = TOURS[this.k].passos[this.i];
    const ms = 2600 + p.texto.length * 38;
    this.timer = setTimeout(() => this.proximo(true), ms);
  },
  posicionar(el) {
    const luz = $('tourLuz'), cur = $('tourCursor'), bal = $('tourBalao');
    if (!el) { luz.style.opacity = 0; cur.style.opacity = 0; bal.style.left = '50%'; bal.style.top = '40%'; bal.style.transform = 'translate(-50%,0)'; return; }
    const r = el.getBoundingClientRect(), m = 6;
    Object.assign(luz.style, { opacity: 1, left: r.left - m + 'px', top: r.top - m + 'px', width: r.width + m * 2 + 'px', height: r.height + m * 2 + 'px' });
    cur.style.opacity = 1;
    cur.style.transform = `translate(${r.left + Math.min(r.width / 2, 60)}px, ${r.top + r.height / 2}px)`;
    // balão abaixo do alvo; se não couber, acima
    const bw = Math.min(380, innerWidth - 32), bh = bal.offsetHeight || 150;
    let x = Math.min(Math.max(16, r.left), innerWidth - bw - 16);
    let y = r.bottom + 18;
    if (y + bh > innerHeight - 16) y = Math.max(16, r.top - bh - 18);
    Object.assign(bal.style, { left: x + 'px', top: y + 'px', transform: 'none', width: bw + 'px' });
  },
  proximo(auto) {
    const n = TOURS[this.k].passos.length;
    if (this.i >= n - 1) { if (auto) { this.tocando = false; $('tourPausa').textContent = 'Continuar'; return; } return this.fechar(); }
    this.i++; this.mostrar();
  },
  anterior() { if (this.i > 0) { this.i--; this.mostrar(); } },
  pausar() {
    this.tocando = !this.tocando;
    $('tourPausa').textContent = this.tocando ? 'Pausar' : 'Continuar';
    if (this.tocando) this.agendar(); else clearTimeout(this.timer);
  },
};
const reduzido = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

$('tourProx').onclick = () => tour.proximo(false);
$('tourAnt').onclick = () => tour.anterior();
$('tourPausa').onclick = () => tour.pausar();
$('tourFechar').onclick = () => tour.fechar();
document.addEventListener('keydown', (e) => {
  if (!tour.k) return;
  if (e.key === 'Escape') { e.preventDefault(); tour.fechar(); }
  if (e.key === 'ArrowRight') { e.preventDefault(); tour.proximo(false); }
  if (e.key === 'ArrowLeft') { e.preventDefault(); tour.anterior(); }
  if (e.key === ' ' && e.target.tagName !== 'BUTTON') { e.preventDefault(); tour.pausar(); }
}, true);
window.addEventListener('resize', () => { if (tour.k) tour.posicionar(document.querySelector(TOURS[tour.k].passos[tour.i].alvo)); });
