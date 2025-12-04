

(function() {
    'use strict';

    const BotDetector = {
        results: {
            audioContext: null,
            fonts: null,
            webglExtended: null,
            webrtc: null,
            propertyDescriptors: null,
            functionToString: null,
            timezone: null,
            speechSynthesis: null,
            consistency: null,
            userAgentData: null,
            svg: null,
            cssMediaQueries: null,
            performance: null,
            screenOrientation: null,
            errorStack: null,
            mathPrecision: null,
            windowScreenMismatch: null,
            storage: null,
            extensions: null,
            sensors: null,
            advancedNavigator: null,
            emojiCanvas: null,
            webglCanvas: null,
            dateFormatting: null,
            pointerEvents: null,
            advancedCodecs: null,
            connectionAPI: null
        },

        flags: [],
        score: 0, // 0-100, higher = more suspicious

        // ==================== AUDIO CONTEXT FINGERPRINTING ====================
        checkAudioContext: async function() {
            const result = {
                supported: false,
                hash: null,
                sampleRate: null,
                suspicious: false,
                flags: []
            };

            try {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                if (!AudioContext) {
                    result.flags.push('AudioContext not supported');
                    result.suspicious = true;
                    return result;
                }

                const context = new AudioContext();
                const oscillator = context.createOscillator();
                const compressor = context.createDynamicsCompressor();
                const destination = context.createAnalyser();

                oscillator.type = 'triangle';
                oscillator.frequency.setValueAtTime(10000, context.currentTime);

                compressor.threshold.setValueAtTime(-50, context.currentTime);
                compressor.knee.setValueAtTime(40, context.currentTime);
                compressor.ratio.setValueAtTime(12, context.currentTime);
                compressor.attack.setValueAtTime(0, context.currentTime);
                compressor.release.setValueAtTime(0.25, context.currentTime);

                oscillator.connect(compressor);
                compressor.connect(destination);
                destination.connect(context.destination);

                oscillator.start(0);
                
                const offlineContext = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(1, 44100, 44100);
                const offlineOscillator = offlineContext.createOscillator();
                const offlineCompressor = offlineContext.createDynamicsCompressor();

                offlineOscillator.type = 'triangle';
                offlineOscillator.frequency.setValueAtTime(10000, offlineContext.currentTime);
                offlineCompressor.threshold.setValueAtTime(-50, offlineContext.currentTime);
                offlineCompressor.knee.setValueAtTime(40, offlineContext.currentTime);
                offlineCompressor.ratio.setValueAtTime(12, offlineContext.currentTime);
                offlineCompressor.attack.setValueAtTime(0, offlineContext.currentTime);
                offlineCompressor.release.setValueAtTime(0.25, offlineContext.currentTime);

                offlineOscillator.connect(offlineCompressor);
                offlineCompressor.connect(offlineContext.destination);
                offlineOscillator.start(0);

                const buffer = await offlineContext.startRendering();
                const channelData = buffer.getChannelData(0);
                
                let hash = 0;
                for (let i = 4500; i < 5000; i++) {
                    hash += Math.abs(channelData[i]);
                }

                result.supported = true;
                result.hash = hash.toString();
                result.sampleRate = context.sampleRate;

                oscillator.stop();
                context.close();

                // Check for suspicious patterns
                if (hash === 0) {
                    result.flags.push('Audio hash is zero - likely spoofed');
                    result.suspicious = true;
                }

                // Common sample rates: 44100, 48000
                if (![44100, 48000, 96000, 192000].includes(context.sampleRate)) {
                    result.flags.push(`Unusual sample rate: ${context.sampleRate}`);
                    result.suspicious = true;
                }

            } catch (e) {
                result.flags.push(`Audio context error: ${e.message}`);
                result.suspicious = true;
            }

            this.results.audioContext = result;
            if (result.suspicious) this.score += 15;
            return result;
        },

        // ==================== FONT FINGERPRINTING ====================
        checkFonts: function() {
            const result = {
                detectedFonts: [],
                totalFonts: 0,
                suspicious: false,
                flags: []
            };

            const baseFonts = ['monospace', 'sans-serif', 'serif'];
            const testFonts = [
                'Arial', 'Verdana', 'Times New Roman', 'Courier New', 'Georgia', 
                'Palatino', 'Garamond', 'Bookman', 'Comic Sans MS', 'Trebuchet MS',
                'Impact', 'Lucida Console', 'Tahoma', 'Lucida Sans Unicode',
                'MS Sans Serif', 'MS Serif', 'Calibri', 'Cambria', 'Consolas',
                'Segoe UI', 'Candara', 'Franklin Gothic', 'Futura', 'Geneva',
                'Helvetica', 'Helvetica Neue', 'Monaco', 'Optima', 'Palatino Linotype',
                // Mac fonts
                'Apple Chancery', 'Apple Color Emoji', 'Apple SD Gothic Neo', 'Menlo',
                'San Francisco', 'Avenir', 'Avenir Next', 'Lucida Grande',
                // Linux fonts
                'Ubuntu', 'Cantarell', 'DejaVu Sans', 'Liberation Sans', 'Noto Sans',
                'Droid Sans', 'Roboto', 'Oxygen', 'FreeSans',
                // Android fonts
                'Roboto', 'Noto Color Emoji', 'Dancing Script',
                // Rare/Enterprise fonts (red flags)
                'Calibri Light', 'Segoe UI Light', 'Courier', 'MS Reference Sans Serif',
                'Agency FB', 'Algerian', 'Arial Rounded MT Bold', 'Bauhaus 93',
                'Bell MT', 'Berlin Sans FB', 'Bernard MT Condensed', 'Blackadder ITC',
                'Bodoni MT', 'Britannic Bold', 'Broadway', 'Brush Script MT'
            ];

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = 500;
            canvas.height = 200;

            const testString = 'mmmmmmmmmmlli';
            const fontSize = '72px';

            const baseMeasurements = {};
            baseFonts.forEach(baseFont => {
                ctx.font = `${fontSize} ${baseFont}`;
                baseMeasurements[baseFont] = ctx.measureText(testString).width;
            });

            testFonts.forEach(font => {
                let detected = false;
                baseFonts.forEach(baseFont => {
                    ctx.font = `${fontSize} '${font}', ${baseFont}`;
                    const measurement = ctx.measureText(testString).width;
                    if (measurement !== baseMeasurements[baseFont]) {
                        detected = true;
                    }
                });
                if (detected) {
                    result.detectedFonts.push(font);
                }
            });

            result.totalFonts = result.detectedFonts.length;

            // Flags for suspicious patterns
            if (result.totalFonts === 0) {
                result.flags.push('No fonts detected - likely blocked');
                result.suspicious = true;
            } else if (result.totalFonts < 5) {
                result.flags.push(`Very few fonts detected: ${result.totalFonts}`);
                result.suspicious = true;
            } else if (result.totalFonts > 80) {
                result.flags.push(`Unusually many fonts: ${result.totalFonts}`);
                result.suspicious = true;
            }

            // Check for Windows fonts on non-Windows platform
            const windowsFonts = ['Calibri', 'Cambria', 'Consolas', 'Segoe UI'];
            const hasWindowsFonts = windowsFonts.some(f => result.detectedFonts.includes(f));
            if (hasWindowsFonts && !navigator.platform.match(/Win/)) {
                result.flags.push('Windows fonts on non-Windows platform');
                result.suspicious = true;
            }

            // Check for Mac fonts on non-Mac platform
            const macFonts = ['Menlo', 'San Francisco', 'Avenir', 'Apple Color Emoji'];
            const hasMacFonts = macFonts.some(f => result.detectedFonts.includes(f));
            if (hasMacFonts && !navigator.platform.match(/Mac/)) {
                result.flags.push('Mac fonts on non-Mac platform');
                result.suspicious = true;
            }

            this.results.fonts = result;
            if (result.suspicious) this.score += 10;
            return result;
        },

        // ==================== WEBGL EXTENDED PARAMETERS ====================
        checkWebGLExtended: function() {
            const result = {
                supported: false,
                parameters: {},
                extensions: [],
                webgl2: false,
                renderHash: null,
                suspicious: false,
                flags: []
            };

            try {
                const canvas = document.createElement('canvas');
                const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
                
                if (!gl) {
                    result.flags.push('WebGL not supported');
                    result.suspicious = true;
                    return result;
                }

                result.supported = true;

                // Get all parameters
                const params = {
                    MAX_TEXTURE_SIZE: gl.getParameter(gl.MAX_TEXTURE_SIZE),
                    MAX_VERTEX_UNIFORM_VECTORS: gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS),
                    MAX_VIEWPORT_DIMS: gl.getParameter(gl.MAX_VIEWPORT_DIMS),
                    MAX_RENDERBUFFER_SIZE: gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),
                    MAX_COMBINED_TEXTURE_IMAGE_UNITS: gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS),
                    MAX_VERTEX_ATTRIBS: gl.getParameter(gl.MAX_VERTEX_ATTRIBS),
                    MAX_VARYING_VECTORS: gl.getParameter(gl.MAX_VARYING_VECTORS),
                    MAX_FRAGMENT_UNIFORM_VECTORS: gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS),
                    MAX_CUBE_MAP_TEXTURE_SIZE: gl.getParameter(gl.MAX_CUBE_MAP_TEXTURE_SIZE),
                    MAX_TEXTURE_IMAGE_UNITS: gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS),
                    MAX_VERTEX_TEXTURE_IMAGE_UNITS: gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS),
                    SHADING_LANGUAGE_VERSION: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
                    VERSION: gl.getParameter(gl.VERSION),
                    RENDERER: gl.getParameter(gl.RENDERER),
                    VENDOR: gl.getParameter(gl.VENDOR),
                    ALIASED_LINE_WIDTH_RANGE: gl.getParameter(gl.ALIASED_LINE_WIDTH_RANGE),
                    ALIASED_POINT_SIZE_RANGE: gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE),
                    RED_BITS: gl.getParameter(gl.RED_BITS),
                    GREEN_BITS: gl.getParameter(gl.GREEN_BITS),
                    BLUE_BITS: gl.getParameter(gl.BLUE_BITS),
                    ALPHA_BITS: gl.getParameter(gl.ALPHA_BITS),
                    DEPTH_BITS: gl.getParameter(gl.DEPTH_BITS),
                    STENCIL_BITS: gl.getParameter(gl.STENCIL_BITS)
                };

                // Get unmasked vendor/renderer
                const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
                if (debugInfo) {
                    params.UNMASKED_VENDOR_WEBGL = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
                    params.UNMASKED_RENDERER_WEBGL = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
                }

                result.parameters = params;

                // Get all extensions
                result.extensions = gl.getSupportedExtensions() || [];

                // Check WebGL2
                const gl2 = canvas.getContext('webgl2');
                result.webgl2 = !!gl2;

                // 3D rendering test
                canvas.width = 256;
                canvas.height = 128;
                gl.viewport(0, 0, canvas.width, canvas.height);
                gl.clearColor(0.5, 0.5, 0.5, 1.0);
                gl.clear(gl.COLOR_BUFFER_BIT);

                // Draw a triangle
                const vertexShader = gl.createShader(gl.VERTEX_SHADER);
                gl.shaderSource(vertexShader, 'attribute vec2 pos;void main(){gl_Position=vec4(pos,0.0,1.0);}');
                gl.compileShader(vertexShader);

                const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
                gl.shaderSource(fragmentShader, 'precision mediump float;void main(){gl_FragColor=vec4(1.0,0.0,0.0,1.0);}');
                gl.compileShader(fragmentShader);

                const program = gl.createProgram();
                gl.attachShader(program, vertexShader);
                gl.attachShader(program, fragmentShader);
                gl.linkProgram(program);
                gl.useProgram(program);

                const vertices = new Float32Array([0, 0.5, -0.5, -0.5, 0.5, -0.5]);
                const buffer = gl.createBuffer();
                gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
                gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

                const pos = gl.getAttribLocation(program, 'pos');
                gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
                gl.enableVertexAttribArray(pos);
                gl.drawArrays(gl.TRIANGLES, 0, 3);

                // Hash the rendering
                const pixels = new Uint8Array(canvas.width * canvas.height * 4);
                gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
                let hash = 0;
                for (let i = 0; i < pixels.length; i++) {
                    hash = ((hash << 5) - hash) + pixels[i];
                    hash = hash & hash;
                }
                result.renderHash = hash;

                // Detect suspicious patterns
                if (params.UNMASKED_RENDERER_WEBGL) {
                    if (params.UNMASKED_RENDERER_WEBGL.includes('SwiftShader')) {
                        result.flags.push('SwiftShader detected - software rendering');
                        result.suspicious = true;
                    }
                    if (params.UNMASKED_RENDERER_WEBGL.includes('llvmpipe')) {
                        result.flags.push('llvmpipe detected - Linux software rendering');
                        result.suspicious = true;
                    }
                    if (params.UNMASKED_RENDERER_WEBGL === 'Mesa OffScreen') {
                        result.flags.push('Mesa OffScreen - headless rendering');
                        result.suspicious = true;
                    }
                }

                if (params.UNMASKED_VENDOR_WEBGL === 'Brian Paul') {
                    result.flags.push('Brian Paul vendor - Mesa/software rendering');
                    result.suspicious = true;
                }

                if (result.extensions.length < 10) {
                    result.flags.push(`Very few WebGL extensions: ${result.extensions.length}`);
                    result.suspicious = true;
                }

                if (hash === 0) {
                    result.flags.push('WebGL render hash is zero');
                    result.suspicious = true;
                }

            } catch (e) {
                result.flags.push(`WebGL error: ${e.message}`);
                result.suspicious = true;
            }

            this.results.webglExtended = result;
            if (result.suspicious) this.score += 20;
            return result;
        },

        // ==================== WEBRTC  DETECTION ====================
