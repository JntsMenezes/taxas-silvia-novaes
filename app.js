'use strict';

const KEY = 'taxas.v1';
const PARCELAS = ['PIX', 'Débito', '1x', '2x', '3x', '4x', '5x', '6x', '7x', '8x', '9x', '10x', '11x', '12x'];
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const $ = (id) => document.getElementById(id);
const brl = (n) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = (n) => (n * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
// aceita "350,50", "350.50", "1.234,56", "1,234.56", "1.234" e "R$ 80"
function num(s) {
  let t = String(s).replace(/[^\d.,-]/g, '');
  if (!t) return 0;
  const v = t.lastIndexOf(','), p = t.lastIndexOf('.');
  if (v > -1 && p > -1) t = v > p ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  else if (v > -1) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  return parseFloat(t) || 0;
}
const chipBand = (k) => k === 'TODAS' ? 'Todas as bandeiras' : `${logo(k)}${BAND[k].nome}`;
const NOMES = { INFINITEPAY: 'InfinitePay', LARANJINHA: 'Laranjinha', 'MERCADO PAGO': 'Mercado Pago', PRIME: 'Prime', 'PRIME LINK': 'Prime Link', LINK: 'Link', TOM: 'TOM' };
const nm = (m) => NOMES[m] || String(m).toLowerCase().replace(/(^|\s)\p{L}/gu, (c) => c.toUpperCase());
const ordemParcela = (p) => { const i = PARCELAS.indexOf(p); return i < 0 ? 99 : i; };
const nomeMes = (ym) => { const [y, m] = ym.split('-'); return MESES[+m - 1] + '/' + y.slice(2); };
// data local (toISOString daria o dia seguinte depois das 21h no horário de Brasília)
const hoje = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// tabelas passadas pelas máquinas em 20/10/2026 (máquinas fora daqui ficam só no histórico)
const TAXAS_VER = 2;
const TAXAS_OFICIAIS = {
  'MERCADO PAGO': { '1x': 3.10, '2x': 4.70, '3x': 5.55, '4x': 6.40, '5x': 7.25, '6x': 8.10, '10x': 11.50 },
  'INFINITEPAY': { 'PIX': 0, 'Débito': 1.37, '1x': 3.15, '2x': 5.39, '3x': 6.12, '4x': 6.85, '5x': 7.57, '6x': 8.28, '10x': 11.06 },
  'LARANJINHA': { 'Débito': 0.80, '1x': 3.36, '2x': 4.46, '3x': 5.20, '4x': 5.94, '5x': 6.68, '6x': 7.42, '10x': 10.70 },
};

// ---------- estado ----------
const NA_NUVEM = !!window.TAXAS_NUVEM?.supabaseUrl;
let db = carregar();

function carregar() {
  let d;
  // no site os dados vêm do Supabase depois do login (nuvem.js); começa vazio
  if (NA_NUVEM) return { vendas: [], taxas: structuredClone(TAXAS_OFICIAIS), taxasBand: {}, bandExtra: [], ver: TAXAS_VER };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) d = JSON.parse(raw);
  } catch (e) { /* storage indisponível: cai no seed */ }
  if (!d) {
    const vendas = (window.SEED || []).map(([dt, v, t, p, m], i) => ({ id: 's' + i, d: dt, v, t, p, m }));
    d = { vendas };
  }
  if ((d.ver || 0) < TAXAS_VER) {
    d.taxas = structuredClone(TAXAS_OFICIAIS);
    d.ver = TAXAS_VER;
  }
  d.taxasBand ??= {};
  d.bandExtra ??= [];
  migrarPix(d);
  return d;
}

// 22/10/2026: o PIX da InfinitePay entra como 0% uma única vez (a planilha mostra Pix sem taxa).
// Se alguém apagar depois, não volta. Devolve true quando mudou algo.
function migrarPix(d) {
  if (d.pix0) return false;
  d.pix0 = true;
  if (d.taxas?.INFINITEPAY && d.taxas.INFINITEPAY.PIX == null) d.taxas.INFINITEPAY.PIX = 0;
  return true;
}

// taxas e bandeiras: no aparelho ou na configuração da loja (site)
function salvar() {
  if (NA_NUVEM) { nuvem.gravarCache(); nuvem.enviarConfig(); return; }
  try { localStorage.setItem(KEY, JSON.stringify(db)); }
  catch (e) { toast('Não consegui salvar no aparelho'); }
}

// vendas: no site cada venda vai para o banco; no programa, o aparelho guarda tudo junto
function persistir(acao, x) {
  if (NA_NUVEM) return nuvem.venda(acao, x);
  try { localStorage.setItem(KEY, JSON.stringify(db)); }
  catch (e) { toast('Não consegui salvar no aparelho'); }
}
const novoId = () => (crypto.randomUUID ? crypto.randomUUID() : 'u' + Date.now() + Math.random().toString(16).slice(2, 8));
// quando a venda foi lançada (as da planilha não têm)
const lancadaEm = (x) => x.c || (/^u\d+$/.test(x.id) ? +x.id.slice(1) : 0);

const maquinas = () => Object.keys(db.taxas).sort();
// bandeira criada pelo usuário: selo com as iniciais
function seloGenerico(nome) {
  const ini = nome.replace(/[^\p{L}\p{N} ]/gu, '').split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 3).toUpperCase() || '?';
  return `<rect width="40" height="26" rx="4" fill="#5C4A38"/><text x="20" y="17" text-anchor="middle" font-family="Jost,Segoe UI,sans-serif" font-weight="600" font-size="${ini.length > 2 ? 9.5 : 11}" fill="#fff">${ini}</text>`;
}
const bandeirasNativas = new Set(BANDEIRAS.map((b) => b.k));
function registrarExtras() {
  for (const k of Object.keys(BAND)) if (!bandeirasNativas.has(k)) delete BAND[k];
  for (const b of db.bandExtra) BAND[b.k] = { k: b.k, nome: b.nome, svg: seloGenerico(b.nome) };
}
registrarExtras();
const listaBand = () => Object.keys(BAND);
// PIX não tem bandeira
const semBandeira = (p) => p === 'PIX';
// taxa da bandeira quando ela foi cadastrada; senão, a padrão da máquina
function taxaDe(m, p, b) {
  const esp = b ? db.taxasBand[m]?.[b]?.[p] : undefined;
  return esp != null ? esp : db.taxas[m]?.[p];
}
const meses = () => [...new Set(db.vendas.map((x) => x.d.slice(0, 7)))].sort().reverse();

