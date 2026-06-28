// ============================================================
// Joby — Payout provider abstraction layer
//
// Defines the interface that any payout provider must implement.
// Currently uses a stub (no-op) provider for internal testing.
// When integrating a real provider, implement PayoutProvider and
// swap getProvider() — core payout logic stays unchanged.
// ============================================================

// ── Provider interface ──────────────────────────────────────

export interface TransferPayload {
  ledger_item_id: string;
  worker_id: string;
  worker_name: string;
  bank_name: string;
  bank_branch: string;
  account_number: string;
  account_holder: string;
  amount: number;
  currency: string;
  reference: string;
}

export interface BatchPayload {
  batch_id: string;
  batch_date: string;
  items: TransferPayload[];
  total_amount: number;
  currency: string;
}

export interface TransferResult {
  success: boolean;
  provider_transfer_id: string | null;
  provider_status: string;
  provider_message: string | null;
}

export interface BatchResult {
  success: boolean;
  provider_batch_id: string | null;
  provider_status: string;
  provider_message: string | null;
  item_results: Map<string, TransferResult>;
}

export interface PayoutProvider {
  readonly name: string;

  prepareBatchPayload(batch: BatchPayload): Promise<BatchPayload>;

  submitBatch(payload: BatchPayload): Promise<BatchResult>;

  checkBatchStatus(providerBatchId: string): Promise<{
    status: string;
    message: string | null;
    item_statuses: Map<string, { status: string; message: string | null }>;
  }>;

  submitSingleTransfer(payload: TransferPayload): Promise<TransferResult>;

  checkTransferStatus(providerTransferId: string): Promise<{
    status: string;
    message: string | null;
  }>;
}

// ── Stub provider (internal testing only) ───────────────────

export class StubPayoutProvider implements PayoutProvider {
  readonly name = "stub";

  async prepareBatchPayload(batch: BatchPayload): Promise<BatchPayload> {
    return batch;
  }

  async submitBatch(payload: BatchPayload): Promise<BatchResult> {
    const itemResults = new Map<string, TransferResult>();
    for (const item of payload.items) {
      itemResults.set(item.ledger_item_id, {
        success: true,
        provider_transfer_id: `stub-tx-${item.ledger_item_id.slice(0, 8)}`,
        provider_status: "SIMULATED",
        provider_message: "Stub provider — no real transfer executed",
      });
    }
    return {
      success: true,
      provider_batch_id: `stub-batch-${payload.batch_id.slice(0, 8)}`,
      provider_status: "SIMULATED",
      provider_message: "Stub provider — no real transfer executed",
      item_results: itemResults,
    };
  }

  async checkBatchStatus(providerBatchId: string): Promise<{
    status: string;
    message: string | null;
    item_statuses: Map<string, { status: string; message: string | null }>;
  }> {
    return {
      status: "SIMULATED",
      message: `Stub status check for ${providerBatchId}`,
      item_statuses: new Map(),
    };
  }

  async submitSingleTransfer(payload: TransferPayload): Promise<TransferResult> {
    return {
      success: true,
      provider_transfer_id: `stub-tx-${payload.ledger_item_id.slice(0, 8)}`,
      provider_status: "SIMULATED",
      provider_message: "Stub provider — no real transfer executed",
    };
  }

  async checkTransferStatus(providerTransferId: string): Promise<{
    status: string;
    message: string | null;
  }> {
    return {
      status: "SIMULATED",
      message: `Stub status check for ${providerTransferId}`,
    };
  }
}

// ── Provider registry ───────────────────────────────────────

let currentProvider: PayoutProvider = new StubPayoutProvider();

export function getProvider(): PayoutProvider {
  return currentProvider;
}

export function setProvider(provider: PayoutProvider): void {
  currentProvider = provider;
}
