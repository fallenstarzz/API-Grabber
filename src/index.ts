import { BrowserManager } from './core/BrowserManager.js';
import { RecorderEngine } from './recorder/RecorderEngine.js';
import { Logger } from './utils/Logger.js';
import { Storage } from './utils/Storage.js';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';

class SwapRecorderBot {
  private browserManager: BrowserManager;
  private recorder: RecorderEngine | null = null;
  private logger: Logger;
  private storage: Storage;

  constructor() {
    this.browserManager = new BrowserManager();
    this.logger = new Logger('Main');
    this.storage = new Storage();
  }

  async start(): Promise<void> {
    console.clear();
    console.log(chalk.cyan.bold(`
╔══════════════════════════════════════╗
║                                      ║
║    🤖 SWAP RECORDER BOT v3.0         ║
║    Enhanced Edition                  ║
║    By @fallenstarzz                  ║
║                                      ║
╚══════════════════════════════════════╝
    `));

    try {
      // Launch browser
      const spinner = ora('Initializing browser...').start();
      const page = await this.browserManager.launch();
      spinner.succeed('Browser launched successfully');

      // Initialize recorder
      this.recorder = new RecorderEngine(page);

      // Check if first run
      if (this.browserManager.isFirstTimeRun()) {
        await this.firstTimeSetup(page);
      }

      // Main menu loop
      await this.showMainMenu();

    } catch (error) {
      this.logger.error('Fatal error:', error);
      process.exit(1);
    }
  }

