export default async (req, context) => {
  try {
    const url = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.25471/dados/ultimos/24?formato=csv";
    const resp = await fetch(url);

    if (!resp.ok) {
      return new Response(JSON.stringify({ error: "Erro ao buscar taxa do BCB" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const csv = await resp.text();
    const lines = csv.trim().split("\n").slice(1);

    const last = lines[lines.length - 1].split(";");
    const dateStr = last[0];
    const valueStr = last[1];

    return new Response(JSON.stringify({ dateStr, valueStr }), {
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
