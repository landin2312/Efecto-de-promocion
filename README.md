# Elasticidad de Productos

Proyecto para consolidar bases de datos comerciales, crear una base analitica mejorada y medir elasticidad de productos.

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

