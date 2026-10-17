import { describe, it, expect } from 'vitest';
import { isIpSafe, isDomainAllowed, validateSafeUrl } from '../../src/middleware/ssrf.js';

describe('SSRF & IP Safety Protection', () => {
  describe('isDomainAllowed', () => {
    const allowed = ['archive.org', 'commons.wikimedia.org'];

    it('allows exact domain matches', () => {
      expect(isDomainAllowed('archive.org', allowed)).toBe(true);
      expect(isDomainAllowed('commons.wikimedia.org', allowed)).toBe(true);
    });

    it('allows legitimate subdomains', () => {
      expect(isDomainAllowed('ia800100.us.archive.org', allowed)).toBe(true);
      expect(isDomainAllowed('upload.wikimedia.org', ['wikimedia.org'])).toBe(true);
    });

    it('rejects disallowed domains and prefix tricks', () => {
      expect(isDomainAllowed('fake-archive.org', allowed)).toBe(false);
      expect(isDomainAllowed('archive.org.attacker.com', allowed)).toBe(false);
      expect(isDomainAllowed('google.com', allowed)).toBe(false);
      expect(isDomainAllowed('localhost', allowed)).toBe(false);
    });
  });

  describe('isIpSafe', () => {
    it('blocks IPv4 loopback (127.0.0.1)', () => {
      expect(isIpSafe('127.0.0.1')).toBe(false);
      expect(isIpSafe('127.0.0.2')).toBe(false);
    });

    it('blocks IPv4 private RFC1918 subnets', () => {
      expect(isIpSafe('10.0.0.1')).toBe(false);
      expect(isIpSafe('172.16.0.1')).toBe(false);
      expect(isIpSafe('192.168.1.100')).toBe(false);
    });

    it('blocks cloud metadata / link-local addresses (169.254.169.254)', () => {
      expect(isIpSafe('169.254.169.254')).toBe(false);
    });

    it('blocks IPv6 loopback (::1)', () => {
      expect(isIpSafe('::1')).toBe(false);
    });

    it('blocks IPv4-mapped IPv6 loopback and private', () => {
      expect(isIpSafe('::ffff:127.0.0.1')).toBe(false);
      expect(isIpSafe('::ffff:192.168.1.1')).toBe(false);
    });

    it('allows public Internet IP addresses', () => {
      expect(isIpSafe('8.8.8.8')).toBe(true);
      expect(isIpSafe('1.1.1.1')).toBe(true);
      expect(isIpSafe('207.241.224.2')).toBe(true); // Internet Archive IP
    });
  });

  describe('validateSafeUrl', () => {
    it('rejects non-HTTPS schemes', async () => {
      await expect(validateSafeUrl('http://archive.org/details/test', ['archive.org']))
        .rejects.toThrow('Only secure HTTPS URLs are permitted');

      await expect(validateSafeUrl('file:///etc/passwd', ['archive.org']))
        .rejects.toThrow('Only secure HTTPS URLs are permitted');
    });

    it('rejects embedded credentials in URL', async () => {
      await expect(validateSafeUrl('https://user:pass@archive.org/details/test', ['archive.org']))
        .rejects.toThrow('URLs with embedded credentials are not permitted');
    });

    it('rejects unapproved domains without making network calls', async () => {
      await expect(validateSafeUrl('https://untrusted-site.com/video', ['archive.org']))
        .rejects.toThrow(/is not in the allowed source domains/);
    });
  });
});
