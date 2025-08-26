/**
 * Complete helper utilities - FIXED VERSION
 */

// ============ Selector Generation ============
export function generateSelector(element: HTMLElement): string {
  // Try ID first
  if (element.id && !element.id.includes(':')) {
    return `#${CSS.escape(element.id)}`;
  }

  // Try unique attributes
  const uniqueAttrs = ['data-testid', 'data-id', 'aria-label', 'name'];
  for (const attr of uniqueAttrs) {
    const value = element.getAttribute(attr);
    if (value && !value.includes(':')) {
      return `[${attr}="${CSS.escape(value)}"]`;
    }
  }

  // Generate path selector
  return generatePathSelector(element);
}

export function generatePathSelector(element: HTMLElement): string {
  const path: string[] = [];
  let current: HTMLElement | null = element;

  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();
    
    // Add ID if available
    if (current.id && !current.id.includes(':')) {
      selector += `#${CSS.escape(current.id)}`;
      path.unshift(selector);
      break;
    }
    
    // Add meaningful classes
    if (current.className && typeof current.className === 'string') {
      const classes = current.className
        .split(' ')
        .filter(c => c && !c.startsWith('_') && !c.includes(':'))
        .slice(0, 2);
      
      if (classes.length) {
        selector += '.' + classes.map(c => CSS.escape(c)).join('.');
      }
    }

    // Add position if needed
    const siblings = current.parentElement?.children;
    if (siblings && siblings.length > 1) {
      const sameTagSiblings = Array.from(siblings).filter(
        s => s.tagName === current!.tagName
      );
      
      if (sameTagSiblings.length > 1) {
        const index = sameTagSiblings.indexOf(current) + 1;
        selector += `:nth-of-type(${index})`;
      }
    }

    path.unshift(selector);
    current = current.parentElement;

    // Limit depth
    if (path.length >= 5) break;
  }

  return path.join(' > ');
}

export function generateXPath(element: HTMLElement): string {
  const paths: string[] = [];
  let current: Node | null = element;

  while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.body) {
    const el = current as HTMLElement;
    let index = 1;
    
    // Count preceding siblings with same tag
    let sibling = el.previousSibling;
    while (sibling) {
      if (sibling.nodeType === Node.ELEMENT_NODE && 
          sibling.nodeName === el.nodeName) {
        index++;
      }
      sibling = sibling.previousSibling;
    }

    const tagName = el.nodeName.toLowerCase();
    const pathIndex = `[${index}]`;
    paths.unshift(`${tagName}${pathIndex}`);

    current = el.parentNode;
  }

  return paths.length ? '//' + paths.join('/') : '';
}

export function generateAlternativeSelectors(element: HTMLElement): string[] {
  const selectors: string[] = [];
  
  // Generate different selector strategies
  
  // 1. By attributes
  const attrs = ['data-testid', 'data-id', 'aria-label', 'name', 'placeholder'];
  attrs.forEach(attr => {
    const value = element.getAttribute(attr);
    if (value) {
      selectors.push(`[${attr}="${CSS.escape(value)}"]`);
    }
  });
  
  // 2. By class combinations
  if (element.className && typeof element.className === 'string') {
    const classes = element.className.split(' ').filter(c => c && !c.startsWith('_'));
    if (classes.length > 0) {
      // Single class
      selectors.push(`.${CSS.escape(classes[0])}`);
      
      // Multiple classes
      if (classes.length > 1) {
        selectors.push(classes.slice(0, 3).map(c => `.${CSS.escape(c)}`).join(''));
      }
    }
  }
  
  // 3. By parent + tag
  const parent = element.parentElement;
  if (parent && parent.id) {
    selectors.push(`#${CSS.escape(parent.id)} > ${element.tagName.toLowerCase()}`);
  }
  
  // 4. By text content (for buttons)
  if (element.tagName === 'BUTTON' && element.textContent) {
    const text = element.textContent.trim();
    if (text.length < 30) {
      selectors.push(`button:contains("${text}")`);
    }
  }
  
  return [...new Set(selectors)]; // Remove duplicates
}

