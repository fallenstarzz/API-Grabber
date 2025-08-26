import type { Page, Frame } from 'puppeteer';
import chalk from 'chalk';

export class FrameManager {
  private page: Page;
  private currentFrame: Frame | Page;
  private frameHierarchy: Map<string, Frame> = new Map();

  constructor(page: Page) {
    this.page = page;
    this.currentFrame = page;
    this.initializeFrameTracking();
  }

  private initializeFrameTracking(): void {
    this.page.on('frameattached', (frame) => {
      console.log(chalk.cyan(`📄 Frame attached: ${frame.url().substring(0, 50)}...`));
      this.updateFrameHierarchy();
    });

    this.page.on('framedetached', (frame) => {
      console.log(chalk.gray(`📄 Frame detached: ${frame.url().substring(0, 50)}...`));
      this.frameHierarchy.delete(frame.url());
    });

    this.page.on('framenavigated', (frame) => {
      if (frame !== this.page.mainFrame()) {
        console.log(chalk.blue(`📄 Frame navigated: ${frame.url().substring(0, 50)}...`));
        this.updateFrameHierarchy();
      }
    });
  }

  private async updateFrameHierarchy(): Promise<void> {
    this.frameHierarchy.clear();
    
    const frames = this.page.frames();
    for (const frame of frames) {
      if (frame !== this.page.mainFrame()) {
        this.frameHierarchy.set(frame.url(), frame);
      }
    }

    console.log(chalk.gray(`Total frames: ${frames.length}`));
  }

  async detectFrameContext(selector: string): Promise<Frame | Page> {
    try {
      const element = await this.page.$(selector);
      if (element) {
        return this.page;
      }
    } catch {}

    for (const frame of this.page.frames()) {
      if (frame === this.page.mainFrame()) continue;
      
      try {
        const element = await frame.$(selector);
        if (element) {
          console.log(chalk.magenta(`🔄 Switching to frame: ${frame.url().substring(0, 50)}...`));
          this.currentFrame = frame;
          return frame;
        }
      } catch {}
    }

    return this.page;
  }

  async executeInCorrectFrame(selector: string, action: () => Promise<any>): Promise<any> {
    const frame = await this.detectFrameContext(selector);
    this.currentFrame = frame;
    
    if (frame !== this.page) {
      console.log(chalk.magenta('📄 Executing in iframe context'));
    }

    return await action();
  }

  getCurrentFrame(): Frame | Page {
    return this.currentFrame;
  }

  async getAllFramesInfo(): Promise<any[]> {
    const frames = this.page.frames();
    const framesInfo = [];

    for (const frame of frames) {
      try {
        const info = await frame.evaluate(() => {
          return {
            url: window.location.href,
            title: document.title,
            hasWallet: typeof (window as any).ethereum !== 'undefined',
            elementCount: document.querySelectorAll('*').length
          };
        });

        framesInfo.push({
          ...info,
          isMainFrame: frame === this.page.mainFrame(),
          name: frame.name()
        });
      } catch {
        framesInfo.push({
          url: frame.url(),
          isMainFrame: frame === this.page.mainFrame(),
          error: true
        });
      }
    }

    return framesInfo;
  }

  async switchToMainFrame(): Promise<void> {
    this.currentFrame = this.page;
    console.log(chalk.gray('📄 Switched to main frame'));
  }

  async findFrameByUrl(urlPattern: string): Promise<Frame | null> {
    const frames = this.page.frames();
    
    for (const frame of frames) {
      if (frame.url().includes(urlPattern)) {
        return frame;
      }
    }

    return null;
  }

  async waitForFrame(urlPattern: string, timeout: number = 5000): Promise<Frame | null> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const frame = await this.findFrameByUrl(urlPattern);
      if (frame) {
        console.log(chalk.green(`✅ Frame found: ${urlPattern}`));
        return frame;
      }
      await this.delay(100);
    }

    console.log(chalk.yellow(`⚠️ Frame not found: ${urlPattern}`));
    return null;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}