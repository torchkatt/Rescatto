// @vitest-environment node
/**
 * Tests for Wompi webhook HMAC-SHA256 signature validation logic.
 * Tests the same algorithm used in functions/src/services/paymentService.js.
 */
import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';

/**
 * Replicates the server-side signature validation logic.
 */
function validateWompiSignature(
    body: object,
    timestamp: string,
    receivedSignature: string,
    secret: string
): boolean {
    const rawBody = JSON.stringify(body);
    const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(`${timestamp}.${rawBody}`)
        .digest('hex');

    try {
        const sigBuffer = Buffer.from(receivedSignature, 'hex');
        const expectedBuffer = Buffer.from(expectedSignature, 'hex');
        if (sigBuffer.length !== expectedBuffer.length) return false;
        return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
    } catch {
        return false;
    }
}

function generateWompiSignature(body: object, timestamp: string, secret: string): string {
    const rawBody = JSON.stringify(body);
    return crypto
        .createHmac('sha256', secret)
        .update(`${timestamp}.${rawBody}`)
        .digest('hex');
}

const SECRET = 'test_integrity_secret_abc123';
const TIMESTAMP = '1700000000';
const BODY = { event: 'transaction.updated', data: { transaction: { id: 'txn-123', status: 'APPROVED' } } };

describe('Wompi Webhook Signature Validation', () => {
    it('accepts a valid HMAC-SHA256 signature', () => {
        const sig = generateWompiSignature(BODY, TIMESTAMP, SECRET);
        expect(validateWompiSignature(BODY, TIMESTAMP, sig, SECRET)).toBe(true);
    });

    it('rejects a signature with wrong secret', () => {
        const sig = generateWompiSignature(BODY, TIMESTAMP, 'wrong_secret');
        expect(validateWompiSignature(BODY, TIMESTAMP, sig, SECRET)).toBe(false);
    });

    it('rejects a tampered body', () => {
        const sig = generateWompiSignature(BODY, TIMESTAMP, SECRET);
        const tamperedBody = { ...BODY, data: { transaction: { id: 'txn-999', status: 'DECLINED' } } };
        expect(validateWompiSignature(tamperedBody, TIMESTAMP, sig, SECRET)).toBe(false);
    });

    it('rejects a wrong timestamp', () => {
        const sig = generateWompiSignature(BODY, TIMESTAMP, SECRET);
        expect(validateWompiSignature(BODY, '9999999999', sig, SECRET)).toBe(false);
    });

    it('rejects a missing/empty signature', () => {
        expect(validateWompiSignature(BODY, TIMESTAMP, '', SECRET)).toBe(false);
    });

    it('rejects a malformed (non-hex) signature', () => {
        expect(validateWompiSignature(BODY, TIMESTAMP, 'not-a-hex-string!!!', SECRET)).toBe(false);
    });

    it('uses timing-safe comparison (buffers of different length return false without throwing)', () => {
        // Truncated signature
        const sig = generateWompiSignature(BODY, TIMESTAMP, SECRET);
        const truncated = sig.slice(0, 10);
        expect(validateWompiSignature(BODY, TIMESTAMP, truncated, SECRET)).toBe(false);
    });

    it('is deterministic — same inputs always produce same signature', () => {
        const sig1 = generateWompiSignature(BODY, TIMESTAMP, SECRET);
        const sig2 = generateWompiSignature(BODY, TIMESTAMP, SECRET);
        expect(sig1).toBe(sig2);
    });
});