checkWebRTC: async function() {
    const result = {
        supported: false,
        localIPs: [],
        publicIP: null,
        leaked: false,
        suspicious: false,
        flags: []
    };

    try {
        if (!window.RTCPeerConnection && !window.webkitRTCPeerConnection && !window.mozRTCPeerConnection) {
            result.flags.push('WebRTC not supported');
            result.suspicious = true;
            return result;
        }

        result.supported = true;

        const RTCPeerConnection = window.RTCPeerConnection || 
                                window.webkitRTCPeerConnection || 
                                window.mozRTCPeerConnection;

        const pc = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });

        pc.createDataChannel('');

        const ips = new Set();

        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                pc.close();
                result.localIPs = Array.from(ips);
                
                // ONLY flag if NO IPs detected (WebRTC blocked)
                if (ips.size === 0) {
                    result.flags.push('No WebRTC IPs detected - likely blocked');
                    result.suspicious = true;
                }

                // REMOVED: Public IP leak detection - not relevant for bots
                // Just store the info without flagging it
                const privateIPRegex = /^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.)/;
                ips.forEach(ip => {
                    if (!privateIPRegex.test(ip)) {
                        result.publicIP = ip;
                        result.leaked = true;
                        // NO FLAG - this is normal behavior
                    }
                });

                this.results.webrtc = result;
                if (result.suspicious) this.score += 5;
                resolve(result);
            }, 2000);

            pc.onicecandidate = (ice) => {
                if (!ice || !ice.candidate || !ice.candidate.candidate) {
                    return;
                }

                const ipRegex = /([0-9]{1,3}(\.[0-9]{1,3}){3})/;
                const match = ipRegex.exec(ice.candidate.candidate);
                if (match && match[1]) {
                    ips.add(match[1]);
                }
            };

            pc.createOffer()
                .then(offer => pc.setLocalDescription(offer))
                .catch(() => {
                    clearTimeout(timeout);
                    result.flags.push('WebRTC offer creation failed');
                    result.suspicious = true;
                    pc.close();
                    this.results.webrtc = result;
                    resolve(result);
                });
        });

    } catch (e) {
        result.flags.push(`WebRTC error: ${e.message}`);
        result.suspicious = true;
        this.results.webrtc = result;
        return result;
    }
},


        // ==================== PROPERTY DESCRIPTOR  TAMPERING ==========
