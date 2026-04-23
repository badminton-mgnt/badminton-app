export const Header = ({ title, subtitle, subtitleContent, action }) => (
  <div className="bg-gradient-to-r from-primary-400 to-primary-400 text-white py-6 px-4">
    <div className="container-mobile flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitleContent || (subtitle && <p className="text-sm opacity-90">{subtitle}</p>)}
      </div>
      {action && <div>{action}</div>}
    </div>
  </div>
)
