import { handmatig } from './handmatig'
import type { PaymentProvider } from './provider'

// Register van beschikbare providers. Eén rij nu; Uni5Pay/Mope worden er later
// aan toegevoegd zonder dat er iets aan tickets, QR, delivery of de scanner
// verandert. Zie provider.ts voor waarom deze laag er al staat.
export const providers: Record<string, PaymentProvider> = { handmatig }

export function vindProvider(key: string | null): PaymentProvider {
  return providers[key ?? 'handmatig'] ?? handmatig
}

export type { BetaalIntent, BetaalStart, PaymentProvider } from './provider'
