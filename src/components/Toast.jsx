import { motion } from 'framer-motion'
import { AlertCircle, CheckCircle } from 'lucide-react'

export const Toast = ({ message, type = 'info', isVisible }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={isVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: -20 }}
      exit={{ opacity: 0, y: -20 }}
      className={`fixed top-4 left-4 right-4 max-w-md mx-auto p-4 rounded-xl flex items-center gap-3 z-50 ${
        type === 'success'
          ? 'bg-success-50 text-success-700'
          : type === 'error'
          ? 'bg-error-50 text-error-800'
          : 'bg-neutral-100 text-neutral-800'
      }`}
    >
      {type === 'success' && <CheckCircle size={20} />}
      {type === 'error' && <AlertCircle size={20} />}
      <span className="text-sm">{message}</span>
    </motion.div>
  )
}
