

const PlaywrightDetector = {
    score: 0,
    flags: [],
    results: {},

    // ===== CHECK 1: NOTIFICATION PERMISSION MISMATCH (CRITICAL) =====
    checkNotificationPermission: async function() {
        try {
            const permQuery = await navigator.permissions.query({ name: 'notifications' });
            const notifPerm = Notification.permission;
            
            console.log('[CHECK] Notification.permission:', notifPerm);
            console.log('[CHECK] permissions.query state:', permQuery.state);
            
            // PLAYWRIGHT BUG: This mismatch ALWAYS exists
            if (notifPerm === 'denied' && permQuery.state === 'prompt') {
                this.flags.push(' PLAYWRIGHT: Notification.permission=denied but query=prompt');
                this.score += 100;
                return { detected: true, reason: 'Notification mismatch' };
            }
            
            if (notifPerm === 'default' && permQuery.state === 'denied') {
                this.flags.push(' PLAYWRIGHT: Notification reversed mismatch');
                this.score += 100;
                return { detected: true, reason: 'Notification reversed' };
            }
            
            return { detected: false };
        } catch (e) {
            console.error('[ERROR] Notification check failed:', e);
            return { detected: false, error: e.message };
        }
    },

    // ===== CHECK 2: CHROME OBJECT IN IFRAME (CRITICAL) =====
    checkIframeChrome: function() {
        try {
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            document.body.appendChild(iframe);
            
            const hasParentChrome = !!window.chrome;
            const hasIframeChrome = !!iframe.contentWindow.chrome;
            
            console.log('[CHECK] Parent has chrome:', hasParentChrome);
            console.log('[CHECK] Iframe has chrome:', hasIframeChrome);
            
            document.body.removeChild(iframe);
            
            // If parent Chrome but iframe doesn't = Playwright
            if (hasParentChrome && !hasIframeChrome && navigator.vendor === 'Google Inc.') {
                this.flags.push(' PLAYWRIGHT: Iframe missing chrome object');
                this.score += 80;
                return { detected: true, reason: 'Iframe chrome missing' };
            }
            
            return { detected: false };
        } catch (e) {
            console.error('[ERROR] Iframe check failed:', e);
            return { detected: false, error: e.message };
        }
    },

    // ===== CHECK 3: WEBDRIVER FLAG =====
    checkWebDriver: function() {
        const hasWebDriver = navigator.webdriver === true;
        
        console.log('[CHECK] navigator.webdriver:', navigator.webdriver);
        
        if (hasWebDriver) {
            this.flags.push('⚠️ navigator.webdriver = true');
            this.score += 65;
            return { detected: true, reason: 'webdriver flag' };
        }
        
        return { detected: false };
    },

    // ===== CHECK 4: CHROME RUNTIME CONNECT ERROR =====
    checkChromeRuntime: function() {
        if (!window.chrome || !window.chrome.runtime) {
            return { detected: false, reason: 'No chrome.runtime' };
        }
        
        try {
            window.chrome.runtime.connect();
        } catch (e) {
            console.log('[CHECK] chrome.runtime.connect error:', e.message);
            
            // Real Chrome: "TypeError: Invalid invocation" or "Error in invocation"
            // Playwright: "Cannot read properties of undefined (reading 'connect')" or different error
            
            if (e.message.includes('reading \'connect\'') || 
                e.message.includes('undefined') && !e.message.includes('Invalid invocation')) {
                this.flags.push(' PLAYWRIGHT: Wrong chrome.runtime.connect error');
                this.score += 60;
                return { detected: true, reason: 'Chrome runtime error mismatch' };
            }
        }
        
        return { detected: false };
    },

    // ===== CHECK 5: PLUGIN ARRAY INSTANCE =====
    checkPlugins: function() {
        const isPluginArray = navigator.plugins instanceof PluginArray;
        const isMimeArray = navigator.mimeTypes instanceof MimeTypeArray;
        
        console.log('[CHECK] plugins instanceof PluginArray:', isPluginArray);
        console.log('[CHECK] mimeTypes instanceof MimeTypeArray:', isMimeArray);
        
        if (!isPluginArray) {
            this.flags.push(' plugins is not PluginArray instance');
            this.score += 90;
            return { detected: true, reason: 'Fake plugins array' };
        }
        
        if (!isMimeArray) {
            this.flags.push(' mimeTypes is not MimeTypeArray instance');
            this.score += 90;
            return { detected: true, reason: 'Fake mimeTypes array' };
        }
        
        // Check plugin toString
        if (navigator.plugins.length > 0) {
            const pluginStr = navigator.plugins[0].toString();
            console.log('[CHECK] First plugin toString:', pluginStr);
            
            if (pluginStr !== '[object Plugin]') {
                this.flags.push(' Plugin toString is wrong');
                this.score += 70;
                return { detected: true, reason: 'Fake plugin object' };
            }
        }
        
        return { detected: false };
    },

    // ===== CHECK 6: PERMISSIONS PROTOTYPE =====
    checkPermissionsPrototype: function() {
        try {
            const desc = Object.getOwnPropertyDescriptor(Permissions.prototype, 'query');
            if (!desc) {
                this.flags.push('⚠️ Permissions.query descriptor missing');
                this.score += 30;
                return { detected: true, reason: 'Permissions tampered' };
            }
            
            const queryStr = desc.value.toString();
            console.log('[CHECK] Permissions.query toString:', queryStr.substring(0, 50));
            
            if (!queryStr.includes('[native code]')) {
                this.flags.push(' Permissions.query is not native');
                this.score += 50;
                return { detected: true, reason: 'Permissions wrapped' };
            }
        } catch (e) {
            console.error('[ERROR] Permissions check failed:', e);
        }
        
        return { detected: false };
    },

    // ===== CHECK 7: WINDOW CHROME MISSING =====
    checkChromeObject: function() {
        const isChrome = navigator.vendor === 'Google Inc.' || navigator.userAgent.includes('Chrome');
        const hasChrome = !!window.chrome;
        
        console.log('[CHECK] Is Chrome browser:', isChrome);
        console.log('[CHECK] Has window.chrome:', hasChrome);
        
        if (isChrome && !hasChrome) {
            this.flags.push(' Chrome browser without window.chrome');
            this.score += 40;
            return { detected: true, reason: 'Missing chrome object' };
        }
        
        return { detected: false };
    },

    // ===== RUN ALL CHECKS =====
    runAll: async function() {
        console.log(' Starting Playwright Detection...\n');
        
        this.score = 0;
        this.flags = [];
        this.results = {};
        
        // Synchronous checks
        this.results.webdriver = this.checkWebDriver();
        this.results.chromeObject = this.checkChromeObject();
        this.results.iframeChrome = this.checkIframeChrome();
        this.results.plugins = this.checkPlugins();
        this.results.chromeRuntime = this.checkChromeRuntime();
        this.results.permissionsProto = this.checkPermissionsPrototype();
        
        // CRITICAL: Async notification check (MUST await)
        this.results.notificationPerm = await this.checkNotificationPermission();
        
        console.log('\n Detection Complete');
        console.log(' Final Score:', this.score);
        console.log(' Flags:', this.flags.length);
        
        return this.getReport();
    },

    // ===== GET REPORT =====
    getReport: function() {
        let verdict = 'HUMAN';
        let confidence = 'HIGH';
        
        if (this.score >= 80) {
            verdict = 'BOT - PLAYWRIGHT DETECTED';
            confidence = 'VERY HIGH';
        } else if (this.score >= 50) {
            verdict = 'LIKELY BOT';
            confidence = 'HIGH';
        } else if (this.score >= 25) {
            verdict = 'SUSPICIOUS';
            confidence = 'MEDIUM';
        }
        
        return {
            score: this.score,
            verdict: verdict,
            confidence: confidence,
            totalFlags: this.flags.length,
            flags: this.flags,
            results: this.results,
            timestamp: new Date().toISOString()
        };
    }
};


window.PlaywrightDetector = PlaywrightDetector;
