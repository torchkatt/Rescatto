import DOMPurify from 'dompurify';

const purify = DOMPurify(window);

/**
 * Sanitizes HTML/markdown content to prevent XSS.
 * Allows safe formatting tags only.
 */
export function sanitizeHtml(dirty: string): string {
  return purify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'code', 'pre', 'h1', 'h2', 'h3', 'h4', 'blockquote'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
  });
}

/**
 * Strips ALL HTML tags, returning plain text only.
 * Use for user-generated content that should never contain HTML.
 */
export function stripHtml(dirty: string): string {
  return purify.sanitize(dirty, { ALLOWED_TAGS: [] });
}
