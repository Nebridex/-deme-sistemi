const browserOrigin = typeof window !== 'undefined' ? window.location.origin : null;

export const appEnv = {
  appName: process.env.NEXT_PUBLIC_APP_NAME || 'MiniFabrika Adisyon Pilot',
  appDescription: process.env.NEXT_PUBLIC_APP_DESCRIPTION || 'QR destekli restoran adisyon ve masa yönetimi',
  appBaseUrl: process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_APP_BASE_URL || browserOrigin || 'https://adisyon.minifabrika.online',
  appEnvironment: process.env.NEXT_PUBLIC_APP_ENV || 'development'
};
