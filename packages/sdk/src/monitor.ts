import { WsClient } from './client.js';
import { FileWatcher } from './watcher.js';

export interface MonitorOptions {
  root: string;
  include?: string[];
  exclude?: string[];
  serverUrl?: string;
}

const DEFAULT_INCLUDE = ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'];
const DEFAULT_EXCLUDE = ['**/node_modules/**', '**/dist/**', '**/.next/**'];

export function monitor(options: MonitorOptions): { stop: () => void } {
  const client = new WsClient(options.serverUrl);
  const watcher = new FileWatcher(
    {
      root: options.root,
      include: options.include ?? DEFAULT_INCLUDE,
      exclude: options.exclude ?? DEFAULT_EXCLUDE,
    },
    client,
  );

  return {
    stop() {
      watcher.stop();
      client.close();
    },
  };
}
