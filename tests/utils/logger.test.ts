import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger } from '../../utils/logger';

describe('logger utility', () => {
  let consoleSpy: {
    log: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
    warn: ReturnType<typeof vi.spyOn>;
    info: ReturnType<typeof vi.spyOn>;
    debug: ReturnType<typeof vi.spyOn>;
  };

  beforeEach(() => {
    consoleSpy = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      info: vi.spyOn(console, 'info').mockImplementation(() => {}),
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logger.log should call console.log in DEV mode', () => {
    logger.log('test message');
    // In DEV mode (import.meta.env.DEV = true in setup), should log
    expect(consoleSpy.log).toHaveBeenCalledWith('test message');
  });

  it('logger.error should always call console.error', () => {
    const err = new Error('test error');
    logger.error('Error occurred', err);
    expect(consoleSpy.error).toHaveBeenCalledWith('Error occurred', err);
  });

  it('logger.warn should call console.warn in DEV mode', () => {
    logger.warn('warning message');
    expect(consoleSpy.warn).toHaveBeenCalledWith('warning message');
  });

  it('logger.info should call console.info in DEV mode', () => {
    logger.info('info message');
    expect(consoleSpy.info).toHaveBeenCalledWith('info message');
  });

  it('logger.debug should call console.debug in DEV mode', () => {
    logger.debug('debug data', { key: 'value' });
    expect(consoleSpy.debug).toHaveBeenCalledWith('debug data', { key: 'value' });
  });

  it('logger.log should support multiple arguments', () => {
    logger.log('message', { data: 1 }, [1, 2, 3]);
    expect(consoleSpy.log).toHaveBeenCalledWith('message', { data: 1 }, [1, 2, 3]);
  });
});
