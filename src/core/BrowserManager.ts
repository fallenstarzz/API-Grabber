import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import type { Browser, Page } from 'puppeteer';
import * as path from 'path';
import chalk from 'chalk';
import fs from 'fs-extra';

// Use stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

export interface ChainInfo {
  chainId: string;
  network: string;
  rpc: string;
  gasPrice: string;
  blockTime: number;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

export interface BalanceInfo {
  address: string;
  nativeBalance: string;
  tokenBalances: Map<string, string>;
  timestamp: number;
}

export interface SwapSettings {
  slippage: string;
  gasSettings: {
    gasLimit: string;
    gasPrice: string;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
  };
  deadline?: number;
}

export class BrowserManager {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private profilePath: string;
  private isFirstRun: boolean = false;
  private memoryUsage: { actions: number; network: number; lastCleanup: number } = {
    actions: 0,
    network: 0,
    lastCleanup: Date.now()
  };
  private retryAttempts: Map<string, number> = new Map();
  private maxRetries: number = 3;

  constructor() {
    // Get project root
    const projectRoot = path.resolve(process.cwd());
    this.profilePath = path.join(projectRoot, 'profiles', 'chrome');
  }

  async launch(): Promise<Page> {
    try {
      console.log(chalk.cyan('🚀 Launching Chrome browser...\n'));

      // Check if this is first run
      this.isFirstRun = !(await this.checkProfileExists());

      // Launch browser with persistent profile
      this.browser = await puppeteer.launch({
        headless: false,
        userDataDir: this.profilePath,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--disable-features=IsolateOrigins,site-per-process',
          '--window-size=1366,768',
          '--disable-dev-shm-usage',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-features=TranslateUI',
          '--disable-ipc-flooding-protection'
        ],
        defaultViewport: {
          width: 1366,
          height: 768
        },
        ignoreDefaultArgs: ['--enable-automation']
      });

      console.log(chalk.green('✅ Chrome launched successfully\n'));

      // Get or create page
      const pages = await this.browser.pages();
      this.page = pages[0] || await this.browser.newPage();

      // Set user agent
      await this.page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
      );

      // Set page error handling
      this.page.on('error', (error: Error) => {
        console.error(chalk.red('❌ Page error:'), error);
        this.handlePageError(error);
      });

      this.page.on('pageerror', (error: Error) => {
        console.error(chalk.red('❌ Page script error:'), error);
        this.handlePageError(error);
      });

      // If first run, show welcome message
      if (this.isFirstRun) {
        console.log(chalk.yellow('🆕 First run detected!'));
        console.log(chalk.gray('   Profile will be created at: ' + this.profilePath));
        console.log(chalk.gray('   Extensions and data will be saved automatically\n'));
      }

