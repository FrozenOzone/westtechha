SELECT
  pc.product_sku,
  pc.component_sku,
  ci.name AS component_name,
  pc.qty_required,
  ci.stock_qty,
  ci.is_active
FROM product_components pc
LEFT JOIN component_inventory ci
  ON ci.component_sku = pc.component_sku
WHERE pc.product_sku IN (
  'command-30-unloaded',
  'command-38-unloaded',
  'command-30-gp-unloaded',
  'command-38-gp-unloaded',
  'command-30-loaded',
  'command-38-loaded',
  'command-30-gp-loaded',
  'command-38-gp-loaded'
)
ORDER BY pc.product_sku, pc.component_sku;
