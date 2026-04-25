import clsx from 'clsx'

export const Input = ({
  type = 'text',
  placeholder,
  value,
  onChange,
  error,
  label,
  className,
  ...props
}) => {
  const normalizedType = String(type || 'text').toLowerCase()
  const hasCustomMaxLength = Object.prototype.hasOwnProperty.call(props, 'maxLength')
  const shouldApplyDefaultTextLimit = ['text', 'email', 'password', 'search', 'tel', 'url'].includes(normalizedType)
  const resolvedMaxLength = hasCustomMaxLength
    ? props.maxLength
    : normalizedType === 'number'
      ? 20
      : shouldApplyDefaultTextLimit
        ? 100
        : undefined

  const handleChange = (event) => {
    if (!onChange) return

    if (typeof resolvedMaxLength === 'number' && resolvedMaxLength > 0) {
      const inputValue = String(event?.target?.value ?? '')
      if (inputValue.length > resolvedMaxLength) {
        const nextValue = inputValue.slice(0, resolvedMaxLength)
        if (event.target) event.target.value = nextValue
        if (event.currentTarget) event.currentTarget.value = nextValue
      }
    }

    onChange(event)
  }

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-neutral-700 mb-2">
          {label}
        </label>
      )}
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        maxLength={resolvedMaxLength}
        className={clsx('input-field', error && 'border-error-800', className)}
        {...props}
      />
      {error && <p className="text-xs text-error-800 mt-1">{error}</p>}
    </div>
  )
}