  private async firstTimeSetup(page: any): Promise<void> {
    console.log(chalk.yellow('\n🎉 Welcome to Enhanced Swap Recorder Bot!\n'));
    console.log(chalk.gray('This appears to be your first time running the bot.'));
    console.log(chalk.gray('Let\'s set up MetaMask extension for wallet operations.\n'));

    const { setupNow } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'setupNow',
        message: 'Would you like to install MetaMask now?',
        default: true
      }
    ]);

    if (setupNow) {
      await this.browserManager.installMetaMask(page);
      
      await inquirer.prompt([
        {
          type: 'confirm',
          name: 'done',
          message: 'Press Enter when MetaMask is installed and configured',
          default: true
        }
      ]);

      // Verify installation
      const spinner = ora('Verifying MetaMask installation...').start();
      const hasMetaMask = await this.browserManager.checkMetaMask(page);
      
      if (hasMetaMask) {
        spinner.succeed('MetaMask installed successfully!');
        console.log(chalk.green('\n✅ Setup complete! Your wallet is ready.\n'));
      } else {
        spinner.warn('MetaMask not detected yet');
        console.log(chalk.yellow('You can install it later from the main menu.\n'));
      }
    }
  }

  private async showMainMenu(): Promise<void> {
    while (true) {
      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'What would you like to do?',
          choices: [
            { name: '🎬 Record New Swap', value: 'record' },
            { name: '🔍 Pre-Swap Analysis', value: 'analyze' },
            { name: '💰 Check Balance & Chain', value: 'balance' },
            { name: '⚙️  Swap Settings', value: 'settings' },
            { name: '📋 View Recordings', value: 'view' },
            { name: '🗑️  Delete Recording', value: 'delete' },
            { name: '🔧 Advanced Settings', value: 'advanced' },
            { name: '❌ Exit', value: 'exit' }
          ]
        }
      ]);

      switch (action) {
        case 'record':
          await this.recordSwap();
          break;
        case 'analyze':
          await this.preSwapAnalysis();
          break;
        case 'balance':
          await this.checkBalanceAndChain();
          break;
        case 'settings':
          await this.showSwapSettings();
          break;
        case 'view':
          await this.viewRecordings();
          break;
        case 'delete':
          await this.deleteRecording();
          break;
        case 'advanced':
          await this.showAdvancedSettings();
          break;
        case 'exit':
          await this.exit();
          return;
      }
    }
  }

  private async recordSwap(): Promise<void> {
    const page = this.browserManager.getPage();
    if (!page || !this.recorder) {
      this.logger.error('Browser or recorder not initialized');
      return;
    }

    const { url, name } = await inquirer.prompt([
      {
        type: 'input',
        name: 'url',
        message: 'Enter DEX URL:',
        default: 'https://testnet.euclidswap.io/swap'
      },
      {
        type: 'input',
        name: 'name',
        message: 'Recording name:',
        default: `swap-${new Date().toISOString().split('T')[0]}`
      }
    ]);

    try {
      // Navigate to DEX
      await this.browserManager.navigateTo(url);

      // NEW: Enhanced pre-recording checks
      await this.performPreRecordingChecks(page);

      // Start recording
      await this.recorder.startRecording(name, url);
      
      console.log(chalk.yellow('👆 Click the STOP button when you\'re done recording\n'));
      console.log(chalk.gray('Tips:'));
      console.log(chalk.gray('  • All clicks and inputs are being recorded'));
      console.log(chalk.gray('  • You can pause/resume recording'));
      console.log(chalk.gray('  • Wallet interactions are captured automatically'));
      console.log(chalk.gray('  • Balance and chain info are monitored\n'));

      // Wait for user to stop
      await this.recorder.waitForStop();

      // Stop and get recording
      const recording = await this.recorder.stopRecording();
      recording.name = name;

      // Save recording
      const filename = await this.storage.saveRecording(recording);
      console.log(chalk.green(`\n✅ Recording saved: ${filename}\n`));

    } catch (error) {
      this.logger.error('Recording error:', error);
    }
  }

  // NEW: Pre-recording analysis
  private async performPreRecordingChecks(page: any): Promise<void> {
    console.log(chalk.cyan('\n🔍 Performing pre-recording analysis...\n'));
    
    try {
      // Check wallet
      const hasWallet = await this.browserManager.checkMetaMask(page);
      if (hasWallet) {
        console.log(chalk.green('✅ MetaMask detected on page\n'));
      } else {
        console.log(chalk.yellow('⚠️  MetaMask not detected - Recording anyway\n'));
      }

      // Detect chain info
      const chainInfo = await this.browserManager.detectChainInfo();
      if (chainInfo) {
        console.log(chalk.green(`✅ Chain: ${chainInfo.network} (${chainInfo.chainId})`));
        console.log(chalk.gray(`   Gas Price: ${chainInfo.gasPrice} wei`));
        console.log(chalk.gray(`   Block Time: ${chainInfo.blockTime}s\n`));
      }

      // Get balance info
      const balanceInfo = await this.browserManager.getBalanceInfo();
      if (balanceInfo) {
        console.log(chalk.green(`✅ Wallet: ${balanceInfo.address.substring(0, 8)}...`));
        console.log(chalk.gray(`   Balance: ${balanceInfo.nativeBalance} wei\n`));
      }

      // Get swap settings
      const swapSettings = await this.browserManager.getSwapSettings();
      if (swapSettings) {
        console.log(chalk.green(`✅ Swap Settings:`));
        console.log(chalk.gray(`   Slippage: ${swapSettings.slippage}%`));
        console.log(chalk.gray(`   Gas: ${swapSettings.gasSettings.gasLimit}\n`));
      }

    } catch (error) {
      console.warn(chalk.yellow('⚠️  Pre-recording checks failed, continuing anyway:'), error);
    }
  }

  // NEW: Pre-swap analysis
  private async preSwapAnalysis(): Promise<void> {
    const page = this.browserManager.getPage();
    if (!page) {
      console.log(chalk.red('❌ Browser not initialized'));
      return;
    }

    console.log(chalk.cyan('\n🔍 Pre-Swap Analysis\n'));

    try {
      // Get current page info
      const currentUrl = page.url();
      console.log(chalk.gray(`Current URL: ${currentUrl}\n`));

      // Detect chain
      const chainInfo = await this.browserManager.detectChainInfo();
      if (chainInfo) {
        console.log(chalk.green('🌐 Chain Information:'));
        console.log(chalk.gray(`   Network: ${chainInfo.network}`));
        console.log(chalk.gray(`   Chain ID: ${chainInfo.chainId}`));
        console.log(chalk.gray(`   RPC: ${chainInfo.rpc}`));
        console.log(chalk.gray(`   Gas Price: ${chainInfo.gasPrice} wei`));
        console.log(chalk.gray(`   Block Time: ${chainInfo.blockTime}s\n`));
      }

      // Check balance
      const balanceInfo = await this.browserManager.getBalanceInfo();
      if (balanceInfo) {
        console.log(chalk.green('💰 Balance Information:'));
        console.log(chalk.gray(`   Address: ${balanceInfo.address}`));
        console.log(chalk.gray(`   Native Balance: ${balanceInfo.nativeBalance} wei`));
        console.log(chalk.gray(`   Last Updated: ${new Date(balanceInfo.timestamp).toLocaleString()}\n`));
      }

      // Get swap settings
      const swapSettings = await this.browserManager.getSwapSettings();
      if (swapSettings) {
        console.log(chalk.green('⚙️  Swap Settings:'));
        console.log(chalk.gray(`   Slippage: ${swapSettings.slippage}%`));
        console.log(chalk.gray(`   Gas Limit: ${swapSettings.gasSettings.gasLimit}`));
        console.log(chalk.gray(`   Gas Price: ${swapSettings.gasSettings.gasPrice}\n`));
      }

      // Estimate gas
      const gasPrice = await this.browserManager.estimateGasPrice();
      console.log(chalk.green('⛽ Gas Information:'));
      console.log(chalk.gray(`   Current Gas Price: ${gasPrice} wei`));
      console.log(chalk.gray(`   Estimated Cost: Calculating...\n`));

    } catch (error) {
      console.error(chalk.red('❌ Analysis failed:'), error);
    }
  }

  // NEW: Balance and chain checking
  private async checkBalanceAndChain(): Promise<void> {
    const page = this.browserManager.getPage();
    if (!page) {
      console.log(chalk.red('❌ Browser not initialized'));
      return;
    }

    console.log(chalk.cyan('\n💰 Balance & Chain Check\n'));

    try {
      // Check wallet connection
      const hasWallet = await this.browserManager.checkMetaMask(page);
      if (!hasWallet) {
        console.log(chalk.red('❌ MetaMask not detected'));
        console.log(chalk.yellow('Please connect MetaMask first\n'));
        return;
      }

      // Get detailed balance info
      const balanceInfo = await this.browserManager.getBalanceInfo();
      if (balanceInfo) {
        console.log(chalk.green('✅ Wallet Connected:'));
        console.log(chalk.gray(`   Address: ${balanceInfo.address}`));
        console.log(chalk.gray(`   Balance: ${balanceInfo.nativeBalance} wei`));
        
        // Convert to ETH
        const ethBalance = this.weiToEth(balanceInfo.nativeBalance);
        console.log(chalk.green(`   ETH Balance: ${ethBalance} ETH\n`));
      }

      // Get chain info
      const chainInfo = await this.browserManager.detectChainInfo();
      if (chainInfo) {
        console.log(chalk.green('🌐 Network Information:'));
        console.log(chalk.gray(`   Network: ${chainInfo.network}`));
        console.log(chalk.gray(`   Chain ID: ${chainInfo.chainId}`));
        console.log(chalk.gray(`   RPC: ${chainInfo.rpc}`));
        console.log(chalk.gray(`   Gas Price: ${chainInfo.gasPrice} wei`));
        console.log(chalk.gray(`   Block Time: ${chainInfo.blockTime}s\n`));
      }

      // Check if we're on a testnet
      if (chainInfo && this.isTestnet(chainInfo.chainId)) {
        console.log(chalk.yellow('⚠️  Testnet Detected:'));
        console.log(chalk.gray('   This is a test network. Make sure you have test tokens!\n'));
      }

    } catch (error) {
      console.error(chalk.red('❌ Balance check failed:'), error);
    }
  }

  // NEW: Swap settings management
  private async showSwapSettings(): Promise<void> {
    const page = this.browserManager.getPage();
    if (!page) {
      console.log(chalk.red('❌ Browser not initialized'));
      return;
    }

    console.log(chalk.cyan('\n⚙️  Swap Settings\n'));

    try {
      // Get current settings
      const swapSettings = await this.browserManager.getSwapSettings();
      if (swapSettings) {
        console.log(chalk.green('Current Settings:'));
        console.log(chalk.gray(`   Slippage: ${swapSettings.slippage}%`));
        console.log(chalk.gray(`   Gas Limit: ${swapSettings.gasSettings.gasLimit}`));
        console.log(chalk.gray(`   Gas Price: ${swapSettings.gasSettings.gasPrice}\n`));
      }

      // Get gas price
      const gasPrice = await this.browserManager.estimateGasPrice();
      console.log(chalk.green('Gas Information:'));
      console.log(chalk.gray(`   Current Gas Price: ${gasPrice} wei`));
      console.log(chalk.gray(`   Network: ${await this.getCurrentNetwork()}\n`));

      // Settings menu
      const { setting } = await inquirer.prompt([
        {
          type: 'list',
          name: 'setting',
          message: 'Choose a setting to modify:',
          choices: [
            { name: '🔐 Check MetaMask Status', value: 'metamask' },
            { name: '🌐 Test Navigation', value: 'navigate' },
            { name: '📁 Open Recordings Folder', value: 'folder' },
            { name: '🔙 Back', value: 'back' }
          ]
        }
      ]);

      if (setting === 'metamask') {
        const spinner = ora('Checking MetaMask...').start();
        const hasMetaMask = await this.browserManager.checkMetaMask(page);
        
        if (hasMetaMask) {
          spinner.succeed('MetaMask is installed and active');
        } else {
          spinner.fail('MetaMask not detected');
          
          const { install } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'install',
              message: 'Install MetaMask now?',
              default: true
            }
          ]);

          if (install) {
            await this.browserManager.installMetaMask(page);
          }
        }
      } else if (setting === 'navigate') {
        const { url } = await inquirer.prompt([
          {
            type: 'input',
            name: 'url',
            message: 'Enter URL to test:',
            default: 'https://example.com'
          }
        ]);

        await this.browserManager.navigateTo(url);
      } else if (setting === 'folder') {
        console.log(chalk.cyan(`\n📁 Recordings are saved in:`));
        console.log(chalk.gray(`   ${process.cwd()}\\recordings\n`));
      }
    } catch (error) {
      console.error(chalk.red('❌ Settings error:'), error);
    }
  }

  // NEW: Advanced settings
  private async showAdvancedSettings(): Promise<void> {
    console.log(chalk.cyan('\n🔧 Advanced Settings\n'));

    const { setting } = await inquirer.prompt([
      {
        type: 'list',
        name: 'setting',
        message: 'Choose advanced setting:',
        choices: [
          { name: '🧹 Memory Cleanup', value: 'memory' },
          { name: '📊 Performance Stats', value: 'stats' },
          { name: '🔍 Debug Mode', value: 'debug' },
          { name: '🔙 Back', value: 'back' }
        ]
      }
    ]);

    if (setting === 'memory') {
      await this.performMemoryCleanup();
    } else if (setting === 'stats') {
      await this.showPerformanceStats();
    } else if (setting === 'debug') {
      await this.toggleDebugMode();
    }
  }

  // NEW: Memory cleanup
  private async performMemoryCleanup(): Promise<void> {
    console.log(chalk.yellow('\n🧹 Performing Memory Cleanup...\n'));
    
    try {
      await this.browserManager.cleanupMemory();
      console.log(chalk.green('✅ Memory cleanup completed\n'));
    } catch (error) {
      console.error(chalk.red('❌ Memory cleanup failed:'), error);
    }
  }

  // NEW: Performance stats
  private async showPerformanceStats(): Promise<void> {
    console.log(chalk.cyan('\n📊 Performance Statistics\n'));
    
    try {
      const memoryUsage = this.browserManager.getMemoryUsage();
      console.log(chalk.green('Memory Usage:'));
      console.log(chalk.gray(`   Actions: ${memoryUsage.actions}`));
      console.log(chalk.gray(`   Network: ${memoryUsage.network}`));
      console.log(chalk.gray(`   Last Cleanup: ${new Date(memoryUsage.lastCleanup).toLocaleString()}\n`));
      
      // Browser info
      const browser = this.browserManager.getBrowser();
      if (browser) {
        const pages = await browser.pages();
        console.log(chalk.green('Browser Info:'));
        console.log(chalk.gray(`   Active Pages: ${pages.length}`));
        console.log(chalk.gray(`   Process ID: ${browser.process()?.pid || 'Unknown'}\n`));
      }
    } catch (error) {
      console.error(chalk.red('❌ Failed to get stats:'), error);
    }
  }

  // NEW: Debug mode toggle
  private async toggleDebugMode(): Promise<void> {
    console.log(chalk.cyan('\n🔍 Debug Mode\n'));
    
    const { enable } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'enable',
        message: 'Enable debug mode? (More verbose logging)',
        default: false
      }
    ]);

    if (enable) {
      console.log(chalk.green('✅ Debug mode enabled'));
      console.log(chalk.gray('   More detailed logging will be shown\n'));
    } else {
      console.log(chalk.yellow('⚠️  Debug mode disabled'));
      console.log(chalk.gray('   Standard logging mode\n'));
    }
  }

  private async viewRecordings(): Promise<void> {
    const spinner = ora('Loading recordings...').start();
    
    try {
      const recordings = await this.storage.listRecordings();
      spinner.stop();

      if (recordings.length === 0) {
        console.log(chalk.yellow('\n📭 No recordings found yet.\n'));
        return;
      }

      console.log(chalk.cyan(`\n📋 Found ${recordings.length} recording(s):\n`));
      
      for (const file of recordings) {
        try {
          const recording = await this.storage.loadRecording(file);
          console.log(chalk.white(`  📹 ${recording.name}`));
          console.log(chalk.gray(`     File: ${file}`));
          console.log(chalk.gray(`     Date: ${new Date(recording.createdAt).toLocaleString()}`));
          console.log(chalk.gray(`     Actions: ${recording.actions.length}`));
          console.log(chalk.gray(`     Duration: ${Math.round(recording.duration / 1000)}s`));
          console.log(chalk.gray(`     Network Requests: ${recording.networkRequests.length}`));
          console.log(chalk.gray(`     Wallet Actions: ${recording.walletActions.length}\n`));
        } catch {
          console.log(chalk.gray(`  ⚠️  ${file} (corrupted)\n`));
        }
      }

    } catch (error) {
      spinner.fail('Failed to load recordings');
      this.logger.error('Error:', error);
    }
  }

  private async deleteRecording(): Promise<void> {
    const recordings = await this.storage.listRecordings();
    
    if (recordings.length === 0) {
      console.log(chalk.yellow('\n📭 No recordings to delete.\n'));
      return;
    }

    // Create choices array properly
    const choices = recordings.map(file => ({ name: file, value: file }));
    choices.push({ name: '🔙 Cancel', value: 'cancel' });

    const { file } = await inquirer.prompt({
      type: 'list',
      name: 'file',
      message: 'Select recording to delete:',
      choices: choices
    });

    if (file === 'cancel') return;

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `Delete ${file}?`,
        default: false
      }
    ]);

    if (confirm) {
      await this.storage.deleteRecording(file);
      console.log(chalk.green(`\n✅ Deleted: ${file}\n`));
    }
  }

  private async exit(): Promise<void> {
    console.log(chalk.yellow('\n👋 Closing browser...\n'));
    
    await this.browserManager.close();
    
    console.log(chalk.green('✅ Thanks for using Enhanced Swap Recorder Bot!\n'));
    process.exit(0);
  }

  // Helper methods
  private weiToEth(wei: string): string {
    try {
      const weiNum = parseInt(wei, 16);
      const eth = weiNum / Math.pow(10, 18);
      return eth.toFixed(6);
    } catch {
      return '0';
    }
  }

  private isTestnet(chainId: string): boolean {
    const testnetIds = ['0x3', '0x4', '0x5', '0x2a', '0x13881', '0x61', '0x1a4', '0x66eed'];
    return testnetIds.includes(chainId);
  }

  private async getCurrentNetwork(): Promise<string> {
    try {
      const page = this.browserManager.getPage();
      if (!page) return 'Unknown';
      
      const network = await page.evaluate(() => {
        if (typeof (window as any).ethereum !== 'undefined') {
          return (window as any).ethereum.networkVersion || 'Unknown';
        }
        return 'Unknown';
      });
      
      return network;
    } catch {
      return 'Unknown';
    }
  }
}

// Start the bot
const bot = new SwapRecorderBot();
bot.start().catch(console.error);