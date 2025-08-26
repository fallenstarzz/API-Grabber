/**
 * Storage utility for managing recordings
 */

import fs from 'fs/promises';
import path from 'path';
import { Recording } from '../types';

export class Storage {
  private recordingsDir: string;

  constructor() {
    this.recordingsDir = path.join(process.cwd(), 'recordings');
    this.ensureDirectoryExists();
  }

  private async ensureDirectoryExists(): Promise<void> {
    try {
      await fs.access(this.recordingsDir);
    } catch {
      await fs.mkdir(this.recordingsDir, { recursive: true });
    }
  }

  async saveRecording(recording: Recording): Promise<string> {
    const filename = `${recording.name}_${Date.now()}.json`;
    const filepath = path.join(this.recordingsDir, filename);
    
    await fs.writeFile(filepath, JSON.stringify(recording, null, 2));
    
    return filename;
  }

  async loadRecording(filename: string): Promise<Recording> {
    const filepath = path.join(this.recordingsDir, filename);
    const content = await fs.readFile(filepath, 'utf-8');
    return JSON.parse(content);
  }

  async listRecordings(): Promise<string[]> {
    const files = await fs.readdir(this.recordingsDir);
    return files.filter(f => f.endsWith('.json'));
  }

  async deleteRecording(filename: string): Promise<void> {
    const filepath = path.join(this.recordingsDir, filename);
    await fs.unlink(filepath);
  }

  async getRecordingInfo(filename: string): Promise<{
    name: string;
    size: number;
    created: Date;
    modified: Date;
  }> {
    const filepath = path.join(this.recordingsDir, filename);
    const stats = await fs.stat(filepath);
    const recording = await this.loadRecording(filename);
    
    return {
      name: recording.name,
      size: stats.size,
      created: new Date(stats.birthtime),
      modified: new Date(stats.mtime)
    };
  }
}

export default Storage;