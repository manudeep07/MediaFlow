import dns from 'node:dns/promises';
import ipaddr from 'ipaddr.js';
import { getEnv } from '../config/env.js';

export function isIpSafe(ipString) {
  try {
    let addr = ipaddr.parse(ipString);

    // If it's an IPv4-mapped IPv6 address (e.g. ::ffff:127.0.0.1), unmap it
    if (addr.kind() === 'ipv6' && addr.isIPv4MappedAddress()) {
      addr = addr.toIPv4Address();
    }

    const range = addr.range();

    // Disallowed ranges for IPv4 and IPv6
    const blockedRanges = [
      'unspecified',
      'broadcast',
      'linkLocal',
      'loopback',
      'private',
      'reserved',
      'uniqueLocal',
      'carrierGradeNat',
    ];

    if (blockedRanges.includes(range)) {
      return false;
    }

    return true;
  } catch (err) {
    return false;
  }
}

export function isDomainAllowed(hostname, allowedDomains) {
  const cleanHost = hostname.toLowerCase();
  return allowedDomains.some((domain) => {
    const cleanDomain = domain.toLowerCase();
    return cleanHost === cleanDomain || cleanHost.endsWith(`.${cleanDomain}`);
  });
}

export async function validateSafeUrl(rawUrl, customAllowedDomains = null) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw new Error('URL must be a non-empty string');
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(rawUrl);
  } catch (err) {
    throw new Error('Invalid URL format');
  }

  // 1. Strict HTTPS scheme enforcement
  if (parsedUrl.protocol !== 'https:') {
    throw new Error('Only secure HTTPS URLs are permitted');
  }

  // 2. Reject credentials in URL
  if (parsedUrl.username || parsedUrl.password) {
    throw new Error('URLs with embedded credentials are not permitted');
  }

  // 3. Domain allowlist check
  const env = getEnv();
  const allowedDomains = customAllowedDomains || env.ALLOWED_DOMAINS;

  if (!isDomainAllowed(parsedUrl.hostname, allowedDomains)) {
    throw new Error(
      `Domain '${parsedUrl.hostname}' is not in the allowed source domains (${allowedDomains.join(', ')})`
    );
  }

  // 4. DNS resolution and IP safety check
  let resolvedAddresses = [];
  try {
    resolvedAddresses = await dns.lookup(parsedUrl.hostname, { all: true });
  } catch (err) {
    throw new Error(`DNS resolution failed for hostname '${parsedUrl.hostname}': ${err.message}`);
  }

  if (!resolvedAddresses || resolvedAddresses.length === 0) {
    throw new Error(`Could not resolve IP address for hostname '${parsedUrl.hostname}'`);
  }

  for (const record of resolvedAddresses) {
    if (!isIpSafe(record.address)) {
      throw new Error(
        `Destination IP address '${record.address}' for host '${parsedUrl.hostname}' is non-public or restricted`
      );
    }
  }

  return {
    isValid: true,
    url: parsedUrl.href,
    hostname: parsedUrl.hostname,
    resolvedAddresses: resolvedAddresses.map((r) => r.address),
  };
}

export function ssrfMiddleware(req, res, next) {
  const rawUrl = req.body?.url;
  if (!rawUrl) {
    return next();
  }

  validateSafeUrl(rawUrl)
    .then((result) => {
      req.validatedMedia = result;
      next();
    })
    .catch((err) => {
      res.status(400).json({
        success: false,
        error: {
          code: 'SSRF_OR_DOMAIN_VALIDATION_ERROR',
          message: err.message,
        },
      });
    });
}
