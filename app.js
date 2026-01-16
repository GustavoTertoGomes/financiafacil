// ======================
// Utilitários
// ======================
const $ = (id) => document.getElementById(id);

function parseBRNumber(v) {
  if (typeof v !== "string") return Number(v);
  // aceita "12.345,67" ou "12345.67" ou "12345"
  const cleaned = v.trim().replace(/\./g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

function formatBRL(n) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatPct(n) {
  return `${n.toFixed(2).replace(".", ",")}%`;
}

// Tabela Price
function calcPrice(pv, i, n) {
  // pv = principal; i = taxa ao mês (decimal); n = meses
  if (i === 0) return pv / n;
  const fator = Math.pow(1 + i, n);
  return pv * (i * fator) / (fator - 1);
}

// Gera tabela de amortização (Price)
function buildPriceSchedule(pv, i, n, pmt) {
  let saldo = pv;
  const rows = [];
  for (let m = 1; m <= n; m++) {
    const juros = saldo * i;
    const amort = pmt - juros;
    saldo = Math.max(0, saldo - amort);
    rows.push({ mes: m, parcela: pmt, juros, amort, saldo });
  }
  return rows;
}

// ======================
// Taxa do Banco Central (referência)
// ======================
// Série do SGS (BCB) para "taxa média mensal de juros - PF - aquisição de veículos"
// Endpoint público do BCB: https://api.bcb.gov.br/dados/serie/bcdata.sgs.25471/dados?formato=csv :contentReference[oaicite:2]{index=2}
//
// A ideia: buscar os últimos N valores e pegar o mais recente.
// OBS: Dependendo do navegador/ambiente, pode haver CORS. Se acontecer, a solução é usar um "proxy serverless"
// no Netlify (te mostro abaixo se precisar).
const BCB_SERIES_URL = "/.netlify/functions/bcb-rate";

async function fetchBCBLatestRate() {
  const res = await fetch(BCB_SERIES_URL, { cache: "no-store" });
  if (!res.ok) throw new Error("Falha ao buscar taxa (function)");
  const data = await res.json();

  const taxa = parseBRNumber(data.valueStr);
  if (!Number.isFinite(taxa)) throw new Error("Taxa inválida");

  return { taxa, dateStr: data.dateStr };
}


// Converte taxa anual (%) para mensal (%) se necessário.
// Como a série é "taxa média mensal", muitas vezes o dado já é apresentado como taxa anual média do mês ou taxa mensal.
// Como não dá pra garantir o formato só pelo nome, fazemos o seguinte:
// - Você pode escolher exibir e usar "taxa ao mês" no input.
// - Aqui vamos assumir que o valor vindo do BCB está em % ao ano (muito comum em relatórios) e converter para % ao mês efetiva.
// - Se você notar que o valor está "baixo demais" ou "alto demais", você troca o modo com 1 linha.
const ASSUMIR_BCB_COMO_AO_ANO = true;

function anualParaMensalEfetiva(aaPct) {
  const aa = aaPct / 100;
  const am = Math.pow(1 + aa, 1 / 12) - 1;
  return am * 100;
}

// ======================
// UI + Lógica principal
// ======================
window.addEventListener("DOMContentLoaded", async () => {
  $("year").textContent = new Date().getFullYear();

  // carregar taxa
  try {
    const { taxa, dateStr } = await fetchBCBLatestRate();

    let taxaMesPct;
    if (ASSUMIR_BCB_COMO_AO_ANO) {
      taxaMesPct = anualParaMensalEfetiva(taxa);
    } else {
      taxaMesPct = taxa; // se a série já vier em % ao mês
    }

    $("taxaMes").value = taxaMesPct.toFixed(2).replace(".", ",");
    $("rateDot").style.background = "var(--accent)";
    $("rateDot").style.boxShadow = "0 0 0 4px rgba(34,197,94,.10)";
    $("rateStatus").textContent = `Taxa de referência carregada (último dado: ${dateStr}).`;
  } catch (e) {
    $("rateDot").style.background = "var(--danger)";
    $("rateDot").style.boxShadow = "0 0 0 4px rgba(239,68,68,.10)";
    $("rateStatus").textContent = "Não foi possível carregar a taxa automática. Preencha manualmente.";
    // fallback: um valor padrão apenas para não travar
    if (!$("taxaMes").value) $("taxaMes").value = "2,10";
  }

  $("btnLimpar").addEventListener("click", () => {
    $("calcForm").reset();
    $("entrada").value = "0";
    $("prazo").value = "48";
    $("resultadoCard").hidden = true;
    $("tabela").querySelector("tbody").innerHTML = "";
  });

  $("calcForm").addEventListener("submit", (ev) => {
    ev.preventDefault();

    const valorVeiculo = parseBRNumber($("valorVeiculo").value);
    const entrada = parseBRNumber($("entrada").value || "0");
    const prazo = parseInt(($("prazo").value || "").trim(), 10);
    const taxaMesPct = parseBRNumber($("taxaMes").value);

    if (!Number.isFinite(valorVeiculo) || valorVeiculo <= 0) {
      alert("Digite um valor de veículo válido.");
      return;
    }
    if (!Number.isFinite(entrada) || entrada < 0) {
      alert("Digite uma entrada válida.");
      return;
    }
    if (!Number.isFinite(prazo) || prazo <= 0 || prazo > 120) {
      alert("Digite um prazo válido (1 a 120 meses).");
      return;
    }
    if (!Number.isFinite(taxaMesPct) || taxaMesPct < 0 || taxaMesPct > 30) {
      alert("Digite uma taxa mensal válida (ex: 2,10).");
      return;
    }

    const principal = Math.max(0, valorVeiculo - entrada);
    const i = taxaMesPct / 100;

    const parcela = calcPrice(principal, i, prazo);
    const total = parcela * prazo;
    const juros = total - principal;

    $("kpiParcela").textContent = formatBRL(parcela);
    $("kpiTotal").textContent = formatBRL(total);
    $("kpiJuros").textContent = formatBRL(juros);

    $("detalhesTexto").textContent =
      `Valor do veículo: ${formatBRL(valorVeiculo)} | Entrada: ${formatBRL(entrada)} | Financiado: ${formatBRL(principal)} | ` +
      `Prazo: ${prazo} meses | Taxa: ${formatPct(taxaMesPct)} ao mês | Sistema: Tabela Price.`;

    // tabela
    const tbody = $("tabela").querySelector("tbody");
    tbody.innerHTML = "";

    const schedule = buildPriceSchedule(principal, i, prazo, parcela);
    for (const r of schedule) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${r.mes}</td>
        <td>${formatBRL(r.parcela)}</td>
        <td>${formatBRL(r.juros)}</td>
        <td>${formatBRL(r.amort)}</td>
        <td>${formatBRL(r.saldo)}</td>
      `;
      tbody.appendChild(tr);
    }

    $("resultadoCard").hidden = false;
    $("resultadoCard").scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

