export default async (req, context) => {
  try {
    const url =
      "https://api.bcb.gov.br/dados/serie/bcdata.sgs.25471/dados/ultimos/24?formato=json";

    const resp = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json"
      }
    });

    if (!resp.ok) {
      return new Response(
        JSON.stringify({
          error: "Erro ao buscar taxa do BCB",
          status: resp.status
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const data = await resp.json();
    if (!Array.isArray(data) || data.length === 0) {
      return new Response(
        JSON.stringify({ error: "Resposta vazia do BCB" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const last = data[data.length - 1];

    // last = { data: "dd/mm/aaaa", valor: "X.XX" }
    return new Response(
      JSON.stringify({
        dateStr: last.data,
        valueStr: last.valor
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Falha geral", details: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
