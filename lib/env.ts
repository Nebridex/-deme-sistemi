export const appEnv = {
  appName: process.env.NEXT_PUBLIC_APP_NAME || 'Kafe QR Hesap',
  appDescription: process.env.NEXT_PUBLIC_APP_DESCRIPTION || 'QR destekli kafe masa hesap yönetimi',
  appBaseUrl: process.env.NEXT_PUBLIC_APP_BASE_URL || 'http://localhost:3000',
  appEnvironment: process.env.NEXT_PUBLIC_APP_ENV || 'development'
};
