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
export declare enum WmEventType {
    FOCUS_CHANGED = "focus_changed",
    WORKSPACE_ACTIVATED = "workspace_activated",
    WORKSPACE_DEACTIVATED = "workspace_deactivated",
    WINDOW_MANAGED = "window_managed",
    WINDOW_UNMANAGED = "window_unmanaged",
    MONITOR_ADDED = "monitor_added",
    MONITOR_REMOVED = "monitor_removed"
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
export type WmEventUnion = FocusChangedEvent | WorkspaceActivatedEvent | WorkspaceDeactivatedEvent | WindowManagedEvent | WindowUnmanagedEvent | MonitorAddedEvent | MonitorRemovedEvent;
export interface GlazeWMIPCMessage {
    type: string;
    data?: any;
}
export interface GlazeWMIPCResponse {
    success: boolean;
    data?: any;
    error?: string;
}
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
export interface WmClientOptions {
    port?: number;
    timeout?: number;
    autoConnect?: boolean;
}
export type GlazeWMIPCClientOptions = WmClientOptions;
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
export declare class WmClient {
    private options;
    private ws;
    private connected;
    private messageId;
    private pendingRequests;
    private connectHandlers;
    private disconnectHandlers;
    private errorHandlers;
    private eventSubscriptions;
    constructor(options?: WmClientOptions);
    static get GlazeWMIPCClient(): typeof WmClient;
    /**
     * Register a connection event handler
     */
    onConnect(handler: ConnectHandler): void;
    /**
     * Register a disconnection event handler
     */
    onDisconnect(handler: DisconnectHandler): void;
    /**
     * Register an error event handler
     */
    onError(handler: ErrorHandler): void;
    /**
     * Connect to GlazeWM IPC server
     */
    connect(): Promise<void>;
    /**
     * Disconnect from GlazeWM IPC server
     */
    disconnect(): void;
    /**
     * Check if client is connected
     */
    isConnected(): boolean;
    /**
     * Subscribe to a single WM event
     */
    subscribe<T extends WmEventType>(eventType: T, handler: EventHandler<Extract<WmEventUnion, {
        type: T;
    }>>): Promise<void>;
    /**
     * Subscribe to multiple WM events
     */
    subscribeMany<T extends WmEventType>(eventTypes: T[], handler: EventHandler<Extract<WmEventUnion, {
        type: T;
    }>>): Promise<void>;
    /**
     * Unsubscribe from a WM event
     */
    unsubscribe(eventType: WmEventType, handler: EventHandler): void;
    /**
     * Unsubscribe from all events
     */
    unsubscribeAll(): void;
    /**
     * Query monitors
     */
    queryMonitors(): Promise<GlazeWMMonitor[]>;
    /**
     * Query workspaces
     */
    queryWorkspaces(): Promise<GlazeWMWorkspace[]>;
    /**
     * Query windows
     */
    queryWindows(): Promise<GlazeWMWindow[]>;
    /**
     * Query focused container
     */
    queryFocused(): Promise<GlazeWMFocusedContainer>;
    /**
     * Run a WM command
     */
    runCommand(command: string, subject?: string): Promise<any>;
    /**
     * Send a raw IPC command
     */
    private sendRequest;
    /**
     * Handle incoming messages and emit events
     */
    private handleMessage;
    /**
     * Emit an event to all subscribers
     */
    private emitEvent;
    /**
     * Clean up pending requests on disconnect
     */
    private cleanupPendingRequests;
}
/**
 * Check if GlazeWM process is running (Windows-specific)
 */
export declare function checkGlazeWMRunning(): Promise<boolean>;
/**
 * Test direct WebSocket connection to GlazeWM IPC server
 */
export declare function testDirectWebSocketConnection(port?: number): Promise<void>;
/**
 * Test our IPC client implementation
 */
export declare function testIPCConnection(): Promise<void>;
export declare const GlazeWMIPCClient: typeof WmClient;
//# sourceMappingURL=index.d.ts.map