checkPropertyDescriptors: function() {
    const result = {
        tampered: [],
        suspicious: false,
        flags: []
    };

    const propsToCheck = [
        { obj: Navigator.prototype, prop: 'webdriver' },
        { obj: Navigator.prototype, prop: 'languages' },
        { obj: Navigator.prototype, prop: 'userAgent' }
    ];

    propsToCheck.forEach(({ obj, prop }) => {
        try {
            const descriptor = Object.getOwnPropertyDescriptor(obj, prop);
            
            if (!descriptor) {
                result.tampered.push(`${obj.constructor.name}.${prop}: descriptor missing`);
                result.suspicious = true;
                return;
            }

            // Check if it's a getter and if it's been modified
            if (descriptor.get) {
                const getterStr = descriptor.get.toString();
                // Only flag if it clearly doesn't have native code AND looks like a wrapper
                if (!getterStr.includes('[native code]') && getterStr.length > 100) {
                    result.tampered.push(`${obj.constructor.name}.${prop}: likely wrapped`);
                    result.suspicious = true;
                }
            }

        } catch (e) {
            // Errors are expected for some properties, don't flag
        }
    });

    if (result.tampered.length > 0) {
        result.flags.push(`${result.tampered.length} properties potentially tampered`);
    }

    this.results.propertyDescriptors = result;
    if (result.suspicious) this.score += 25;
    return result;
},


        // ==================== FUNCTION toString() VALIDATION ====================
        checkFunctionToString: function() {
            const result = {
                tampered: [],
                suspicious: false,
                flags: []
            };

            const functionsToCheck = [
                { obj: navigator, prop: 'webdriver', type: 'getter' },
                { obj: navigator.permissions, prop: 'query', type: 'function' },
                { obj: navigator, prop: 'getBattery', type: 'function' },
                { obj: Function.prototype, prop: 'toString', type: 'function' },
                { obj: Object, prop: 'getOwnPropertyDescriptor', type: 'function' },
                { obj: navigator.mediaDevices, prop: 'enumerateDevices', type: 'function' },
                { obj: Date.prototype, prop: 'getTimezoneOffset', type: 'function' }
            ];

            functionsToCheck.forEach(({ obj, prop, type }) => {
                try {
                    let target;
                    
                    if (type === 'getter') {
                        const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(obj), prop);
                        target = descriptor ? descriptor.get : null;
                    } else {
                        target = obj[prop];
                    }

                    if (!target) {
                        result.flags.push(`${obj.constructor.name}.${prop} not found`);
                        return;
                    }

                    const str = target.toString();
                    
                    if (!str.includes('[native code]')) {
                        result.tampered.push(`${obj.constructor.name}.${prop}: not native - ${str.substring(0, 50)}`);
                        result.suspicious = true;
                    }

                    // Check toString of toString
                    const toStringStr = target.toString.toString();
                    if (!toStringStr.includes('[native code]')) {
                        result.tampered.push(`${obj.constructor.name}.${prop}.toString: wrapper detected`);
                        result.suspicious = true;
                    }

                } catch (e) {
                    result.flags.push(`Error checking ${prop}: ${e.message}`);
                }
            });

            // Check if Function.prototype.toString itself is tampered
            try {
                const fpToString = Function.prototype.toString.toString();
                if (!fpToString.includes('[native code]')) {
                    result.tampered.push('Function.prototype.toString itself is tampered');
                    result.suspicious = true;
                }
            } catch (e) {
                result.flags.push('Cannot check Function.prototype.toString');
            }

            if (result.tampered.length > 0) {
                result.flags.push(`${result.tampered.length} functions tampered`);
            }

            this.results.functionToString = result;
            if (result.suspicious) this.score += 30;
            return result;
        },

        // ==================== TIMEZONE & LOCALE CONSISTENCY ====================
        checkTimezone: function() {
            const result = {
                offset: null,
                timezone: null,
                locale: null,
                dateFormat: null,
                numberFormat: null,
                suspicious: false,
                flags: []
            };

            try {
                // Timezone offset
                result.offset = new Date().getTimezoneOffset();

                // Timezone name
                if (Intl && Intl.DateTimeFormat) {
                    result.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
                    result.locale = Intl.DateTimeFormat().resolvedOptions().locale;
                    
                    // Date formatting
                    result.dateFormat = new Date().toLocaleString();
                    
                    // Number formatting
                    if (Intl.NumberFormat) {
                        result.numberFormat = Intl.NumberFormat().resolvedOptions();
                    }
                }

                // Consistency checks
                if (!result.timezone || result.timezone === '') {
                    result.flags.push('Timezone is empty');
                    result.suspicious = true;
                }

                // Check if offset matches common timezones
                const validOffsets = [];
                for (let i = -12; i <= 14; i++) {
                    validOffsets.push(i * 60);
                    validOffsets.push(i * 60 + 30);
                    validOffsets.push(i * 60 + 45);
                }
                
                if (!validOffsets.includes(result.offset)) {
                    result.flags.push(`Unusual timezone offset: ${result.offset}`);
                    result.suspicious = true;
                }

                // Check locale vs navigator.language
                if (result.locale && navigator.language) {
                    const localeBase = result.locale.split('-')[0];
                    const navLangBase = navigator.language.split('-')[0];
                    if (localeBase !== navLangBase) {
                        result.flags.push(`Locale mismatch: Intl=${result.locale}, navigator=${navigator.language}`);
                        result.suspicious = true;
                    }
                }

            } catch (e) {
                result.flags.push(`Timezone check error: ${e.message}`);
                result.suspicious = true;
            }

            this.results.timezone = result;
            if (result.suspicious) this.score += 8;
            return result;
        },

        // ==================== SPEECH SYNTHESIS ====================
