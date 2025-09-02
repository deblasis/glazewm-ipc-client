// WebSocket support for Node.js
import WebSocket from "ws";

/**
 * GlazeWM IPC Client for v3.x
 *
 * This package provides a TypeScript client for communicating with GlazeWM v3.x
 * via its IPC (Inter-Process Communication) interface.
 *
 * @example
 * ```typescript
 * import { WmClient } from '@deblasis/glazewm-ipc-client';
 *
 * const client = new WmClient();
 *
 * // Listen for events
 * client.onConnect(() => console.log('Connected!'));
 * client.onDisconnect(() => console.log('Disconnected!'));
 *
 * // Auto-connects by default, or manually:
 * await client.connect();
 *
 * const monitors = await client.queryMonitors();
 * const workspaces = await client.queryWorkspaces();
 *
 * client.disconnect();
 * ```
 */

// Event Types and Interfaces (matching official glazewm-js API)
export enum WmEventType {
  FOCUS_CHANGED = "focus_changed",
  WORKSPACE_ACTIVATED = "workspace_activated",
  WORKSPACE_DEACTIVATED = "workspace_deactivated",
  WINDOW_MANAGED = "window_managed",
  WINDOW_UNMANAGED = "window_unmanaged",
  MONITOR_ADDED = "monitor_added",
  MONITOR_REMOVED = "monitor_removed",
}

export interface WmEvent {
  type: WmEventType;
  timestamp: number;
}

export interface FocusChangedEvent extends WmEvent {
  type: WmEventType.FOCUS_CHANGED;
  focusedContainer: any;
  previousContainer?: any;
}

export interface WorkspaceActivatedEvent extends WmEvent {
  type: WmEventType.WORKSPACE_ACTIVATED;
  activatedWorkspace: any;
}

export interface WorkspaceDeactivatedEvent extends WmEvent {
  type: WmEventType.WORKSPACE_DEACTIVATED;
  deactivatedWorkspace: any;
}

export interface WindowManagedEvent extends WmEvent {
  type: WmEventType.WINDOW_MANAGED;
  managedWindow: any;
}

export interface WindowUnmanagedEvent extends WmEvent {
  type: WmEventType.WINDOW_UNMANAGED;
  unmanagedWindow: any;
}

export interface MonitorAddedEvent extends WmEvent {
  type: WmEventType.MONITOR_ADDED;
  addedMonitor: any;
}

export interface MonitorRemovedEvent extends WmEvent {
  type: WmEventType.MONITOR_REMOVED;
  removedMonitor: any;
}

export type WmEventUnion =
  | FocusChangedEvent
  | WorkspaceActivatedEvent
  | WorkspaceDeactivatedEvent
  | WindowManagedEvent
  | WindowUnmanagedEvent
  | MonitorAddedEvent
  | MonitorRemovedEvent;

// Core IPC Protocol Types
export interface GlazeWMIPCMessage {
  type: string;
  data?: any;
}

export interface GlazeWMIPCResponse {
  success: boolean;
  data?: any;
  error?: string;
}

// GlazeWM State Types
export interface GlazeWMMonitor {
  id: string;
  name: string;
  width: number;
  height: number;
  x: number;
  y: number;
  isPrimary: boolean;
}

export interface GlazeWMWorkspace {
  id: string;
  name: string;
  displayName?: string;
  monitorId?: string;
  isDisplayed: boolean;
  isFocused: boolean;
}