// ============ Debounce & Throttle ============
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return function(this: any, ...args: Parameters<T>) {
    const context = this;
    
    if (timeout) clearTimeout(timeout);
    
    timeout = setTimeout(() => {
      func.apply(context, args);
      timeout = null;
    }, wait);
  };
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): T {
  let inThrottle = false;
  let lastFunc: NodeJS.Timeout | null = null;
  let lastTime = 0;
  
  return (function(this: any, ...args: Parameters<T>) {
    const context = this;
    
    if (!inThrottle) {
      func.apply(context, args);
      lastTime = Date.now();
      inThrottle = true;
      
      setTimeout(() => {
        inThrottle = false;
        if (lastFunc) {
          clearTimeout(lastFunc);
          lastFunc = null;
        }
      }, limit);
    } else {
      if (lastFunc) clearTimeout(lastFunc);
      
      lastFunc = setTimeout(() => {
        if (Date.now() - lastTime >= limit) {
          func.apply(context, args);
          lastTime = Date.now();
        }
      }, Math.max(limit - (Date.now() - lastTime), 0));
    }
  }) as T;
}

// ============ Value Sanitization & Formatting ============
export function sanitizeValue(value: string): string {
  if (!value) return '';
  
  // Remove common formatting characters
  return value
    .replace(/[$€£¥₹,\s]/g, '') // Remove currency symbols, commas, spaces
    .replace(/[^\d.-]/g, '') // Keep only digits, dots, and minus
    .trim();
}

export function normalizeNumber(value: string): number {
  const sanitized = sanitizeValue(value);
  
  // Handle different decimal separators
  const normalized = sanitized.replace(',', '.');
  
  const num = parseFloat(normalized);
  return isNaN(num) ? 0 : num;
}

export function formatNumber(
  value: number, 
  decimals: number = 6,
  locale: string = 'en-US'
): string {
  if (isNaN(value)) return '0';
  
  // Format based on size
  if (Math.abs(value) < 0.000001) {
    return value.toExponential(2);
  }
  
  if (Math.abs(value) >= 1000000) {
    return value.toExponential(2);
  }
  
  // Regular formatting
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals
  }).format(value);
}

export function isValidNumber(value: string): boolean {
  if (!value) return false;
  
  const sanitized = sanitizeValue(value);
  if (!sanitized) return false;
  
  // Check format
  const numberRegex = /^-?\d*\.?\d+$/;
  if (!numberRegex.test(sanitized)) return false;
  
  const num = parseFloat(sanitized);
  return !isNaN(num) && isFinite(num);
}

export function parseTokenAmount(
  value: string, 
  decimals: number = 18
): bigint {
  try {
    const sanitized = sanitizeValue(value);
    if (!sanitized) return BigInt(0);
    
    // Split into integer and decimal parts
    const parts = sanitized.split('.');
    const integerPart = parts[0] || '0';
    const decimalPart = parts[1] || '';
    
    // Pad or truncate decimal part
    const paddedDecimal = decimalPart.padEnd(decimals, '0').slice(0, decimals);
    
    // Combine and convert to bigint
    const combined = integerPart + paddedDecimal;
    return BigInt(combined);
  } catch {
    return BigInt(0);
  }
}

export function formatTokenAmount(
  value: bigint, 
  decimals: number = 18
): string {
  const str = value.toString();
  
  if (str === '0') return '0';
  
  // Add decimal point
  const padded = str.padStart(decimals + 1, '0');
  const integerPart = padded.slice(0, -decimals) || '0';
  const decimalPart = padded.slice(-decimals);
  
  // Remove trailing zeros
  const trimmedDecimal = decimalPart.replace(/0+$/, '');
  
  if (!trimmedDecimal) return integerPart;
  
  return `${integerPart}.${trimmedDecimal}`;
}

