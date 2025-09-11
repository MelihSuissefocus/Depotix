import createMiddleware from 'next-intl/middleware';

export default createMiddleware({
  locales: ['en', 'de'],
  defaultLocale: 'de',
  localePrefix: 'as-needed'
});

export const config = {
  matcher: ['/', '/(de|en)/:path*', '/((?!_next|_vercel|.*\\..*).*)']
};
