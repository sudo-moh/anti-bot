console.log("Backend request:", window.__FIRST_REQUEST__);


(function() {
    'use strict';

    // Helper function to parse User-Agent
    function parseUserAgent(ua) {
        const platformMatch = ua.match(/\(([^)]+)\)/);
        const platform = platformMatch ? platformMatch[1] : '';

        const chromeMatch = ua.match(/Chrome\/(\d+)/);
        const chromeVersion = chromeMatch ? chromeMatch[1] : null;

        return {
            platform: platform,
            chromeVersion: chromeVersion,
            fullUA: ua
        };
    }

    // Helper function to parse sec-ch-ua header
    function parseSecChUa(header) {
        const brands = [];
        const regex = /"([^"]+)";v="(\d+)"/g;
        let match;

        while ((match = regex.exec(header)) !== null) {
            brands.push({ brand: match[1], version: match[2] });
        }

        return brands;
    }

    // Collect browser attributes that match HTTP headers
    function collectBrowserAttributes() {
        const attrs = {
            // User-Agent match
            userAgent: navigator.userAgent,

            // Platform match (sec-ch-ua-platform)
            platform: navigator.platform,
            userAgentData: navigator.userAgentData ? {
                platform: navigator.userAgentData.platform,
                mobile: navigator.userAgentData.mobile,
                brands: navigator.userAgentData.brands
            } : null,

            // Language match (accept-language)
            language: navigator.language,
            languages: navigator.languages,

            // Mobile detection (sec-ch-ua-mobile)
            maxTouchPoints: navigator.maxTouchPoints,

            // Screen/hardware info (can indicate device type)
            screen: {
                width: screen.width,
                height: screen.height,
                availWidth: screen.availWidth,
                availHeight: screen.availHeight,
                colorDepth: screen.colorDepth,
                pixelDepth: screen.pixelDepth
            },

            // Timezone (can be compared with accept-language region)
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            timezoneOffset: new Date().getTimezoneOffset(),

            // Hardware concurrency (can indicate real device vs VM)
            hardwareConcurrency: navigator.hardwareConcurrency,

            // Device memory (if available)
            deviceMemory: navigator.deviceMemory || null,

            // Connection info
            connection: navigator.connection ? {
                effectiveType: navigator.connection.effectiveType,
                downlink: navigator.connection.downlink,
                rtt: navigator.connection.rtt
            } : null,

            // WebGL vendor/renderer (can detect headless browsers)
            webgl: getWebGLInfo(),

            // Plugins (headless browsers have no plugins)
            plugins: Array.from(navigator.plugins).map(p => ({
                name: p.name,
                description: p.description
            })),
            pluginCount: navigator.plugins.length
        };

        return attrs;
    }

    function getWebGLInfo() {
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

            if (!gl) return null;

            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');

            return {
                vendor: debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
                renderer: debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)
            };
        } catch(e) {
            return null;
        }
    }

    // Scoring system - higher score = more suspicious
    function calculateMismatchScore() {
        const headers = window.__FIRST_REQUEST__.headers;
        const browserAttrs = collectBrowserAttributes();

        let score = 0;
        const issues = [];

        // 1. User-Agent mismatch (CRITICAL - 30 points)
        if (headers['user-agent'] && browserAttrs.userAgent !== headers['user-agent']) {
            score += 30;
            issues.push({
                severity: 'CRITICAL',
                points: 30,
                type: 'user-agent-mismatch',
                expected: headers['user-agent'],
                actual: browserAttrs.userAgent
            });
        }

        // 2. Platform mismatch (HIGH - 20 points)
        if (headers['sec-ch-ua-platform']) {
            const headerPlatform = headers['sec-ch-ua-platform'].replace(/"/g, '');
            const browserPlatform = browserAttrs.userAgentData?.platform || browserAttrs.platform;

            // Check if platforms are compatible
            const platformCompatible = checkPlatformCompatibility(headerPlatform, browserPlatform);

            if (!platformCompatible) {
                score += 20;
                issues.push({
                    severity: 'HIGH',
                    points: 20,
                    type: 'platform-mismatch',
                    expected: headerPlatform,
                    actual: browserPlatform
                });
            }
        }

        // 3. Mobile flag mismatch (HIGH - 15 points)
        if (headers['sec-ch-ua-mobile']) {
            const headerMobile = headers['sec-ch-ua-mobile'] === '?1';
            const browserMobile = browserAttrs.userAgentData?.mobile || (browserAttrs.maxTouchPoints > 0 && screen.width < 768);

            if (headerMobile !== browserMobile) {
                score += 15;
                issues.push({
                    severity: 'HIGH',
                    points: 15,
                    type: 'mobile-flag-mismatch',
                    expected: headerMobile,
                    actual: browserMobile
                });
            }
        }

        // 4. Language mismatch (MEDIUM - 10 points)
        if (headers['accept-language']) {
            const headerLang = headers['accept-language'].split(',')[0].split(';')[0].trim();
            const browserLang = browserAttrs.language;

            if (!headerLang.startsWith(browserLang.split('-')[0])) {
                score += 10;
                issues.push({
                    severity: 'MEDIUM',
                    points: 10,
                    type: 'language-mismatch',
                    expected: headerLang,
                    actual: browserLang
                });
            }
        }

        // 5. Chrome version mismatch (MEDIUM - 15 points)
        if (headers['sec-ch-ua']) {
            const headerBrands = parseSecChUa(headers['sec-ch-ua']);
            const chromeBrand = headerBrands.find(b => b.brand.includes('Chrome'));

            const uaData = browserAttrs.userAgentData?.brands;
            const browserChromeBrand = uaData ? uaData.find(b => b.brand.includes('Chrome')) : null;

            if (chromeBrand && browserChromeBrand && chromeBrand.version !== browserChromeBrand.version) {
                score += 15;
                issues.push({
                    severity: 'MEDIUM',
                    points: 15,
                    type: 'chrome-version-mismatch',
                    expected: chromeBrand.version,
                    actual: browserChromeBrand.version
                });
            }
        }

        // 6. Headless browser detection (CRITICAL - 25 points)
        if (navigator.webdriver === true) {
            score += 25;
            issues.push({
                severity: 'CRITICAL',
                points: 25,
                type: 'webdriver-flag-detected',
                detail: 'navigator.webdriver is true'
            });
        }

        // 7. No plugins (MEDIUM - 10 points for desktop)
        const isMobile = headers['sec-ch-ua-mobile'] === '?1';
        if (!isMobile && browserAttrs.pluginCount === 0) {
            score += 10;
            issues.push({
                severity: 'MEDIUM',
                points: 10,
                type: 'no-plugins-desktop',
                detail: 'Desktop browser with 0 plugins'
            });
        }

        // 8. Timezone/Language region mismatch (LOW - 5 points)
        if (headers['accept-language']) {
            const langRegion = headers['accept-language'].match(/[a-z]{2}-([A-Z]{2})/);
            if (langRegion) {
                const headerRegion = langRegion[1];
                const timezone = browserAttrs.timezone;

                // Simple check: DZ (Algeria) should have Africa timezone
                if (headerRegion === 'DZ' && !timezone.includes('Africa')) {
                    score += 5;
                    issues.push({
                        severity: 'LOW',
                        points: 5,
                        type: 'timezone-region-mismatch',
                        expected: `Africa/* for ${headerRegion}`,
                        actual: timezone
                    });
                }
            }
        }

        // 9. WebGL missing or suspicious (MEDIUM - 12 points)
        if (!browserAttrs.webgl || browserAttrs.webgl.vendor.includes('SwiftShader') || 
            browserAttrs.webgl.renderer.includes('SwiftShader')) {
            score += 12;
            issues.push({
                severity: 'MEDIUM',
                points: 12,
                type: 'webgl-suspicious',
                detail: browserAttrs.webgl ? 'SwiftShader detected' : 'WebGL not available'
            });
        }

        return {
            score: score,
            riskLevel: getRiskLevel(score),
            issues: issues,
            browserAttributes: browserAttrs,
            timestamp: new Date().toISOString()
        };
    }

    function checkPlatformCompatibility(headerPlatform, browserPlatform) {
        const platformMap = {
            'Windows': ['Win32', 'Win64', 'Windows'],
            'macOS': ['MacIntel', 'Macintosh'],
            'Linux': ['Linux'],
            'Android': ['Linux armv', 'Android'],
            'iOS': ['iPhone', 'iPad', 'iPod']
        };

        for (const [key, values] of Object.entries(platformMap)) {
            if (headerPlatform.includes(key)) {
                return values.some(v => browserPlatform.includes(v));
            }
        }

        return true; // If we can't determine, don't penalize
    }

    function getRiskLevel(score) {
        if (score === 0) return 'NONE';
        if (score <= 10) return 'LOW';
        if (score <= 25) return 'MEDIUM';
        if (score <= 50) return 'HIGH';
        return 'CRITICAL';
    }

window.__VALIDATION_RESULT__ = calculateMismatchScore(); 


})();
