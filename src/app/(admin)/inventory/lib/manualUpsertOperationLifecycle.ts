export type ManualUpsertOperationState = {
  fingerprint: string;
  operationId: string;
};

export function resolveManualUpsertOperation(params: {
  current: ManualUpsertOperationState | null;
  fingerprint: string;
  createOperationId: () => string;
}): ManualUpsertOperationState {
  if (params.current?.fingerprint === params.fingerprint) {
    return params.current;
  }

  return {
    fingerprint: params.fingerprint,
    operationId: params.createOperationId(),
  };
}
