// app.js
(() => {
  // Formatadores
  const fmtBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const fmtInt = new Intl.NumberFormat('pt-BR');

  const parseBR = (s) => {
    if (typeof s !== 'string') return 0;
    const n = Number(s.replace(/\./g,'').replace(',', '.').replace(/[^\d.-]/g,''));
    return Number.isFinite(n) ? n : 0;
  };

  const formatPctInput = (el) => {
    const v = parseBR(el.value);
    el.value = v.toFixed(2).replace('.', ',');
  };
  const formatMoneyInput = (el) => {
    const v = parseBR(el.value);
    const inteiro = Math.floor(v);
    const cents = Math.round((v - inteiro) * 100);
    el.value = `${fmtInt.format(inteiro)},${String(cents).padStart(2,'0')}`;
  };

  // Elementos
  const $ = (id) => document.getElementById(id);
  const el = {
    valorInicial: $('valorInicial'),
    aporteMensal: $('aporteMensal'),
    taxa: $('taxa'),
    taxaLegend: $('taxaLegend'),
    aa: $('aa'),
    am: $('am'),
    prazoAnos: $('prazoAnos'),
    prazoMeses: $('prazoMeses'),
    calcular: $('calcular'),
    zerar: $('zerar'),
    valorFuturo: $('valorFuturo'),
    totalInvestido: $('totalInvestido'),
    jurosAcumulados: $('jurosAcumulados'),
    tbody: $('tbody'),
    objetivoValor: $('objetivoValor'),
    objetivoTempo: $('objetivoTempo'),
    objetivoAporte: $('objetivoAporte'),
    objetivoObs: $('objetivoObs'),
    erros: {
      valorInicial: $('erroValorInicial'),
      aporteMensal: $('erroAporteMensal'),
      taxa: $('erroTaxa'),
      prazo: $('erroPrazo'),
    }
  };

  // Máscaras
  el.valorInicial.addEventListener('blur', () => formatMoneyInput(el.valorInicial));
  el.aporteMensal.addEventListener('blur', () => formatMoneyInput(el.aporteMensal));
  el.taxa.addEventListener('blur', () => formatPctInput(el.taxa));
  if (el.objetivoValor) el.objetivoValor.addEventListener('blur', () => formatMoneyInput(el.objetivoValor));

  // Alternância a.a./a.m.
  const updateLegend = () => {
    el.taxaLegend.textContent = `Taxa (% ${el.aa.checked ? 'a.a.' : 'a.m.'})`;
  };
  document.querySelectorAll('input[name="taxaBase"]').forEach(r =>
    r.addEventListener('change', () => { updateLegend(); trigger(); })
  );
  updateLegend();

  // Erros
  const setError = (key, msg='') => { el.erros[key].textContent = msg; };

  // Gráfico
  const ctx = document.getElementById('grafico').getContext('2d');
  const chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Valor total',
          data: [],
          borderColor: '#ff7a00',
          backgroundColor: 'rgba(255,122,0,0.15)',
          borderWidth: 3,
          tension: 0.2,
          pointRadius: 0,
          fill: true
        },
        {
          label: 'Total investido',
          data: [],
          borderColor: '#ffffff',
          borderDash: [6,6],
          borderWidth: 2,
          tension: 0.2,
          pointRadius: 0,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top', labels: { color: '#fff' } },
        tooltip: {
          callbacks: {
            title: (items) => `Mês ${items[0].label}`,
            label: (ctx) => `${ctx.dataset.label}: ${fmtBRL.format(ctx.parsed.y)}`
          }
        }
      },
      scales: {
        x: { ticks: { color: 'var(--tick)' }, grid: { color: 'var(--grid)' } },
        y: {
          ticks: { color: 'var(--tick)', callback: v => fmtBRL.format(v) },
          grid: { color: 'var(--grid)' }
        }
      }
    }
  });

  // Cálculo principal
  const validate = ({P0, PMT, taxaPct, n}) => {
    let ok = true;
    if (P0 < 0) { setError('valorInicial','Informe um valor maior ou igual a R$ 0,00'); ok = false; } else setError('valorInicial','');
    if (PMT < 0){ setError('aporteMensal','Informe um valor maior ou igual a R$ 0,00'); ok = false; } else setError('aporteMensal','');
    if (taxaPct < 0){ setError('taxa','Informe uma taxa válida maior ou igual a 0%'); ok = false; } else setError('taxa','');
    if (n < 1)   { setError('prazo','Informe um prazo mínimo de 1 mês'); ok = false; } else setError('prazo','');
    return ok;
  };

  const compute = () => {
    const P0 = parseBR(el.valorInicial.value);
    const PMT = parseBR(el.aporteMensal.value);
    const taxaPct = parseBR(el.taxa.value);
    const baseAA = el.aa.checked;
    const anos = Number(el.prazoAnos.value || 0);
    const meses = Number(el.prazoMeses.value || 0);
    const n = Math.max(0, Math.trunc(anos))*12 + Math.max(0, Math.trunc(meses));

    const vals = { P0, PMT, taxaPct, n };
    if (!validate(vals)) return null;

    let i;
    if (baseAA) {
      i = Math.pow(1 + taxaPct/100, 1/12) - 1; // taxa mensal equivalente
    } else {
      i = taxaPct/100; // taxa mensal direta
    }

    const labels = [];
    const saldoSerie = [];
    const investidoSerie = [];
    const rows = [];

    let saldo = P0;
    for (let m = 1; m <= n; m++){
      saldo = (m === 1 ? P0 : saldo) * (1 + i) + PMT;
      const totalInvestido = P0 + PMT * m;
      const juros = saldo - totalInvestido;

      labels.push(String(m));
      saldoSerie.push(saldo);
      investidoSerie.push(totalInvestido);
      rows.push({ mes: m, aporte: PMT, investido: totalInvestido, juros, saldo });
    }

    const valorFuturo = n === 0 ? P0 : saldo;
    const totalInv = P0 + PMT * n;
    const jurosAcum = valorFuturo - totalInv;

    return { labels, saldoSerie, investidoSerie, rows, valorFuturo, totalInv, jurosAcum, P0, PMT, i, n };
  };

  // --- Objetivo: tempo para alcançar (com parâmetros atuais)
  function tempoParaObjetivo({ P0, PMT, i, objetivo }, maxMeses = 1200){
    if (!objetivo || objetivo <= 0) return null;
    if (P0 >= objetivo) return 0;

    // Caso i=0 (sem juros): só acumula aportes
    if (i === 0){
      const falta = objetivo - P0;
      if (PMT <= 0) return Infinity;
      return Math.ceil(falta / PMT);
    }

    // Iteração mensal (estável e fácil de entender)
    let saldo = P0;
    for (let m = 1; m <= maxMeses; m++){
      saldo = saldo * (1 + i) + PMT;
      if (saldo >= objetivo) return m;
    }
    return Infinity; // não alcança dentro do limite
  }

  // --- Objetivo: aporte necessário para atingir no prazo atual
  function aporteNecessario({ FV, P0, i, n }){
    if (!n || n <= 0) return 0;
    if (i === 0){
      // Sem juros: PMT = (FV - P0)/n
      const p = (FV - P0)/n;
      return p < 0 ? 0 : p;
    }
    const fator = Math.pow(1+i, n);
    const num = (FV - P0 * fator) * i;
    const den = (fator - 1);
    const PMT = num / den;
    return PMT < 0 ? 0 : PMT;
  }

  const render = (data) => {
    if (!data) return;

    el.valorFuturo.textContent   = fmtBRL.format(round2(data.valorFuturo));
    el.totalInvestido.textContent = fmtBRL.format(round2(data.totalInv));
    el.jurosAcumulados.textContent= fmtBRL.format(round2(data.jurosAcum));

    chart.data.labels = data.labels;
    chart.data.datasets[0].data = data.saldoSerie;
    chart.data.datasets[1].data = data.investidoSerie;
    chart.update('none');

    const frag = document.createDocumentFragment();
    data.rows.forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${r.mes}</td>
        <td class="num">${fmtBRL.format(round2(r.aporte))}</td>
        <td class="num">${fmtBRL.format(round2(r.investido))}</td>
        <td class="num">${fmtBRL.format(round2(r.juros))}</td>
        <td class="num">${fmtBRL.format(round2(r.saldo))}</td>
      `;
      frag.appendChild(tr);
    });
    el.tbody.replaceChildren(frag);

    // ---- Objetivo Financeiro ----
    const objetivo = el.objetivoValor ? parseBR(el.objetivoValor.value) : 0;
    if (el.objetivoValor && objetivo > 0){
      // Tempo para alcançar com parâmetros atuais
      const meses = tempoParaObjetivo({ P0: data.P0, PMT: data.PMT, i: data.i, objetivo });
      if (meses === Infinity){
        el.objetivoTempo.textContent = 'Não alcança em 100 anos com os parâmetros atuais';
      } else if (meses === 0){
        el.objetivoTempo.textContent = 'Já atingido';
      } else {
        const anos = Math.floor(meses / 12);
        const rest = meses % 12;
        el.objetivoTempo.textContent =
          anos > 0 ? `${anos} ano(s) e ${rest} mês(es)` : `${meses} mês(es)`;
      }

      // Aporte necessário para atingir no prazo atual (n meses)
      const pNec = aporteNecessario({ FV: objetivo, P0: data.P0, i: data.i, n: data.n });
      el.objetivoAporte.textContent = fmtBRL.format(round2(pNec));
      el.objetivoObs.textContent = pNec === 0
        ? 'Com o capital presente e prazo, o objetivo já é atendido.'
        : '';
    } else if (el.objetivoTempo && el.objetivoAporte){
      el.objetivoTempo.textContent = '—';
      el.objetivoAporte.textContent = '—';
      el.objetivoObs.textContent = '';
    }
  };

  const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

  // Debounce
  const debounce = (fn, t=200) => {
    let id; return (...a) => { clearTimeout(id); id = setTimeout(() => fn(...a), t); };
  };
  const trigger = debounce(() => render(compute()), 200);

  // Eventos
  ['input','change'].forEach(e=>{
    el.valorInicial.addEventListener(e, trigger);
    el.aporteMensal.addEventListener(e, trigger);
    el.taxa.addEventListener(e, trigger);
    el.prazoAnos.addEventListener(e, trigger);
    el.prazoMeses.addEventListener(e, trigger);
    if (el.objetivoValor) el.objetivoValor.addEventListener(e, trigger);
  });
  $('calcular').addEventListener('click', () => render(compute()));
  $('zerar').addEventListener('click', () => {
    el.valorInicial.value = '1.000,00';
    el.aporteMensal.value = '500,00';
    el.taxa.value = '12,00';
    el.aa.checked = true; el.am.checked = false; updateLegend();
    el.prazoAnos.value = 5; el.prazoMeses.value = 0;
    if (el.objetivoValor) el.objetivoValor.value = '100.000,00';
    setError('valorInicial',''); setError('aporteMensal',''); setError('taxa',''); setError('prazo','');
    render(compute());
  });

  // Inicial
  render(compute());
})();
