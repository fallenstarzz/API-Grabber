import type { Page, Frame } from 'puppeteer';
import chalk from 'chalk';

export interface WaitCondition {
  type: 'element' | 'network' | 'popup' | 'metamask' | 'loading' | 'custom';
  selector?: string;
  timeout?: number;
  description?: string;
}

export class WaitManager {
  private page: Page;
  private defaultTimeout: number = 30000;
  private smartWaitEnabled: boolean = true;

  constructor(page: Page) {
    this.page = page;
  }

  // Smart wait before action
  async waitBeforeAction(selector: string, action: string): Promise<void> {
    if (!this.smartWaitEnabled) return;

    try {
      console.log(chalk.gray(`⏳ Smart wait before ${action}...`));

      // Wait for element to be ready
      await this.waitForElement(selector);
      
      // Wait for any ongoing animations
      await this.waitForAnimations(selector);
      
      // Wait for network to be relatively idle
      await this.waitForNetworkIdle();

      // Small delay for stability
      await this.delay(100);

    } catch (error) {
      console.log(chalk.yellow(`⚠️ Wait timeout for ${selector}, continuing...`));
    }
  }

  // Smart wait after action
  async waitAfterAction(action: string): Promise<void> {
    if (!this.smartWaitEnabled) return;

    console.log(chalk.gray(`⏳ Smart wait after ${action}...`));

    // Detect what changed after action
    const changes = await this.detectChanges();
    
    if (changes.popupDetected) {
      await this.waitForPopup();
    }
    
    if (changes.navigationDetected) {
      await this.waitForNavigation();
    }
    
    if (changes.loadingDetected) {
      await this.waitForLoadingComplete();
    }

    if (changes.metamaskDetected) {
      await this.waitForMetaMask();
    }

    // Always wait for network to stabilize after action
    await this.waitForNetworkIdle();
  }

  // Wait for element to be interactable
  private async waitForElement(selector: string): Promise<void> {
    try {
      // First wait for element to exist
      await this.page.waitForSelector(selector, { 
        timeout: 5000,
        visible: true 
      });

      // Then wait for it to be clickable (not covered by other elements)
      await this.page.evaluate((sel) => {
        return new Promise<void>((resolve, reject) => {
          const checkClickable = () => {
            const element = document.querySelector(sel);
            if (!element) {
              reject(new Error('Element not found'));
              return;
            }

            const rect = element.getBoundingClientRect();
            const elementAtPoint = document.elementFromPoint(
              rect.left + rect.width / 2,
              rect.top + rect.height / 2
            );

            // Check if element is clickable (not covered)
            if (element === elementAtPoint || element.contains(elementAtPoint)) {
              resolve();
            } else {
              setTimeout(checkClickable, 100);
            }
          };

          checkClickable();
          setTimeout(() => reject(new Error('Timeout')), 5000);
        });
      }, selector);

    } catch (error) {
      // Element might not need special wait
    }
  }

  // Wait for animations to complete
  private async waitForAnimations(selector: string): Promise<void> {
    try {
      await this.page.evaluate((sel) => {
        return new Promise<void>((resolve) => {
          const element = document.querySelector(sel);
          if (!element) {
            resolve();
            return;
          }

          const computedStyle = window.getComputedStyle(element);
          const animationDuration = parseFloat(computedStyle.animationDuration) * 1000;
          const transitionDuration = parseFloat(computedStyle.transitionDuration) * 1000;
          
          const maxDuration = Math.max(animationDuration, transitionDuration, 0);
          
          if (maxDuration > 0) {
            setTimeout(resolve, Math.min(maxDuration, 1000)); // Max 1 second wait
          } else {
            resolve();
          }
        });
      }, selector);
    } catch {
      // No animation to wait for
    }
  }

