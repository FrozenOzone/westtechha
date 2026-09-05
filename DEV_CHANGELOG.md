# WestTechHA Dev Change and Rollback Log

This file records accepted Dev checkpoints and the recovery point created before each complex workflow change. Production remains separate until a Dev version is explicitly accepted and promoted.

## 2026-09-05 — Before unified Orders workspace

- Accepted Dev commit: `e170d969a6adf92d51e9618920f9b9c9e682df61`
- Named checkpoint branch: `checkpoint-before-unified-orders-20260905`
- Preview D1 bookmark: `00000058-00000000-000050dd-b11563f336938b1e2022cc12f5ab36ee`
- Private D1 export: `westtechha-preview-before-unified-orders-20260905.sql`
- Export SHA-256: `35f5b1823568aa1f6e500d73399c623bcdf7accf05bbb945bdb2994c1d8b1102`
- Accepted behavior at checkpoint: unified enclosure buying, coaster and enclosure approval/payment workflows, and shared paid/released FIFO manufacturing work orders.

Rollback boundary: restore the Dev branch to the accepted commit for source recovery. Restore the private SQL export only if order data or schema was changed after this checkpoint. The unified Orders workspace itself is designed to require no D1 schema change.

## 2026-09-05 — Unified Orders detail-pane visibility fix

- Pre-fix Dev commit: `7cd2b9f3f12c1f8f6aa0cf8740895047421fcbe0`
- Named checkpoint branch: `checkpoint-before-orders-pane-fix-20260905`
- Scope: CSS visibility correction and stylesheet cache refresh only.
- Cause: the empty-state grid rule overrode the element's `hidden` state, leaving the placeholder above the selected order.
- Database impact: none; Preview D1 schema, data, and order records remain untouched.

Rollback boundary: restore the Dev branch to `7cd2b9f3f12c1f8f6aa0cf8740895047421fcbe0`. No database restore is required for this change.

## Rule for future complex changes

1. Record the accepted Dev commit.
2. Create a named checkpoint branch before editing.
3. Export Preview D1 when the change touches database schema, data, or workflow state.
4. Deploy one coherent Dev commit.
5. Record what changed, what stayed untouched, and the exact rollback boundary here.
