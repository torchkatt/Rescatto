/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
        "./components/**/*.{js,ts,jsx,tsx}",
        "./pages/**/*.{js,ts,jsx,tsx}",
        "!./functions/**/*",
        "!./node_modules/**/*"
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Outfit', 'Inter', 'sans-serif'],
            },
            colors: {
                emerald: {
                    50: '#ecfdf5',
                    100: '#d1fae5',
                    200: '#a7f3d0',
                    300: '#6ee7b7',
                    400: '#34d399',
                    500: '#10b981',
                    600: '#059669',
                    700: '#047857',
                    800: '#065f46',
                    900: '#064e3b',
                    950: '#022c22',
                },
            },
            animation: {
                'slide-in-right': 'slideInRight 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                'slide-in-left': 'slideInLeft 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                'fade-in-up': 'fadeInUp 0.5s ease-out forwards',
            },
            keyframes: {
                slideInRight: {
                    '0%': { opacity: '0', transform: 'translateX(100%)' },
                    '100%': { opacity: '1', transform: 'translateX(0)' },
                },
                slideInLeft: {
                    '0%': { opacity: '0', transform: 'translateX(-100%)' },
                    '100%': { opacity: '1', transform: 'translateX(0)' },
                },
                fadeInUp: {
                    '0%': { opacity: '0', transform: 'translateY(10px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                }
            },
        },
    },
    plugins: [],
}
