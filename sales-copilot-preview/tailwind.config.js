/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#1e40af', /* 深蓝主色 */
          600: '#1e3a8a',
          700: '#1e3380',
          800: '#172e6d',
          900: '#15255f',
        },
        accent: {
          DEFAULT: '#10b981', /* 青绿色 */
          light: '#d1fae5',
          dark: '#059669',
        },
        surface: {
          DEFAULT: '#f8fafc',
          card: '#ffffff',
          warm: '#fefce8',
          warn: '#fff7ed',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', 'Helvetica', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
