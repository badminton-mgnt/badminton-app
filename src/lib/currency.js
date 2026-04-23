const vndNumberFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

export const formatVndAmount = (value) => {
  const amount = Number(value) || 0
  return vndNumberFormatter.format(amount)
}
