module.exports = {
    content: ['./src/**/*.{html,js,jsx,ts,tsx}'],
    theme: {
      extend: {
        colors: {
          dark: {
            800: '#1E2028',
            900: '#13141A',
          },
          gray: {
            100: '#F3F4F6',
            200: '#E5E7EB',
            300: '#D1D5DB',
            600: '#4B5563',
          },
          accent: {
            400: '#60A5FA',
            500: '#3B82F6',
            600: '#2563EB',
            700: '#1D4ED8',
          },
        },
      },
    },
    variants: {
      extend: {},
    },
    plugins: [],
  };