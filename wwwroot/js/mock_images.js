// Mock images as SVG Data URLs for the dental clinic application
const MOCK_IMAGES = {
    // A beautiful medical tooth logo
    logo: `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' width='100' height='100'><defs><linearGradient id='g' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='%230d6efd'/><stop offset='100%' stop-color='%2300f2fe'/></linearGradient></defs><rect width='100' height='100' rx='20' fill='url(%23g)'/><path d='M50 20 C42 20, 38 28, 38 42 C38 62, 28 65, 36 78 C38 82, 43 82, 45 80 C48 78, 49 72, 50 72 C51 72, 52 78, 55 80 C57 82, 62 82, 64 78 C72 65, 62 62, 62 42 C62 28, 58 20, 50 20 Z' fill='white'/><circle cx='50' cy='40' r='4' fill='%230d6efd'/></svg>`,
    
    // Default avatar for patients / users
    avatar: `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' width='100' height='100'><circle cx='50' cy='50' r='50' fill='%23e9ecef'/><circle cx='50' cy='35' r='20' fill='%236c757d'/><path d='M20 80 C 20 60, 80 60, 80 80 Z' fill='%236c757d'/></svg>`,

    // Tooth graphic for odontogram when not treated
    diente: `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><path d='M50 10 C35 10, 30 20, 30 40 C30 70, 20 75, 30 90 C35 95, 42 95, 45 90 C48 85, 49 80, 50 80 C51 80, 52 85, 55 90 C58 95, 65 95, 70 90 C80 75, 70 70, 70 40 C70 20, 65 10, 50 10 Z' fill='%23f8f9fa' stroke='%23cbd5e1' stroke-width='3'/></svg>`,

    // Muela (molar) graphic
    muela: `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><path d='M50 12 C32 10, 26 22, 26 42 C26 72, 16 77, 28 92 C34 98, 42 96, 46 90 C48 85, 49 82, 50 82 C51 82, 52 85, 54 90 C58 96, 66 98, 72 92 C84 77, 74 72, 74 42 C74 22, 68 10, 50 12 Z' fill='%23f1f5f9' stroke='%23cbd5e1' stroke-width='3'/><path d='M38 32 C38 32, 45 38, 50 38 C55 38, 62 32, 62 32' fill='none' stroke='%23cbd5e1' stroke-width='2'/></svg>`
};
