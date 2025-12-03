/**
 * Утилита для условного логирования
 * Позволяет включать/выключать DEBUG логи через переменную окружения
 */

const DEBUG_ENABLED = process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development';

export const logger = {
  /**
   * DEBUG логи - только в development или при DEBUG=true
   */
  debug: (...args: any[]) => {
    if (DEBUG_ENABLED) {
      console.log('[DEBUG]', ...args);
    }
  },

  /**
   * INFO логи - всегда
   */
  info: (...args: any[]) => {
    console.log('[INFO]', ...args);
  },

  /**
   * WARN логи - всегда
   */
  warn: (...args: any[]) => {
    console.warn('[WARN]', ...args);
  },

  /**
   * ERROR логи - всегда
   */
  error: (...args: any[]) => {
    console.error('[ERROR]', ...args);
  },
};