function soma(lista) {
  const v = lista.reduce((s, x) => s + x.v, 0);
  const t = lista.reduce((s, x) => s + x.t, 0);
  return { v, t, l: v - t, q: lista.length, p: v ? t / v : 0 };
}

function agrupar(lista, campo) {
  const g = {};
  for (const x of lista) (g[x[campo]] ??= []).push(x);
  return Object.entries(g).map(([k, l]) => ({ k, ...soma(l) }));
}

// ---------- navegação ----------
document.querySelectorAll('#nav button').forEach((b) => b.addEventListener('click', () => abrir(b.dataset.v)));

function abrir(v) {
  document.querySelectorAll('#nav button').forEach((b) => b.classList.toggle('on', b.dataset.v === v));
  document.querySelectorAll('.view').forEach((s) => s.classList.toggle('on', s.id === 'v-' + v));
  document.querySelector('main').scrollTop = 0;
  ({ inicio: renderResumo, lancar: renderLancar, simular: renderSimular, vendas: renderVendas, taxas: renderTaxas, ajuda: renderAjuda })[v]();
}

document.addEventListener('keydown', (e) => {
  const v = { F1: 'inicio', F2: 'lancar', F3: 'simular', F4: 'vendas', F5: 'taxas', F6: 'ajuda' }[e.key];
  if (v) { e.preventDefault(); abrir(v); }
});

let toastT;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg; t.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2200);
}

function preencherMeses(sel, atual) {
  const ms = meses();
  sel.innerHTML = ms.map((m) => `<option value="${m}">${nomeMes(m)}</option>`).join('');
  sel.value = ms.includes(atual) ? atual : ms[0] || '';
}

function chips(el, itens, sel, onPick, rot = nm, cls = '') {
  el.innerHTML = itens.map((i) => `<button type="button" class="chip${cls ? ' ' + cls : ''}${i === sel ? ' on' : ''}" aria-pressed="${i === sel}" data-k="${i}">${rot(i)}</button>`).join('');
  el.onclick = (e) => {
    const b = e.target.closest('.chip'); if (!b) return;
    el.querySelectorAll('.chip').forEach((c) => { c.classList.toggle('on', c === b); c.setAttribute('aria-pressed', c === b); });
    onPick(b.dataset.k);
  };
}

// ---------- resumo ----------
let mesSel;
$('mes').onchange = (e) => { mesSel = e.target.value; renderResumo(); };

function renderResumo() {
  preencherMeses($('mes'), mesSel);
  mesSel = $('mes').value;
  if (!mesSel) { $('kpis').innerHTML = ''; $('frase').innerHTML = '<p>Nenhuma venda lançada ainda.</p>'; $('porMaquina').innerHTML = $('porParcela').innerHTML = ''; return; }

  const doMes = db.vendas.filter((x) => x.d.startsWith(mesSel));
  const s = soma(doMes);
  const ms = meses();
  const ant = ms[ms.indexOf(mesSel) + 1];
  const sa = ant ? soma(db.vendas.filter((x) => x.d.startsWith(ant))) : null;
  const dif = sa ? s.p - sa.p : null;

  $('kpis').innerHTML = `
    <div class="kpi"><small>Vendido no cartão</small><b>${brl(s.v)}</b><em>${s.q} ${s.q === 1 ? "venda" : "vendas"}</em></div>
    <div class="kpi"><small>Pago de taxa</small><b>${brl(s.t)}</b></div>
    <div class="kpi"><small>Ficou para a loja</small><b>${brl(s.l)}</b></div>
    <div class="kpi"><small>Taxa média</small><b>${pct(s.p)}</b>${dif === null ? '' :
      `<em class="${dif > 0 ? 'up' : 'down'}"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="${dif > 0 ? 'M6 2 11 10H1Z' : 'M6 10 1 2h10Z'}"/></svg>${pct(Math.abs(dif)).replace('%', '')} ponto ${dif > 0 ? 'acima' : 'abaixo'} de ${nomeMes(ant)}</em>`}</div>`;

  const frases = [
    `Em ${nomeMes(mesSel)} entraram ${brl(s.v)} no cartão e ${brl(s.t)} ficaram com as máquinas.`,
    `A cada R$ 100 vendidos, R$ ${(s.p * 100).toFixed(2).replace('.', ',')} foram de taxa.`,
  ];
  if (sa) frases.push(`Em ${nomeMes(ant)} essa conta foi de R$ ${(sa.p * 100).toFixed(2).replace('.', ',')} a cada R$ 100.`);
  $('frase').innerHTML = frases.map((f) => `<p>${f}</p>`).join('');

  const pm = agrupar(doMes, 'm').sort((a, b) => b.v - a.v);
  const max = Math.max(...pm.map((x) => x.v), 1);
  $('porMaquina').innerHTML = pm.map((x) => `
    <div class="row"><div style="flex:1">${nm(x.k)}<br><small>${x.q} ${x.q === 1 ? "venda" : "vendas"} · taxa ${pct(x.p)}</small>
      <div class="bar"><i style="width:${x.v / max * 100}%"></i></div></div>
      <div class="n">${brl(x.v)}<br><small>${brl(x.t)} de taxa</small></div></div>`).join('');

  const pb = agrupar(doMes.map((x) => ({ ...x, b: semBandeira(x.p) ? 'PIX' : x.b || '—' })), 'b').sort((a, b) => b.v - a.v);
  const maxB = Math.max(...pb.map((x) => x.v), 1);
  $('porBandeira').innerHTML = pb.map((x) => `
    <div class="row"><div style="flex:1"><span class="cel-band">${BAND[x.k] ? logo(x.k) + BAND[x.k].nome : x.k === 'PIX' ? 'PIX' : 'Não informada'}</span><br><small>${x.q} ${x.q === 1 ? 'venda' : 'vendas'} · taxa ${pct(x.p)}</small>
      <div class="bar"><i style="width:${x.v / maxB * 100}%"></i></div></div>
      <div class="n">${brl(x.v)}</div></div>`).join('')
    + (pb.length === 1 && pb[0].k === '—' ? '<p class="hint">As vendas da planilha não tinham bandeira. As que você lançar daqui em diante aparecem separadas.</p>' : '');
  const pp = agrupar(doMes, 'p').sort((a, b) => ordemParcela(a.k) - ordemParcela(b.k));
  $('porParcela').innerHTML = pp.map((x) => `
    <div class="row"><div>${x.k}<br><small>${x.q} ${x.q === 1 ? "venda" : "vendas"}</small></div>
      <div class="n">${brl(x.v)}<br><small>taxa ${pct(x.p)}</small></div></div>`).join('');
  renderGraficos(doMes, mesSel);
}

