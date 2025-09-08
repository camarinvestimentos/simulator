// ===== Util =====
const fmtBRL = (n) => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n);
const parseBRL = (str) => Number(String(str).replace(/\./g,'').replace(',','.')) || 0;

// ===== Seletores =====
const els = {
  valorInicial: document.querySelector('#valorInicial'),
  prazo: document.querySelector('#prazo'),
  rendimento: document.querySelector('#rendimento'),
  aporte: document.querySelector('#aporte'),
  recorrencia: document.querySelector('#recorrencia'),
  simular: document.querySelector('#simular'),
  exemplo: document.querySelector('#exemplo'),
  erro: document.querySelector('#erro'),
  kpiFinal: document.querySelector('#kpiFinal'),
  kpiInvestido: document.querySelector('#kpiInvestido'),
  kpiJuros: document.querySelector('#kpiJuros'),
  tabelaBody: document.querySelector('#tabela tbody'),
  chart: document.querySelector('#chart'),
  tooltip: document.querySelector('#tooltip'),
};

// ===== Lógica de Simulação =====
function simular() {
  const valorInicial = parseBRL(els.valorInicial.value);
  const prazo = Number(els.prazo.value);
  const taxaAA = Number(els.rendimento.value)/100;
  const aporte = parseBRL(els.aporte.value);
  const freq = Number(els.recorrencia.value);

  if(!(valorInicial>=0 && prazo>0 && taxaAA>=0)) {
    els.erro.style.display = 'block';
    return;
  }
  els.erro.style.display = 'none';

  const meses = Math.round(prazo*12);
  const taxaMensal = Math.pow(1+taxaAA, 1/12) - 1;
  let saldo = valorInicial, investido = valorInicial;
  const pontos = [];

  for(let m=1; m<=meses; m++){
    saldo *= (1+taxaMensal);
    if(m % freq === 0){ saldo += aporte; investido += aporte; }
    pontos.push({m, saldo, investido, juros: saldo - investido});
  }

  // KPIs
  els.kpiFinal.textContent = fmtBRL(saldo);
  els.kpiInvestido.textContent = fmtBRL(investido);
  els.kpiJuros.textContent = fmtBRL(saldo - investido);

  // Tabela
  els.tabelaBody.innerHTML = pontos.map(p=>`
    <tr>
      <td>${p.m}</td>
      <td>${fmtBRL(p.saldo)}</td>
      <td>${fmtBRL(p.investido)}</td>
      <td>${fmtBRL(p.juros)}</td>
    </tr>
  `).join('');

  // Gráfico
  desenharGrafico(pontos);
}