  // Wait for network to be idle (Fixed version)
  private async waitForNetworkIdle(): Promise<void> {
    try {
      // Use waitForLoadState for Puppeteer
      await this.page.waitForNavigation({ 
        waitUntil: 'networkidle2',
        timeout: 3000 
      }).catch(() => {
        // Navigation might not happen, just wait for network idle
      });
      
      // Alternative: wait for no network activity
      await this.page.evaluate(() => {
        return new Promise<void>((resolve) => {
          let timer: any;
          let requestCount = 0;
          
          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (entry.entryType === 'resource') {
                requestCount++;
                clearTimeout(timer);
                timer = setTimeout(() => {
                  if (requestCount === 0) {
                    resolve();
                  }
                  requestCount = 0;
                }, 500);
              }
            }
          });
          
          observer.observe({ entryTypes: ['resource'] });
          
          // Timeout after 3 seconds
          setTimeout(() => {
            observer.disconnect();
            resolve();
          }, 3000);
        });
      });
    } catch {
      // Network might not idle, continue anyway
    }
  }

  // Detect changes after action
  private async detectChanges(): Promise<any> {
    return await this.page.evaluate(() => {
      const changes = {
        popupDetected: false,
        navigationDetected: false,
        loadingDetected: false,
        metamaskDetected: false
      };

      // Check for new modals/popups
      const modals = document.querySelectorAll('[role="dialog"], .modal, .popup, [class*="modal"], [class*="popup"]');
      changes.popupDetected = modals.length > 0;

      // Check for loading indicators
      const loadingIndicators = document.querySelectorAll('.loading, .spinner, [class*="loading"], [class*="spinner"], [aria-busy="true"]');
      changes.loadingDetected = loadingIndicators.length > 0;

      // Check for MetaMask
      const metamaskIndicators = document.querySelectorAll('[class*="metamask"], [id*="metamask"], .metamask-popup');
      changes.metamaskDetected = metamaskIndicators.length > 0;

      return changes;
    });
  }

  // Wait for popup to be fully loaded
  private async waitForPopup(): Promise<void> {
    console.log(chalk.blue('🔲 Popup detected, waiting...'));
    
    try {
      // Wait for popup to be visible
      await this.page.waitForSelector('[role="dialog"], .modal, .popup', {
        visible: true,
        timeout: 5000
      });

      // Wait for content inside popup to load
      await this.delay(500);
      
      // Wait for any animations
      await this.page.evaluate(() => {
        return new Promise<void>((resolve) => {
          const popup = document.querySelector('[role="dialog"], .modal, .popup');
          if (!popup) {
            resolve();
            return;
          }

          // Wait for all images in popup to load
          const images = popup.querySelectorAll('img');
          let loadedCount = 0;
          
          if (images.length === 0) {
            resolve();
            return;
          }

          images.forEach((img) => {
            if (img.complete) {
              loadedCount++;
            } else {
              img.addEventListener('load', () => {
                loadedCount++;
                if (loadedCount === images.length) {
                  resolve();
                }
              });
            }
          });

          if (loadedCount === images.length) {
            resolve();
          }

          // Timeout after 3 seconds
          setTimeout(resolve, 3000);
        });
      });

      console.log(chalk.green('✅ Popup loaded'));
    } catch {
      console.log(chalk.yellow('⚠️ Popup wait timeout'));
    }
  }

  // Wait for loading to complete
  private async waitForLoadingComplete(): Promise<void> {
    console.log(chalk.blue('⏳ Loading detected, waiting...'));
    
    try {
      // Wait for loading indicators to disappear
      await this.page.waitForFunction(
        () => {
          const indicators = document.querySelectorAll('.loading, .spinner, [class*="loading"], [class*="spinner"], [aria-busy="true"]');
          return indicators.length === 0;
        },
        { timeout: 10000 }
      );

      console.log(chalk.green('✅ Loading complete'));
    } catch {
      console.log(chalk.yellow('⚠️ Loading timeout'));
    }
  }

  // Wait for MetaMask popup
  private async waitForMetaMask(): Promise<void> {
    console.log(chalk.blue('🦊 MetaMask detected, waiting...'));
    
    try {
      // Check for MetaMask notification window
      const pages = await this.page.browser().pages();
      const metamaskPage = pages.find(p => p.url().includes('notification.html'));
      
      if (metamaskPage) {
        console.log(chalk.green('✅ MetaMask popup found'));
        // Wait a bit for it to fully load
        await this.delay(1000);
      } else {
        // Wait for MetaMask in-page popup
        await this.page.waitForSelector('[class*="metamask"]', {
          visible: true,
          timeout: 3000
        });
      }
    } catch {
      console.log(chalk.yellow('⚠️ MetaMask wait timeout'));
    }
  }

  // Wait for navigation
  private async waitForNavigation(): Promise<void> {
    try {
      await this.page.waitForNavigation({ 
        waitUntil: 'networkidle2',
        timeout: 5000 
      });
    } catch {
      // Navigation might not happen
    }
  }

  // Simple delay helper
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Set smart wait enabled/disabled
  setSmartWait(enabled: boolean): void {
    this.smartWaitEnabled = enabled;
    console.log(chalk.gray(`Smart wait ${enabled ? 'enabled' : 'disabled'}`));
  }
}