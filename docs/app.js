const fileInput = document.querySelector("#fileInput");
const runBtn = document.querySelector("#runBtn");
const addPromoBtn = document.querySelector("#addPromoBtn");
const promoRows = document.querySelector("#promoRows");
const periodSelect = document.querySelector("#periodSelect");
const fileStatus = document.querySelector("#fileStatus");
const errorBox = document.querySelector("#errorBox");
const dashboard = document.querySelector("#dashboard");
const summaryMetrics = document.querySelector("#summaryMetrics");
const previewHead = document.querySelector("#previewTable thead");
const previewBody = document.querySelector("#previewTable tbody");

let rawRows = [];
let charts = [];

const aliases = {
  date: ["fecha", "date", "dia", "semana", "fecha_venta", "transaction_date"],
  sku: ["sku", "producto_id", "id_producto", "product_id", "codigo", "articulo"],
  name: ["producto_nombre", "nombre_producto", "producto", "product_name", "descripcion"],
  units: ["unidades", "cantidad", "cantidad_vendida", "ventas_unidades", "qty", "quantity"],
  price: ["precio", "precio_final", "precio_venta", "price", "unit_price", "venta_unitaria"],
  cost: ["costo", "costo_unitario", "cost", "unit_cost"],
  revenue: ["ingresos", "venta_neta", "ventas", "revenue", "sales"],
  promo: ["promocion", "promo", "campana", "descuento_activo", "is_promo"],
};

const colors = ["#2563eb", "#0f766e", "#b45309"];

fileInput.addEventListener("change", handleFile);
runBtn.addEventListener("click", processDashboard);
addPromoBtn.addEventListener("click", () => addPromoRow());
addPromoRow();

async function handleFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  fileStatus.textContent = `Leyendo ${file.name}`;
  try {
    rawRows = await readFile(file);
    rawRows = rawRows.filter((row) => Object.values(row).some((value) => String(value ?? "").trim()));
    renderPreview(rawRows);
    runBtn.disabled = rawRows.length === 0;
    fileStatus.textContent = `${rawRows.length.toLocaleString("es-MX")} filas cargadas`;
    errorBox.className = "diagnostics empty";
    errorBox.textContent = "Archivo cargado. Procesa el dashboard para ver diagnostico completo.";
  } catch (error) {
    rawRows = [];
    runBtn.disabled = true;
    fileStatus.textContent = "No se pudo leer el archivo";
    errorBox.className = "diagnostics";
    errorBox.innerHTML = `<strong>Error:</strong> ${escapeHtml(error.message)}`;
  }
}

function readFile(file) {
  const extension = file.name.split(".").pop().toLowerCase();
  if (extension === "csv") {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false,
        complete: (result) => resolve(result.data),
        error: reject,
      });
    });
  }

  if (["xlsx", "xls"].includes(extension)) {
    return file.arrayBuffer().then((buffer) => {
      const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      return XLSX.utils.sheet_to_json(firstSheet, { defval: "" });
    });
  }

  throw new Error("Formato no soportado. Usa CSV, XLSX o XLS.");
}

function renderPreview(rows) {
  const columns = Object.keys(rows[0] || {}).slice(0, 12);
  previewHead.innerHTML = `<tr>${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}</tr>`;
  previewBody.innerHTML = rows
    .slice(0, 12)
    .map(
      (row) =>
        `<tr>${columns.map((column) => `<td>${escapeHtml(formatCell(row[column]))}</td>`).join("")}</tr>`
    )
    .join("");
}

function processDashboard() {
  const mapped = mapColumns(rawRows);
  if (mapped.errors.length) {
    renderDiagnostics(mapped.errors, []);
    dashboard.classList.add("hidden");
    return;
  }

  const manualPromos = readManualPromos();
  const normalized = normalizeRows(mapped.rows, mapped.columns, manualPromos);
  const analysis = analyze(normalized.rows, periodSelect.value);

  renderDiagnostics(normalized.errors, normalized.warnings);
  renderDashboard(analysis, normalized.errors, normalized.warnings);
}

