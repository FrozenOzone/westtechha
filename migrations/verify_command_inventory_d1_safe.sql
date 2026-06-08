SELECT pc.product_sku, pc.component_sku, ci.name AS component_name, pc.qty_required, ci.stock_qty, ci.is_active
FROM product_components pc
LEFT JOIN component_inventory ci ON ci.component_sku = pc.component_sku
WHERE pc.product_sku = 'command-30-unloaded'
   OR pc.product_sku = 'command-38-unloaded'
   OR pc.product_sku = 'command-30-gp-unloaded'
   OR pc.product_sku = 'command-38-gp-unloaded'
   OR pc.product_sku = 'command-30-loaded'
   OR pc.product_sku = 'command-38-loaded'
   OR pc.product_sku = 'command-30-gp-loaded'
   OR pc.product_sku = 'command-38-gp-loaded'
ORDER BY pc.product_sku, pc.component_sku;