// ============ DOM Utilities ============
export function waitForElement(
  selector: string, 
  timeout: number = 10000
): Promise<HTMLElement> {
  return new Promise((resolve, reject) => {
    const element = document.querySelector<HTMLElement>(selector);
    if (element) {
      resolve(element);
      return;
    }
    
    const observer = new MutationObserver((_mutations, obs) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (element) {
        obs.disconnect();
        resolve(element);
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Element not found: ${selector}`));
    }, timeout);
  });
}

export function waitForCondition(
  condition: () => boolean,
  timeout: number = 10000,
  interval: number = 100
): Promise<void> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const check = () => {
      if (condition()) {
        resolve();
        return;
      }
      
      if (Date.now() - startTime > timeout) {
        reject(new Error('Condition timeout'));
        return;
      }
      
      setTimeout(check, interval);
    };
    
    check();
  });
}

export function isElementVisible(element: HTMLElement): boolean {
  if (!element) return false;
  
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  
  return !!(
    rect.width > 0 &&
    rect.height > 0 &&
    rect.top < window.innerHeight &&
    rect.bottom > 0 &&
    rect.left < window.innerWidth &&
    rect.right > 0 &&
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    parseFloat(style.opacity) > 0
  );
}

export function isElementInViewport(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

export function scrollToElement(element: HTMLElement, smooth: boolean = true): void {
  element.scrollIntoView({
    behavior: smooth ? 'smooth' : 'auto',
    block: 'center',
    inline: 'center'
  });
}

// ============ Event Simulation ============
export function simulateClick(element: HTMLElement): void {
  const clickEvent = new MouseEvent('click', {
    view: window,
    bubbles: true,
    cancelable: true,
    buttons: 1
  });
  
  element.dispatchEvent(clickEvent);
}

export function simulateInput(
  element: HTMLInputElement | HTMLTextAreaElement, 
  value: string
): void {
  // Set value
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value'
  )?.set;
  
  if (nativeInputValueSetter) {
    nativeInputValueSetter.call(element, value);
  } else {
    element.value = value;
  }
  
  // Trigger events
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

export function simulateKeyPress(
  element: HTMLElement,
  key: string,
  code?: string
): void {
  const keydownEvent = new KeyboardEvent('keydown', {
    key,
    code: code || `Key${key.toUpperCase()}`,
    bubbles: true,
    cancelable: true
  });
  
  const keyupEvent = new KeyboardEvent('keyup', {
    key,
    code: code || `Key${key.toUpperCase()}`,
    bubbles: true,
    cancelable: true
  });
  
  element.dispatchEvent(keydownEvent);
  element.dispatchEvent(keyupEvent);
}

// ============ Storage Utilities ============
export function saveToStorage(key: string, value: any): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error('Failed to save to storage:', error);
  }
}

export function loadFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
  } catch {
    return defaultValue;
  }
}

export function removeFromStorage(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore errors
  }
}

// ============ Async Utilities ============
export const delay = (ms: number): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms));

export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < maxAttempts - 1) {
        await delay(delayMs * Math.pow(2, i)); // Exponential backoff
      }
    }
  }
  
  throw lastError || new Error('Retry failed');
}

export function timeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string = 'Operation timed out'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error(message)), ms)
    )
  ]);
}

// ============ Validation Utilities ============
export function isValidAddress(address: string): boolean {
  // Ethereum address validation
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return false;
  
  // Could add checksum validation here
  return true;
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function isValidSelector(selector: string): boolean {
  try {
    document.querySelector(selector);
    return true;
  } catch {
    return false;
  }
}

// ============ String Utilities ============
export function truncateAddress(
  address: string, 
  startChars: number = 6, 
  endChars: number = 4
): string {
  if (!address) return '';
  if (address.length <= startChars + endChars) return address;
  
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}

export function capitalizeFirst(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function camelToKebab(str: string): string {
  return str.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`);
}

export function kebabToCamel(str: string): string {
  return str.replace(/-./g, m => m[1].toUpperCase());
}

// ============ Browser Detection ============
export function getBrowserInfo(): {
  name: string;
  version: string;
  platform: string;
} {
  const ua = navigator.userAgent;
  let name = 'Unknown';
  let version = 'Unknown';
  
  if (ua.includes('Firefox')) {
    name = 'Firefox';
    version = ua.match(/Firefox\/(\d+)/)?.[1] || 'Unknown';
  } else if (ua.includes('Chrome')) {
    name = 'Chrome';
    version = ua.match(/Chrome\/(\d+)/)?.[1] || 'Unknown';
  } else if (ua.includes('Safari')) {
    name = 'Safari';
    version = ua.match(/Version\/(\d+)/)?.[1] || 'Unknown';
  } else if (ua.includes('Edge')) {
    name = 'Edge';
    version = ua.match(/Edge\/(\d+)/)?.[1] || 'Unknown';
  }
  
  return {
    name,
    version,
    platform: navigator.platform
  };
}

export function isMobile(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}