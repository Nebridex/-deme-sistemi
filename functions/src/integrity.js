/**
 * Firebase Functions scaffold for production integrity.
 * NOTE: This file is intentionally a non-deploy scaffold in this repository pass.
 * Implement with firebase-admin + firebase-functions v2 before production deploy.
 *
 * Planned callable endpoints:
 * - recomputeTableAggregates({ tableId, cafeId })
 * - syncPublicTableProjection({ tableId, cafeId })
 * - rotatePublicToken({ tableId, actorUid })
 */

export const integrityScaffold = {
  recomputeTableAggregates: 'TODO: move aggregate calculations server-side',
  syncPublicTableProjection: 'TODO: move projection writes server-side',
  rotatePublicToken: 'TODO: owner-only token rotation on backend'
};
