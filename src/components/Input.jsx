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
        onChange={onChange}
        className={clsx('input-field', error && 'border-error-800', className)}
        {...props}
      />
      {error && <p className="text-xs text-error-800 mt-1">{error}</p>}
    </div>
  )
}
