-- Additive Sales & Invoices contact field. PREVIEW only until separately approved for Production.
-- Existing invoices stay unchanged, with customer_phone empty by default.
ALTER TABLE sales_invoices ADD COLUMN customer_phone TEXT NOT NULL DEFAULT '';
