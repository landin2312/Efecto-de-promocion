# Estructura de datos

## Archivos de entrada

### Base ideal

Ruta: `data/raw/base_ideal/`

Usar para entender:

- nombres esperados de columnas
- granularidad de la base final
- formato de fechas, productos, precios y cantidades
- columnas obligatorias vs opcionales

### Bases fuente

Ruta: `data/raw/bases_fuente/`

Usar para identificar:

- ventas historicas
- catalogo de productos
- precios regulares y precios finales
- descuentos y promociones
- tienda, canal, region o cliente, si aplica

### Promociones

Ruta: `data/raw/promociones/`

Usar para extraer:

- fecha de inicio
- fecha de fin
- producto o familia
- descuento
- mecanica promocional
- restricciones
- fuente del documento

## Salidas esperadas

### `data/interim/promociones_extraidas.xlsx`

Tabla preliminar con texto y metadatos extraidos desde PDF/Word.

### `data/processed/base_elasticidad.xlsx`

Tabla final para modelar elasticidad.

