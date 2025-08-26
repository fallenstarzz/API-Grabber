import type { Page, HTTPRequest, HTTPResponse } from 'puppeteer';
import { EventEmitter } from 'events';
import chalk from 'chalk';
import { v4 as uuidv4 } from 'uuid';
import { WaitManager } from './WaitManager.js';
import { FrameManager } from './FrameManager.js';
import { DataOptimizer } from './DataOptimizer.js';
import type { RecordedAction, Recording, NetworkRequest, WalletAction } from '../types/index.js';
import type { ChainInfo, BalanceInfo, SwapSettings } from '../core/BrowserManager.js';

export class RecorderEngine extends EventEmitter {
  private page: Page;
  private recording: boolean = false;
  private actions: RecordedAction[] = [];
  private networkRequests: NetworkRequest[] = [];
  private startTime: number = 0;
  private recordingId: string = '';
  private stopCheckInterval: NodeJS.Timeout | null = null;
  private waitManager: WaitManager;
  private frameManager: FrameManager;
  
  // NEW: Enhanced data tracking
  private chainInfo: ChainInfo | null = null;
  private balanceInfo: BalanceInfo | null = null;
  private swapSettings: SwapSettings | null = null;
  private memoryUsage: { actions: number; network: number; lastCleanup: number } = {
    actions: 0,
    network: 0,
    lastCleanup: Date.now()
  };
  private errorCount: number = 0;
  private maxErrors: number = 10;

  constructor(page: Page) {
    super();
    this.page = page;
    this.waitManager = new WaitManager(page);
    this.frameManager = new FrameManager(page);
  }

  async startRecording(name: string, url: string): Promise<void> {
    try {
      this.recording = true;
      this.recordingId = uuidv4();
      this.actions = [];
      this.networkRequests = [];
      this.startTime = Date.now();
      this.errorCount = 0;

      console.log(chalk.green('🎬 Recording started with Smart Wait & Frame Support\n'));
      console.log(chalk.gray(`Recording ID: ${this.recordingId}`));
      console.log(chalk.gray(`Recording Name: ${name}\n`));

      // NEW: Pre-recording setup
      await this.setupPreRecording();
      
      await this.setupNetworkMonitoring();
      await this.setupEnhancedListeners();
      await this.waitManager.waitAfterAction('initial-load');
      await this.injectRecordingUI();
      
      // NEW: Start memory monitoring
      this.startMemoryMonitoring();
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to start recording:'), error);
      this.recording = false;
      throw error;
    }
  }

  // NEW: Pre-recording setup
  private async setupPreRecording(): Promise<void> {
    try {
      console.log(chalk.cyan('🔍 Setting up pre-recording checks...\n'));
      
      // Detect chain info
      this.chainInfo = await this.detectChainInfo();
      
      // Get balance info
      this.balanceInfo = await this.getBalanceInfo();
      
      // Get swap settings
      this.swapSettings = await this.getSwapSettings();
      
      // Validate recording readiness
      await this.validateRecordingReadiness();
      
    } catch (error) {
      console.warn(chalk.yellow('⚠️  Pre-recording setup failed, continuing anyway:'), error);
    }
  }

