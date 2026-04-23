import clsx from 'clsx'

export const Card = ({ children, className, ...props }) => (
  <div className={clsx('card', className)} {...props}>
    {children}
  </div>
)
