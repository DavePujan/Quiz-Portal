/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // Theme-controlled background levels (bound to CSS variables)
                background: {
                    DEFAULT: "var(--bg-color)",
                    layer1: "var(--bg-layer1)",
                    layer2: "var(--bg-layer2)",
                },
                // Brand Colors
                primary: {
                    DEFAULT: "var(--primary-color)",
                    hover: "var(--primary-hover)",
                    gradientStart: "var(--primary-gradient-start)",
                    gradientEnd: "var(--primary-gradient-end)",
                },
                // Semantic Colors
                success: "var(--success-color)",
                error: "var(--error-color)",
                warning: "var(--warning-color)",
            },
            fontFamily: {
                sans: ['Inter', 'Roboto', 'system-ui', 'sans-serif'],
            }
        },
    },
    plugins: [],
}
