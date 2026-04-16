export type RecomputeTableAggregatesInput = {
  tableId: string;
  cafeId: string;
};

export type SyncPublicTableProjectionInput = {
  tableId: string;
  cafeId: string;
};

export type RotatePublicTokenInput = {
  tableId: string;
  actorUid: string;
};

export type IntegrityMutationResponse = {
  ok: boolean;
  source: 'function' | 'client_fallback';
};

export type RotatePublicTokenResponse = {
  publicToken: string;
  source: 'function' | 'client_fallback';
};