checkSpeechSynthesis: function() {
    const result = {
        supported: false,
        voices: [],
        voiceCount: 0,
        suspicious: false,
        flags: []
    };

    try {
        if (!window.speechSynthesis) {
            result.flags.push('Speech synthesis not supported');
            result.suspicious = true;
            this.results.speechSynthesis = result;
            return result;
        }

        result.supported = true;

        const getVoices = () => {
            const voices = speechSynthesis.getVoices();
            result.voices = voices.map(v => ({
                name: v.name,
                lang: v.lang,
                default: v.default
            }));
            result.voiceCount = voices.length;

            // RESET flags and suspicious status
            result.flags = [];
            result.suspicious = false;

            // Re-evaluate flags based on current voice count
            if (result.voiceCount === 0) {
                result.flags.push('No speech synthesis voices');
                result.suspicious = true;
            } else if (result.voiceCount > 100) {
                result.flags.push(`Unusually many voices: ${result.voiceCount}`);
                result.suspicious = true;
            }

            // Update the results
            this.results.speechSynthesis = result;
            
            // Update score only if suspicious
            if (result.suspicious) {
                this.score += 5;
            }
        };

        getVoices();

        // Some browsers load voices async
        if (result.voiceCount === 0) {
            speechSynthesis.onvoiceschanged = getVoices;
        }

    } catch (e) {
        result.flags.push(`Speech synthesis error: ${e.message}`);
        result.suspicious = true;
        this.results.speechSynthesis = result;
    }

    return result;
},


        // ==================== CONSISTENCY VALIDATION ====================
