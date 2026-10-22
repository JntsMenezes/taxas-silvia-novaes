// aplica o tema salvo antes de pintar a tela, para não piscar
try { const t = localStorage.getItem('taxas.tema'); if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; } catch (e) { /* sem storage: segue o sistema */ }
