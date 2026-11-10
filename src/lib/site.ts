// Public address of the app, for metadata, robots.txt and sitemap.xml (server only: it reads Vercel's
// build variables). On Vercel, VERCEL_PROJECT_PRODUCTION_URL is the production domain (fiubi.ar once it is
// added to the project), also in preview builds; NEXT_PUBLIC_SITE_URL overrides it.
const vercelDomain = process.env.VERCEL_PROJECT_PRODUCTION_URL;
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? (vercelDomain ? `https://${vercelDomain}` : "http://localhost:3000");

/** Only the production deployment is indexed: previews share the database and are not the public site. */
export const INDEXABLE = process.env.VERCEL_ENV ? process.env.VERCEL_ENV === "production" : false;

export const SITE_DESCRIPTION =
  "Un portal para estudiantes de la FIUBA donde consultar tu información académica y seguir el avance de tu carrera de ingeniería.";