function mapColumns(rows) {
  const columns = Object.keys(rows[0] || {});
  const normalizedNames = new Map(columns.map((column) => [normalizeKey(column), column]));
  const found = {};

  Object.entries(aliases).forEach(([key, names]) => {
    found[key] = names.map(normalizeKey).map((name) => normalizedNames.get(name)).find(Boolean);
  });

  const errors = [];
  ["date", "sku", "units", "price"].forEach((key) => {
    if (!found[key]) errors.push(`Falta una columna obligatoria para ${key}: ${aliases[key].join(", ")}.`);
  });

  return { columns: found, errors, rows };
}

function normalizeRows(rows, columns, manualPromos) {
  const errors = [];
  const warnings = [];
  const bySkuPrices = new Map();
  const skuDateCounts = new Map();

  if (!columns.cost) {
    warnings.push("No se encontro columna de costo. La utilidad se mostrara como 0 y no debe usarse para concluir rentabilidad.");
  }

  const parsed = rows
    .map((row, index) => {
      const date = parseDate(row[columns.date]);
      const sku = String(row[columns.sku] ?? "").trim();
      const units = parseNumber(row[columns.units]);
      const price = parseNumber(row[columns.price]);
      const cost = columns.cost ? parseNumber(row[columns.cost]) : 0;
      const revenue = columns.revenue ? parseNumber(row[columns.revenue]) : units * price;
      const name = columns.name ? String(row[columns.name] || sku).trim() : sku;

      if (!date) errors.push(`Fila ${index + 2}: fecha invalida.`);
      if (!sku) errors.push(`Fila ${index + 2}: SKU o producto_id vacio.`);
      if (!Number.isFinite(units) || units < 0) errors.push(`Fila ${index + 2}: unidades invalidas.`);
      if (!Number.isFinite(price) || price <= 0) errors.push(`Fila ${index + 2}: precio invalido.`);
      if (Number.isFinite(cost) && cost > price) {
        warnings.push(
          `Fila ${index + 2}: costo (${cost}) mayor al precio (${price}) en ${sku}. Se mantiene en el analisis, pero esa venta destruye margen.`
        );
      }
      if (Number.isFinite(revenue) && Number.isFinite(units) && units > 0) {
        const impliedPrice = revenue / units;
        if (Math.abs(impliedPrice - price) / price > 0.08) {
          warnings.push(`Fila ${index + 2}: ingresos no coinciden con unidades por precio en ${sku}.`);
        }
      }

      if (!bySkuPrices.has(sku)) bySkuPrices.set(sku, []);
      if (Number.isFinite(price)) bySkuPrices.get(sku).push(price);
      const skuDateKey = `${sku}__${date ? toIsoDate(date) : ""}`;
      skuDateCounts.set(skuDateKey, (skuDateCounts.get(skuDateKey) || 0) + 1);

      return {
        date,
        dateKey: date ? toIsoDate(date) : "",
        sku,
        name,
        units,
        price,
        cost: Number.isFinite(cost) ? cost : 0,
        revenue: Number.isFinite(revenue) ? revenue : units * price,
        profit: Number.isFinite(cost) ? units * (price - cost) : 0,
        explicitPromo: columns.promo ? parsePromo(row[columns.promo]) : false,
      };
    })
    .filter((row) => row.date && row.sku && Number.isFinite(row.units) && Number.isFinite(row.price));

  const regularPrice = new Map(
    [...bySkuPrices.entries()].map(([sku, prices]) => [sku, percentile(prices, 0.75)])
  );

  const normalized = parsed.map((row) => {
    const baselinePrice = regularPrice.get(row.sku) || row.price;
    const discount = baselinePrice > 0 ? (baselinePrice - row.price) / baselinePrice : 0;
    const manualPromo = manualPromos.some(
      (promo) =>
        (!promo.sku || promo.sku === row.sku) &&
        row.date >= promo.start &&
        row.date <= promo.end
    );
    return {
      ...row,
      discount,
      promo: row.explicitPromo || manualPromo || discount >= 0.1,
      promoSource: row.explicitPromo ? "base" : manualPromo ? "manual" : discount >= 0.1 ? "proxy precio" : "",
    };
  });

  manualPromos.forEach((promo) => {
    const overlap = normalized.some(
      (row) => (!promo.sku || promo.sku === row.sku) && row.date >= promo.start && row.date <= promo.end
    );
    if (!overlap) warnings.push(`La promocion manual ${promo.sku || "global"} no cruza con fechas de la base.`);
  });

  [...skuDateCounts.entries()].forEach(([key, count]) => {
    if (count > 1) {
      const [sku, date] = key.split("__");
      warnings.push(`${sku} tiene ${count} filas para ${date}. Se agregaran en el analisis, pero conviene revisar duplicados.`);
    }
  });

  return { rows: normalized, errors: unique(errors).slice(0, 30), warnings: unique(warnings).slice(0, 30) };
}

