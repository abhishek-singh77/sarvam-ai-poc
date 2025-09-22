/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ['./src/**/*.{html,ts}'],
    theme: {
        extend: {
            colors: {
                // Digio Brand Colors
                primary: {
                    DEFAULT: '#004494', // Digio's signature blue
                    hover: '#003366',
                    light: '#e6f0ff',
                    dark: '#002244',
                },
                secondary: {
                    DEFAULT: '#64748b',
                    light: '#f1f5f9',
                },
                accent: {
                    DEFAULT: '#0066cc', // Lighter blue for accents
                    light: '#e6f2ff',
                },
                success: {
                    DEFAULT: '#059669',
                    light: '#d1fae5',
                },
                warning: {
                    DEFAULT: '#d97706',
                    light: '#fef3c7',
                },
                error: {
                    DEFAULT: '#dc2626',
                    light: '#fee2e2',
                },
                background: {
                    primary: '#ffffff',
                    secondary: '#f8fafc',
                    tertiary: '#f1f5f9',
                    accent: '#f0f7ff', // Very light blue for Digio theme
                },
                text: {
                    primary: '#1a202c', // Darker for better contrast
                    secondary: '#4a5568',
                    muted: '#718096',
                },
                border: {
                    DEFAULT: '#e2e8f0',
                    hover: '#cbd5e1',
                    accent: '#b3d9ff', // Light blue borders
                },
                // Digio specific colors
                digio: {
                    blue: '#004494',
                    'blue-light': '#e6f0ff',
                    'blue-dark': '#002244',
                    gray: '#6b7280',
                    'gray-light': '#f3f4f6',
                },
            },
            fontFamily: {
                sans: [
                    'Inter',
                    '-apple-system',
                    'BlinkMacSystemFont',
                    'Segoe UI',
                    'Roboto',
                    'sans-serif',
                ],
                mono: [
                    'SF Mono',
                    'Monaco',
                    'Cascadia Code',
                    'Roboto Mono',
                    'Consolas',
                    'Courier New',
                    'monospace',
                ],
            },
            animation: {
                'fade-in': 'fadeIn 0.3s ease-in-out',
                'slide-up': 'slideUp 0.3s ease-out',
                spin: 'spin 1s linear infinite',
            },
            keyframes: {
                fadeIn: {
                    from: { opacity: '0', transform: 'translateY(10px)' },
                    to: { opacity: '1', transform: 'translateY(0)' },
                },
                slideUp: {
                    from: { opacity: '0', transform: 'translateY(20px)' },
                    to: { opacity: '1', transform: 'translateY(0)' },
                },
            },
        },
    },
    plugins: [],
}