checkConsistency: function() {
    const result = {
        inconsistencies: [],
        suspicious: false,
        flags: []
    };

    // Platform vs UserAgent
    const ua = navigator.userAgent.toLowerCase();
    const platform = navigator.platform.toLowerCase();

    if (platform.includes('win') && !ua.includes('windows') && !ua.includes('win')) {
        result.inconsistencies.push('Platform=Windows but UA doesn\'t match');
        result.suspicious = true;
    }
    if (platform.includes('mac') && !ua.includes('mac') && !ua.includes('macos')) {
        result.inconsistencies.push('Platform=Mac but UA doesn\'t match');
        result.suspicious = true;
    }
    if (platform.includes('linux') && !ua.includes('linux') && !ua.includes('x11')) {
        result.inconsistencies.push('Platform=Linux but UA doesn\'t match');
        result.suspicious = true;
    }

    // Hardware concurrency vs device memory - RELAXED
    if (navigator.hardwareConcurrency && navigator.deviceMemory) {
        const cores = navigator.hardwareConcurrency;
        const memory = navigator.deviceMemory;
        
        // Only flag extreme mismatches
        if (cores >= 20 && memory < 2) {
            result.inconsistencies.push(`Extreme: ${cores} cores but only ${memory}GB RAM`);
            result.suspicious = true;
        }
        if (cores === 1 && memory >= 32) {
            result.inconsistencies.push(`Extreme: ${cores} core but ${memory}GB RAM`);
            result.suspicious = true;
        }
    }

    // Languages array vs navigator.language - RELAXED
    if (navigator.languages && navigator.languages.length > 0 && navigator.language) {
        const lang0 = navigator.languages[0].split('-')[0].toLowerCase();
        const lang = navigator.language.split('-')[0].toLowerCase();
        if (lang0 !== lang) {
            result.inconsistencies.push(`languages[0]=${navigator.languages[0]} != language=${navigator.language}`);
            // Don't mark as suspicious - this can happen normally
        }
    }

    // Screen dimensions sanity - RELAXED
    if (screen.width && screen.height) {
        if (screen.width < 320 || screen.height < 240) {
            result.inconsistencies.push(`Unusually small screen: ${screen.width}x${screen.height}`);
            result.suspicious = true;
        }
        if (screen.width > 10000 || screen.height > 10000) {
            result.inconsistencies.push(`Unusually large screen: ${screen.width}x${screen.height}`);
            result.suspicious = true;
        }
    }

    // devicePixelRatio sanity - RELAXED
    if (window.devicePixelRatio) {
        if (window.devicePixelRatio < 0.1 || window.devicePixelRatio > 10) {
            result.inconsistencies.push(`Unusual devicePixelRatio: ${window.devicePixelRatio}`);
            result.suspicious = true;
        }
    }

    if (result.inconsistencies.length > 0) {
        result.flags.push(`${result.inconsistencies.length} inconsistencies found`);
    }

    this.results.consistency = result;
    if (result.suspicious) this.score += 15;
    return result;
},


        // ==================== USER-AGENT CLIENT HINTS ====================
        checkUserAgentData: function() {
            const result = {
                supported: false,
                brands: null,
                mobile: null,
                platform: null,
                suspicious: false,
                flags: []
            };

            try {
                if (!navigator.userAgentData) {
                    result.flags.push('navigator.userAgentData not supported (OK for older browsers)');
                    // Not suspicious - many browsers don't support this yet
                    this.results.userAgentData = result;
                    return result;
                }

                result.supported = true;
                result.brands = navigator.userAgentData.brands;
                result.mobile = navigator.userAgentData.mobile;
                result.platform = navigator.userAgentData.platform;

                // Check consistency with platform
                if (result.platform && navigator.platform) {
                    if (result.platform.toLowerCase() == "windows") {
                        if (navigator.platform.toLowerCase() !== "win32") {
                        result.flags.push(`userAgentData.platform=${result.platform} != navigator.platform=${navigator.platform}`);
                        result.suspicious = true;                       
                        }
                    } else {
                    if (result.platform.toLowerCase() !== navigator.platform.toLowerCase()) {
                        result.flags.push(`userAgentData.platform=${result.platform} != navigator.platform=${navigator.platform}`);
                        result.suspicious = true;
                    }}
                }

                // Check mobile consistency
                if (result.mobile === true && navigator.maxTouchPoints === 0) {
                    result.flags.push('mobile=true but maxTouchPoints=0');
                    result.suspicious = true;
                }

            } catch (e) {
                result.flags.push(`userAgentData error: ${e.message}`);
            }

            this.results.userAgentData = result;
            if (result.suspicious) this.score += 10;
            return result;
        },

        // ==================== SVG FINGERPRINTING ====================
        checkSVG: function() {
            const result = {
                hash: null,
                suspicious: false,
                flags: []
            };

            try {
                const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                svg.setAttribute('width', '200');
                svg.setAttribute('height', '200');
                svg.setAttributeNS('http://www.w3.org/2000/xmlns/', 'xmlns', 'http://www.w3.org/2000/svg');

                const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                circle.setAttribute('cx', '100');
                circle.setAttribute('cy', '100');
                circle.setAttribute('r', '50');
                circle.setAttribute('fill', 'red');
                svg.appendChild(circle);

                const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                text.setAttribute('x', '50');
                text.setAttribute('y', '110');
                text.setAttribute('font-family', 'Arial');
                text.setAttribute('font-size', '20');
                text.textContent = 'Test';
                svg.appendChild(text);

                document.body.appendChild(svg);
                const bbox = text.getBBox();
                const serializer = new XMLSerializer();
                const svgStr = serializer.serializeToString(svg);
                document.body.removeChild(svg);

                let hash = 0;
                for (let i = 0; i < svgStr.length; i++) {
                    hash = ((hash << 5) - hash) + svgStr.charCodeAt(i);
                    hash = hash & hash;
                }
                hash += bbox.width + bbox.height;
                result.hash = hash;

                if (hash === 0) {
                    result.flags.push('SVG hash is zero');
                    result.suspicious = true;
                }

            } catch (e) {
                result.flags.push(`SVG error: ${e.message}`);
                result.suspicious = true;
            }

            this.results.svg = result;
            if (result.suspicious) this.score += 5;
            return result;
        },

        // ==================== CSS MEDIA QUERIES ====================
        checkCSSMediaQueries: function() {
            const result = {
                matches: {},
                suspicious: false,
                flags: []
            };

            const queries = [
                'screen',
                'print',
                '(hover: hover)',
                '(hover: none)',
                '(pointer: fine)',
                '(pointer: coarse)',
                '(pointer: none)',
                '(any-hover: hover)',
                '(any-pointer: fine)',
                '(color)',
                '(monochrome)',
                '(prefers-color-scheme: dark)',
                '(prefers-color-scheme: light)',
                '(prefers-reduced-motion: reduce)',
                '(color-gamut: srgb)',
                '(color-gamut: p3)',
                '(color-gamut: rec2020)'
            ];

            queries.forEach(query => {
                try {
                    result.matches[query] = window.matchMedia(query).matches;
                } catch (e) {
                    result.flags.push(`Query failed: ${query}`);
                }
            });

            // Consistency checks
            if (result.matches['(pointer: fine)'] && result.matches['(pointer: coarse)']) {
                result.flags.push('Both fine and coarse pointer');
                result.suspicious = true;
            }

            if (result.matches['(hover: none)'] && navigator.maxTouchPoints === 0) {
                result.flags.push('hover:none but no touch points');
                result.suspicious = true;
            }

            if (!result.matches['(color)'] && screen.colorDepth > 1) {
                result.flags.push('No color support but colorDepth > 1');
                result.suspicious = true;
            }

            this.results.cssMediaQueries = result;
            if (result.suspicious) this.score += 5;
            return result;
        },

        // ==================== PERFORMANCE & TIMING ====================
