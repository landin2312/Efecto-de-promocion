# Efecto de promociones

Sitio web y proyecto de analisis para medir que tanto cambian los ingresos, ventas,
rotacion y utilidad de una tienda cuando hay promociones, descuentos o campanas.

La pagina principal permite que un usuario suba un archivo CSV o Excel, capture
fechas de promocion manuales si la base no las trae, y reciba un dashboard con:

- graficas de unidades vendidas, ingresos y utilidad normalizadas por dia o semana;
- comparativo entre periodos con promocion y sin promocion;
- revision automatica de errores de datos;
- conclusiones positivas, negativas, correcciones e insights ejecutivos;
- enfoque en los 3 productos mas importantes por ingresos, como pide la entrega.

## Sitio web

La app esta en `docs/index.html` para poder publicarse con GitHub Pages.
Incluye bases de prueba en `docs/sample_promociones.csv` y
`docs/sample_tienda_deportiva.csv`.

Para verla localmente:

```powershell
python -m http.server 8000 -d docs
```

Despues abre:

```text
http://localhost:8000
```

Para publicarla en GitHub:

1. Sube este repo a GitHub.
2. Entra a `Settings > Pages`.
3. En `Build and deployment`, selecciona `Deploy from a branch`.
4. Selecciona la rama principal y la carpeta `/docs`.
5. GitHub dara un link publico para usar la consultoria online.

## Formato esperado de la base

Columnas obligatorias, con nombres flexibles:

- `fecha`: fecha de venta o semana.
- `sku` o `producto_id`: identificador del producto.
- `unidades` o `cantidad_vendida`: unidades vendidas.
- `precio` o `precio_final`: precio vigente en esa fecha.

Columnas recomendadas:

- `producto_nombre`: nombre legible del producto.
- `costo` o `costo_unitario`: costo unitario para calcular utilidad.
- `ingresos` o `venta_neta`: si no existe, se calcula como unidades por precio.
- `promocion`: valores como `si/no`, `1/0`, `true/false`.

La utilidad se calcula como:

```text
utilidad = unidades vendidas * (precio vigente - costo unitario)
```

Si no hay columna de promociones, la pagina permite capturar fechas manuales y
tambien usa proxies de descuento por precio. Un precio al menos 10% menor al
precio regular estimado del SKU se considera posible promocion.

## Validaciones que hace la pagina

El dashboard marca problemas que pueden afectar el estudio, por ejemplo:

- fechas invalidas;
- SKU vacio;
- unidades negativas;
- precios invalidos;
- costos mayores al precio;
- ingresos que no coinciden con unidades por precio;
- promociones manuales que no cruzan con fechas de la base;
- productos sin periodo comparable con y sin promocion.

Estas advertencias aparecen dentro del diagnostico y tambien alimentan las
conclusiones negativas con recomendaciones de correccion.

## Criterio de analisis

El sitio sigue las instrucciones del profesor:

- usa unidades vendidas, ingresos y ganancias;
- respeta el precio en el tiempo porque calcula ingresos con el precio vigente de cada fila;
- normaliza los valores por dia o por semana;
- evita mezclar periodos con y sin promocion;
- revisa fechas de promocion por SKU;
- usa proxies de promocion cuando no hay columna explicita;
- grafica las metricas en linea de tiempo;
- resume el efecto de promociones en conclusiones;
- analiza solo los 3 productos mas importantes por ingresos.

## Donde poner los archivos

Coloca los archivos originales asi:

- `data/raw/base_ideal/`
  - Aqui va tu "base ideal", por ejemplo el Excel que representa como deberia verse la base final.
  - Ejemplo: `base_ideal.xlsx`

- `data/raw/bases_fuente/`
  - Aqui van las 4 bases con todos los datos disponibles.
  - Ejemplos: `ventas.xlsx`, `productos.csv`, `precios.xlsx`, `clientes.xlsx`

- `data/raw/promociones/`
  - Aqui van los PDF y Word del Drive con descuentos/promociones.
  - Puedes copiar todo tal cual desde Drive.
  - Formatos esperados: `.pdf`, `.docx`, `.doc`

- `data/processed/`
  - Aqui se generaran archivos limpios y consolidados.
  - No pongas archivos manuales aqui salvo que sea necesario.

## Primer objetivo

Crear una tabla consolidada para elasticidad con, idealmente, estas columnas:

- `fecha`
- `producto_id`
- `producto_nombre`
- `categoria`
- `canal` o `tienda`, si existe
- `precio_regular`
- `precio_final`
- `descuento`
- `promocion`
- `cantidad_vendida`
- `venta_neta`
- `costo`, si existe
- `margen`, si existe

La base ideal sirve como referencia de estructura. Las bases fuente sirven para llenar esa estructura.

## Flujo de trabajo

1. Copiar bases originales a `data/raw/`.
2. Ejecutar perfilado de columnas:

```powershell
python scripts/profile_data.py
```

3. Revisar el reporte generado en `reports/data_profile.xlsx`.
4. Extraer promociones desde PDF/Word:

```powershell
python scripts/extract_promotions.py
```

5. Revisar `data/interim/promociones_extraidas.xlsx`.
6. Crear la base final consolidada en `data/processed/base_elasticidad.xlsx`.

## GitHub

Recomendacion: no subir bases sensibles a GitHub. Este repo esta configurado para ignorar archivos dentro de `data/raw/`, `data/interim/` y `data/processed/`, excepto archivos `.gitkeep`.

Si necesitas compartir datos conmigo, subelos aqui en el chat o ponlos en las carpetas locales indicadas. Para GitHub, subiremos codigo, documentacion y estructura, no datos privados.