// ===== Gráfico Interativo SVG =====
function desenharGrafico(pontos){
  const svg = els.chart;
  svg.innerHTML = '';
  els.tooltip.hidden = true;

  if(!pontos.length) return;

  const W=1000, H=280, PADL=50, PADR=20, PADT=20, PADB=28;
  const innerW = W - PADL - PADR;
  const innerH = H - PADT - PADB;

  const yMax = Math.max(...pontos.map(p=>p.saldo));
  const yMin = 0;
  const xScale = m => PADL + innerW * ((m-1)/(pontos.length-1 || 1));
  const yScale = v => PADT + innerH * (1 - (v - yMin)/(yMax - yMin || 1));

  // Grid horizontal (4 linhas)
  const gridGroup = document.createElementNS('http://www.w3.org/2000/svg','g');
  const ticks = 4;
  for(let i=0;i<=ticks;i++){
    const y = PADT + innerH * (i/ticks);
    const line = lineEl( PADL, y, W-PADR, y, 'gridline' );
    gridGroup.appendChild(line);

    // labels de eixo Y (valores)
    const val = yMax * (1 - i/ticks);
    const lbl = textEl(fmtBRL(val), 8, y+4, '12px', 'end', 'middle');
    gridGroup.appendChild(lbl);
  }
  svg.appendChild(gridGroup);

  // Eixo X (linha)
  svg.appendChild(lineEl(PADL, H-PADB, W-PADR, H-PADB, 'axis'));

  // Caminhos
  const pathSaldo = pontos.map((p,i)=>`${i?'L':'M'}${xScale(p.m)},${yScale(p.saldo)}`).join('');
  const pathInv = pontos.map((p,i)=>`${i?'L':'M'}${xScale(p.m)},${yScale(p.investido)}`).join('');

  // Área sob a curva do saldo
  const fillSaldo = document.createElementNS('http://www.w3.org/2000/svg','path');
  fillSaldo.setAttribute('d', `${pathSaldo} L ${xScale(pontos[pontos.length-1].m)},${H-PADB} L ${xScale(pontos[0].m)},${H-PADB} Z`);
  fillSaldo.setAttribute('class','fill-saldo');
  svg.appendChild(fillSaldo);

  const saldoPathEl = pathEl(pathSaldo, 'path-saldo');
  const invPathEl   = pathEl(pathInv, 'path-invest');
  svg.appendChild(invPathEl);
  svg.appendChild(saldoPathEl);

  // Marcadores (pontos) – desenhamos poucos para não poluir (amostragem)
  const step = Math.ceil(pontos.length / 24);
  const pointsGroup = document.createElementNS('http://www.w3.org/2000/svg','g');
  for(let i=0;i<pontos.length;i+=step){
    const p = pontos[i];
    pointsGroup.appendChild(circleEl(xScale(p.m), yScale(p.saldo), 2.5, 'marker'));
    pointsGroup.appendChild(circleEl(xScale(p.m), yScale(p.investido), 2, 'marker-invest'));
  }
  svg.appendChild(pointsGroup);

  // Linha vertical do cursor
  const cursorLine = lineEl(0, PADT, 0, H-PADB, 'cursor-line');
  cursorLine.setAttribute('opacity','0');
  svg.appendChild(cursorLine);

  // Interatividade
  const bbox = svg.getBoundingClientRect();
  const onMove = (e) => {
    const x = (e.clientX - bbox.left) * (W / bbox.width);
    const clamped = Math.min(Math.max(x, PADL), W-PADR);
    const t = (clamped - PADL) / innerW;
    const idx = Math.round(t * (pontos.length-1));
    const p = pontos[idx];
    if(!p) return;

    // Atualiza cursor
    cursorLine.setAttribute('x1', xScale(p.m));
    cursorLine.setAttribute('x2', xScale(p.m));
    cursorLine.setAttribute('opacity','1');

    // Tooltip
    const tx = (e.clientX - bbox.left);
    const ty = yScale(p.saldo) * (bbox.height / H);

    els.tooltip.innerHTML = `
      <div><strong>Mês ${p.m}</strong></div>
      <div class="muted">Saldo: <strong>${fmtBRL(p.saldo)}</strong></div>
      <div class="muted">Investido: ${fmtBRL(p.investido)}</div>
      <div class="muted">Juros: ${fmtBRL(p.juros)}</div>
    `;
    els.tooltip.style.left = `${tx}px`;
    els.tooltip.style.top  = `${ty}px`;
    els.tooltip.hidden = false;
  };

  const onLeave = () => {
    cursorLine.setAttribute('opacity','0');
    els.tooltip.hidden = true;
  };

  svg.addEventListener('mousemove', onMove);
  svg.addEventListener('mouseleave', onLeave);

  // ===== Helpers SVG =====
  function lineEl(x1,y1,x2,y2, cls){
    const el = document.createElementNS('http://www.w3.org/2000/svg','line');
    el.setAttribute('x1',x1); el.setAttribute('y1',y1);
    el.setAttribute('x2',x2); el.setAttribute('y2',y2);
    el.setAttribute('class', cls);
    return el;
  }
  function pathEl(d, cls){
    const el = document.createElementNS('http://www.w3.org/2000/svg','path');
    el.setAttribute('d', d);
    el.setAttribute('class', cls);
    return el;
  }
  function circleEl(cx, cy, r, cls){
    const el = document.createElementNS('http://www.w3.org/2000/svg','circle');
    el.setAttribute('cx', cx); el.setAttribute('cy', cy); el.setAttribute('r', r);
    el.setAttribute('class', cls);
    return el;
  }
  function textEl(text, x, y, size='12px', anchor='start', baseline='alphabetic'){
    const el = document.createElementNS('http://www.w3.org/2000/svg','text');
    el.textContent = text;
    el.setAttribute('x', x); el.setAttribute('y', y);
    el.setAttribute('font-size', size);
    el.setAttribute('fill', '#c9cbd1');
    el.setAttribute('text-anchor', anchor);
    el.setAttribute('dominant-baseline', baseline);
    return el;
  }
}

// ===== Eventos =====
els.simular.addEventListener('click', simular);
els.exemplo.addEventListener('click', ()=>{
  els.valorInicial.value="10.000,00";
  els.prazo.value="5";
  els.rendimento.value="12";
  els.aporte.value="500,00";
  els.recorrencia.value="1";
  simular();
});

// Primeiro render (opcional)
// simular();
