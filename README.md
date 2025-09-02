# @deblasis/glazewm-ipc-client

A TypeScript client for GlazeWM v3.x IPC (Inter-Process Communication). This package fills the gap left by the official `glazewm-js` package which doesn't support GlazeWM v3.x.

## Features

- 🚀 **GlazeWM v3.x Compatible**: Works with the latest GlazeWM IPC protocol
- 📦 **TypeScript Support**: Full TypeScript definitions and intellisense
- 🔌 **WebSocket IPC**: Direct communication with GlazeWM's IPC server
- 🛠️ **Query Operations**: Query monitors, workspaces, windows, and focused containers
- ⚡ **Command Execution**: Run GlazeWM window management commands
- 🔄 **Connection Management**: Robust connection handling with timeouts and error recovery

## Installation

```bash
npm install @deblasis/glazewm-ipc-client
# or
pnpm add @deblasis/glazewm-ipc-client
# or
yarn add @deblasis/glazewm-ipc-client
```

## Quick Start

```typescript
import { WmClient, WmEventType, checkGlazeWMRunning } from '@deblasis/glazewm-ipc-client';

// Check if GlazeWM is running
const isRunning = await checkGlazeWMRunning();
if (!isRunning) {
  console.error('GlazeWM is not running');
  process.exit(1);
}

// Create client (auto-connects by default)
const client = new WmClient();

// Event handlers (same as official glazewm-js)
client.onConnect(() => console.log('✅ Connected to GlazeWM!'));
client.onDisconnect(() => console.log('❌ Disconnected from GlazeWM!'));
client.onError((error) => console.error('🔥 Connection error:', error));

// Subscribe to events
await client.subscribe(WmEventType.FOCUS_CHANGED, (event) => {
  console.log('🎯 Focus changed:', event.focusedContainer);
});

await client.subscribeMany(
  [WmEventType.WORKSPACE_ACTIVATED, WmEventType.WORKSPACE_DEACTIVATED],
  (event) => console.log('🏢 Workspace event:', event)
);

try {
  // Query current state (same API as official package)
  const monitors = await client.queryMonitors();
  const workspaces = await client.queryWorkspaces();
  const windows = await client.queryWindows();
  const focused = await client.queryFocused();

  console.log('📺 Monitors:', monitors);
  console.log('🖥️ Workspaces:', workspaces);
  console.log('🪟 Windows:', windows);
  console.log('🎯 Focused:', focused);

  // Run commands (same as official package)
  await client.runCommand('focus --workspace 1');
  await client.runCommand('move --direction left', windows[0]?.id);

} finally {
  // Always disconnect
  client.disconnect();
}
```

## API Reference

### WmClient

#### Constructor Options

```typescript
interface WmClientOptions {
  port?: number;       // IPC port (default: 6123)
  timeout?: number;    // Request timeout in ms (default: 10000)
  autoConnect?: boolean; // Auto-connect on instantiation (default: true)
}

const client = new WmClient({
  port: 6123,
  timeout: 5000,
  autoConnect: true // Can be disabled via env var GLAZEWm_DISABLE_AUTO_CONNECT=true
});
```

#### Methods

##### Connection Management

- `connect(): Promise<void>` - Connect to GlazeWM IPC
- `disconnect(): void` - Disconnect from GlazeWM IPC
- `isConnected(): boolean` - Check connection status

##### Event Handling (NEW - matches official glazewm-js)

- `onConnect(handler: () => void): void` - Register connection handler
- `onDisconnect(handler: () => void): void` - Register disconnection handler
- `onError(handler: (error: any) => void): void` - Register error handler

##### Event Subscription (NEW - matches official glazewm-js)

- `subscribe(eventType, handler): Promise<void>` - Subscribe to single event
- `subscribeMany(eventTypes, handler): Promise<void>` - Subscribe to multiple events
- `unsubscribe(eventType, handler): void` - Unsubscribe from event
- `unsubscribeAll(): void` - Unsubscribe from all events

##### Event Types

```typescript
enum WmEventType {
  FOCUS_CHANGED = 'focus_changed',
  WORKSPACE_ACTIVATED = 'workspace_activated',
  WORKSPACE_DEACTIVATED = 'workspace_deactivated',
  WINDOW_MANAGED = 'window_managed',
  WINDOW_UNMANAGED = 'window_unmanaged',
  MONITOR_ADDED = 'monitor_added',
  MONITOR_REMOVED = 'monitor_removed'
}
```

##### Query Methods

- `queryMonitors(): Promise<GlazeWMMonitor[]>` - Get monitor information
- `queryWorkspaces(): Promise<GlazeWMWorkspace[]>` - Get workspace information
- `queryWindows(): Promise<GlazeWMWindow[]>` - Get window information
- `queryFocused(): Promise<GlazeWMFocusedContainer>` - Get focused container

##### Command Execution

- `runCommand(command: string, subject?: string): Promise<any>` - Execute WM command

### Utility Functions

- `checkGlazeWMRunning(): Promise<boolean>` - Check if GlazeWM process is running (Windows)
- `testDirectWebSocketConnection(port?: number): Promise<void>` - Test WebSocket connection

## Type Definitions

```typescript
interface GlazeWMMonitor {
  id: string;
  name: string;
  width: number;
  height: number;
  x: number;
  y: number;
  isPrimary: boolean;
}

interface GlazeWMWorkspace {
  id: string;
  name: string;
  displayName?: string;
  monitorId?: string;
  isDisplayed: boolean;
  isFocused: boolean;
}

interface GlazeWMWindow {
  id: string;
  processName: string;
  title: string;
  className?: string;
  parentId?: string;
  hasFocus: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface GlazeWMFocusedContainer {
  id: string;
  type: string;
  children?: any[];
  windows?: GlazeWMWindow[];
}
```

## Command Examples

```typescript
// Focus workspace
await client.runCommand('focus --workspace 1');

// Move window to workspace
await client.runCommand('move --workspace 2', 'window-id');

// Toggle maximize
await client.runCommand('toggle-maximized');

// Close window
await client.runCommand('close');
```

## Error Handling

```typescript
try {
  await client.connect();
  const monitors = await client.queryMonitors();
} catch (error) {
  if (error.message.includes('timeout')) {
    console.error('Connection timeout - ensure GlazeWM is running');
  } else if (error.message.includes('connect')) {
    console.error('Failed to connect - check IPC port and GlazeWM status');
  } else {
    console.error('IPC error:', error.message);
  }
} finally {
  client.disconnect();
}
```

## Requirements

- **Node.js**: >= 18.0.0
- **GlazeWM**: v3.x with IPC enabled
- **OS**: Windows (currently optimized for Windows, but WebSocket protocol should work cross-platform)

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm run build

# Development with watch mode
pnpm run dev

# Clean build artifacts
pnpm run clean
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Why This Package Exists

The official `glazewm-js` package only supports GlazeWM v2.x and earlier. GlazeWM v3.x introduced breaking changes to the IPC protocol that made the existing client incompatible. This package implements the new protocol while maintaining a similar API for easy migration.

## License

MIT License - see LICENSE file for details.

## Related Projects

- [GlazeWM](https://github.com/glzr-io/glazewm) - The window manager
- [glazewm-js](https://github.com/glzr-io/glazewm-js) - Official TypeScript client (v2.x only)
- [glazewm-query](https://github.com/alessandrodblasis/glazewm-query) - CLI tool built on this client
