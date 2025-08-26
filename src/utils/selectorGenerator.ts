/**
 * Generate robust selectors for elements
 */

export function generateSelector(element: HTMLElement): string {
  // Try ID first
  if (element.id) {
    return `#${CSS.escape(element.id)}`;
  }

  // Try unique attributes
  const uniqueAttrs = ['data-testid', 'data-id', 'aria-label', 'name'];
  for (const attr of uniqueAttrs) {
    const value = element.getAttribute(attr);
    if (value) {
      return `[${attr}="${CSS.escape(value)}"]`;
    }
  }

  // Generate path selector
  const path: string[] = [];
  let current: HTMLElement | null = element;

  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();
    
    // Add classes if available
    if (current.className) {
      const classes = current.className.split(' ')
        .filter(c => c && !c.startsWith('_'))
        .slice(0, 2);
      if (classes.length) {
        selector += '.' + classes.map(c => CSS.escape(c)).join('.');
      }
    }

    // Add nth-child if needed
    const siblings = current.parentElement?.children;
    if (siblings && siblings.length > 1) {
      const index = Array.from(siblings).indexOf(current) + 1;
      selector += `:nth-child(${index})`;
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

  while (current && current.nodeType === Node.ELEMENT_NODE) {
    const el = current as HTMLElement;
    let index = 1;
    
    // Count siblings with same tag
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

  return '//' + paths.join('/');
}