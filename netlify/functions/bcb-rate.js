function fmtBR(d) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export default async () => {
  try {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 36); // 36 meses pra garantir retorno

    const url =
      "https://api.bcb.gov.br/dados/serie/bcdata.sgs.25471/dados" +
      `?formato=json&dataInicial=${encodeURIComponent(fmtBR(start))}` +
      `&dataFinal=${encodeURIComponent(fmtBR(end))}`;

    const resp = await fetch(url, {
      headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0" }
    });

    if (!resp.ok) {
      return new Response(
        JSON.stringify({ error: "Erro ao buscar taxa do BCB", status: resp.status }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const data = await resp.json();
    if (!Array.isArray(data) || data.length === 0) {
      return new Response(JSON.stringify({ error: "Resposta vazia do BCB" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const last = data[data.length - 1]; // { data: "dd/mm/aaaa", valor: "X.XX" }

    return new Response(JSON.stringify({ dateStr: last.data, valueStr: last.valor }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Falha geral", details: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};