// ---------- gráficos: taxa (%) em cima, vendido (R$) embaixo, mesmo eixo de tempo ----------
const curto = (n) => n >= 1000 ? (n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: n >= 10000 ? 0 : 1 }) + ' mil' : String(Math.round(n));
const pct1 = (p) => (p * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
const graficos = {};

// segmentos retos entre os pontos: curva suavizada inventa valores entre um ponto e outro
function curva(pts) {
  return pts.map(([x, y], k) => `${k ? 'L' : 'M'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
}

function passoBom(max, n) {
  const bruto = max / n, mag = 10 ** Math.floor(Math.log10(bruto || 1));
  return [1, 2, 2.5, 5, 10].map((k) => k * mag).find((k) => k >= bruto) || mag * 10;
}

// itens: [{ rot, v (vendido), t (taxa), maq: {m: {v,t}}, titulo }]
// dois gráficos empilhados no mesmo eixo de tempo, cada um com a sua escala (nunca dois eixos Y no mesmo gráfico)
function desenhar(id, itens) {
  const svg = $(id), W = svg.parentElement.clientWidth, n = itens.length;
  if (W < 200 || !n) return; // tela escondida: desenha quando o Resumo abrir
  const L = 56, R = 14, slot = (W - L - R) / n, cx = (i) => L + slot * i + slot / 2;
  const bw = Math.min(24, slot * 0.6);
  // faixa 1: taxa (%) · faixa 2: vendido (R$)
  const t1 = 14, b1 = 112, t2 = 150, b2 = 272, H = 296;
  const comVenda = itens.filter((o) => o.v);
  const pMax = Math.max(...comVenda.map((o) => o.t / o.v * 100), 0.5);
  const st1 = passoBom(pMax, 3), top1 = Math.ceil(pMax / st1) * st1;
  const yP = (p) => b1 - (p / top1) * (b1 - t1);
  const vMax = Math.max(...itens.map((o) => o.v), 1);
  const st2 = passoBom(vMax, 3), top2 = Math.ceil(vMax / st2) * st2;
  const yV = (v) => b2 - (v / top2) * (b2 - t2);

  let g = '';
  // grade fina e contínua + marcas do eixo Y
  for (let p = 0; p <= top1 + 1e-9; p += st1) g += `<line x1="${L}" x2="${W - R}" y1="${yP(p)}" y2="${yP(p)}" class="gr${p ? '' : ' base'}"/><text x="${L - 8}" y="${yP(p) + 4}" text-anchor="end" class="eixo">${p.toLocaleString('pt-BR')}%</text>`;
  for (let v = 0; v <= top2 + 1e-9; v += st2) g += `<line x1="${L}" x2="${W - R}" y1="${yV(v)}" y2="${yV(v)}" class="gr${v ? '' : ' base'}"/><text x="${L - 8}" y="${yV(v) + 4}" text-anchor="end" class="eixo">${curto(v)}</text>`;

  // colunas: cor lisa, ponta arredondada em cima, base reta
  itens.forEach((o, i) => {
    if (!o.v) return;
    const h = Math.max(b2 - yV(o.v), 1.5), x = cx(i) - bw / 2, y = b2 - h, r = Math.min(4, h, bw / 2);
    g += `<path class="b" style="animation-delay:${i * 22}ms" d="M${x},${b2}V${y + r}Q${x},${y} ${x + r},${y}H${x + bw - r}Q${x + bw},${y} ${x + bw},${y + r}V${b2}Z" fill="var(--s-col)"/>`;
  });

  // linha da taxa: 2 px, pontos de 8 px com anel da cor do fundo, área a 10%
  const pts = itens.map((o, i) => o.v ? [cx(i), yP(o.t / o.v * 100), i] : null).filter(Boolean);
  if (pts.length > 1) {
    const d = curva(pts);
    g += `<path d="${d} L ${pts[pts.length - 1][0]} ${b1} L ${pts[0][0]} ${b1} Z" fill="var(--s-lin)" fill-opacity=".1"/>`;
    g += `<path class="ln" d="${d}" fill="none" stroke="var(--s-lin)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  g += pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4" fill="var(--s-lin)" stroke="var(--card)" stroke-width="2"/>`).join('');

  // rótulos só onde contam: última ponta e o extremo de cada série
  const ult = pts[pts.length - 1];
  const iMaxP = pts.reduce((a, q) => (itens[q[2]].t / itens[q[2]].v > itens[a[2]].t / itens[a[2]].v ? q : a), pts[0] || [0, 0, 0])[2];
  const iMaxV = itens.reduce((a, o, i) => (o.v > itens[a].v ? i : a), 0);
  const iUltV = itens.map((o) => o.v).findLastIndex((v) => v > 0);
  const rot = [];
  const poe = (x, y, txt, cls) => {
    const w = txt.length * 6.6 + 6;
    if (rot.some((q) => Math.abs(q.x - x) < (q.w + w) / 2 && Math.abs(q.y - y) < 15)) return;
    rot.push({ x, y, w });
    const anc = x + w / 2 > W - R ? 'end' : 'middle';
    g += `<text x="${anc === 'end' ? W - R : x}" y="${y}" text-anchor="${anc}" class="${cls}">${txt}</text>`;
  };
  if (ult) poe(ult[0], ult[1] - 10, pct1(itens[ult[2]].t / itens[ult[2]].v), 'vf');
  if (pts.length > 1 && iMaxP !== ult[2]) { const q = pts.find((p) => p[2] === iMaxP); poe(q[0], q[1] - 10, pct1(itens[iMaxP].t / itens[iMaxP].v), 'vp'); }
  if (iUltV >= 0) poe(cx(iUltV), yV(itens[iUltV].v) - 6, curto(itens[iUltV].v), 'vf');
  if (iMaxV !== iUltV && itens[iMaxV].v) poe(cx(iMaxV), yV(itens[iMaxV].v) - 6, curto(itens[iMaxV].v), 'vp');

  // eixo do tempo
  const marca = (i) => slot >= 40 || i === 0 || i === n - 1 || (n > 13 ? (i + 1) % 5 === 0 : i % 2 === 0);
  itens.forEach((o, i) => { if (marca(i)) g += `<text x="${cx(i)}" y="${H - 6}" text-anchor="middle" class="eixo">${o.rot}</text>`; });

  g += `<line class="cross" x1="0" x2="0" y1="${t1 - 6}" y2="${b2}"/>`;
  g += itens.map((o, i) => `<rect class="hit" data-i="${i}" x="${L + slot * i}" y="0" width="${slot}" height="${H}"/>`).join('');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('height', H);
  svg.innerHTML = g;
  graficos[id] = { itens, cx };
}

function porDia(doMes, ym) {
  const [y, m] = ym.split('-').map(Number);
  const dias = Array.from({ length: new Date(y, m, 0).getDate() }, (_, i) => ({ rot: String(i + 1), v: 0, t: 0, maq: {}, titulo: `${String(i + 1).padStart(2, '0')}/${ym.slice(5)}` }));
  for (const x of doMes) {
    const o = dias[+x.d.slice(8, 10) - 1];
    o.v += x.v; o.t += x.t;
    const k = o.maq[x.m] ??= { v: 0, t: 0 };
    k.v += x.v; k.t += x.t;
  }
  return dias;
}

function porMes(ate) {
  const [y, m] = ate.split('-').map(Number);
  const out = [];
  for (let k = 12; k >= 0; k--) {
    const d = new Date(y, m - 1 - k, 1), ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const o = { ym, rot: nomeMes(ym), v: 0, t: 0, maq: {}, titulo: nomeMes(ym) };
    for (const x of db.vendas) if (x.d.startsWith(ym)) {
      o.v += x.v; o.t += x.t;
      const q = o.maq[x.m] ??= { v: 0, t: 0 };
      q.v += x.v; q.t += x.t;
    }
    out.push(o);
  }
  // não começa por meses vazios antes da primeira venda
  while (out.length > 1 && !out[0].v) out.shift();
  return out;
}

function renderGraficos(doMes, ym) {
  const meses13 = porMes(ym);
  $('tMes').textContent = `${meses13[0].rot} a ${meses13[meses13.length - 1].rot}`;
  desenhar('gMes', meses13);
  desenhar('gDia', porDia(doMes, ym));
  $('tDia').textContent = nomeMes(ym);
  const com = porDia(doMes, ym).filter((o) => o.v);
  $('tabGraf').innerHTML = `<table><thead><tr><th>Dia</th><th class="l">Vendido</th><th class="l">Taxa</th><th>Taxa %</th><th class="l">Ficou para a loja</th></tr></thead><tbody>
    ${com.map((o) => `<tr><td>${o.titulo}</td><td class="l">${brl(o.v)}</td><td class="l">${brl(o.t)}</td><td>${pct(o.t / o.v)}</td><td class="l">${brl(o.v - o.t)}</td></tr>`).join('')}</tbody></table>`;
}

function esconderDica() {
  $('tip').classList.remove('on');
  document.querySelectorAll('.graf .cross').forEach((c) => c.classList.remove('on'));
}

function dicaEm(svg, i, yTela) {
  const gr = graficos[svg.id]; if (!gr) return;
  const tip = $('tip'), o = gr.itens[i], x = gr.cx(i);
  document.querySelectorAll('.graf .cross').forEach((c) => c.classList.remove('on'));
  const cr = svg.querySelector('.cross'); cr.setAttribute('x1', x); cr.setAttribute('x2', x); cr.classList.add('on');
  gr.atual = i;
  const maqs = Object.keys(o.maq).sort((a, b) => o.maq[b].v - o.maq[a].v);
  tip.innerHTML = o.v ? `<b>${o.titulo}</b>
      <div><span>Vendido</span><span>${brl(o.v)}</span></div>
      <div><span>Taxa</span><span>${brl(o.t)} · ${pct(o.t / o.v)}</span></div>
      <div><span>Ficou para a loja</span><span>${brl(o.v - o.t)}</span></div>
      ${maqs.length ? '<hr>' + maqs.map((k) => `<div><span>${nm(k)}</span><span>${pct(o.maq[k].t / o.maq[k].v)}</span></div>`).join('') : ''}`
    : `<b>${o.titulo}</b><div><span>Sem vendas no cartão</span><span></span></div>`;
  const box = tip.offsetParent.getBoundingClientRect(), sr = svg.getBoundingClientRect();
  const px = sr.left - box.left + x * (sr.width / svg.viewBox.baseVal.width);
  tip.classList.add('on');
  const tw = tip.offsetWidth;
  tip.style.left = (px + 16 + tw > box.width ? px - tw - 16 : px + 16) + 'px';
  tip.style.top = (yTela ?? sr.top + 40) - box.top + 'px';
  // leitor de tela recebe o mesmo texto da dica
  $('tip').setAttribute('aria-hidden', 'true');
  svg.setAttribute('aria-valuetext', tip.innerText.replace(/\s*\n\s*/g, ', '));
}

function mostrarDica(e) {
  const h = e.target.closest && e.target.closest('.hit');
  if (!h) return esconderDica();
  dicaEm(h.ownerSVGElement, +h.dataset.i, h.ownerSVGElement.getBoundingClientRect().top + 40);
}

// teclado: setas andam pelos pontos, Home/End vão às pontas, Esc fecha
document.querySelectorAll('.graf svg').forEach((svg) => {
  svg.addEventListener('keydown', (e) => {
    const gr = graficos[svg.id]; if (!gr) return;
    const n = gr.itens.length, i0 = gr.atual ?? n;
    const i = { ArrowRight: Math.min(i0 + 1, n - 1), ArrowLeft: Math.max((gr.atual ?? n) - 1, 0), Home: 0, End: n - 1 }[e.key];
    if (e.key === 'Escape') { esconderDica(); return; }
    if (i === undefined) return;
    e.preventDefault();
    dicaEm(svg, i);
    $('fala').textContent = svg.getAttribute('aria-valuetext');
  });
  svg.addEventListener('blur', esconderDica);
});
document.querySelectorAll('.graf').forEach((el) => {
  el.addEventListener('mousemove', mostrarDica);
  el.addEventListener('mouseleave', () => mostrarDica({ target: document.body }));
});
let rz;
window.addEventListener('resize', () => {
  clearTimeout(rz);
  rz = setTimeout(() => { if ($('v-inicio').classList.contains('on')) renderResumo(); }, 120);
});

// ---------- lançar ----------
const form = { m: null, p: null, taxaManual: false };

function parcelasDe(m) {
  const t = db.taxas[m] || {};
  return Object.keys(t).filter((p) => t[p] != null).sort((a, b) => ordemParcela(a) - ordemParcela(b));
}

function renderLancar() {
  if (!$('fData').value) $('fData').value = hoje();
  const ms = maquinas();
  form.m ??= ms[0];
  chips($('fMaquina'), ms, form.m, (m) => { form.m = m; if (!parcelasDe(m).includes(form.p)) form.p = null; renderParcelasForm(); sugerirTaxa(); });
  renderParcelasForm();
  renderBandForm();
  sugerirTaxa();
  renderRecentes();
  $('fValor').focus();
}

function renderBandForm() {
  form.b ??= 'VISA';
  $('fBandBox').hidden = semBandeira(form.p);
  chips($('fBand'), listaBand(), form.b, (b) => { form.b = b; sugerirTaxa(); }, chipBand, 'cb');
}

function renderRecentes() {
  const l = db.vendas.filter(lancadaEm).sort((a, b) => lancadaEm(b) - lancadaEm(a)).slice(0, 12);
  $('recentes').innerHTML = l.length ? tabelaVendas(l, false)
    : '<div class="empty">As vendas que você lançar aparecem aqui.</div>';
}

function renderParcelasForm() {
  const ps = parcelasDe(form.m);
  form.p ??= ps.includes('1x') ? '1x' : ps[0];
  chips($('fParcela'), ps, form.p, (p) => { form.p = p; $('fBandBox').hidden = semBandeira(p); sugerirTaxa(); });
  // sem taxa de Pix cadastrada a opção some; explica como liberar
  const semPix = form.m && db.taxas[form.m] && db.taxas[form.m].PIX == null;
  $('fPixHint').textContent = semPix ? `Pix não aparece porque a taxa do PIX da ${nm(form.m)} está em branco em Taxas (F5). Se ela não cobra no Pix, preencha 0.` : '';
}

function sugerirTaxa() {
  const b = semBandeira(form.p) ? null : form.b;
  const r = taxaDe(form.m, form.p, b);
  const v = num($('fValor').value);
  if (r == null) { $('fHint').textContent = ''; return; }
  const propria = b && db.taxasBand[form.m]?.[b]?.[form.p] != null;
  $('fHint').textContent = `Taxa de ${nm(form.m)} em ${form.p}${propria ? ` no ${BAND[b].nome}` : ''}: ${r.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}%`;
  if (!form.taxaManual && v) $('fTaxa').value = (v * r / 100).toFixed(2).replace('.', ',');
}

$('fValor').addEventListener('input', () => {
  const v = num($('fValor').value);
  $('fValorHint').textContent = v ? `Valor: ${brl(v)}` : '';
  sugerirTaxa();
});
$('fTaxa').addEventListener('input', () => { form.taxaManual = $('fTaxa').value !== ''; });

$('fSalvar').onclick = () => {
  const v = num($('fValor').value);
  const t = num($('fTaxa').value);
  const d = $('fData').value;
  if (!d || !v) return toast('Preencha data e valor');
  if (!form.m || !form.p) return toast('Escolha máquina e parcela');
  const venda = { id: novoId(), d, v, t, p: form.p, m: form.m, c: Date.now() };
  if (!semBandeira(form.p)) venda.b = form.b;
  db.vendas.push(venda);
  persistir('nova', venda);
  $('fValor').value = ''; $('fTaxa').value = ''; $('fValorHint').textContent = ''; form.taxaManual = false;
  mesSel = d.slice(0, 7);
  toast(`Venda de ${brl(v)} salva`);
  sugerirTaxa();
  renderRecentes();
  $('fValor').focus();
};

['fValor', 'fTaxa', 'fData'].forEach((id) => $(id).addEventListener('keydown', (e) => { if (e.key === 'Enter') $('fSalvar').click(); }));

// ---------- simular ----------
let simP = '1x', simB = 'VISA';
$('sValor').addEventListener('input', renderRank);

function renderSimular() {
  const todas = [...new Set(maquinas().flatMap(parcelasDe))].sort((a, b) => ordemParcela(a) - ordemParcela(b));
  if (!todas.includes(simP)) simP = todas[0];
  chips($('sParcela'), todas, simP, (p) => { simP = p; $('sBandBox').hidden = semBandeira(p); renderRank(); });
  chips($('sBand'), listaBand(), simB, (b) => { simB = b; renderRank(); }, chipBand, 'cb');
  $('sBandBox').hidden = semBandeira(simP);
  renderRank();
}

function renderRank() {
  const v = num($('sValor').value) || 100;
  const op = maquinas()
    .map((m) => ({ m, r: taxaDe(m, simP, semBandeira(simP) ? null : simB) }))
    .filter((x) => x.r != null)
    .map((x) => ({ ...x, t: v * x.r / 100 }))
    .sort((a, b) => a.t - b.t);
  if (!op.length) { $('sRank').innerHTML = '<div class="empty">Nenhuma máquina aceita essa parcela.</div>'; $('sFrase').innerHTML = ''; return; }

  const melhor = op[0], pior = op[op.length - 1];
  const base = num($('sValor').value) ? '' : ' (exemplo com R$ 100)';
  $('sFrase').innerHTML = op.length > 1
    ? `<p>Para ${brl(v)} em ${simP}${semBandeira(simP) ? '' : ' no ' + BAND[simB].nome}${base}, a mais barata é ${nm(melhor.m)}: ${brl(melhor.t)} de taxa.</p>
       <p>Na ${nm(pior.m)} seriam ${brl(pior.t)}: ${brl(pior.t - melhor.t)} a mais.</p>`
    : `<p>Só a ${nm(melhor.m)} aceita ${simP}.</p>`;
  $('sRank').innerHTML = op.map((x, i) => `
    <div class="row${i === 0 ? ' best' : ''}"><div>${nm(x.m)} ${i === 0 ? '<span class="tag">mais barata</span>' : ''}<br>
      <small>${x.r.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}%</small></div>
      <div class="n"><b>${brl(x.t)}</b><br><small>recebe ${brl(v - x.t)}</small></div></div>`).join('');
}

// ---------- vendas ----------
let mesV, editId = null;
$('mesVendas').onchange = (e) => { mesV = e.target.value; editId = null; renderLista(); };

function renderVendas() {
  preencherMeses($('mesVendas'), mesV ?? mesSel);
  mesV = $('mesVendas').value;
  editId = null;
  renderLista();
}

const opcoes = (lista, sel, rot = (x) => x) => lista.map((x) => `<option value="${x}"${x === sel ? ' selected' : ''}>${rot(x)}</option>`).join('');
const dinheiro = (n) => n.toFixed(2).replace('.', ',');

function linhaEdicao(x) {
  const ms = [...new Set([...maquinas(), x.m])];
  const ps = [...new Set([...parcelasDe(x.m), x.p])].sort((a, b) => ordemParcela(a) - ordemParcela(b));
  return `<tr class="editando" data-id="${x.id}">
    <td class="dt"><input type="date" name="d" value="${x.d}" aria-label="Data"></td>
    <td><select name="m" aria-label="Máquina">${opcoes(ms, x.m, nm)}</select></td>
    <td><select name="p" aria-label="Parcela">${opcoes(ps, x.p)}</select></td>
    <td><select name="b" aria-label="Bandeira"><option value="">Não informada</option>${opcoes(listaBand(), x.b, (k) => BAND[k].nome)}</select></td>
    <td><input name="v" inputmode="decimal" value="${dinheiro(x.v)}" aria-label="Valor (R$)"></td>
    <td><input name="t" inputmode="decimal" value="${dinheiro(x.t)}" aria-label="Taxa (R$)"></td>
    <td colspan="3"><div class="acoes"><button class="ok" data-acao="salvar">Salvar</button><button class="ed" data-acao="cancelar">Cancelar</button></div></td></tr>`;
}

function tabelaVendas(l, comAcoes) {
  return `<table><thead><tr><th>Data</th><th class="l">Máquina</th><th>Parcela</th><th>Bandeira</th><th class="l">Valor</th><th class="l">Taxa</th><th>%</th><th class="l">Líquido</th>${comAcoes ? '<th></th>' : ''}</tr></thead><tbody>
    ${l.map((x) => comAcoes && x.id === editId ? linhaEdicao(x) : `<tr><td>${x.d.slice(8, 10)}/${x.d.slice(5, 7)}/${x.d.slice(2, 4)}</td><td class="l">${nm(x.m)}</td><td>${x.p}</td><td>${semBandeira(x.p) ? '' : logo(x.b)}</td>
      <td class="l">${brl(x.v)}</td><td class="l">${brl(x.t)}</td><td>${pct(x.v ? x.t / x.v : 0)}</td><td class="l">${brl(x.v - x.t)}</td>
      ${comAcoes ? `<td><div class="acoes"><button class="ed" data-acao="editar" data-id="${x.id}">Editar</button><button class="del" data-acao="excluir" data-id="${x.id}">Excluir</button></div></td>` : ''}</tr>`).join('')}</tbody></table>`;
}

function renderLista() {
  const l = db.vendas.filter((x) => x.d.startsWith(mesV)).sort((a, b) => b.d.localeCompare(a.d) || lancadaEm(b) - lancadaEm(a));
  $('lista').innerHTML = l.length ? tabelaVendas(l, true) : '<div class="empty">Sem vendas neste mês</div>';
  const ed = $('lista').querySelector('tr.editando input[name="v"]');
  if (ed) { ed.focus(); ed.select(); }
}

function salvarEdicao(tr) {
  const x = db.vendas.find((y) => y.id === tr.dataset.id);
  const f = (n) => tr.querySelector(`[name="${n}"]`).value;
  const d = f('d'), v = num(f('v')), t = num(f('t'));
  if (!d) return toast('Informe a data');
  if (!v) return toast('Informe o valor da venda');
  if (t > v) return toast('A taxa não pode ser maior que a venda');
  Object.assign(x, { d, m: f('m'), p: f('p'), v, t });
  if (f('b') && !semBandeira(x.p)) x.b = f('b'); else delete x.b;
  persistir('alterada', x);
  editId = null;
  if (!d.startsWith(mesV)) { mesV = d.slice(0, 7); preencherMeses($('mesVendas'), mesV); }
  renderLista();
  toast('Venda atualizada');
}

$('lista').onclick = (e) => {
  const b = e.target.closest('button[data-acao]'); if (!b) return;
  const acao = b.dataset.acao;
  if (acao === 'editar') { editId = b.dataset.id; renderLista(); return; }
  if (acao === 'cancelar') { editId = null; renderLista(); return; }
  if (acao === 'salvar') { salvarEdicao(b.closest('tr')); return; }
  if (acao === 'excluir') {
    if (b.dataset.ok) {
      db.vendas = db.vendas.filter((x) => x.id !== b.dataset.id);
      persistir('excluida', b.dataset.id); renderLista(); toast('Venda excluída');
    } else {
      b.dataset.ok = '1'; b.textContent = 'Confirmar';
      setTimeout(() => { if (b.isConnected) { delete b.dataset.ok; b.textContent = 'Excluir'; } }, 3000);
    }
  }
};
// trocar a máquina na edição atualiza as parcelas e sugere a taxa
$('lista').addEventListener('change', (e) => {
  const tr = e.target.closest('tr.editando'); if (!tr) return;
  if (e.target.name === 'm') {
    const ps = parcelasDe(e.target.value), sel = tr.querySelector('[name="p"]'), atual = sel.value;
    sel.innerHTML = opcoes(ps.length ? ps : [atual], ps.includes(atual) ? atual : ps[0]);
  }
  if (['m', 'p', 'v', 'b'].includes(e.target.name)) {
    const r = taxaDe(tr.querySelector('[name="m"]').value, tr.querySelector('[name="p"]').value, tr.querySelector('[name="b"]').value);
    const v = num(tr.querySelector('[name="v"]').value);
    if (r != null && v) tr.querySelector('[name="t"]').value = dinheiro(v * r / 100);
  }
});
$('lista').addEventListener('keydown', (e) => {
  const tr = e.target.closest('tr.editando'); if (!tr) return;
  if (e.key === 'Enter') { e.preventDefault(); salvarEdicao(tr); }
  if (e.key === 'Escape') { editId = null; renderLista(); }
});

// ---------- taxas das máquinas ----------
const XIS = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 2l8 8M10 2 2 10"/></svg>';

let tabB = 'TODAS';

function renderTaxas() {
  const ms = maquinas();
  chips($('tBand'), ['TODAS', ...listaBand()], tabB, (b) => { tabB = b; renderTaxas(); }, chipBand, 'cb');
  if (!BAND[tabB]) tabB = 'TODAS';
  $('notaBand').innerHTML = tabB === 'TODAS' ? ''
    : `<p>Taxas da bandeira ${BAND[tabB].nome}. Em branco, vale a taxa de "Todas as bandeiras", que aparece apagada no campo.${bandeirasNativas.has(tabB) ? '' : `<button class="btn ghost" id="tiraBand">Excluir a bandeira ${BAND[tabB].nome}</button>`}</p>`;
  const ps = PARCELAS;
  $('erroTaxas').textContent = '';
  if (!ms.length) { $('tabTaxas').innerHTML = '<div class="empty">Nenhuma máquina cadastrada. Acrescente uma acima.</div>'; return; }
  $('tabTaxas').innerHTML = `<table><thead><tr><th class="l">Parcela</th>${ms.map((m) => `<th><span class="cab">${nm(m)}<button class="x" data-tira-maq="${m}" aria-label="Excluir a máquina ${nm(m)}" title="Excluir máquina">${XIS}</button></span></th>`).join('')}</tr></thead><tbody>
    ${ps.map((p) => `<tr><td class="l">${p}</td>${ms.map((m) => {
      const r = db.taxas[m][p];
      if (tabB === 'TODAS' || semBandeira(p)) {
        const trava = tabB !== 'TODAS';
        return `<td><input inputmode="decimal" data-m="${m}" data-p="${p}" value="${r == null ? '' : dinheiro(r)}" placeholder="–" aria-label="${nm(m)} ${p} (%)"${trava ? ' disabled title="PIX não tem bandeira"' : ''}></td>`;
      }
      const esp = db.taxasBand[m]?.[tabB]?.[p];
      return `<td${esp != null ? ' class="difere"' : ''}><input inputmode="decimal" data-m="${m}" data-p="${p}" data-b="${tabB}" value="${esp == null ? '' : dinheiro(esp)}" placeholder="${r == null ? '–' : dinheiro(r)}" aria-label="${nm(m)} ${p} no ${BAND[tabB].nome} (%)"${r == null ? ' disabled title="A máquina não aceita essa parcela"' : ''}></td>`;
    }).join('')}</tr>`).join('')}</tbody></table>`;
}

$('tabTaxas').addEventListener('change', (e) => {
  const i = e.target; if (!i.dataset.m) return;
  const txt = i.value.trim();
  if (i.dataset.b) {
    const m = i.dataset.m, p = i.dataset.p, b = i.dataset.b;
    if (txt === '') { if (db.taxasBand[m]?.[b]) delete db.taxasBand[m][b][p]; }
    else {
      const r = num(txt);
      if (r < 0 || r >= 100) { $('erroTaxas').textContent = `Taxa de ${nm(m)} em ${p} no ${BAND[b].nome} inválida: use um número entre 0 e 100.`; i.focus(); return; }
      ((db.taxasBand[m] ??= {})[b] ??= {})[p] = r;
    }
    $('erroTaxas').textContent = '';
    salvar(); renderTaxas();
    toast(txt === '' ? `${BAND[b].nome} em ${nm(m)} ${p} volta a usar a taxa padrão` : `Taxa do ${BAND[b].nome} em ${nm(m)} ${p} salva`);
    return;
  }
  if (txt === '') db.taxas[i.dataset.m][i.dataset.p] = null;
  else {
    const r = num(txt);
    if (r < 0 || r >= 100) { $('erroTaxas').textContent = `Taxa de ${nm(i.dataset.m)} em ${i.dataset.p} inválida: use um número entre 0 e 100.`; i.focus(); return; }
    db.taxas[i.dataset.m][i.dataset.p] = r;
    i.value = dinheiro(r);
  }
  $('erroTaxas').textContent = '';
  salvar(); toast(`Taxa de ${nm(i.dataset.m)} em ${i.dataset.p} salva`);
});

// excluir pede confirmação no segundo clique
function confirmar(b, fazer) {
  if (b.dataset.ok) return fazer();
  b.dataset.ok = '1'; b.title = 'Clique de novo para confirmar';
  toast('Clique de novo no X para confirmar');
  setTimeout(() => { if (b.isConnected) { delete b.dataset.ok; } }, 3000);
}

$('tabTaxas').addEventListener('click', (e) => {
  const b = e.target.closest('.x'); if (!b) return;
  if (b.dataset.tiraMaq) confirmar(b, () => {
    const m = b.dataset.tiraMaq;
    delete db.taxas[m];
    delete db.taxasBand[m];
    if (form.m === m) { form.m = null; form.p = null; }
    salvar(); renderTaxas(); toast(`${nm(m)} saiu da tabela. As vendas feitas nela continuam no histórico.`);
  });
});

$('formMaq').onsubmit = (e) => {
  e.preventDefault();
  const nome = $('novaMaq').value.trim().replace(/\s+/g, ' ');
  const chave = nome.toUpperCase();
  if (!nome) { $('erroTaxas').textContent = 'Escreva o nome da máquina.'; $('novaMaq').focus(); return; }
  if (db.taxas[chave]) { $('erroTaxas').textContent = `${nm(chave)} já está na tabela.`; $('novaMaq').focus(); return; }
  db.taxas[chave] = Object.fromEntries(PARCELAS.map((p) => [p, null]));
  salvar(); $('novaMaq').value = ''; renderTaxas();
  toast(`${nm(chave)} acrescentada. Preencha as taxas na coluna nova`);
  $('tabTaxas').querySelector(`input[data-m="${CSS.escape(chave)}"]`)?.focus();
};

$('formBand').onsubmit = (e) => {
  e.preventDefault();
  const nome = $('novaBand').value.trim().replace(/\s+/g, ' ');
  const k = nome.toUpperCase();
  if (!nome) { $('erroTaxas').textContent = 'Escreva o nome da bandeira.'; $('novaBand').focus(); return; }
  if (BAND[k] || Object.values(BAND).some((b) => b.nome.toUpperCase() === k)) { $('erroTaxas').textContent = `${nome} já está na lista de bandeiras.`; $('novaBand').focus(); return; }
  db.bandExtra.push({ k, nome });
  registrarExtras();
  salvar(); $('novaBand').value = '';
  tabB = k; renderTaxas();
  toast(`Bandeira ${nome} acrescentada. Preencha só as taxas que mudam`);
};

$('notaBand').addEventListener('click', (e) => {
  const b = e.target.closest('#tiraBand'); if (!b) return;
  const k = tabB, nome = BAND[k].nome;
  if (!b.dataset.ok) {
    b.dataset.ok = '1'; b.textContent = 'Clique de novo para confirmar';
    setTimeout(() => { if (b.isConnected) { delete b.dataset.ok; b.textContent = `Excluir a bandeira ${nome}`; } }, 3000);
    return;
  }
  db.bandExtra = db.bandExtra.filter((x) => x.k !== k);
  for (const m in db.taxasBand) delete db.taxasBand[m][k];
  if (form.b === k) form.b = 'VISA';
  if (simB === k) simB = 'VISA';
  registrarExtras();
  tabB = 'TODAS';
  salvar(); renderTaxas();
  toast(`Bandeira ${nome} excluída. As vendas feitas com ela continuam no histórico`);
});


$('restaurar').onclick = () => {
  const b = $('restaurar');
  if (!b.dataset.ok) {
    b.dataset.ok = '1'; b.textContent = 'Clique de novo para confirmar';
    setTimeout(() => { delete b.dataset.ok; b.textContent = 'Voltar às taxas de 20/10/2026'; }, 3000);
    return;
  }
  db.taxas = structuredClone(TAXAS_OFICIAIS);
  db.taxasBand = {};
  form.m = null; form.p = null;
  delete b.dataset.ok; b.textContent = 'Voltar às taxas de 20/10/2026';
  salvar(); renderTaxas(); toast('Taxas de 20/10/2026 de volta');
};

$('exportar').onclick = async () => {
  const linhas = [['Movimento', 'Faturamento', 'Taxa R$', 'Faturamento Liquido', 'Parcela', 'Maquina', 'Bandeira']]
    .concat([...db.vendas].sort((a, b) => a.d.localeCompare(b.d)).map((x) =>
      [x.d.split('-').reverse().join('/'), x.v, x.t, +(x.v - x.t).toFixed(2), x.p, x.m, BAND[x.b]?.nome || ''].map((c) => typeof c === 'number' ? String(c).replace('.', ',') : c)));
  const csv = '﻿' + linhas.map((l) => l.join(';')).join('\r\n');
  const nome = `taxas_${hoje()}.csv`;
  const P = window.Capacitor?.Plugins;
  try {
    if (P?.Filesystem && P?.Share) {
      const f = await P.Filesystem.writeFile({ path: nome, data: csv, directory: 'CACHE', encoding: 'utf8' });
      await P.Share.share({ title: nome, url: f.uri });
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      a.download = nome; a.click();
    }
  } catch (err) {
    if (!String(err?.message).includes('cancel')) toast('Não consegui exportar: ' + (err?.message || err));
  }
};

// ---------- tema ----------
function aplicarTema(t) {
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
  document.querySelectorAll('#tema button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.t === t));
}
let tema = 'auto';
try { tema = localStorage.getItem('taxas.tema') || 'auto'; } catch (e) { /* sem storage: segue o sistema */ }
aplicarTema(tema);
$('tema').onclick = (e) => {
  const b = e.target.closest('button'); if (!b) return;
  aplicarTema(b.dataset.t);
  try { localStorage.setItem('taxas.tema', b.dataset.t); } catch (err) { /* só não lembra a escolha */ }
};

// no site quem abre é o nuvem.js, depois do login
if (!NA_NUVEM) renderResumo();
