/**
 * Cloud Functions are intentionally disabled for this pilot.
 * All integrity logic runs directly on Firestore client flows.
 */

export const integrityScaffold = {
  mode: 'client-only-firestore',
  notes: 'No callable endpoints are used in runtime.'
};
