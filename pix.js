'use strict';
// Pix copia e cola (BR Code estático, padrão EMV do Banco Central) com o valor preenchido.

const PIX_TIPOS = { cpf: 'CPF', cnpj: 'CNPJ', celular: 'Celular', email: 'E-mail', aleatoria: 'Chave aleatória' };

const semAcento = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9 .\-]/g, '').trim();

// deixa a chave no formato que o Banco Central espera; devolve { chave } ou { erro }
function normalizarChave(tipo, bruta) {
  const t = String(bruta || '').trim();
  const dig = t.replace(/\D/g, '');
  if (tipo === 'cpf') return dig.length === 11 ? { chave: dig } : { erro: 'O CPF precisa ter 11 números.' };
  if (tipo === 'cnpj') return dig.length === 14 ? { chave: dig } : { erro: 'O CNPJ precisa ter 14 números.' };
  if (tipo === 'celular') {
    const n = dig.length >= 12 && dig.startsWith('55') ? dig : '55' + dig;
    return /^55\d{10,11}$/.test(n) ? { chave: '+' + n } : { erro: 'Digite o celular com DDD, por exemplo (19) 99999-1234.' };
  }
  if (tipo === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t) ? { chave: t.toLowerCase() } : { erro: 'O e-mail da chave não parece completo.' };
  if (tipo === 'aleatoria') return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t) ? { chave: t.toLowerCase() } : { erro: 'A chave aleatória tem 36 caracteres, no formato 1234abcd-12ab-34cd-56ef-123456abcdef.' };
  return { erro: 'Escolha o tipo da chave.' };
}

// CRC16-CCITT (polinômio 0x1021, início 0xFFFF), exigido no fim do código
function crc16(txt) {
  let crc = 0xffff;
  for (let i = 0; i < txt.length; i++) {
    crc ^= txt.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function brCode({ chave, nome, cidade, valor }) {
  const campo = (id, v) => id + String(v.length).padStart(2, '0') + v;
  const conta = campo('00', 'br.gov.bcb.pix') + campo('01', chave);
  let p = campo('00', '01') + campo('26', conta) + campo('52', '0000') + campo('53', '986');
  if (valor) p += campo('54', valor.toFixed(2));
  p += campo('58', 'BR') + campo('59', semAcento(nome).slice(0, 25) || 'RECEBEDOR') + campo('60', semAcento(cidade).slice(0, 15) || 'BRASIL') + campo('62', campo('05', '***')) + '6304';
  return p + crc16(p);
}

// texto definido pela loja (imagem do WhatsApp de 22/10/2026), igual ao que ela manda à cliente
function mensagemCobranca(conta, valor) {
  return [
    'Olá! Aqui é da Sílvia Novaes Acessórios. ✨',
    '',
    `O valor da sua compra ficou em ${brl(valor)}. 🛍️`,
    '',
    'Segue chave Pix cópia e cola:',
    brCode({ ...conta, valor }),
    '',
    `Se preferir digitar, a chave Pix é ${conta.mostrar || conta.chave}, em nome de ${conta.nome}.`,
    '',
    'Ao efetuar o pagamento por gentileza encaminhe o comprovante 🥰',
    '',
    'Desde já, obrigada ✨',
  ].join('\n');
}

// ---------- tela: "Cobrar pelo WhatsApp" no Lançar, quando a forma é Pix da loja ----------
let cobEditando = false;

function atualizarCobranca() {
  const box = $('cobranca');
  box.hidden = form.m !== 'PIX DA LOJA';
  if (box.hidden) return;
  const c = db.pixConta;
  const mostrarForm = cobEditando || !c;
  $('cobForm').hidden = !mostrarForm;
  $('cobPronta').hidden = mostrarForm;
  $('cobCancelar').hidden = !c;
  if (c) $('cobChave').textContent = `Chave ${PIX_TIPOS[c.tipo] || ''}: ${c.mostrar || c.chave} · ${c.nome}`;
  if (mostrarForm) {
    $('cobTipo').value = c?.tipo || 'celular';
    $('cobValor').value = c?.mostrar || '';
    $('cobNome').value = c?.nome || '';
    $('cobCidade').value = c?.cidade || '';
    $('cobErro').textContent = '';
  }
}

$('cobAlterar').onclick = () => { cobEditando = true; atualizarCobranca(); $('cobValor').focus(); };
$('cobCancelar').onclick = () => { cobEditando = false; atualizarCobranca(); };
$('cobSalvar').onclick = () => {
  const tipo = $('cobTipo').value, r = normalizarChave(tipo, $('cobValor').value);
  const nome = $('cobNome').value.trim(), cidade = $('cobCidade').value.trim();
  if (r.erro) { $('cobErro').textContent = r.erro; $('cobValor').focus(); return; }
  if (!nome) { $('cobErro').textContent = 'Escreva o nome do recebedor, como aparece no banco.'; $('cobNome').focus(); return; }
  if (!cidade) { $('cobErro').textContent = 'Escreva a cidade da loja (vai no código do Pix).'; $('cobCidade').focus(); return; }
  db.pixConta = { tipo, chave: r.chave, mostrar: $('cobValor').value.trim(), nome, cidade };
  cobEditando = false;
  salvar();
  atualizarCobranca();
  toast('Chave Pix da loja salva');
};

function cobrancaAtual() {
  const valor = num($('fValor').value);
  if (!valor) { toast('Digite o valor da venda primeiro'); $('fValor').focus(); return null; }
  return mensagemCobranca(db.pixConta, valor);
}

async function copiarTexto(txt) {
  try { await navigator.clipboard.writeText(txt); return true; } catch (e) {
    // sem permissão de área de transferência: copia pelo jeito antigo
    const t = document.createElement('textarea');
    t.value = txt; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
    document.body.appendChild(t); t.select();
    const ok = document.execCommand('copy'); t.remove(); return ok;
  }
}

$('cobCopiar').onclick = async () => {
  const msg = cobrancaAtual(); if (!msg) return;
  toast(await copiarTexto(msg) ? 'Cobrança copiada. Cole na conversa com a cliente.' : 'Não consegui copiar. Tente de novo.');
};
$('cobWhats').onclick = () => {
  const msg = cobrancaAtual(); if (!msg) return;
  window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank');
};