function analyze(rows, period) {
  const topSkus = [...groupBy(rows, (row) => row.sku).entries()]
    .map(([sku, skuRows]) => ({
      sku,
      name: skuRows[0].name,
      revenue: sum(skuRows, "revenue"),
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 3);

  const selectedRows = rows.filter((row) => topSkus.some((product) => product.sku === row.sku));
  const grouped = new Map();

  selectedRows.forEach((row) => {
    const bucket = period === "week" ? weekKey(row.date) : row.dateKey;
    const key = `${row.sku}__${bucket}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        sku: row.sku,
        name: row.name,
        period: bucket,
        units: 0,
        revenue: 0,
        profit: 0,
        promoRows: 0,
        rows: 0,
      });
    }
    const current = grouped.get(key);
    current.units += row.units;
    current.revenue += row.revenue;
    current.profit += row.profit;
    current.promoRows += row.promo ? 1 : 0;
    current.rows += 1;
  });

  const timeline = [...grouped.values()].map((row) => ({
    ...row,
    promo: row.promoRows / row.rows >= 0.5,
  }));

  const effects = topSkus.map((product) => {
    const productPeriods = timeline.filter((row) => row.sku === product.sku);
    const promo = productPeriods.filter((row) => row.promo);
    const base = productPeriods.filter((row) => !row.promo);
    return {
      ...product,
      promoPeriods: promo.length,
      basePeriods: base.length,
      unitsUplift: uplift(avg(promo, "units"), avg(base, "units")),
      revenueUplift: uplift(avg(promo, "revenue"), avg(base, "revenue")),
      profitUplift: uplift(avg(promo, "profit"), avg(base, "profit")),
      avgPromoUnits: avg(promo, "units"),
      avgBaseUnits: avg(base, "units"),
      avgPromoRevenue: avg(promo, "revenue"),
      avgBaseRevenue: avg(base, "revenue"),
      avgPromoProfit: avg(promo, "profit"),
      avgBaseProfit: avg(base, "profit"),
    };
  });

  return { topSkus, timeline, effects, period };
}

function renderDashboard(analysis, errors, warnings) {
  dashboard.classList.remove("hidden");
  charts.forEach((chart) => chart.destroy());
  charts = [];

  const totalRevenue = sum(analysis.timeline, "revenue");
  const totalProfit = sum(analysis.timeline, "profit");
  const promoPeriods = analysis.timeline.filter((row) => row.promo).length;
  const avgRevenueUplift = avgValue(analysis.effects.map((item) => item.revenueUplift).filter(Number.isFinite));

  summaryMetrics.innerHTML = [
    ["Productos analizados", analysis.topSkus.length],
    ["Periodos con promo", promoPeriods],
    ["Ingresos top 3", currency(totalRevenue)],
    ["Uplift ingresos", percent(avgRevenueUplift)],
  ]
    .map(([label, value]) => `<div class="metric"><span>${label}</span><strong>${value}</strong></div>`)
    .join("");

  renderLineChart("unitsChart", analysis, "units");
  renderLineChart("revenueChart", analysis, "revenue");
  renderLineChart("profitChart", analysis, "profit");
  renderUpliftChart(analysis);
  renderFindings(analysis, errors, warnings, totalProfit);
}

function renderLineChart(canvasId, analysis, metric) {
  const labels = unique(analysis.timeline.map((row) => row.period)).sort();
  const datasets = analysis.topSkus.map((product, index) => ({
    label: product.name,
    data: labels.map((label) => {
      const point = analysis.timeline.find((row) => row.sku === product.sku && row.period === label);
      return point ? round(point[metric]) : null;
    }),
    borderColor: colors[index],
    backgroundColor: colors[index],
    spanGaps: true,
    tension: 0.25,
  }));

  charts.push(
    new Chart(document.getElementById(canvasId), {
      type: "line",
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        resizeDelay: 150,
        interaction: { mode: "index", intersect: false },
        plugins: { legend: { position: "bottom" } },
        scales: { y: { beginAtZero: true } },
      },
    })
  );
}

function renderUpliftChart(analysis) {
  charts.push(
    new Chart(document.getElementById("upliftChart"), {
      type: "bar",
      data: {
        labels: analysis.effects.map((item) => item.name),
        datasets: [
          {
            label: "Unidades",
            data: analysis.effects.map((item) => round(item.unitsUplift * 100)),
            backgroundColor: "#2563eb",
          },
          {
            label: "Ingresos",
            data: analysis.effects.map((item) => round(item.revenueUplift * 100)),
            backgroundColor: "#0f766e",
          },
          {
            label: "Utilidad",
            data: analysis.effects.map((item) => round(item.profitUplift * 100)),
            backgroundColor: "#b45309",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        resizeDelay: 150,
        plugins: { legend: { position: "bottom" } },
        scales: { y: { ticks: { callback: (value) => `${value}%` } } },
      },
    })
  );
}

function renderFindings(analysis, errors, warnings, totalProfit) {
  const positives = [];
  const negatives = [];
  const insights = [];

  analysis.effects.forEach((item) => {
    if (item.promoPeriods === 0) {
      negatives.push(`${item.name}: no se detectaron periodos de promocion. Agrega fechas manuales o revisa proxies de descuento.`);
      return;
    }
    if (item.basePeriods === 0) {
      negatives.push(`${item.name}: no hay comparativo sin promocion. No conviene concluir efecto causal sin linea base.`);
      return;
    }
    if (item.revenueUplift > 0.05) {
      positives.push(`${item.name}: los ingresos normalizados suben ${percent(item.revenueUplift)} durante promocion.`);
    }
    if (item.unitsUplift > 0.05) {
      positives.push(`${item.name}: la rotacion mejora ${percent(item.unitsUplift)} frente al periodo base.`);
    }
    if (item.profitUplift < -0.05) {
      negatives.push(`${item.name}: la utilidad cae ${percent(Math.abs(item.profitUplift))}. Correccion: reducir descuento, negociar costo o limitar la campana a inventario lento.`);
    }
    if (item.unitsUplift > 0.1 && item.profitUplift < 0) {
      insights.push(`${item.name}: vende mas unidades, pero destruye margen. Es una promocion util para rotacion, no para rentabilidad.`);
    }
  });

  if (warnings.length) negatives.push(`Hay ${warnings.length} advertencias de calidad de datos. Corrige esas filas antes de presentar resultados finales.`);
  if (errors.length) negatives.push(`Hay ${errors.length} errores criticos. La consultoria debe justificar que afectan el estudio.`);
  if (totalProfit <= 0) negatives.push("La utilidad total del top 3 es menor o igual a cero. Revisa costos, precios y descuentos antes de recomendar mas campanas.");
  if (!positives.length) positives.push("No se encontro evidencia fuerte de mejora. Esto tambien es una conclusion valida para evitar promociones poco rentables.");

  insights.push("El analisis esta limitado a los 3 productos mas importantes por ingresos, como pide la entrega.");
  insights.push("Los valores se comparan por periodo normalizado para no mezclar dias o semanas con y sin promocion.");
  insights.push("Si la base no trae promociones, se usan proxies por descuento de precio desde 10% y fechas manuales capturadas por el usuario.");

  fillList("positiveFindings", positives);
  fillList("negativeFindings", negatives);
  fillList("insightFindings", insights);
}

function renderDiagnostics(errors, warnings) {
  if (!errors.length && !warnings.length) {
    errorBox.className = "diagnostics empty";
    errorBox.textContent = "No se detectaron errores criticos en la muestra procesada.";
    return;
  }
  errorBox.className = "diagnostics";
  errorBox.innerHTML = [
    ...errors.map((item) => `<div><strong>Error:</strong> ${escapeHtml(item)}</div>`),
    ...warnings.map((item) => `<div><strong>Advertencia:</strong> ${escapeHtml(item)}</div>`),
  ].join("");
}

function addPromoRow() {
  const row = document.createElement("div");
  row.className = "promo-row";
  row.innerHTML = `
    <input type="text" placeholder="SKU opcional; vacio aplica a todos" data-field="sku" />
    <div class="date-grid">
      <input type="date" data-field="start" aria-label="Inicio de promocion" />
      <input type="date" data-field="end" aria-label="Fin de promocion" />
    </div>
    <button type="button" data-remove>Quitar</button>
  `;
  row.querySelector("[data-remove]").addEventListener("click", () => row.remove());
  promoRows.appendChild(row);
}

function readManualPromos() {
  return [...promoRows.querySelectorAll(".promo-row")]
    .map((row) => ({
      sku: row.querySelector('[data-field="sku"]').value.trim(),
      start: parseDate(row.querySelector('[data-field="start"]').value),
      end: parseDate(row.querySelector('[data-field="end"]').value),
    }))
    .filter((promo) => promo.start && promo.end && promo.start <= promo.end);
}

function fillList(id, items) {
  document.getElementById(id).innerHTML = items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function parseDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return stripTime(value);
  if (typeof value === "number") {
    const date = XLSX.SSF.parse_date_code(value);
    return date ? new Date(date.y, date.m - 1, date.d) : null;
  }
  const text = String(value ?? "").trim();
  if (!text) return null;
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const slash = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) return new Date(Number(slash[3]), Number(slash[2]) - 1, Number(slash[1]));
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : stripTime(date);
}

function parseNumber(value) {
  if (typeof value === "number") return value;
  const cleaned = String(value ?? "")
    .replace(/\$/g, "")
    .replace(/,/g, "")
    .replace(/\s/g, "")
    .trim();
  return Number(cleaned);
}

function parsePromo(value) {
  return ["1", "si", "sí", "true", "promo", "promocion", "promoción", "yes"].includes(
    String(value ?? "").trim().toLowerCase()
  );
}

function normalizeKey(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function stripTime(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function weekKey(date) {
  const firstDay = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date - firstDay) / 86400000);
  const week = Math.ceil((days + firstDay.getDay() + 1) / 7);
  return `${date.getFullYear()}-S${String(week).padStart(2, "0")}`;
}

function groupBy(rows, fn) {
  const map = new Map();
  rows.forEach((row) => {
    const key = fn(row);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  });
  return map;
}

function sum(rows, key) {
  return rows.reduce((total, row) => total + (Number(row[key]) || 0), 0);
}

function avg(rows, key) {
  return rows.length ? sum(rows, key) / rows.length : NaN;
}

function avgValue(values) {
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;
}

function uplift(promo, base) {
  if (!Number.isFinite(promo) || !Number.isFinite(base) || base === 0) return NaN;
  return (promo - base) / base;
}

function percentile(values, p) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  return sorted[Math.floor((sorted.length - 1) * p)];
}

function unique(values) {
  return [...new Set(values)];
}

function round(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function percent(value) {
  if (!Number.isFinite(value)) return "sin base";
  return `${round(value * 100)}%`;
}

function currency(value) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatCell(value) {
  if (value instanceof Date) return toIsoDate(value);
  return String(value ?? "");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
