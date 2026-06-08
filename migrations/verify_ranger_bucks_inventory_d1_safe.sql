SELECT pc.product_sku, pc.component_sku, ci.name AS component_name, pc.qty_required, ci.stock_qty, ci.is_active
FROM product_components pc
LEFT JOIN component_inventory ci ON ci.component_sku = pc.component_sku
WHERE pc.product_sku = 'ranger-30-bucks-unloaded'
   OR pc.product_sku = 'ranger-38-bucks-unloaded'
   OR pc.product_sku = 'ranger-30-bucks-loaded'
   OR pc.product_sku = 'ranger-38-bucks-loaded'
ORDER BY pc.product_sku, pc.component_sku;
