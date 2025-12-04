/**
 * Bot Detection & Proxy Detection Script
 * Analyzes IP, Geolocation, Timezone, Hardware Time, and Browser Fingerprints
 * to detect proxy/VPN usage and bot behavior
 */

class ProxyDetector {
  constructor() {
    this.results = {
      ip: null,
      geolocation: null,
      timezone: null,
      hardwareTime: null,
      timezoneMismatch: null,
      suspiciousIndicators: [],
      riskScore: 0,
      isProxyDetected: false,
    };
  }

  /**
   * Get client IP from public API
   * Uses multiple fallback services for reliability
   */
  async getClientIP() {
    const services = [
      'https://api.ipify.org?format=json',
      'https://api64.ipify.org?format=json',
      'https://icanhazip.com/',
    ];

    for (let service of services) {
      try {
        const response = await fetch(service);
        if (response.ok) {
          const data = await response.json();
          this.results.ip = data.ip || (await response.text()).trim();
          console.log('✓ IP Retrieved:', this.results.ip);
          return this.results.ip;
        }
      } catch (error) {
        console.warn(`Failed to fetch from ${service}:`, error.message);
        continue;
      }
    }
    console.error('✗ Could not retrieve IP');
    return null;
  }

  /**
   * Get geolocation data from IP using free API
   * Returns: country, city, latitude, longitude, timezone, ISP
   */
  async getGeolocation(ip) {
    if (!ip) return null;

    const services = [
      `https://ipapi.co/${ip}/json/`,
      `https://ip-api.com/json/${ip}?fields=status,country,countryCode,city,lat,lon,timezone,isp,proxy,query`,
      `https://geoip-api.com/api/geoip/${ip}`,
    ];

    for (let service of services) {
      try {
        const response = await fetch(service);
        if (response.ok) {
          const data = await response.json();
          
          // Parse response based on service
          this.results.geolocation = {
            country: data.country || data.country_name || 'Unknown',
            countryCode: data.country_code || data.countryCode || 'XX',
            city: data.city || 'Unknown',
            latitude: data.latitude || data.lat || null,
            longitude: data.longitude || data.lon || null,
            timezone: data.timezone || 'Unknown',
            isp: data.isp || data.org || 'Unknown',
            isProxy: data.proxy || data.is_proxy || false,
            vpn: data.vpn || false,
            tor: data.tor || false,
          };

          console.log('✓ Geolocation Retrieved:', this.results.geolocation);
          return this.results.geolocation;
        }
      } catch (error) {
        console.warn(`Failed to fetch from ${service}:`, error.message);
        continue;
      }
    }

    console.error('✗ Could not retrieve geolocation');
    return null;
  }

  /**
   * Get timezone from browser (JavaScript)
   * This is the "claimed" timezone from the system
   */
  getTimezone() {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    this.results.timezone = timezone;
    console.log('✓ Browser Timezone:', timezone);
    return timezone;
  }

