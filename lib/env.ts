export const appEnv = {
  appName: process.env.NEXT_PUBLIC_APP_NAME || 'Cafe Bill MVP',
  appDescription: process.env.NEXT_PUBLIC_APP_DESCRIPTION || 'QR-ready cafe table bill management',
  appBaseUrl: process.env.NEXT_PUBLIC_APP_BASE_URL || 'http://localhost:3000',
  appEnvironment: process.env.NEXT_PUBLIC_APP_ENV || 'development'
};