export interface GlazeWMWindow {
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

export interface GlazeWMFocusedContainer {
  id: string;
  type: string;
  children?: any[];
  windows?: GlazeWMWindow[];
}

/**
 * GlazeWM IPC Client Options
 */
// Client Options (enhanced to match official API)
export interface WmClientOptions {
  port?: number;
  timeout?: number;
  autoConnect?: boolean;
}

// Legacy alias for backward compatibility
export type GlazeWMIPCClientOptions = WmClientOptions;

// Event handler types
export type ConnectHandler = () => void;
export type DisconnectHandler = () => void;
export type ErrorHandler = (error: any) => void;
export type EventHandler<T extends WmEvent = WmEvent> = (event: T) => void;

/**
 * WmClient - GlazeWM IPC Client for v3.x
 *
 * Provides methods to query GlazeWM state, execute commands, and subscribe to events.
 * Compatible with GlazeWM v3.x IPC protocol.
 *
 * @example
 * ```typescript
 * const client = new WmClient();
 *
 * client.onConnect(() => console.log('Connected!'));
 * client.onDisconnect(() => console.log('Disconnected!'));
 * client.onError((error) => console.error('Error:', error));
 *
 * // Subscribe to events
 * await client.subscribe(WmEventType.FOCUS_CHANGED, (event) => {
 *   console.log('Focus changed:', event);
 * });
 *
 * // Query state
 * const monitors = await client.queryMonitors();
 * const workspaces = await client.queryWorkspaces();
 * ```
 */
export class WmClient {
  private ws: WebSocket | null = null;
  private connected = false;
  private messageId = 0;
  private pendingRequests = new Map<
    number,
    { resolve: Function; reject: Function; timeout: NodeJS.Timeout }
  >();

  // Event handlers
  private connectHandlers: ConnectHandler[] = [];
  private disconnectHandlers: DisconnectHandler[] = [];
  private errorHandlers: ErrorHandler[] = [];
  private eventSubscriptions = new Map<WmEventType, EventHandler[]>();

  constructor(private options: WmClientOptions = {}) {
    // Set defaults
    this.options.port = this.options.port || 6123;
    this.options.timeout = this.options.timeout || 10000;

    // Auto-connect by default unless explicitly disabled or environment variable set
    const disableAutoConnect =
      process.env.GLAZEWm_DISABLE_AUTO_CONNECT === "true" ||
      process.env.GLAZEWm_DISABLE_AUTO_CONNECT === "1";
    this.options.autoConnect =
      this.options.autoConnect !== false && !disableAutoConnect;

    // Auto-connect if enabled
    if (this.options.autoConnect) {
      this.connect().catch((error) => {
        // Silently fail auto-connection - user can manually connect later
        console.warn(
          "Auto-connection failed, will connect manually when needed:",
          error.message
        );
      });
    }
  }

  // Legacy class name alias for backward compatibility
  static get GlazeWMIPCClient() {
    return WmClient;
  }

  /**
   * Register a connection event handler
   */
  onConnect(handler: ConnectHandler): void {
    this.connectHandlers.push(handler);
  }

  /**
   * Register a disconnection event handler
   */
  onDisconnect(handler: DisconnectHandler): void {
    this.disconnectHandlers.push(handler);
  }

  /**
   * Register an error event handler
   */
  onError(handler: ErrorHandler): void {
    this.errorHandlers.push(handler);
  }

  /**
   * Connect to GlazeWM IPC server
   */
  async connect(): Promise<void> {
    // If already connected, return
    if (this.connected && this.ws) {
      return;
    }

    return new Promise((resolve, reject) => {
      console.log(
        `🔌 Connecting to GlazeWM IPC on port ${this.options.port}...`
      );

      this.ws = new WebSocket(`ws://localhost:${this.options.port}`);

      this.ws.on("open", () => {
        console.log("✅ Connected to GlazeWM IPC");
        this.connected = true;

        // Call all connect handlers
        this.connectHandlers.forEach((handler) => {
          try {
            handler();
          } catch (error) {
            console.error("Error in connect handler:", error);
          }
        });

        resolve();
      });

      this.ws.on("message", (data: Buffer) => {
        this.handleMessage(data);
      });

      this.ws.on("error", (error) => {
        console.error("❌ WebSocket error:", error.message || error);

        // Call all error handlers
        this.errorHandlers.forEach((handler) => {
          try {
            handler(error);
          } catch (handlerError) {
            console.error("Error in error handler:", handlerError);
          }
        });

        reject(
          new Error(
            `Failed to connect to GlazeWM IPC: ${error.message || error}`
          )
        );
      });

      this.ws.on("close", (code, reason) => {
        console.log(
          `🔌 WebSocket connection closed (code: ${code}, reason: ${reason.toString()})`
        );
        this.connected = false;

        // Call all disconnect handlers
        this.disconnectHandlers.forEach((handler) => {
          try {
            handler();
          } catch (error) {
            console.error("Error in disconnect handler:", error);
          }
        });

        this.cleanupPendingRequests();
      });

      // Connection timeout
      setTimeout(() => {
        if (!this.connected) {
          const timeoutError = new Error(
            "Connection timeout - Make sure GlazeWM is running and IPC is enabled"
          );

          // Call error handlers for timeout
          this.errorHandlers.forEach((handler) => {
            try {
              handler(timeoutError);
            } catch (error) {
              console.error("Error in error handler:", error);
            }
          });

          reject(timeoutError);
        }
      }, this.options.timeout);
    });
  }

