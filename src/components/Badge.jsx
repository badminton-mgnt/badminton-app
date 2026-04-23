import clsx from 'clsx'

export const Badge = ({ children, status = 'default', className }) => {
  const statusClasses = {
    success: 'badge-success',
    warning: 'badge-warning',
    error: 'badge-error',
    default: 'bg-neutral-100 text-neutral-700',
  }

  return (
    <span className={clsx('badge', statusClasses[status], className)}>
      {children}
    </span>
  )
}
