import chokidar from 'chokidar';
import path from 'node:path';
import type { FunctionInfo } from '@agent-monitor/types';
import { parseFile } from './parser.js';
import { normalizePath } from './utils.js';
import type { WsClient } from './client.js';

export interface WatcherOptions {
  root: string;
  include: string[];
  exclude: string[];
}

export class FileWatcher {
  private watcher: chokidar.FSWatcher | null = null;
  private fileFunctions = new Map<string, FunctionInfo[]>();
  private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private client: WsClient;
  private options: WatcherOptions;

  constructor(options: WatcherOptions, client: WsClient) {
    this.options = options;
    this.client = client;
    this.start();
  }

  private start(): void {
    this.watcher = chokidar.watch(this.options.include, {
      cwd: this.options.root,
      ignored: this.options.exclude,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50,
      },
    });

    this.watcher.on('add', (rel) => this.debouncedHandle(rel));
    this.watcher.on('change', (rel) => this.debouncedHandle(rel));
    this.watcher.on('unlink', (rel) => this.handleRemove(rel));
  }

  private debouncedHandle(relativePath: string): void {
    const existing = this.debounceTimers.get(relativePath);
    if (existing) clearTimeout(existing);

    this.debounceTimers.set(
      relativePath,
      setTimeout(() => {
        this.debounceTimers.delete(relativePath);
        void this.handleFileChange(relativePath);
      }, 150),
    );
  }

  private async handleFileChange(relativePath: string): Promise<void> {
    const absPath = normalizePath(path.join(this.options.root, relativePath));
    let newFunctions: FunctionInfo[];
    try {
      newFunctions = await parseFile(absPath);
    } catch {
      return; // Skip unparseable files
    }

    const prev = this.fileFunctions.get(absPath);
    const prevById = new Map<string, FunctionInfo>();
    if (prev) {
      for (const fn of prev) {
        prevById.set(fn.id, fn);
      }
    }

    const newById = new Map<string, FunctionInfo>();
    for (const fn of newFunctions) {
      newById.set(fn.id, fn);
    }

    // Discovered: in new but not in prev
    for (const fn of newFunctions) {
      if (!prevById.has(fn.id)) {
        this.client.send({ type: 'function-discovered', payload: fn });
      } else {
        // Updated: exists in both, check if changed
        const old = prevById.get(fn.id)!;
        if (
          old.sourcePreview !== fn.sourcePreview ||
          old.jsdoc !== fn.jsdoc ||
          old.returnType !== fn.returnType ||
          old.params.length !== fn.params.length
        ) {
          this.client.send({ type: 'function-updated', payload: fn });
        }
      }
    }

    // Removed: in prev but not in new
    if (prev) {
      for (const fn of prev) {
        if (!newById.has(fn.id)) {
          this.client.send({ type: 'function-removed', payload: { id: fn.id } });
        }
      }
    }

    this.fileFunctions.set(absPath, newFunctions);
  }

  private handleRemove(relativePath: string): void {
    const absPath = normalizePath(path.join(this.options.root, relativePath));
    const prev = this.fileFunctions.get(absPath);
    if (prev) {
      for (const fn of prev) {
        this.client.send({ type: 'function-removed', payload: { id: fn.id } });
      }
      this.fileFunctions.delete(absPath);
    }
  }

  stop(): void {
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
    if (this.watcher) {
      void this.watcher.close();
      this.watcher = null;
    }
  }
}