  /**
   * Disconnect from GlazeWM IPC server
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.connected = false;
    }
    this.cleanupPendingRequests();
  }

  /**
   * Check if client is connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Subscribe to a single WM event
   */
  async subscribe<T extends WmEventType>(
    eventType: T,
    handler: EventHandler<Extract<WmEventUnion, { type: T }>>
  ): Promise<void> {
    if (!this.eventSubscriptions.has(eventType)) {
      this.eventSubscriptions.set(eventType, []);
    }
    this.eventSubscriptions.get(eventType)!.push(handler as EventHandler);
  }

  /**
   * Subscribe to multiple WM events
   */
  async subscribeMany<T extends WmEventType>(
    eventTypes: T[],
    handler: EventHandler<Extract<WmEventUnion, { type: T }>>
  ): Promise<void> {
    for (const eventType of eventTypes) {
      await this.subscribe(eventType, handler);
    }
  }

  /**
   * Unsubscribe from a WM event
   */
  unsubscribe(eventType: WmEventType, handler: EventHandler): void {
    const handlers = this.eventSubscriptions.get(eventType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Unsubscribe from all events
   */
  unsubscribeAll(): void {
    this.eventSubscriptions.clear();
  }

  /**
   * Query monitors
   */
  async queryMonitors(): Promise<GlazeWMMonitor[]> {
    const response = await this.sendRequest("query monitors");
    return response.monitors || response;
  }

  /**
   * Query workspaces
   */
  async queryWorkspaces(): Promise<GlazeWMWorkspace[]> {
    const response = await this.sendRequest("query workspaces");
    return response.workspaces || response;
  }

  /**
   * Query windows
   */
  async queryWindows(): Promise<GlazeWMWindow[]> {
    const response = await this.sendRequest("query windows");
    return response.windows || response;
  }

  /**
   * Query focused container
   */
  async queryFocused(): Promise<GlazeWMFocusedContainer> {
    const response = await this.sendRequest("query focused");
    return response.focused || response;
  }

  /**
   * Run a WM command
   */
  async runCommand(command: string, subject?: string): Promise<any> {
    let cmd = subject
      ? `command --id ${subject} ${command}`
      : `command ${command}`;
    return this.sendRequest(cmd);
  }

  /**
   * Send a raw IPC command
   */
  private async sendRequest(command: string): Promise<any> {
    if (!this.ws || !this.connected) {
      throw new Error("Not connected to GlazeWM IPC");
    }

    return new Promise((resolve, reject) => {
      const requestId = this.messageId++;

      // Set up response handler
      const handleResponse = (data: Buffer) => {
        try {
          const response = JSON.parse(data.toString());
          console.log("📨 Received IPC response:", response);

          // Remove this handler after processing
          if (this.ws) {
            this.ws.off("message", handleResponse);
          }

          // Clear timeout
          const pending = this.pendingRequests.get(requestId);
          if (pending) {
            clearTimeout(pending.timeout);
            this.pendingRequests.delete(requestId);
          }

          if (response.success) {
            resolve(response.data);
          } else {
            reject(new Error(response.error || "Command failed"));
          }
        } catch (error) {
          console.error("❌ Failed to parse response:", error);
          // If parsing fails, try to resolve with raw data
          if (this.ws) {
            this.ws.off("message", handleResponse);
          }
          const pending = this.pendingRequests.get(requestId);
          if (pending) {
            clearTimeout(pending.timeout);
            this.pendingRequests.delete(requestId);
          }
          resolve(data.toString());
        }
      };

      // Set up timeout
      const timeout = setTimeout(() => {
        if (this.ws) {
          this.ws.off("message", handleResponse);
        }
        this.pendingRequests.delete(requestId);
        reject(
          new Error(
            `Request timeout after ${this.options.timeout}ms: ${command}`
          )
        );
      }, this.options.timeout);

      // Store pending request
      this.pendingRequests.set(requestId, {
        resolve,
        reject,
        timeout,
      });

      // Set up the response handler
      this.ws!.on("message", handleResponse);

      // Send the plain text command
      console.log("📤 Sending IPC command:", command);
      this.ws!.send(command);
    });
  }

  /**
   * Handle incoming messages and emit events
   */
  private handleMessage(data: Buffer): void {
    try {
      const message = JSON.parse(data.toString());

      // Check if this is an event message
      if (message.type && message.data) {
        this.emitEvent(message.type, message.data);
      } else {
        // Handle as regular IPC response - this will be handled by individual request handlers
        console.log("📨 IPC message:", message);
      }
    } catch (error) {
      console.error("❌ Failed to parse message:", error);
    }
  }

  /**
   * Emit an event to all subscribers
   */
  private emitEvent(eventType: string, data: any): void {
    const wmEventType = eventType as WmEventType;
    const handlers = this.eventSubscriptions.get(wmEventType);

    if (handlers && handlers.length > 0) {
      const event: WmEvent = {
        type: wmEventType,
        timestamp: Date.now(),
        ...data,
      };

      handlers.forEach((handler) => {
        try {
          handler(event);
        } catch (error) {
          console.error(`Error in event handler for ${eventType}:`, error);
        }
      });
    }
  }

  /**
   * Clean up pending requests on disconnect
   */
  private cleanupPendingRequests(): void {
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error("Connection closed"));
    }
    this.pendingRequests.clear();
  }
}

/**
 * Check if GlazeWM process is running (Windows-specific)
 */
export async function checkGlazeWMRunning(): Promise<boolean> {
  try {
    const { execSync } = await import("child_process");
    // Try to check if glazewm process is running
    const result = execSync('tasklist /FI "IMAGENAME eq glazewm.exe" /NH', {
      encoding: "utf8",
    });
    return result.includes("glazewm.exe");
  } catch (error) {
    // If we can't check, assume it's running (don't block the connection)
    console.warn("⚠️  Could not check if GlazeWM is running:", error);
    return true;
  }
}

/**
 * Test direct WebSocket connection to GlazeWM IPC server
 */
export async function testDirectWebSocketConnection(
  port: number = 6123
): Promise<void> {
  console.log("🔌 Testing direct WebSocket connection to GlazeWM IPC...");

  const WebSocket = require("ws");
  const ws = new WebSocket(`ws://localhost:${port}`);

  return new Promise((resolve) => {
    ws.on("open", () => {
      console.log("✅ WebSocket connected to GlazeWM IPC!");
      ws.close();
      resolve();
    });

    ws.on("error", (error: any) => {
      console.error("❌ WebSocket connection failed:", error.message);
      resolve();
    });

    ws.on("close", () => {
      console.log("🔌 WebSocket connection closed");
      resolve();
    });

    // Timeout after 5 seconds
    setTimeout(() => {
      console.log("⏰ WebSocket connection timeout");
      ws.close();
      resolve();
    }, 5000);
  });
}

/**
 * Test our IPC client implementation
 */
export async function testIPCConnection(): Promise<void> {
  console.log("🔧 Testing GlazeWM IPC client...");

  const client = new GlazeWMIPCClient();

  try {
    // Connect to IPC
    await client.connect();

    // Test monitors query
    console.log("📺 Testing monitors query...");
    const monitors = await client.queryMonitors();
    console.log("✅ Monitors query successful:", monitors);

    // Test workspaces query
    console.log("🖥️ Testing workspaces query...");
    const workspaces = await client.queryWorkspaces();
    console.log("✅ Workspaces query successful:", workspaces);

    console.log("🎉 IPC client working!");
  } catch (error) {
    console.error(
      "❌ IPC test failed:",
      error instanceof Error ? error.message : String(error)
    );
  } finally {
    client.disconnect();
  }
}

// Legacy export for backward compatibility
export const GlazeWMIPCClient = WmClient;
