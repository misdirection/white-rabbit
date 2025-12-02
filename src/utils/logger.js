import { config } from '../config.js';

/**
 * Logger utility to control console output based on configuration.
 * Only outputs logs if config.debug is true.
 * Errors are always logged.
 */
export const Logger = {
  log: (...args) => {
    if (config.debug) {
      console.log(...args);
    }
  },
  warn: (...args) => {
    if (config.debug) {
      console.warn(...args);
    }
  },
  error: (...args) => {
    // Always log errors, but maybe add a prefix or special handling if needed
    console.error(...args);
  },
  info: (...args) => {
    if (config.debug) {
      console.info(...args);
    }
  },
};