  /**
   * Get current hardware time
   * Includes timezone offset and formatted time
   */
  getHardwareTime() {
    const now = new Date();
    const timezoneOffset = now.getTimezoneOffset(); // in minutes
    const gmtOffset = -timezoneOffset / 60; // convert to hours

    this.results.hardwareTime = {
      timestamp: now.getTime(),
      iso: now.toISOString(),
      local: now.toString(),
      hours: now.getHours(),
      minutes: now.getMinutes(),
      seconds: now.getSeconds(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      gmtOffset: gmtOffset,
      timezoneOffsetMinutes: timezoneOffset,
    };

    console.log('✓ Hardware Time:', this.results.hardwareTime);
    return this.results.hardwareTime;
  }

  /**
   * Compare geolocation timezone with browser timezone
   * Detects timezone spoofing/mismatch
   */
  compareTimezones() {
    const geoTimezone = this.results.geolocation?.timezone;
    const browserTimezone = this.results.timezone;

    if (!geoTimezone || !browserTimezone) {
      console.warn('⚠ Cannot compare timezones - missing data');
      return null;
    }

    const match = geoTimezone === browserTimezone;
    
    this.results.timezoneMismatch = {
      geoTimezone,
      browserTimezone,
      match,
      riskLevel: match ? 'low' : 'high',
    };

    if (!match) {
      this.addSuspiciousIndicator(
        `TIMEZONE MISMATCH: Geolocation says ${geoTimezone}, but browser says ${browserTimezone}`,
        40
      );
      console.warn('⚠ TIMEZONE MISMATCH DETECTED');
    } else {
      console.log('✓ Timezones match');
    }

    return this.results.timezoneMismatch;
  }

  /**
   * Get local time offset and compare with expected offset from geolocation
   * Detects if system clock is manipulated
   */
  compareTimeOffsets() {
    const browserOffset = this.results.hardwareTime.gmtOffset;
    
    // Get expected offset from timezone name (approximation)
    const timezoneName = this.results.timezone;
    const expectedOffsets = this.getExpectedTimezoneOffset(timezoneName);

    const offsetMatch = expectedOffsets.includes(browserOffset);

    if (!offsetMatch) {
      this.addSuspiciousIndicator(
        `TIME OFFSET MISMATCH: Expected ${expectedOffsets.join(' or ')} hours from UTC, but got ${browserOffset}`,
        40
      );
      console.warn('⚠ TIME OFFSET MISMATCH');
    } else {
      console.log('✓ Time offset matches timezone');
    }

    return offsetMatch;
  }

  /**
   * Get expected UTC offset for a timezone (approximation)
   * Note: This is simplified; real implementation would use timezone database
   */
  getExpectedTimezoneOffset(timezone) {
    const offsets = {
      'America/New_York': [-5, -4], // EST/EDT
      'America/Chicago': [-6, -5],
      'America/Denver': [-7, -6],
      'America/Los_Angeles': [-8, -7],
      'Europe/London': [0, 1],
      'Europe/Paris': [1, 2],
      'Europe/Berlin': [1, 2],
      'Europe/Moscow': [3],
      'Asia/Dubai': [4],
      'Asia/Kolkata': [5.5],
      'Asia/Bangkok': [7],
      'Asia/Shanghai': [8],
      'Asia/Tokyo': [9],
      'Australia/Sydney': [10, 11],
      'UTC': [0],
      'Africa/Johannesburg': [2],
      'Africa/Lagos': [1],
      'Africa/Cairo': [2],
      'Africa/Algiers': [1],
    };

    return offsets[timezone] || [0]; // Default to UTC if unknown
  }

  /**
   * Detect proxy/VPN indicators from geolocation data
   */
  detectProxyIndicators() {
    const geo = this.results.geolocation;

    if (!geo) return;

    // Direct proxy/VPN flags from API
    if (geo.isProxy) {
      this.addSuspiciousIndicator('API detected proxy usage', 80);
    }
    if (geo.vpn) {
      this.addSuspiciousIndicator('API detected VPN usage', 80);
    }
    if (geo.tor) {
      this.addSuspiciousIndicator('Tor network detected', 100);
    }

    // ISP suspicious patterns
    const suspiciousISPs = ['Proxy', 'VPN', 'Hosting', 'Datacenter', 'AWS', 'Azure', 'Google Cloud'];
    if (suspiciousISPs.some(isp => geo.isp.includes(isp))) {
      this.addSuspiciousIndicator(`Suspicious ISP detected: ${geo.isp}`, 60);
    }

    // Datacenter IP detection (non-residential)
    const datacenterCountries = ['--']; // Unknown country code
    if (datacenterCountries.includes(geo.countryCode)) {
      this.addSuspiciousIndicator('Datacenter/Non-residential IP detected', 70);
    }
  }



  addSuspiciousIndicator(indicator, riskPoints) {
    this.results.suspiciousIndicators.push({
      indicator,
      riskPoints,
      timestamp: new Date().toISOString(),
    });
    this.results.riskScore += riskPoints;
    console.warn(`⚠ [+${riskPoints}] ${indicator}`);
  }


  determineProxyLikelihood() {
    const score = this.results.riskScore;

    if (score >= 80) {
      this.results.isProxyDetected = true;
      this.results.proxyLikelihood = 'VERY HIGH';
    } else if (score >= 60) {
      this.results.proxyLikelihood = 'HIGH';
    } else if (score >= 40) {
      this.results.proxyLikelihood = 'MEDIUM';
    } else if (score >= 20) {
      this.results.proxyLikelihood = 'LOW';
    } else {
      this.results.proxyLikelihood = 'VERY LOW';
    }

    console.log(`\n📊 RISK SCORE: ${score}/100 - ${this.results.proxyLikelihood}`);
  }

  /**
   * Run complete detection analysis
   */
  async runFullDetection() {
    console.log('🔍 Starting Bot/Proxy Detection Analysis...\n');

    try {
      // Step 1: Get IP
      await this.getClientIP();

      // Step 2: Get geolocation from IP
      if (this.results.ip) {
        await this.getGeolocation(this.results.ip);
      }

      // Step 3: Get browser timezone
      this.getTimezone();

      // Step 4: Get hardware time
      this.getHardwareTime();

      // Step 5: Compare timezones
      this.compareTimezones();

      // Step 6: Compare time offsets
      this.compareTimeOffsets();

      // Step 7: Detect proxy indicators
      this.detectProxyIndicators();


      // Step 9: Detect geolocation-browser mismatch
      this.detectGeolocationBrowserMismatch();

      // Step 11: Calculate final risk level
      this.determineProxyLikelihood();

      console.log('\n✅ Detection Complete\n');
      return this.results;
    } catch (error) {
      console.error('❌ Error during detection:', error);
      return this.results;
    }
  }

  /**
   * Get results as JSON
   */
  getResults() {
    return this.results;
  }

  /**
   * Print formatted report
   */
  printReport() {


    console.log('SUSPICIOUS INDICATORS:');
    if (this.results.suspiciousIndicators.length === 0) {
      console.log('  None detected ✓');
    } else {
      this.results.suspiciousIndicators.forEach((ind, idx) => {
        console.log(`  ${idx + 1}. [${ind.riskPoints}pts] ${ind.indicator}`);
      });
    }

    console.log(`\n FINAL VERDICT:`);
    console.log(`  Risk Score: ${this.results.riskScore}/100`);
    console.log(`  Proxy Likelihood: ${this.results.proxyLikelihood}`);
    console.log(`  Proxy Detected: ${this.results.isProxyDetected ? '✗ YES' : '✓ NO'}`);
    console.log('\n' + '='.repeat(60) + '\n');
  }
}


if (typeof module !== 'undefined' && module.exports) {
  module.exports = ProxyDetector;
}