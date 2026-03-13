import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { UserRole } from '../types';
import { logger } from '../utils/logger';

export enum AuditAction {
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILURE = 'LOGIN_FAILURE',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS_ATTEMPT',
  SENSITIVE_DATA_VIEW = 'SENSITIVE_DATA_VIEW',
  LOGOUT = 'LOGOUT',
  PASSWORD_RESET_REQUEST = 'PASSWORD_RESET_REQUEST',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
}

interface AuditEvent {
  action: AuditAction;
  performedBy?: string; // userId or email
  userRole?: UserRole;
  details?: Record<string, any>;
  path?: string;
}

class AuditService {
  private static instance: AuditService;

  private constructor() {}

  public static getInstance(): AuditService {
    if (!AuditService.instance) {
      AuditService.instance = new AuditService();
    }
    return AuditService.instance;
  }

  /**
   * Logs a security-related event to the audit_logs collection.
   */
  public async logEvent(event: AuditEvent): Promise<void> {
    try {
      const auditLog = {
        ...event,
        timestamp: serverTimestamp(),
        userAgent: navigator.userAgent,
        device: this.getDeviceType(),
        metadata: {
          location: window.location.href,
          referrer: document.referrer,
        }
      };

      await addDoc(collection(db, 'audit_logs'), auditLog);
    } catch (err) {
      // We don't want audit failures to break the UI, but we should log them locally
      logger.error('Failed to write audit log:', err);
    }
  }

  private getDeviceType(): string {
    const ua = navigator.userAgent;
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
      return 'tablet';
    }
    if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
      return 'mobile';
    }
    return 'desktop';
  }
}

export const auditService = AuditService.getInstance();
