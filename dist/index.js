"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GlazeWMIPCClient = exports.WmClient = exports.WmEventType = void 0;
exports.checkGlazeWMRunning = checkGlazeWMRunning;
exports.testDirectWebSocketConnection = testDirectWebSocketConnection;
exports.testIPCConnection = testIPCConnection;
// WebSocket support for Node.js
const ws_1 = __importDefault(require("ws"));
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
var WmEventType;
(function (WmEventType) {
    WmEventType["FOCUS_CHANGED"] = "focus_changed";
    WmEventType["WORKSPACE_ACTIVATED"] = "workspace_activated";
    WmEventType["WORKSPACE_DEACTIVATED"] = "workspace_deactivated";
    WmEventType["WINDOW_MANAGED"] = "window_managed";
    WmEventType["WINDOW_UNMANAGED"] = "window_unmanaged";
    WmEventType["MONITOR_ADDED"] = "monitor_added";
    WmEventType["MONITOR_REMOVED"] = "monitor_removed";
})(WmEventType || (exports.WmEventType = WmEventType = {}));
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
class WmClient {
    options;
    ws = null;
    connected = false;
    messageId = 0;
    pendingRequests = new Map();
    // Event handlers
    connectHandlers = [];
    disconnectHandlers = [];
    errorHandlers = [];
    eventSubscriptions = new Map();
    constructor(options = {}) {
        this.options = options;
        // Set defaults
        this.options.port = this.options.port || 6123;
        this.options.timeout = this.options.timeout || 10000;
        // Auto-connect by default unless explicitly disabled or environment variable set
        const disableAutoConnect = process.env.GLAZEWm_DISABLE_AUTO_CONNECT === "true" ||
            process.env.GLAZEWm_DISABLE_AUTO_CONNECT === "1";
        this.options.autoConnect =
            this.options.autoConnect !== false && !disableAutoConnect;
        // Auto-connect if enabled
        if (this.options.autoConnect) {
            this.connect().catch((error) => {
                // Silently fail auto-connection - user can manually connect later
                console.warn("Auto-connection failed, will connect manually when needed:", error.message);
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
    onConnect(handler) {
        this.connectHandlers.push(handler);
    }
    /**
     * Register a disconnection event handler
     */
    onDisconnect(handler) {
        this.disconnectHandlers.push(handler);
    }
    /**
     * Register an error event handler
     */
    onError(handler) {
        this.errorHandlers.push(handler);
    }
    /**
     * Connect to GlazeWM IPC server
     */
    async connect() {
        // If already connected, return
        if (this.connected && this.ws) {
            return;
        }
        return new Promise((resolve, reject) => {
            console.log(`🔌 Connecting to GlazeWM IPC on port ${this.options.port}...`);
            this.ws = new ws_1.default(`ws://localhost:${this.options.port}`);
            this.ws.on("open", () => {
                console.log("✅ Connected to GlazeWM IPC");
                this.connected = true;
                // Call all connect handlers
                this.connectHandlers.forEach((handler) => {
                    try {
                        handler();
                    }
                    catch (error) {
                        console.error("Error in connect handler:", error);
                    }
                });
                resolve();
            });
            this.ws.on("message", (data) => {
                this.handleMessage(data);
            });
            this.ws.on("error", (error) => {
                console.error("❌ WebSocket error:", error.message || error);
                // Call all error handlers
                this.errorHandlers.forEach((handler) => {
                    try {
                        handler(error);
                    }
                    catch (handlerError) {
                        console.error("Error in error handler:", handlerError);
                    }
                });
                reject(new Error(`Failed to connect to GlazeWM IPC: ${error.message || error}`));
            });
            this.ws.on("close", (code, reason) => {
                console.log(`🔌 WebSocket connection closed (code: ${code}, reason: ${reason.toString()})`);
                this.connected = false;
                // Call all disconnect handlers
                this.disconnectHandlers.forEach((handler) => {
                    try {
                        handler();
                    }
                    catch (error) {
                        console.error("Error in disconnect handler:", error);
                    }
                });
                this.cleanupPendingRequests();
            });
            // Connection timeout
            setTimeout(() => {
                if (!this.connected) {
                    const timeoutError = new Error("Connection timeout - Make sure GlazeWM is running and IPC is enabled");
                    // Call error handlers for timeout
                    this.errorHandlers.forEach((handler) => {
                        try {
                            handler(timeoutError);
                        }
                        catch (error) {
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
    disconnect() {
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
    isConnected() {
        return this.connected;
    }
    /**
     * Subscribe to a single WM event
     */
    async subscribe(eventType, handler) {
        if (!this.eventSubscriptions.has(eventType)) {
            this.eventSubscriptions.set(eventType, []);
        }
        this.eventSubscriptions.get(eventType).push(handler);
    }
    /**
     * Subscribe to multiple WM events
     */
    async subscribeMany(eventTypes, handler) {
        for (const eventType of eventTypes) {
            await this.subscribe(eventType, handler);
        }
    }
    /**
     * Unsubscribe from a WM event
     */
    unsubscribe(eventType, handler) {
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
    unsubscribeAll() {
        this.eventSubscriptions.clear();
    }
    /**
     * Query monitors
     */
    async queryMonitors() {
        const response = await this.sendRequest("query monitors");
        return response.monitors || response;
    }
    /**
     * Query workspaces
     */
    async queryWorkspaces() {
        const response = await this.sendRequest("query workspaces");
        return response.workspaces || response;
    }
    /**
     * Query windows
     */
    async queryWindows() {
        const response = await this.sendRequest("query windows");
        return response.windows || response;
    }
    /**
     * Query focused container
     */
    async queryFocused() {
        const response = await this.sendRequest("query focused");
        return response.focused || response;
    }
    /**
     * Run a WM command
     */
    async runCommand(command, subject) {
        let cmd = subject
            ? `command --id ${subject} ${command}`
            : `command ${command}`;
        return this.sendRequest(cmd);
    }
    /**
     * Send a raw IPC command
     */
    async sendRequest(command) {
        if (!this.ws || !this.connected) {
            throw new Error("Not connected to GlazeWM IPC");
        }
        return new Promise((resolve, reject) => {
            const requestId = this.messageId++;
            // Set up response handler
            const handleResponse = (data) => {
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
                    }
                    else {
                        reject(new Error(response.error || "Command failed"));
                    }
                }
                catch (error) {
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
                reject(new Error(`Request timeout after ${this.options.timeout}ms: ${command}`));
            }, this.options.timeout);
            // Store pending request
            this.pendingRequests.set(requestId, {
                resolve,
                reject,
                timeout,
            });
            // Set up the response handler
            this.ws.on("message", handleResponse);
            // Send the plain text command
            console.log("📤 Sending IPC command:", command);
            this.ws.send(command);
        });
    }
    /**
     * Handle incoming messages and emit events
     */
    handleMessage(data) {
        try {
            const message = JSON.parse(data.toString());
            // Check if this is an event message
            if (message.type && message.data) {
                this.emitEvent(message.type, message.data);
            }
            else {
                // Handle as regular IPC response - this will be handled by individual request handlers
                console.log("📨 IPC message:", message);
            }
        }
        catch (error) {
            console.error("❌ Failed to parse message:", error);
        }
    }
    /**
     * Emit an event to all subscribers
     */
    emitEvent(eventType, data) {
        const wmEventType = eventType;
        const handlers = this.eventSubscriptions.get(wmEventType);
        if (handlers && handlers.length > 0) {
            const event = {
                type: wmEventType,
                timestamp: Date.now(),
                ...data,
            };
            handlers.forEach((handler) => {
                try {
                    handler(event);
                }
                catch (error) {
                    console.error(`Error in event handler for ${eventType}:`, error);
                }
            });
        }
    }
    /**
     * Clean up pending requests on disconnect
     */
    cleanupPendingRequests() {
        for (const [id, pending] of this.pendingRequests) {
            clearTimeout(pending.timeout);
            pending.reject(new Error("Connection closed"));
        }
        this.pendingRequests.clear();
    }
}
exports.WmClient = WmClient;
/**
 * Check if GlazeWM process is running (Windows-specific)
 */
async function checkGlazeWMRunning() {
    try {
        const { execSync } = await Promise.resolve().then(() => __importStar(require("child_process")));
        // Try to check if glazewm process is running
        const result = execSync('tasklist /FI "IMAGENAME eq glazewm.exe" /NH', {
            encoding: "utf8",
        });
        return result.includes("glazewm.exe");
    }
    catch (error) {
        // If we can't check, assume it's running (don't block the connection)
        console.warn("⚠️  Could not check if GlazeWM is running:", error);
        return true;
    }
}
/**
 * Test direct WebSocket connection to GlazeWM IPC server
 */
async function testDirectWebSocketConnection(port = 6123) {
    console.log("🔌 Testing direct WebSocket connection to GlazeWM IPC...");
    const WebSocket = require("ws");
    const ws = new WebSocket(`ws://localhost:${port}`);
    return new Promise((resolve) => {
        ws.on("open", () => {
            console.log("✅ WebSocket connected to GlazeWM IPC!");
            ws.close();
            resolve();
        });
        ws.on("error", (error) => {
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
async function testIPCConnection() {
    console.log("🔧 Testing GlazeWM IPC client...");
    const client = new exports.GlazeWMIPCClient();
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
    }
    catch (error) {
        console.error("❌ IPC test failed:", error instanceof Error ? error.message : String(error));
    }
    finally {
        client.disconnect();
    }
}
// Legacy export for backward compatibility
exports.GlazeWMIPCClient = WmClient;
//# sourceMappingURL=index.js.map