      return this.page;

          } catch (error) {
        console.error(chalk.red('❌ Failed to launch browser:'), error);
        await this.handleLaunchError(error as Error);
        throw error;
      }
  }

  async checkProfileExists(): Promise<boolean> {
    try {
      const profileExists = await fs.pathExists(this.profilePath);
      const hasData = profileExists && 
                     await fs.pathExists(path.join(this.profilePath, 'Default'));
      return hasData;
    } catch {
      return false;
    }
  }

  async checkMetaMask(page: Page): Promise<boolean> {
    try {
      // Navigate to simple page to check extensions
      if (!page.url().startsWith('http')) {
        await page.goto('https://example.com', { 
          waitUntil: 'networkidle2',
          timeout: 10000 
        });
      }
      
      // Wait for extensions to initialize using new method
      await this.delay(2000);
      
      // Check if MetaMask is available
      const hasMetaMask = await page.evaluate(() => {
        return typeof (window as any).ethereum !== 'undefined' && 
               (window as any).ethereum.isMetaMask === true;
      });

      return hasMetaMask;
    } catch (error) {
      console.error(chalk.red('Error checking MetaMask:'), error);
      return false;
    }
  }

  async installMetaMask(page: Page): Promise<void> {
    console.log(chalk.yellow('\n📦 Installing MetaMask Extension...\n'));
    
    // Navigate to Chrome Web Store
    await page.goto('https://chromewebstore.google.com/detail/metamask/nkbihfbeogaeaoehlefnkodbefgpgknn', {
      waitUntil: 'networkidle2'
    });
    
    console.log(chalk.green('✅ MetaMask page opened\n'));
    console.log(chalk.cyan('📋 Installation Guide:'));
    console.log('   1. Click the blue "Add to Chrome" button');
    console.log('   2. Click "Add Extension" in the popup');
    console.log('   3. Wait for MetaMask to open in new tab');
    console.log('   4. Create new wallet or import existing');
    console.log('   5. Your wallet will be saved permanently!\n');
  }

  async navigateTo(url: string): Promise<void> {
    if (!this.page) throw new Error('Browser not initialized');

    console.log(chalk.cyan(`📍 Navigating to: ${url}\n`));
    
    try {
      await this.page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });

      console.log(chalk.green('✅ Navigation successful\n'));
          } catch (error) {
        console.error(chalk.red('❌ Navigation failed:'), error);
        await this.handleNavigationError(error as Error, url);
      }
  }

  // NEW: Enhanced chain detection
  async detectChainInfo(): Promise<ChainInfo | null> {
    if (!this.page) return null;

    try {
      const chainInfo = await this.page.evaluate(() => {
        if (typeof (window as any).ethereum === 'undefined') {
          return null;
        }

        const ethereum = (window as any).ethereum;
        return {
          chainId: ethereum.chainId,
          network: ethereum.networkVersion,
          rpc: ethereum.rpcUrls?.[0] || 'unknown',
          gasPrice: '0',
          blockTime: 12,
          nativeCurrency: {
            name: 'Ether',
            symbol: 'ETH',
            decimals: 18
          }
        };
      });

      if (chainInfo) {
        // Get actual gas price
        const gasPrice = await this.estimateGasPrice();
        chainInfo.gasPrice = gasPrice;
        
        // Map chain ID to network name
        chainInfo.network = this.mapChainIdToNetwork(chainInfo.chainId);
        
        console.log(chalk.green(`✅ Chain detected: ${chainInfo.network} (${chainInfo.chainId})`));
        return chainInfo;
      }

      return null;
    } catch (error) {
      console.error(chalk.red('❌ Failed to detect chain:'), error);
      return null;
    }
  }

  // NEW: Balance checking
  async getBalanceInfo(): Promise<BalanceInfo | null> {
    if (!this.page) return null;

    try {
      const balanceInfo = await this.page.evaluate(async () => {
        if (typeof (window as any).ethereum === 'undefined') {
          return null;
        }

        const ethereum = (window as any).ethereum;
        const accounts = await ethereum.request({ method: 'eth_accounts' });
        
        if (accounts.length === 0) {
          return null;
        }

        const address = accounts[0];
        const balance = await ethereum.request({
          method: 'eth_getBalance',
          params: [address, 'latest']
        });

        return {
          address,
          nativeBalance: balance,
          tokenBalances: new Map(),
          timestamp: Date.now()
        };
      });

      if (balanceInfo) {
        // Convert wei to ETH
        const ethBalance = this.weiToEth(balanceInfo.nativeBalance);
        console.log(chalk.green(`💰 Balance: ${ethBalance} ETH`));
        
        // Get token balances (basic implementation)
        balanceInfo.tokenBalances = await this.getTokenBalances();
        
        return balanceInfo;
      }

      return null;
    } catch (error) {
      console.error(chalk.red('❌ Failed to get balance:'), error);
      return null;
    }
  }

  // NEW: Swap settings detection
  async getSwapSettings(): Promise<SwapSettings | null> {
    if (!this.page) return null;

    try {
      const settings = await this.page.evaluate(() => {
        // Try to find slippage input
        const slippageInput = document.querySelector('[data-testid="slippage-input"], [placeholder*="slippage"], [name*="slippage"]');
        const slippage = slippageInput ? (slippageInput as HTMLInputElement).value : '0.5';

        // Try to find gas settings
        const gasInput = document.querySelector('[data-testid="gas-input"], [placeholder*="gas"], [name*="gas"]');
        const gasLimit = gasInput ? (gasInput as HTMLInputElement).value : 'auto';

        return {
          slippage,
          gasSettings: {
            gasLimit,
            gasPrice: 'auto'
          }
        };
      });

      console.log(chalk.green(`⚙️  Swap settings detected: Slippage ${settings.slippage}%, Gas: ${settings.gasSettings.gasLimit}`));
      return settings;
    } catch (error) {
      console.error(chalk.red('❌ Failed to get swap settings:'), error);
      return null;
    }
  }

  // NEW: Gas estimation
  async estimateGasPrice(): Promise<string> {
    if (!this.page) return '0';

    try {
      const gasPrice = await this.page.evaluate(async () => {
        if (typeof (window as any).ethereum === 'undefined') {
          return '0';
        }

        try {
          const gasPrice = await (window as any).ethereum.request({
            method: 'eth_gasPrice'
          });
          return gasPrice;
        } catch {
          return '0';
        }
      });

      return gasPrice;
    } catch (error) {
      console.error(chalk.red('❌ Failed to estimate gas price:'), error);
      return '0';
    }
  }

  // NEW: Memory management
  async cleanupMemory(): Promise<void> {
    const now = Date.now();
    const timeSinceLastCleanup = now - this.memoryUsage.lastCleanup;

    // Cleanup every 5 minutes or if memory usage is high
    if (timeSinceLastCleanup > 300000 || this.memoryUsage.actions > 10000) {
      console.log(chalk.yellow('🧹 Performing memory cleanup...'));

      if (this.browser) {
        // Clear browser cache
        const pages = await this.browser.pages();
        for (const page of pages) {
          try {
            await page.evaluate(() => {
              if ('caches' in window) {
                caches.keys().then(names => {
                  names.forEach(name => caches.delete(name));
                });
              }
            });
          } catch {
            // Ignore errors
          }
        }
      }

      this.memoryUsage.actions = 0;
      this.memoryUsage.network = 0;
      this.memoryUsage.lastCleanup = now;

      console.log(chalk.green('✅ Memory cleanup completed'));
    }
  }

  // NEW: Retry mechanism
  async retryOperation<T>(
    operation: () => Promise<T>,
    operationName: string,
    maxRetries: number = this.maxRetries
  ): Promise<T> {
    let lastError: Error | undefined;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        console.warn(chalk.yellow(`⚠️  ${operationName} attempt ${attempt} failed:`, error));
        
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Exponential backoff
          console.log(chalk.gray(`   Retrying in ${delay}ms...`));
          await this.delay(delay);
        }
      }
    }
    
    throw new Error(`${operationName} failed after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`);
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }

  // Helper methods
  private async handlePageError(error: Error): Promise<void> {
    console.error(chalk.red('Page error occurred:'), error);
    
    // Try to recover page
    if (this.page && !this.page.isClosed()) {
      try {
        await this.page.reload({ waitUntil: 'networkidle2' });
        console.log(chalk.green('✅ Page recovered successfully'));
      } catch (reloadError) {
        console.error(chalk.red('❌ Failed to recover page:'), reloadError);
      }
    }
  }

  private async handleLaunchError(error: Error): Promise<void> {
    console.error(chalk.red('Launch error occurred:'), error);
    
    // Cleanup any partial browser state
    if (this.browser) {
      try {
        await this.browser.close();
      } catch {
        // Ignore cleanup errors
      }
      this.browser = null;
    }
  }

  private async handleNavigationError(error: Error, url: string): Promise<void> {
    console.error(chalk.red(`Navigation to ${url} failed:`), error);
    
    // Try alternative navigation method
    if (this.page && !this.page.isClosed()) {
      try {
        console.log(chalk.yellow('🔄 Trying alternative navigation method...'));
        await this.page.goto(url, { 
          waitUntil: 'domcontentloaded',
          timeout: 15000 
        });
        console.log(chalk.green('✅ Alternative navigation successful'));
      } catch (altError) {
        console.error(chalk.red('❌ Alternative navigation also failed:'), altError);
        throw error; // Re-throw original error
      }
    }
  }

  private mapChainIdToNetwork(chainId: string): string {
    const chainMap: Record<string, string> = {
      '0x1': 'Ethereum Mainnet',
      '0x3': 'Ropsten Testnet',
      '0x4': 'Rinkeby Testnet',
      '0x5': 'Goerli Testnet',
      '0x2a': 'Kovan Testnet',
      '0x89': 'Polygon Mainnet',
      '0x13881': 'Mumbai Testnet',
      '0xa': 'Optimism',
      '0xa4b1': 'Arbitrum One',
      '0xa4ec': 'Celo Mainnet',
      '0x38': 'BSC Mainnet',
      '0x61': 'BSC Testnet',
      '0x1a4': 'Optimism Goerli',
      '0x66eed': 'Arbitrum Goerli'
    };
    
    return chainMap[chainId] || `Unknown Chain (${chainId})`;
  }

  private weiToEth(wei: string): string {
    try {
      const weiNum = parseInt(wei, 16);
      const eth = weiNum / Math.pow(10, 18);
      return eth.toFixed(6);
    } catch {
      return '0';
    }
  }

  private async getTokenBalances(): Promise<Map<string, string>> {
    // Basic implementation - can be enhanced later
    return new Map();
  }

  // Helper method to replace waitForTimeout
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getPage(): Page | null {
    return this.page;
  }

  getBrowser(): Browser | null {
    return this.browser;
  }

  isFirstTimeRun(): boolean {
    return this.isFirstRun;
  }

  // NEW: Get memory usage info
  getMemoryUsage() {
    return { ...this.memoryUsage };
  }
}