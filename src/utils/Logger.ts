/**
 * Logger utility for structured logging
 */

import chalk from 'chalk';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'success';

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  module: string;
  message: string;
  data?: any;
}

export class Logger {
  private module: string;
  private enabled: boolean;
  private logHistory: LogEntry[] = [];
  private maxHistory: number = 1000;

  constructor(module: string, enabled: boolean = true) {
    this.module = module;
    this.enabled = enabled;
  }

  private log(level: LogLevel, message: string, data?: any): void {
    if (!this.enabled && level !== 'error') return;

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      module: this.module,
      message,
      data
    };

    // Add to history
    this.logHistory.push(entry);
    if (this.logHistory.length > this.maxHistory) {
      this.logHistory = this.logHistory.slice(-this.maxHistory / 2);
    }

    // Format and output
    const timestamp = entry.timestamp.toISOString().split('T')[1].split('.')[0];
    const prefix = `[${timestamp}] [${this.module}]`;

    switch (level) {
      case 'debug':
        console.log(chalk.gray(`${prefix} ${message}`), data || '');
        break;
      case 'info':
        console.log(chalk.blue(`${prefix} ${message}`), data || '');
        break;
      case 'warn':
        console.warn(chalk.yellow(`${prefix} ⚠️  ${message}`), data || '');
        break;
      case 'error':
        console.error(chalk.red(`${prefix} ❌ ${message}`), data || '');
        break;
      case 'success':
        console.log(chalk.green(`${prefix} ✅ ${message}`), data || '');
        break;
    }
  }

  debug(message: string, data?: any): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: any): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: any): void {
    this.log('warn', message, data);
  }

  error(message: string, error?: any): void {
    const errorData = error instanceof Error ? {
      message: error.message,
      stack: error.stack
    } : error;
    
    this.log('error', message, errorData);
  }

  success(message: string, data?: any): void {
    this.log('success', message, data);
  }

  getHistory(): LogEntry[] {
    return [...this.logHistory];
  }

  clearHistory(): void {
    this.logHistory = [];
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }
}

export default Logger;