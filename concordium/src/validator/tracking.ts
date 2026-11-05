/**
 * Tracking number validation. Offline and structural only: it can say a
 * number is well formed for a known carrier format, never that a parcel was
 * delivered. Confirming delivery needs carrier or marketplace APIs (not built).
 */
import { fail, pass, type ValidationResult } from './types.ts'

const NOTE = 'Format check only: delivery status is not verified.'

export function normalizeTracking(raw: string): string {
  return raw.replace(/[\s-]/g, '').toUpperCase()
}

/** UPU S10 check digit: weights over the 8 serial digits, 10 maps to 0, 11 maps to 5. */
export function s10CheckDigit(serial: string): number {
  const weights = [8, 6, 4, 2, 3, 5, 9, 7]
  let sum = 0
  for (let i = 0; i < 8; i++) sum += Number(serial[i]) * weights[i]
  const check = 11 - (sum % 11)
  if (check === 10) return 0
  if (check === 11) return 5
  return check
}

function looksLikePlaceholder(value: string): boolean {
  return new Set(value).size === 1
}

const DIGIT_FORMATS: Record<number, string> = {
  10: 'DHL Express (10 digits)',
  12: 'FedEx Express (12 digits)',
  15: 'FedEx Ground (15 digits)',
  20: 'USPS (20 digits)',
  22: 'USPS or FedEx (22 digits)',
}

export function validateTracking(raw: string): ValidationResult {
  const value = normalizeTracking(raw)
  if (looksLikePlaceholder(value)) {
    return fail('tracking', 'Tracking number looks like a placeholder (a single repeated character).')
  }

  if (/^[A-Z]{2}\d{9}[A-Z]{2}$/.test(value)) {
    const serial = value.slice(2, 10)
    const expected = s10CheckDigit(serial)
    if (Number(value[10]) !== expected) {
      return fail('tracking', 'Postal (UPU S10) tracking number has an invalid check digit.', 'upu-s10')
    }
    return pass('tracking', `Valid postal (UPU S10) tracking number. ${NOTE}`, 'upu-s10')
  }

  if (/^1Z[0-9A-Z]{16}$/.test(value)) {
    return pass('tracking', `Matches the UPS tracking number format. ${NOTE}`, 'ups')
  }

  if (/^\d+$/.test(value)) {
    const format = DIGIT_FORMATS[value.length]
    if (format) return pass('tracking', `Matches the ${format} format. ${NOTE}`, 'digits')
    return fail('tracking', `A ${value.length}-digit number does not match a supported carrier format.`)
  }

  return fail('unknown', 'Not a recognised tracking number format.')
}