  // NEW: Chain detection
  private async detectChainInfo(): Promise<ChainInfo | null> {
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
  private async getBalanceInfo(): Promise<BalanceInfo | null> {
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
        
        return balanceInfo;
      }

      return null;
    } catch (error) {
      console.error(chalk.red('❌ Failed to get balance:'), error);
      return null;
    }
  }

  // NEW: Swap settings detection
  private async getSwapSettings(): Promise<SwapSettings | null> {
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

  // NEW: Recording validation
  private async validateRecordingReadiness(): Promise<void> {
    const warnings: string[] = [];
    
    if (!this.chainInfo) {
      warnings.push('Chain info not detected');
    }
    
    if (!this.balanceInfo) {
      warnings.push('Wallet not connected or balance not accessible');
    }
    
    if (!this.swapSettings) {
      warnings.push('Swap settings not detected');
    }
    
    if (warnings.length > 0) {
      console.log(chalk.yellow('⚠️  Recording warnings:'));
      warnings.forEach(warning => console.log(chalk.yellow(`   • ${warning}`)));
      console.log(chalk.gray('   Recording will continue but may miss some data\n'));
    } else {
      console.log(chalk.green('✅ All pre-recording checks passed\n'));
    }
  }

  // NEW: Memory monitoring
  private startMemoryMonitoring(): void {
    const memoryInterval = setInterval(() => {
      if (!this.recording) {
        clearInterval(memoryInterval);
        return;
      }
      
      this.memoryUsage.actions = this.actions.length;
      this.memoryUsage.network = this.networkRequests.length;
      
      // Auto cleanup if needed
      if (this.shouldCleanupMemory()) {
        this.cleanupMemory();
      }
    }, 30000); // Check every 30 seconds
  }

  // NEW: Helper methods for chain and balance detection
  private async estimateGasPrice(): Promise<string> {
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

  // NEW: Error handling
  private async handleRecordingError(error: Error, context: string): Promise<void> {
    this.errorCount++;
    console.error(chalk.red(`❌ Recording error in ${context}:`), error);
    
    // Stop recording if too many errors
    if (this.errorCount >= this.maxErrors) {
      console.error(chalk.red('❌ Too many errors, stopping recording'));
      this.recording = false;
      return;
    }
    
    // Try to recover
    try {
      if (context === 'frame-navigation') {
        await this.page.reload({ waitUntil: 'domcontentloaded' });
        console.log(chalk.green('✅ Page recovered from navigation error'));
      } else if (context === 'listener-setup') {
        // Retry listener setup
        await this.delay(2000);
        await this.setupEnhancedListeners();
        console.log(chalk.green('✅ Listeners recovered'));
      }
    } catch (recoveryError) {
      console.error(chalk.red('❌ Failed to recover from error:'), recoveryError);
    }
  }

  private shouldCleanupMemory(): boolean {
    const now = Date.now();
    const timeSinceLastCleanup = now - this.memoryUsage.lastCleanup;
    
    return timeSinceLastCleanup > 300000 || // 5 minutes
           this.memoryUsage.actions > 10000 || // Too many actions
           this.memoryUsage.network > 5000; // Too many network requests
  }

  private async cleanupMemory(): Promise<void> {
    console.log(chalk.yellow('🧹 Performing memory cleanup...'));
    
    try {
      // Trim old actions if too many
      if (this.actions.length > 5000) {
        const keepCount = 3000;
        this.actions = this.actions.slice(-keepCount);
        console.log(chalk.gray(`   Trimmed actions from ${this.actions.length + keepCount} to ${this.actions.length}`));
      }
      
      // Trim old network requests if too many
      if (this.networkRequests.length > 3000) {
        const keepCount = 2000;
        this.networkRequests = this.networkRequests.slice(-keepCount);
        console.log(chalk.gray(`   Trimmed network requests from ${this.networkRequests.length + keepCount} to ${this.networkRequests.length}`));
      }
      
      this.memoryUsage.lastCleanup = Date.now();
      console.log(chalk.green('✅ Memory cleanup completed'));
      
    } catch (error) {
      console.error(chalk.red('❌ Memory cleanup failed:'), error);
    }
  }

  private async setupNetworkMonitoring(): Promise<void> {
    await this.page.setRequestInterception(true);

    this.page.on('request', (request: HTTPRequest) => {
      if (!this.recording) {
        request.continue();
        return;
      }

      try {
        const url = request.url();
        const method = request.method();
        
        if (
          (url.includes('/api/') || 
           url.includes('/swap') || 
           url.includes('/quote') ||
           url.includes('/transaction') ||
           url.includes('/token') ||
           url.includes('/price') ||
           url.includes('/liquidity') ||
           url.includes('/pool') ||
           url.includes('.json') ||
           url.includes('/v1/') ||
           url.includes('/v2/') ||
           url.includes('/v3/') ||
           method === 'POST' ||
           method === 'PUT') &&
          !url.includes('.png') &&
          !url.includes('.jpg') &&
          !url.includes('.css') &&
          !url.includes('.js') &&
          !url.includes('font') &&
          !url.includes('favicon')
        ) {
          const networkReq: NetworkRequest = {
            id: uuidv4(),
            timestamp: Date.now() - this.startTime,
            url,
            method,
            headers: request.headers(),
            postData: request.postData(),
            resourceType: request.resourceType()
          };
          
          this.networkRequests.push(networkReq);
          
          console.log(chalk.cyan(`[API ${method}] ${url.substring(0, 80)}...`));
          if (request.postData()) {
            console.log(chalk.gray(`  Body: ${request.postData()?.substring(0, 100)}...`));
          }
        }

        request.continue();
      } catch (error) {
        console.error(chalk.red('❌ Error handling request:'), error);
        request.continue(); // Continue anyway to avoid blocking
      }
    });

    this.page.on('response', (response: HTTPResponse) => {
      if (!this.recording) return;

      try {
        const url = response.url();
        const status = response.status();
        
        if (
          (url.includes('/api/') || 
           url.includes('/swap') || 
           url.includes('/quote') ||
           url.includes('/transaction')) &&
          !url.includes('.png') &&
          !url.includes('.jpg')
        ) {
          const statusEmoji = status >= 200 && status < 300 ? '✅' : '❌';
          console.log(chalk.green(`[Response ${statusEmoji} ${status}] ${url.substring(0, 80)}...`));
        }
      } catch (error) {
        console.error(chalk.red('❌ Error handling response:'), error);
      }
    });
  }

  private async setupEnhancedListeners(): Promise<void> {
    try {
      await this.page.evaluateOnNewDocument(() => {
        (window as any).__recordedActions = (window as any).__recordedActions || [];
        (window as any).__recordingActive = true;

        function getEnhancedSelector(element: HTMLElement): string {
          if (element.tagName === 'BUTTON' || element.tagName === 'A') {
            const text = element.innerText || element.textContent;
            if (text && text.length < 50) {
              return `${element.tagName.toLowerCase()}:contains("${text.trim()}")`;
            }
          }

          if (element.id) {
            return `#${element.id}`;
          }

          const dataAttrs = ['data-testid', 'data-id', 'data-cy', 'data-test'];
          for (const attr of dataAttrs) {
            if (element.getAttribute(attr)) {
              return `[${attr}="${element.getAttribute(attr)}"]`;
            }
          }

          if (element.getAttribute('aria-label')) {
            return `[aria-label="${element.getAttribute('aria-label')}"]`;
          }

          if (element.className && typeof element.className === 'string') {
            const classes = element.className.trim().split(/\s+/).filter(c => c && !c.startsWith('css-'));
            if (classes.length > 0) {
              const selector = `${element.tagName.toLowerCase()}.${classes.join('.')}`;
              if (document.querySelectorAll(selector).length === 1) {
                return selector;
              }
            }
          }

          const path: string[] = [];
          let current = element;
          
          while (current && current !== document.body) {
            let selector = current.tagName.toLowerCase();
            
            if (current.id) {
              selector = `#${current.id}`;
              path.unshift(selector);
              break;
            }
            
            const parent = current.parentElement;
            if (parent) {
              const siblings = Array.from(parent.children);
              const index = siblings.indexOf(current);
              
              if (siblings.filter(s => s.tagName === current.tagName).length > 1) {
                selector += `:nth-child(${index + 1})`;
              }
            }
            
            path.unshift(selector);
            current = current.parentElement!;
          }
          
          return path.join(' > ');
        }

        function getDetailedElementInfo(element: HTMLElement) {
          const rect = element.getBoundingClientRect();
          
          return {
            tag: element.tagName.toLowerCase(),
            text: element.innerText?.trim() || element.textContent?.trim(),
            value: (element as HTMLInputElement).value,
            placeholder: (element as HTMLInputElement).placeholder,
            type: (element as HTMLInputElement).type,
            href: (element as HTMLAnchorElement).href,
            className: element.className,
            id: element.id,
            name: (element as any).name,
            role: element.getAttribute('role'),
            ariaLabel: element.getAttribute('aria-label'),
            dataTestId: element.getAttribute('data-testid'),
            innerHTML: element.innerHTML,
            outerHTML: element.outerHTML,
            attributes: Array.from(element.attributes).reduce((acc: any, attr) => {
              acc[attr.name] = attr.value;
              return acc;
            }, {}),
            position: {
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
              x: rect.x,
              y: rect.y
            },
            computed: {
              display: window.getComputedStyle(element).display,
              visibility: window.getComputedStyle(element).visibility,
              opacity: window.getComputedStyle(element).opacity,
              zIndex: window.getComputedStyle(element).zIndex
            },
            parents: getParentChain(element),
            frameInfo: {
              isInFrame: window !== window.top,
              frameUrl: window.location.href
            }
          };
        }

        function getParentChain(element: HTMLElement): string[] {
          const chain: string[] = [];
          let current = element.parentElement;
          let depth = 0;
          
          while (current && depth < 5) {
            chain.push(`${current.tagName.toLowerCase()}${current.id ? '#' + current.id : ''}`);
            current = current.parentElement;
            depth++;
          }
          
          return chain;
        }

        document.addEventListener('click', async (e) => {
          if (!(window as any).__recordingActive) return;
          
          try {
            const target = e.target as HTMLElement;
            const buttonText = target.innerText || target.textContent || '';
            const isSwapAction = buttonText.match(/swap|confirm|approve|connect|select|max|balance/i);
            
            const action = {
              type: 'click',
              timestamp: Date.now(),
              selector: getEnhancedSelector(target),
              xpath: getXPath(target),
              coordinates: { 
                x: e.clientX, 
                y: e.clientY, 
                pageX: e.pageX, 
                pageY: e.pageY 
              },
              element: getDetailedElementInfo(target),
              isSwapAction,
              eventDetails: {
                bubbles: e.bubbles,
                ctrlKey: e.ctrlKey,
                shiftKey: e.shiftKey,
                altKey: e.altKey,
                metaKey: e.metaKey
              }
            };
            
            (window as any).__recordedActions.push(action);
            
            if (isSwapAction) {
              console.log(`[🎯 SWAP ACTION] Clicked: "${buttonText}"`);
            } else {
              console.log(`[Click] ${action.selector}`);
            }
          } catch (error) {
            console.error('[Recording Error] Click event:', error);
          }
        }, true);

        document.addEventListener('input', (e) => {
          if (!(window as any).__recordingActive) return;
          
          try {
            const target = e.target as HTMLInputElement;
            const isAmountInput = target.placeholder?.match(/amount|quantity|value/i) ||
                                 target.name?.match(/amount|quantity|value/i);
            
            const action = {
              type: 'input',
              timestamp: Date.now(),
              selector: getEnhancedSelector(target),
              xpath: getXPath(target),
              value: target.value,
              previousValue: (window as any).__lastInputValue || '',
              element: getDetailedElementInfo(target),
              isAmountInput
            };
            
            (window as any).__lastInputValue = target.value;
            (window as any).__recordedActions.push(action);
            
            console.log(`[Input] ${action.selector} = "${action.value}"`);
          } catch (error) {
            console.error('[Recording Error] Input event:', error);
          }
        }, true);

        document.addEventListener('submit', (e) => {
          if (!(window as any).__recordingActive) return;
          
          try {
            const target = e.target as HTMLFormElement;
            const formData: any = {};
            
            const inputs = target.querySelectorAll('input, select, textarea');
            inputs.forEach((input: any) => {
              if (input.name) {
                formData[input.name] = input.value;
              }
            });
            
            const action = {
              type: 'submit',
              timestamp: Date.now(),
              selector: getEnhancedSelector(target),
              xpath: getXPath(target),
              formData,
              element: getDetailedElementInfo(target)
            };
            
            (window as any).__recordedActions.push(action);
            console.log('[Form Submit]', action.selector);
          } catch (error) {
            console.error('[Recording Error] Submit event:', error);
          }
        }, true);

        function getXPath(element: HTMLElement): string {
          if (element.id) {
            return `//*[@id="${element.id}"]`;
          }
          
          const parts: string[] = [];
          let current: HTMLElement | null = element;
          
          while (current && current.nodeType === Node.ELEMENT_NODE) {
            let index = 0;
            let sibling = current.previousSibling;
            
            while (sibling) {
              if (sibling.nodeType === Node.ELEMENT_NODE && 
                  sibling.nodeName === current.nodeName) {
                index++;
              }
              sibling = sibling.previousSibling;
            }
            
            const tagName = current.nodeName.toLowerCase();
            const part = index > 0 ? `${tagName}[${index + 1}]` : tagName;
            parts.unshift(part);
            
            current = current.parentElement;
          }
          
          return '/' + parts.join('/');
        }

        if ((window as any).ethereum) {
          const originalRequest = (window as any).ethereum.request;
          (window as any).ethereum.request = async function(args: any) {
            try {
              console.log('[🦊 MetaMask Request]', args.method);
              
              (window as any).__recordedActions.push({
                type: 'wallet',
                timestamp: Date.now(),
                method: args.method,
                params: args.params,
                walletAction: true
              });
              
              return originalRequest.apply(this, [args]);
            } catch (error) {
              console.error('[MetaMask Error]', error);
              throw error;
            }
          };
        }
      });

      this.page.on('frameattached', async (frame) => {
        try {
          await frame.evaluate(() => {
            console.log('[Frame] Recording enabled');
            (window as any).__recordingActive = true;
            (window as any).__recordedActions = (window as any).__recordedActions || [];
          });
        } catch {
          console.log(chalk.gray('Frame not ready for injection'));
        }
      });

      this.page.on('console', (msg) => {
        const text = msg.text();
        if (text.includes('[') && text.includes(']')) {
          console.log(chalk.blue(text));
        }
      });

      this.page.on('framenavigated', async (frame) => {
        if (frame === this.page.mainFrame() && this.recording) {
          try {
            this.actions.push({
              id: uuidv4(),
              type: 'navigate',
              timestamp: Date.now() - this.startTime,
              url: frame.url()
            });
            console.log(chalk.magenta(`[Navigation] ${frame.url()}`));
            
            await this.waitManager.waitAfterAction('navigation');
            
            if (this.recording) {
              await this.injectRecordingUI();
            }
          } catch (error) {
            console.error(chalk.red('❌ Error handling frame navigation:'), error);
            this.handleRecordingError(error as Error, 'frame-navigation');
          }
        }
      });

    } catch (error) {
      console.error(chalk.red('❌ Failed to setup enhanced listeners:'), error);
      this.handleRecordingError(error as Error, 'listener-setup');
    }
  }

  private async injectRecordingUI(): Promise<void> {
    try {
      await this.page.evaluate(() => {
        const oldUI = document.getElementById('recorder-ui');
        if (oldUI) oldUI.remove();

        const ui = document.createElement('div');
        ui.id = 'recorder-ui';
        ui.innerHTML = `
          <div id="recorder-container" style="
            position: fixed;
            top: 10px;
            right: 10px;
            z-index: 2147483647;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          ">
            <div id="recorder-panel" style="
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              border-radius: 12px;
              padding: 12px;
              box-shadow: 0 10px 25px rgba(0,0,0,0.3);
              min-width: 160px;
            ">
              <div style="
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 8px;
                color: white;
              ">
                <div style="display: flex; align-items: center;">
                  <div style="
                    width: 8px;
                    height: 8px;
                    background: #ff4444;
                    border-radius: 50%;
                    margin-right: 8px;
                    animation: pulse 1.5s infinite;
                  "></div>
                  <span style="font-weight: 600; font-size: 11px;">RECORDING</span>
                </div>
              </div>

              <div id="recorder-timer" style="
                font-size: 18px;
                font-weight: bold;
                color: white;
                text-align: center;
                margin-bottom: 8px;
                font-variant-numeric: tabular-nums;
              ">00:00</div>
              
              <div style="
                background: rgba(255,255,255,0.15);
                border-radius: 6px;
                padding: 6px;
                margin-bottom: 8px;
                color: white;
                font-size: 10px;
              ">
                <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                  <span>Actions:</span>
                  <span id="action-count" style="font-weight: bold;">0</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                  <span>Clicks:</span>
                  <span id="click-count" style="font-weight: bold;">0</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span>API Calls:</span>
                  <span id="network-count" style="font-weight: bold;">0</span>
                </div>
              </div>
              
              <div style="
                background: rgba(255,255,255,0.1);
                border-radius: 4px;
                padding: 4px;
                margin-bottom: 8px;
                text-align: center;
                color: white;
                font-size: 9px;
              ">
                <span id="status-text">Smart Wait Active</span>
              </div>
              
              <button id="recorder-stop-btn" style="
                width: 100%;
                padding: 8px;
                background: white;
                color: #764ba2;
                border: none;
                border-radius: 6px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
                font-size: 11px;
              " onmouseover="this.style.transform='scale(1.05)'" 
                 onmouseout="this.style.transform='scale(1)'">
                STOP RECORDING
              </button>
            </div>
          </div>
          
          <style>
            @keyframes pulse {
              0% { opacity: 1; }
              50% { opacity: 0.3; }
              100% { opacity: 1; }
            }
          </style>
        `;
        document.body.appendChild(ui);

        const startTime = Date.now();
        const timerInterval = setInterval(() => {
          const elapsed = Math.floor((Date.now() - startTime) / 1000);
          const mins = Math.floor(elapsed / 60);
          const secs = elapsed % 60;
          const timer = document.getElementById('recorder-timer');
          if (timer) {
            timer.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
          }
        }, 1000);

        const updateInterval = setInterval(() => {
          const actions = (window as any).__recordedActions || [];
          const actionCount = document.getElementById('action-count');
          const clickCount = document.getElementById('click-count');
          
          if (actionCount) actionCount.textContent = actions.length.toString();
          if (clickCount) {
            const clicks = actions.filter((a: any) => a.type === 'click').length;
            clickCount.textContent = clicks.toString();
          }
        }, 500);

        (window as any).__recorderIntervals = { timerInterval, updateInterval };

        document.getElementById('recorder-stop-btn')?.addEventListener('click', () => {
          const recordedActions = (window as any).__recordedActions || [];
          (window as any).__recordingStopped = true;
          (window as any).__recordingActive = false;
          
          if ((window as any).__recorderIntervals) {
            clearInterval((window as any).__recorderIntervals.timerInterval);
            clearInterval((window as any).__recorderIntervals.updateInterval);
          }
          
          const panel = document.getElementById('recorder-panel');
          if (panel) {
            panel.style.background = 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)';
            panel.innerHTML = `
              <div style="color: white; text-align: center; padding: 10px;">
                <div style="font-size: 24px; margin-bottom: 4px;">✓</div>
                <div style="font-size: 12px; font-weight: 600;">Recording Saved!</div>
                <div style="font-size: 10px; margin-top: 4px; opacity: 0.9;">
                  ${recordedActions.length} actions captured
                </div>
              </div>
            `;
          }
        });
      });

      const updateNetworkCount = setInterval(() => {
        if (!this.recording) {
          clearInterval(updateNetworkCount);
          return;
        }
        
        this.page.evaluate((count) => {
          const networkCount = document.getElementById('network-count');
          if (networkCount) {
            networkCount.textContent = count.toString();
          }
        }, this.networkRequests.length).catch(() => {});
      }, 1000);

    } catch (error) {
      console.log(chalk.gray('UI injection skipped'));
    }
  }

  async stopRecording(): Promise<Recording> {
    this.recording = false;
    
    if (this.stopCheckInterval) {
      clearInterval(this.stopCheckInterval);
      this.stopCheckInterval = null;
    }

    let pageActions: any[] = [];
    
    const frames = this.page.frames();
    for (const frame of frames) {
      try {
        const frameActions = await frame.evaluate(() => {
          return (window as any).__recordedActions || [];
        }) as any[];
        pageActions = pageActions.concat(frameActions);
      } catch {
        // Frame might be detached
      }
    }

    pageActions.sort((a: any, b: any) => a.timestamp - b.timestamp);

    pageActions.forEach((action: any) => {
      this.actions.push({
        id: uuidv4(),
        type: action.type,
        timestamp: action.timestamp - this.startTime,
        selector: action.selector,
        xpath: action.xpath,
        value: action.value,
        url: action.url,
        coordinates: action.coordinates,
        element: action.element,
        formData: action.formData,
        walletMethod: action.method,
        walletParams: action.params,
        isSwapAction: action.isSwapAction,
        isAmountInput: action.isAmountInput,
        eventDetails: action.eventDetails
      });
    });

    const duration = Date.now() - this.startTime;

    const walletActions: WalletAction[] = this.actions
      .filter(a => a.type === 'wallet')
      .map(a => ({
        type: 'transaction' as const,
        timestamp: a.timestamp,
        method: a.walletMethod,
        params: a.walletParams,
        details: {
          selector: a.selector,
          value: a.value
        }
      }));

    const framesInfo = await this.frameManager.getAllFramesInfo();

    console.log(chalk.yellow(`\n📊 Recording Summary:`));
    console.log(chalk.gray(`   • Total actions: ${this.actions.length}`));
    console.log(chalk.gray(`   • Swap actions: ${this.actions.filter(a => a.isSwapAction).length}`));
    console.log(chalk.gray(`   • Network requests: ${this.networkRequests.length}`));
    console.log(chalk.gray(`   • Duration: ${Math.round(duration / 1000)}s`));
    console.log(chalk.gray(`   • Frames detected: ${framesInfo.length}`));
    console.log(chalk.gray(`   • Wallet actions: ${walletActions.length}\n`));

    const recording: Recording = {
      id: this.recordingId,
      name: '',
      url: this.page.url(),
      createdAt: new Date().toISOString(),
      duration,
      actions: this.actions,
      networkRequests: this.networkRequests,
      walletActions: walletActions,
      metadata: {
        browser: 'Chrome',
        viewport: { width: 1366, height: 768 },
        hasWallet: await this.checkWallet(),
        frames: framesInfo
      }
    };

    // ADD DATA OPTIMIZATION HERE
    console.log(chalk.cyan('\n🔄 Optimizing recorded data...'));
    const optimizer = new DataOptimizer(recording);
    const optimizedData = await optimizer.optimize();
    
    // Save optimized data
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await optimizer.exportOptimizedData(`optimized_${timestamp}.json`);

    return recording;
  }

  async waitForStop(): Promise<void> {
    return new Promise((resolve) => {
      this.stopCheckInterval = setInterval(async () => {
        try {
          const stopped = await this.page.evaluate(() => {
            return (window as any).__recordingStopped === true;
          });

          if (stopped) {
            if (this.stopCheckInterval) {
              clearInterval(this.stopCheckInterval);
              this.stopCheckInterval = null;
            }
            await this.delay(500);
            resolve();
          }
        } catch (error) {
          if (!this.recording) {
            if (this.stopCheckInterval) {
              clearInterval(this.stopCheckInterval);
              this.stopCheckInterval = null;
            }
            resolve();
          }
        }
      }, 500);
    });
  }

  private async checkWallet(): Promise<boolean> {
    try {
      return await this.page.evaluate(() => {
        return typeof (window as any).ethereum !== 'undefined';
      });
    } catch {
      return false;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}