checkPerformance: function() {
    const result = {
        supported: false,
        timing: {},
        memory: null,
        precision: null,
        suspicious: false,
        flags: []
    };

    try {
        if (!window.performance) {
            result.flags.push('Performance API not supported');
            result.suspicious = true;
            return result;
        }

        result.supported = true;

        // Check performance.now() precision
        const measurements = [];
        for (let i = 0; i < 10; i++) {
            const t1 = performance.now();
            const t2 = performance.now();
            measurements.push(t2 - t1);
        }
        
        result.precision = Math.min(...measurements);

        // Relaxed precision check - some browsers reduce precision for security
        // Only flag if precision is suspiciously high (>5ms) or negative
        if (result.precision < 0) {
            result.flags.push(`Negative performance.now() precision: ${result.precision}ms`);
            result.suspicious = true;
        } else if (result.precision > 5) {
            result.flags.push(`Very low performance.now() precision: ${result.precision}ms`);
            result.suspicious = true;
        }

        // Performance timing
        if (performance.timing) {
            result.timing = {
                navigationStart: performance.timing.navigationStart,
                loadEventEnd: performance.timing.loadEventEnd,
                domComplete: performance.timing.domComplete
            };
        }

        // Memory (Chrome-specific)
        if (performance.memory) {
            result.memory = {
                jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
                totalJSHeapSize: performance.memory.totalJSHeapSize,
                usedJSHeapSize: performance.memory.usedJSHeapSize
            };

            if (result.memory.usedJSHeapSize > result.memory.jsHeapSizeLimit) {
                result.flags.push('usedJSHeapSize > limit');
                result.suspicious = true;
            }
        }

    } catch (e) {
        result.flags.push(`Performance error: ${e.message}`);
        result.suspicious = true;
    }

    this.results.performance = result;
    if (result.suspicious) this.score += 8;
    return result;
},


        // ==================== SCREEN ORIENTATION ====================
        checkScreenOrientation: function() {
            const result = {
                type: null,
                angle: null,
                suspicious: false,
                flags: []
            };

            try {
                if (screen.orientation) {
                    result.type = screen.orientation.type;
                    result.angle = screen.orientation.angle;

                    // Check consistency
                    if (result.angle !== 0 && result.angle !== 90 && result.angle !== 180 && result.angle !== 270) {
                        result.flags.push(`Unusual orientation angle: ${result.angle}`);
                        result.suspicious = true;
                    }

                    // Portrait vs landscape consistency
                    if (result.type && result.type.includes('landscape') && screen.width < screen.height) {
                        result.flags.push('Landscape orientation but width < height');
                        result.suspicious = true;
                    }
                    if (result.type && result.type.includes('portrait') && screen.width > screen.height) {
                        result.flags.push('Portrait orientation but width > height');
                        result.suspicious = true;
                    }
                } else {
                    result.flags.push('screen.orientation not available');
                }
            } catch (e) {
                result.flags.push(`Orientation error: ${e.message}`);
            }

            this.results.screenOrientation = result;
            if (result.suspicious) this.score += 3;
            return result;
        },

        // ==================== ERROR STACK TRACE ====================
        checkErrorStack: function() {
            const result = {
                format: null,
                length: 0,
                suspicious: false,
                flags: []
            };

            try {
                let stack = null;
                try {
                    null.error();
                } catch (e) {
                    stack = e.stack;
                }

                if (!stack) {
                    result.flags.push('No error stack available');
                    result.suspicious = true;
                    return result;
                }

                result.format = stack.split('\n')[0];
                result.length = stack.split('\n').length;

                // Check for automation framework traces
                if (stack.includes('puppeteer')) {
                    result.flags.push('Puppeteer detected in stack trace');
                    result.suspicious = true;
                }
                if (stack.includes('playwright')) {
                    result.flags.push('Playwright detected in stack trace');
                    result.suspicious = true;
                }
                if (stack.includes('webdriver')) {
                    result.flags.push('WebDriver detected in stack trace');
                    result.suspicious = true;
                }
                if (stack.includes('selenium')) {
                    result.flags.push('Selenium detected in stack trace');
                    result.suspicious = true;
                }

            } catch (e) {
                result.flags.push(`Error stack check failed: ${e.message}`);
            }

            this.results.errorStack = result;
            if (result.suspicious) this.score += 20;
            return result;
        },

        // ==================== MATH PRECISION ====================
        checkMathPrecision: function() {
            const result = {
                values: {},
                suspicious: false,
                flags: []
            };

            try {
                result.values = {
                    PI: Math.PI,
                    E: Math.E,
                    sin0: Math.sin(0),
                    cos0: Math.cos(0),
                    tan0: Math.tan(0),
                    acos0: Math.acos(0),
                    asin0: Math.asin(0),
                    atan0: Math.atan(0)
                };

                // These should be exact
                if (Math.sin(0) !== 0) {
                    result.flags.push(`sin(0) !== 0: ${Math.sin(0)}`);
                    result.suspicious = true;
                }
                if (Math.cos(0) !== 1) {
                    result.flags.push(`cos(0) !== 1: ${Math.cos(0)}`);
                    result.suspicious = true;
                }
                if (Math.tan(0) !== 0) {
                    result.flags.push(`tan(0) !== 0: ${Math.tan(0)}`);
                    result.suspicious = true;
                }

                // Check Math.PI precision (should be close to standard value)
                if (Math.abs(Math.PI - 3.141592653589793) > 0.000000000000001) {
                    result.flags.push('Math.PI precision differs');
                    result.suspicious = true;
                }

            } catch (e) {
                result.flags.push(`Math precision error: ${e.message}`);
            }

            this.results.mathPrecision = result;
            if (result.suspicious) this.score += 5;
            return result;
        },

        // ==================== WINDOW/SCREEN MISMATCH (HEADLESS DETECTION) ====================
        checkWindowScreenMismatch: function() {
            const result = {
                mismatches: [],
                suspicious: false,
                flags: []
            };

            // outerWidth/Height should be >= innerWidth/Height
            if (window.outerWidth < window.innerWidth) {
                result.mismatches.push(`outerWidth(${window.outerWidth}) < innerWidth(${window.innerWidth})`);
                result.suspicious = true;
            }
            if (window.outerHeight < window.innerHeight) {
                result.mismatches.push(`outerHeight(${window.outerHeight}) < innerHeight(${window.innerHeight})`);
                result.suspicious = true;
            }

            // outerWidth should match screen.width in fullscreen (approximately)
            // But in headless, they often don't match
            if (window.outerWidth === 0 || window.outerHeight === 0) {
                result.mismatches.push('outerWidth or outerHeight is 0');
                result.suspicious = true;
            }

            // Screen position checks
            if (window.screenX < 0 || window.screenY < 0) {
                result.mismatches.push(`Negative screen position: (${window.screenX}, ${window.screenY})`);
                result.suspicious = true;
            }

            // Very common headless pattern: exact sizes
            if (window.outerWidth === window.innerWidth && window.outerHeight === window.innerHeight) {
                result.mismatches.push('outerWidth === innerWidth AND outerHeight === innerHeight (likely headless)');
                result.suspicious = true;
            }

            // Chrome headless specific: window.chrome missing
            if (!window.chrome && navigator.vendor === 'Google Inc.') {
                result.mismatches.push('Google Inc. vendor but window.chrome missing');
                result.suspicious = true;
            }

            // Permissions in headless
            if (navigator.permissions && Notification.permission === 'denied') {
                navigator.permissions.query({name: 'notifications'}).then(permissionStatus => {
                    if (permissionStatus.state === 'prompt') {
                        result.mismatches.push('Notification.permission=denied but permissions.query=prompt');
                        result.suspicious = true;
                    }
                });
            }

            // Check for screen.availWidth/Height anomalies
            if (screen.availWidth > screen.width) {
                result.mismatches.push(`availWidth(${screen.availWidth}) > width(${screen.width})`);
                result.suspicious = true;
            }
            if (screen.availHeight > screen.height) {
                result.mismatches.push(`availHeight(${screen.availHeight}) > height(${screen.height})`);
                result.suspicious = true;
            }

            // Headless often has exact matches
            if (screen.availWidth === screen.width && screen.availHeight === screen.height) {
                result.flags.push('availWidth === width AND availHeight === height (possible headless)');
                // Not marking as suspicious alone, as fullscreen apps can have this
            }

            if (result.mismatches.length > 0) {
                result.flags.push(`${result.mismatches.length} window/screen mismatches`);
            }

            this.results.windowScreenMismatch = result;
            if (result.suspicious) this.score += 25;
            return result;
        },

        // ==================== STORAGE APIs ====================
        checkStorage: function() {
            const result = {
                localStorage: false,
                sessionStorage: false,
                indexedDB: false,
                cookiesEnabled: navigator.cookieEnabled,
                suspicious: false,
                flags: []
            };

            try {
                // LocalStorage
                if (window.localStorage) {
                    localStorage.setItem('test', '1');
                    if (localStorage.getItem('test') === '1') {
                        result.localStorage = true;
                        localStorage.removeItem('test');
                    }
                }

                // SessionStorage
                if (window.sessionStorage) {
                    sessionStorage.setItem('test', '1');
                    if (sessionStorage.getItem('test') === '1') {
                        result.sessionStorage = true;
                        sessionStorage.removeItem('test');
                    }
                }

                // IndexedDB
                result.indexedDB = !!window.indexedDB;

                // Flags
                if (!result.localStorage) {
                    result.flags.push('localStorage not available');
                    result.suspicious = true;
                }
                if (!result.sessionStorage) {
                    result.flags.push('sessionStorage not available');
                    result.suspicious = true;
                }
                if (!result.cookiesEnabled) {
                    result.flags.push('Cookies disabled');
                    result.suspicious = true;
                }

            } catch (e) {
                result.flags.push(`Storage check error: ${e.message}`);
                result.suspicious = true;
            }

            this.results.storage = result;
            if (result.suspicious) this.score += 10;
            return result;
        },

        // ==================== EXTENSION DETECTION ====================
        checkExtensions: function() {
            const result = {
                detected: [],
                suspicious: false,
                flags: []
            };

            // React DevTools
            if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
                result.detected.push('React DevTools');
            }

            // Redux DevTools
            if (window.__REDUX_DEVTOOLS_EXTENSION__) {
                result.detected.push('Redux DevTools');
            }

            // Vue DevTools
            if (window.__VUE_DEVTOOLS_GLOBAL_HOOK__) {
                result.detected.push('Vue DevTools');
            }

            // Angular DevTools
            if (window.ng) {
                result.detected.push('Angular (possible DevTools)');
            }

            // Selenium IDE
            if (window._Selenium_IDE_Recorder) {
                result.detected.push('Selenium IDE');
                result.suspicious = true;
            }

            // Check for common extension DOM modifications
            const extensionElements = document.querySelectorAll('[class*="extension"], [id*="extension"]');
            if (extensionElements.length > 0) {
                result.flags.push(`${extensionElements.length} extension-related DOM elements`);
            }

            if (result.detected.length > 0) {
                result.flags.push(`${result.detected.length} extensions detected`);
            }

            this.results.extensions = result;
            if (result.suspicious) this.score += 15;
            return result;
        },

        // ==================== SENSOR APIS ====================
        checkSensors: function() {
            const result = {
                accelerometer: false,
                gyroscope: false,
                magnetometer: false,
                suspicious: false,
                flags: []
            };

            try {
                // These are mostly mobile APIs
                if (window.Accelerometer) {
                    result.accelerometer = true;
                }
                if (window.Gyroscope) {
                    result.gyroscope = true;
                }
                if (window.Magnetometer) {
                    result.magnetometer = true;
                }

                // If sensors available but maxTouchPoints is 0 (desktop), suspicious
                if ((result.accelerometer || result.gyroscope) && navigator.maxTouchPoints === 0) {
                    result.flags.push('Sensors available on non-touch device');
                    result.suspicious = true;
                }

            } catch (e) {
                result.flags.push(`Sensor check error: ${e.message}`);
            }

            this.results.sensors = result;
            if (result.suspicious) this.score += 5;
            return result;
        },

        // ==================== ADVANCED NAVIGATOR PROPERTIES ====================
        checkAdvancedNavigator: function() {
            const result = {
                properties: {},
                suspicious: false,
                flags: []
            };

            const props = [
                'oscpu',
                'buildID',
                'pdfViewerEnabled',
                'userAgentData',
                'keyboard',
                'scheduling',
                'userActivation',
                'bluetooth',
                'usb',
                'hid',
                'serial',
                'gpu',
                'xr',
                'mediaSession',
                'credentials',
                'locks',
                'wakeLock',
                'virtualKeyboard'
            ];

            props.forEach(prop => {
                result.properties[prop] = prop in navigator;
            });

            // Firefox-specific checks
            if (navigator.oscpu && !navigator.userAgent.includes('Firefox')) {
                result.flags.push('oscpu present but not Firefox');
                result.suspicious = true;
            }

            // PDF viewer check
            if ('pdfViewerEnabled' in navigator) {
                if (!navigator.pdfViewerEnabled && navigator.plugins.length === 0) {
                    result.flags.push('PDF viewer disabled and no plugins');
                    result.suspicious = true;
                }
            }

            this.results.advancedNavigator = result;
            if (result.suspicious) this.score += 5;
            return result;
        },

        // ==================== EMOJI CANVAS ====================
        checkEmojiCanvas: function() {
            const result = {
                hash: null,
                suspicious: false,
                flags: []
            };

            try {
                const canvas = document.createElement('canvas');
                canvas.width = 100;
                canvas.height = 100;
                const ctx = canvas.getContext('2d');

                ctx.font = '48px Arial';
                ctx.fillText('😀🎉🔥', 10, 50);

                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                let hash = 0;
                for (let i = 0; i < imageData.data.length; i += 4) {
                    hash += imageData.data[i] + imageData.data[i+1] + imageData.data[i+2];
                }

                result.hash = hash;

                if (hash === 0) {
                    result.flags.push('Emoji canvas hash is zero - emoji not rendered');
                    result.suspicious = true;
                }

            } catch (e) {
                result.flags.push(`Emoji canvas error: ${e.message}`);
                result.suspicious = true;
            }

            this.results.emojiCanvas = result;
            if (result.suspicious) this.score += 5;
            return result;
        },

        // ==================== WEBGL CANVAS RENDERING ====================
        checkWebGLCanvas: function() {
            const result = {
                hash: null,
                suspicious: false,
                flags: []
            };

            try {
                const canvas = document.createElement('canvas');
                canvas.width = 256;
                canvas.height = 128;
                const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

                if (!gl) {
                    result.flags.push('WebGL context not available');
                    result.suspicious = true;
                    return result;
                }

                // Draw a gradient rectangle
                gl.clearColor(0.0, 0.5, 1.0, 1.0);
                gl.clear(gl.COLOR_BUFFER_BIT);

                const imageData = new Uint8Array(canvas.width * canvas.height * 4);
                gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, imageData);

                let hash = 0;
                for (let i = 0; i < imageData.length; i++) {
                    hash = ((hash << 5) - hash) + imageData[i];
                    hash = hash & hash;
                }

                result.hash = hash;

                if (hash === 0) {
                    result.flags.push('WebGL canvas hash is zero');
                    result.suspicious = true;
                }

            } catch (e) {
                result.flags.push(`WebGL canvas error: ${e.message}`);
                result.suspicious = true;
            }

            this.results.webglCanvas = result;
            if (result.suspicious) this.score += 8;
            return result;
        },

        // ==================== DATE & NUMBER FORMATTING ====================
        checkDateFormatting: function() {
            const result = {
                dateString: null,
                localeString: null,
                numberFormat: null,
                suspicious: false,
                flags: []
            };

            try {
                const now = new Date();
                result.dateString = now.toString();
                result.localeString = now.toLocaleString();

                if (Intl && Intl.NumberFormat) {
                    const nf = new Intl.NumberFormat();
                    result.numberFormat = (12345.67).toLocaleString();
                }

                // Check for timezone in date string
                if (!result.dateString.includes('GMT') && !result.dateString.includes('UTC')) {
                    result.flags.push('Date string missing timezone');
                    result.suspicious = true;
                }

            } catch (e) {
                result.flags.push(`Date formatting error: ${e.message}`);
            }

            this.results.dateFormatting = result;
            if (result.suspicious) this.score += 3;
            return result;
        },

        // ==================== POINTER EVENTS ====================
        checkPointerEvents: function() {
            const result = {
                pointerEnabled: false,
                maxTouchPoints: navigator.maxTouchPoints,
                touchSupport: false,
                suspicious: false,
                flags: []
            };

            try {
                result.pointerEnabled = !!window.PointerEvent;
                result.touchSupport = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

                // Consistency check
                if (navigator.maxTouchPoints > 0 && !result.touchSupport) {
                    result.flags.push('maxTouchPoints > 0 but no touch support');
                    result.suspicious = true;
                }

                // Desktop with touch
                if (navigator.maxTouchPoints > 0 && !navigator.platform.match(/Android|iPhone|iPad|iPod/)) {
                    // This is OK for Windows touchscreen laptops, so just flag it
                    result.flags.push(`Desktop with touch (This is OK for touchscreen laptops)`);
                }

            } catch (e) {
                result.flags.push(`Pointer events error: ${e.message}`);
            }

            this.results.pointerEvents = result;
            if (result.suspicious) this.score += 5;
            return result;
        },

        // ==================== ADVANCED CODECS ====================
        checkAdvancedCodecs: function() {
            const result = {
                video: {},
                audio: {},
                suspicious: false,
                flags: []
            };

            try {
                const video = document.createElement('video');
                const audio = document.createElement('audio');

                // Video codecs
                result.video = {
                    webm: video.canPlayType('video/webm; codecs="vp8, vorbis"'),
                    webm_vp9: video.canPlayType('video/webm; codecs="vp9"'),
                    mp4: video.canPlayType('video/mp4; codecs="avc1.42E01E, mp4a.40.2"'),
                    ogg: video.canPlayType('video/ogg; codecs="theora"'),
                    hevc: video.canPlayType('video/mp4; codecs="hev1"'),
                    av1: video.canPlayType('video/mp4; codecs="av01.0.05M.08"')
                };

                // Audio codecs
                result.audio = {
                    mp3: audio.canPlayType('audio/mpeg'),
                    ogg: audio.canPlayType('audio/ogg; codecs="vorbis"'),
                    wav: audio.canPlayType('audio/wav; codecs="1"'),
                    aac: audio.canPlayType('audio/aac'),
                    flac: audio.canPlayType('audio/flac'),
                    opus: audio.canPlayType('audio/ogg; codecs="opus"')
                };

                // Check if nothing is supported
                const videoSupported = Object.values(result.video).some(v => v !== '');
                const audioSupported = Object.values(result.audio).some(v => v !== '');

                if (!videoSupported) {
                    result.flags.push('No video codecs supported');
                    result.suspicious = true;
                }
                if (!audioSupported) {
                    result.flags.push('No audio codecs supported');
                    result.suspicious = true;
                }

            } catch (e) {
                result.flags.push(`Codec check error: ${e.message}`);
            }

            this.results.advancedCodecs = result;
            if (result.suspicious) this.score += 5;
            return result;
        },

        // ==================== CONNECTION API ====================
        checkConnectionAPI: function() {
            const result = {
                supported: false,
                effectiveType: null,
                downlink: null,
                rtt: null,
                saveData: null,
                suspicious: false,
                flags: []
            };

            try {
                const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
                
                if (!conn) {
                    result.flags.push('Connection API not supported');
                    // Not suspicious - not all browsers support this
                    this.results.connectionAPI = result;
                    return result;
                }

                result.supported = true;
                result.effectiveType = conn.effectiveType;
                result.downlink = conn.downlink;
                result.rtt = conn.rtt;
                result.saveData = conn.saveData;

                // Sanity checks
                if (result.downlink !== undefined && result.downlink < 0) {
                    result.flags.push(`Negative downlink: ${result.downlink}`);
                    result.suspicious = true;
                }
                if (result.rtt !== undefined && result.rtt < 0) {
                    result.flags.push(`Negative RTT: ${result.rtt}`);
                    result.suspicious = true;
                }

            } catch (e) {
                result.flags.push(`Connection API error: ${e.message}`);
            }

            this.results.connectionAPI = result;
            if (result.suspicious) this.score += 3;
            return result;
        },

        
        // ==================== RUN ALL CHECKS ====================
        runAll: async function() {
            console.log('🔍 Starting comprehensive bot detection...');

            // Synchronous checks
            this.checkFonts();
            this.checkWebGLExtended();
            this.checkPropertyDescriptors();
            this.checkFunctionToString();
            this.checkTimezone();
            this.checkSpeechSynthesis();
            this.checkConsistency();
            this.checkUserAgentData();
            this.checkSVG();
            this.checkCSSMediaQueries();
            this.checkPerformance();
            this.checkScreenOrientation();
            this.checkErrorStack();
            this.checkMathPrecision();
            this.checkWindowScreenMismatch();
            this.checkStorage();
            this.checkExtensions();
            this.checkSensors();
            this.checkAdvancedNavigator();
            this.checkEmojiCanvas();
            this.checkWebGLCanvas();
            this.checkDateFormatting();
            this.checkPointerEvents();
            this.checkAdvancedCodecs();
            this.checkConnectionAPI();

            // Asynchronous checks
            await this.checkAudioContext();
            await this.checkWebRTC();

            // Collect all flags
            for (let key in this.results) {
                if (this.results[key] && this.results[key].flags) {
                    this.flags = this.flags.concat(this.results[key].flags);
                }
            }

            console.log('✅ Detection complete');
            console.log(`🚨 Suspicion Score: ${this.score}/100 (higher = more suspicious)`);
            console.log(`⚠️ Total Flags: ${this.flags.length}`);
            
            return {
                score: this.score,
                flags: this.flags,
                results: this.results
            };
        },

        // ==================== GET REPORT ====================
        getReport: function() {
            return {
                score: this.score,
                totalFlags: this.flags.length,
                verdict: this.score > 50 ? 'LIKELY BOT' : (this.score > 25 ? 'SUSPICIOUS' : 'LIKELY HUMAN'),
                flags: this.flags,
                results: this.results
            };
        }
    };

    // Expose to window
    window.BotDetector = BotDetector;

})();
