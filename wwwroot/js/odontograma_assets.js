// Odontogram SVG Assets and Renderer
const ODONTOGRAMA_ASSETS = {
    // Generate SVG content dynamically based on treatment type and tooth type
    renderToothSVG: function(toothNumber, mapId, acronym, isMolar) {
        let fill = "#ffffff";
        let stroke = "#475569";
        let overlays = "";
        let toothPath = "";

        // Base paths for Tooth and Molar
        if (isMolar) {
            // Molar path (wider with roots and grooves)
            toothPath = `
                <path d="M25 25 C25 15, 35 15, 50 17 C65 15, 75 15, 75 25 C75 45, 68 55, 68 75 C68 85, 75 88, 70 93 C65 98, 58 92, 54 86 C52 82, 50 80, 50 80 C50 80, 48 82, 46 86 C42 92, 35 98, 30 93 C25 88, 32 85, 32 75 C32 55, 25 45, 25 25 Z" 
                      fill="__FILL__" stroke="__STROKE__" stroke-width="2.5"/>
                <path d="M38 35 C38 35, 45 40, 50 40 C55 40, 62 35, 62 35 M50 40 L50 65" fill="none" stroke="#94a3b8" stroke-width="2"/>
            `;
        } else {
            // Incisor/Canine path (pointy/single root)
            toothPath = `
                <path d="M30 25 C30 15, 40 12, 50 12 C60 12, 70 15, 70 25 C70 45, 64 55, 64 75 C64 85, 60 90, 56 93 C53 95, 51 90, 50 86 C49 90, 47 95, 44 93 C40 90, 36 85, 36 75 C36 55, 30 45, 30 25 Z" 
                      fill="__FILL__" stroke="__STROKE__" stroke-width="2.5"/>
            `;
        }

        // Apply Treatment effects based on tbl_MapaOdontograma.id_MapaOdontograma
        switch (parseInt(mapId)) {
            case 1: // Rojo = Caries (Red center)
                fill = "#fef2f2";
                stroke = "#dc2626";
                if (isMolar) {
                    overlays += `<circle cx="50" cy="35" r="10" fill="#dc2626" opacity="0.85"/>`;
                } else {
                    overlays += `<circle cx="50" cy="28" r="8" fill="#dc2626" opacity="0.85"/>`;
                }
                break;
            case 2: // Giroversión (Circular arrows overlay)
                overlays += `
                    <path d="M 20 50 A 30 30 0 1 1 80 50" fill="none" stroke="#2563eb" stroke-width="3" stroke-dasharray="4,4"/>
                    <path d="M 75 45 L 80 50 L 75 55 M 25 55 L 20 50 L 25 45" fill="none" stroke="#2563eb" stroke-width="3"/>
                `;
                break;
            case 3: // Incluido (Blue outline)
                overlays += `
                    <rect x="15" y="8" width="70" height="88" rx="8" fill="none" stroke="#0284c7" stroke-width="2" stroke-dasharray="5,3"/>
                    <text x="50" y="24" font-size="12" font-weight="bold" fill="#0284c7" text-anchor="middle">INC</text>
                `;
                break;
            case 4: // Perdido (Semi-transparent + Red Cross)
                fill = "#f1f5f9";
                stroke = "#cbd5e1";
                overlays += `
                    <line x1="15" y1="15" x2="85" y2="85" stroke="#dc2626" stroke-width="4.5"/>
                    <line x1="85" y1="15" x2="15" y2="85" stroke="#dc2626" stroke-width="4.5"/>
                `;
                break;
            case 5: // Erosión (Orange waves)
                overlays += `
                    <path d="M 32 30 Q 40 25 48 30 T 64 30 M 32 45 Q 40 40 48 45 T 64 45" fill="none" stroke="#ea580c" stroke-width="3"/>
                `;
                break;
            case 6: // Supernumerario (Blue box with 'S')
                overlays += `
                    <circle cx="20" cy="20" r="12" fill="#06b6d4"/>
                    <text x="20" y="24" font-size="12" font-weight="bold" fill="white" text-anchor="middle">S</text>
                `;
                break;
            case 7: // Obturado (Green filling)
                fill = "#f0fdf4";
                stroke = "#16a34a";
                if (isMolar) {
                    overlays += `<circle cx="50" cy="35" r="12" fill="#16a34a" opacity="0.9"/>`;
                } else {
                    overlays += `<circle cx="50" cy="28" r="9" fill="#16a34a" opacity="0.9"/>`;
                }
                break;
            case 8: // Abrasión (Brownish marks)
                overlays += `
                    <line x1="35" y1="30" x2="65" y2="30" stroke="#854d0e" stroke-width="2.5"/>
                    <line x1="35" y1="36" x2="65" y2="36" stroke="#854d0e" stroke-width="2.5"/>
                    <line x1="35" y1="42" x2="65" y2="42" stroke="#854d0e" stroke-width="2.5"/>
                `;
                break;
            case 9: // Pulpectomía (Root canal - red vertical line through root)
                overlays += `
                    <line x1="50" y1="30" x2="50" y2="78" stroke="#dc2626" stroke-width="3.5"/>
                    <circle cx="50" cy="30" r="3" fill="#dc2626"/>
                `;
                break;
            case 10: // Bolsa periodontal (Red line at base)
                overlays += `
                    <path d="M 22 55 L 78 55" stroke="#e11d48" stroke-width="4.5"/>
                    <text x="50" y="68" font-size="10" font-weight="bold" fill="#e11d48" text-anchor="middle">BOLSA</text>
                `;
                break;
            case 11: // Prótesis fija (Crown - gold overlay on top)
                fill = "#fffbeb";
                stroke = "#d97706";
                if (isMolar) {
                    overlays += `
                        <path d="M25 25 C25 15, 35 15, 50 17 C65 15, 75 15, 75 25 L73 45 L27 45 Z" fill="#fbbf24" stroke="#d97706" stroke-width="2"/>
                    `;
                } else {
                    overlays += `
                        <path d="M30 25 C30 15, 40 12, 50 12 C60 12, 70 15, 70 25 L67 42 L33 42 Z" fill="#fbbf24" stroke="#d97706" stroke-width="2"/>
                    `;
                }
                break;
            case 12: // Movilidad (Double side horizontal arrow)
                overlays += `
                    <line x1="20" y1="48" x2="80" y2="48" stroke="#7c3aed" stroke-width="3"/>
                    <path d="M 25 43 L 20 48 L 25 53 M 75 43 L 80 48 L 75 53" fill="none" stroke="#7c3aed" stroke-width="3"/>
                `;
                break;
            case 13: // Órgano no vital (Dark Gray)
                fill = "#64748b";
                stroke = "#334155";
                break;
            case 14: // Prótesis removible (Dotted outline)
                overlays += `
                    <rect x="18" y="10" width="64" height="84" rx="6" fill="none" stroke="#4f46e5" stroke-width="2" stroke-dasharray="3,3"/>
                    <text x="50" y="24" font-size="12" font-weight="bold" fill="#4f46e5" text-anchor="middle">REM</text>
                `;
                break;
            case 15: // Otro (Blue question mark)
                overlays += `
                    <circle cx="50" cy="48" r="10" fill="#2563eb"/>
                    <text x="50" y="52" font-size="12" font-weight="bold" fill="white" text-anchor="middle">?</text>
                `;
                break;
            case 16: // Diastema (Brackets on sides)
                overlays += `
                    <path d="M 12 25 L 6 25 L 6 75 L 12 75 M 88 25 L 94 25 L 94 75 L 88 75" fill="none" stroke="#ea580c" stroke-width="3"/>
                `;
                break;
            default: // Healthy / Diente / Muela
                // Healthy white with subtle blue gradient
                fill = "url(#healthyGrad)";
                break;
        }

        // Replace placeholders in path string
        let svgPath = toothPath.replace("__FILL__", fill).replace("__STROKE__", stroke);

        // Build entire SVG wrapper
        return `
            <svg viewBox="0 0 100 100" class="tooth-svg" width="100%" height="100%">
                <defs>
                    <linearGradient id="healthyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="#ffffff"/>
                        <stop offset="70%" stop-color="#f8fafc"/>
                        <stop offset="100%" stop-color="#e2e8f0"/>
                    </linearGradient>
                </defs>
                ${svgPath}
                ${overlays}
                <text x="50" y="96" font-size="12" font-weight="bold" fill="#1e293b" text-anchor="middle">${toothNumber}</text>
            </svg>
        `;
    }
};
