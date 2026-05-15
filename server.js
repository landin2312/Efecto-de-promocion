import express from "express";
import OpenAI from "openai";

const app = express();
const port = process.env.PORT || 3000;
const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

app.use(express.json({ limit: "1mb" }));
app.use(express.static("docs"));

app.post("/api/conclusiones", async (req, res) => {
  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({
      error: "OPENAI_API_KEY no configurada. Se usara fallback local en el navegador.",
    });
  }

  const summary = sanitizeSummary(req.body);
  if (!summary.products.length) {
    return res.status(400).json({ error: "No hay productos para analizar." });
  }

  try {
    const client = new OpenAI();
    const response = await client.responses.create({
      model,
      input: [
        {
          role: "developer",
          content:
            "Eres consultor de retail. Responde en espanol, en 4 a 6 bullets breves, con recomendaciones accionables. Incluye efectos positivos, riesgos, calidad de datos y una correccion sugerida si la utilidad cae.",
        },
        {
          role: "user",
          content: `Analiza este resumen de promociones normalizado por ${summary.period}. Usa porcentajes como puntos comparativos, no inventes datos externos.\n\n${JSON.stringify(summary, null, 2)}`,
        },
      ],
    });

    const text = response.output_text || "";
    const conclusions = text
      .split(/\n+/)
      .map((line) => line.replace(/^[-*]\s*/, "").trim())
      .filter(Boolean)
      .slice(0, 8);

    return res.json({ model, conclusions });
  } catch (error) {
    return res.status(500).json({
      error: "No se pudieron generar conclusiones con LLM.",
      detail: error.message,
    });
  }
});

app.listen(port, () => {
  console.log(`Efecto de promociones escuchando en puerto ${port}`);
});

function sanitizeSummary(body = {}) {
  return {
    period: String(body.period || "dia").slice(0, 20),
    selectedSku: String(body.selectedSku || "__top3__").slice(0, 80),
    products: Array.isArray(body.products)
      ? body.products.slice(0, 3).map((product) => ({
          sku: String(product.sku || "").slice(0, 80),
          name: String(product.name || "").slice(0, 120),
          promoPeriods: numberOrNull(product.promoPeriods),
          basePeriods: numberOrNull(product.basePeriods),
          unitsUplift: numberOrNull(product.unitsUplift),
          revenueUplift: numberOrNull(product.revenueUplift),
          profitUplift: numberOrNull(product.profitUplift),
          avgPromoUnits: numberOrNull(product.avgPromoUnits),
          avgBaseUnits: numberOrNull(product.avgBaseUnits),
          avgPromoRevenue: numberOrNull(product.avgPromoRevenue),
          avgBaseRevenue: numberOrNull(product.avgBaseRevenue),
          avgPromoProfit: numberOrNull(product.avgPromoProfit),
          avgBaseProfit: numberOrNull(product.avgBaseProfit),
        }))
      : [],
    warnings: Array.isArray(body.warnings)
      ? body.warnings.slice(0, 10).map((warning) => String(warning).slice(0, 220))
      : [],
    errors: Array.isArray(body.errors)
      ? body.errors.slice(0, 10).map((error) => String(error).slice(0, 220))
      : [],
  };
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
