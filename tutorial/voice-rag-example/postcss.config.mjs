// PostCSS configuration for Tailwind CSS v4.
// Includes Tailwind and autoprefixer.

/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
    autoprefixer: {},
  },
};

export default config;
