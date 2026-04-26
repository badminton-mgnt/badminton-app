export const APP_SECRET_INTERNAL_EMAIL_DOMAIN = 'app-secret.example.com'

export const isInternalAppSecretEmail = (email) => {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  return normalizedEmail.endsWith(`@${APP_SECRET_INTERNAL_EMAIL_DOMAIN}`)
}

export const getVisibleUserEmail = (email) => {
  if (!email || isInternalAppSecretEmail(email)) {
    return null
  }

  return String(email)
}
