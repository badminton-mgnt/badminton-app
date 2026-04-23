import clsx from 'clsx'

export const Button = ({
  children,
  variant = 'primary',
  disabled = false,
  loading = false,
  onClick,
  className,
  ...props
}) => {
  const variants = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    danger: 'btn-danger',
  }

  return (
    <button
      className={clsx(variants[variant], className)}
      disabled={disabled || loading}
      onClick={onClick}
      {...props}
    >
      {loading ? '...' : children}
    </button>
  )
}
