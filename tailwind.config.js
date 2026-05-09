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
            screens: {
                '3xl': '1920px',
            },
            fontFamily: {
                sans: ['Outfit', 'Inter', 'sans-serif'],
            },
            colors: {
                // Brand green (remap emerald → Rescatto forest green)
                // Primary anchor: #1A6B4A (emerald-600)
                emerald: {
                    50:  '#edfaf3',
                    100: '#d0f4e5',
                    200: '#a6e8ce',
                    300: '#70d4ae',
                    400: '#3eba89',
                    500: '#23a070',
                    600: '#1A6B4A',
                    700: '#155540',
                    800: '#103f2f',
                    900: '#0b2b20',
                    950: '#061712',
                },
                // Brand semantic tokens
                brand: {
                    primary:  '#1A6B4A',
                    dark:     '#0D1F18',
                    accent:   '#FF6B35',
                    'accent-light': '#FFF0EA',
                    bg:       '#FAFAF7',
                },
            },
            animation: {
                'slide-in-right': 'slideInRight 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                'slide-out-right': 'slideOutRight 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards',
                'slide-in-left': 'slideInLeft 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                'fade-in-up': 'fadeInUp 0.5s ease-out forwards',
                'cart-pop': 'cartPop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)',
            },
            keyframes: {
                slideInRight: {
                    '0%': { opacity: '0', transform: 'translateX(100%)' },
                    '100%': { opacity: '1', transform: 'translateX(0)' },
                },
                slideOutRight: {
                    '0%': { opacity: '1', transform: 'translateX(0)' },
                    '100%': { opacity: '0', transform: 'translateX(120%)' },
                },
                slideInLeft: {
                    '0%': { opacity: '0', transform: 'translateX(-100%)' },
                    '100%': { opacity: '1', transform: 'translateX(0)' },
                },
                fadeInUp: {
                    '0%': { opacity: '0', transform: 'translateY(10px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                cartPop: {
                    '0%':   { transform: 'scale(1)' },
                    '40%':  { transform: 'scale(1.14)' },
                    '70%':  { transform: 'scale(0.96)' },
                    '100%': { transform: 'scale(1)' },
                },
            },
        },
    },
    plugins: [],
}
