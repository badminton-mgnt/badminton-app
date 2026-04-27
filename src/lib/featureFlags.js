const parseBooleanFlag = (value) => {
  const normalized = String(value ?? '').trim().toLowerCase()
  return ['1', 'true', 'yes', 'on', 'enabled'].includes(normalized)
}

export const isSettlementTransferFeatureGloballyEnabled = parseBooleanFlag(
  import.meta.env.VITE_ENABLE_SETTLEMENT_TRANSFER_FEATURE
)
