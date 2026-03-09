import { spawn, type ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";

// --- JSON-RPC 2.0 Types ---

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

// --- MCP Types ---

export type McpStatus = "disconnected" | "connecting" | "connected" | "error";

export interface McpTool {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

export interface McpResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

// --- Transport Interface ---

interface McpTransport {
  start(): Promise<void>;
  send(request: JsonRpcRequest): Promise<JsonRpcResponse>;
  close(): Promise<void>;
}

// --- StdioTransport ---

class StdioTransport implements McpTransport {
  private process: ChildProcess | null = null;
  private buffer = "";
  private pendingRequests = new Map<
    number,
    { resolve: (r: JsonRpcResponse) => void; reject: (e: Error) => void }
  >();

  constructor(
    private command: string,
    private args: string[],
    private env: Record<string, string>,
  ) {}

  async start(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const proc = spawn(this.command, this.args, {
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, ...this.env },
        shell: true,
      });

      this.process = proc;

      proc.stdout!.on("data", (chunk: Buffer) => {
        this.buffer += chunk.toString();
        this.processBuffer();
      });

      proc.on("error", (err) => {
        reject(new Error(`Failed to spawn MCP server: ${err.message}`));
      });

      proc.on("close", (code) => {
        for (const [, pending] of this.pendingRequests) {
          pending.reject(new Error(`MCP server process exited with code ${code}`));
        }
        this.pendingRequests.clear();
        this.process = null;
      });

      // Give the process a moment to start, then resolve
      // If it errors immediately, the error handler above will reject
      setTimeout(() => {
        if (this.process) resolve();
      }, 200);
    });
  }

  async send(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    if (!this.process?.stdin?.writable) {
      throw new Error("MCP server process not running");
    }

    return new Promise<JsonRpcResponse>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(request.id);
        reject(new Error(`MCP request timeout: ${request.method}`));
      }, 30_000);

      this.pendingRequests.set(request.id, {
        resolve: (r) => {
          clearTimeout(timeout);
          resolve(r);
        },
        reject: (e) => {
          clearTimeout(timeout);
          reject(e);
        },
      });

      const message = JSON.stringify(request) + "\n";
      this.process!.stdin!.write(message);
    });
  }

  async close(): Promise<void> {
    if (this.process) {
      this.process.kill("SIGTERM");
      this.process = null;
    }
    for (const [, pending] of this.pendingRequests) {
      pending.reject(new Error("Transport closed"));
    }
    this.pendingRequests.clear();
  }

  private processBuffer(): void {
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const msg = JSON.parse(trimmed) as JsonRpcResponse;
        if (msg.id != null && this.pendingRequests.has(msg.id)) {
          const pending = this.pendingRequests.get(msg.id)!;
          this.pendingRequests.delete(msg.id);
          pending.resolve(msg);
        }
      } catch {
        // Ignore non-JSON lines (stderr leakage, etc.)
      }
    }
  }
}

// --- SseTransport ---

class SseTransport implements McpTransport {
  private abortController: AbortController | null = null;
  private sessionUrl: string | null = null;

  constructor(private url: string) {}

  async start(): Promise<void> {
    this.abortController = new AbortController();

    // SSE MCP transport: GET on the SSE endpoint to establish the event stream
    // The server responds with a session URL for sending requests
    const response = await fetch(this.url, {
      headers: { Accept: "text/event-stream" },
      signal: this.abortController.signal,
    });

    if (!response.ok) {
      throw new Error(`SSE connection failed: ${response.status} ${response.statusText}`);
    }

    // For MCP SSE, the endpoint URL itself is used for POST requests
    this.sessionUrl = this.url;
  }

  async send(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    if (!this.sessionUrl) {
      throw new Error("SSE transport not connected");
    }

    const response = await fetch(this.sessionUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal: this.abortController?.signal,
    });

    if (!response.ok) {
      throw new Error(`MCP SSE request failed: ${response.status}`);
    }

    return (await response.json()) as JsonRpcResponse;
  }

  async close(): Promise<void> {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.sessionUrl = null;
  }
}

// --- McpClient ---

export class McpClient extends EventEmitter {
  private transport: McpTransport | null = null;
  private nextId = 1;
  private _status: McpStatus = "disconnected";
  private _lastError: string | undefined;

  constructor(
    private serverConfig: {
      transport: "stdio" | "sse";
      command?: string;
      args: string[];
      env: Record<string, string>;
      url?: string;
    },
  ) {
    super();
  }

  get status(): McpStatus {
    return this._status;
  }

  get lastError(): string | undefined {
    return this._lastError;
  }

  private setStatus(status: McpStatus, error?: string): void {
    this._status = status;
    this._lastError = error;
    this.emit("status", status, error);
  }

  async connect(): Promise<void> {
    if (this._status === "connected" || this._status === "connecting") {
      return;
    }

    this.setStatus("connecting");

    try {
      if (this.serverConfig.transport === "stdio") {
        if (!this.serverConfig.command) {
          throw new Error("command is required for stdio transport");
        }
        this.transport = new StdioTransport(
          this.serverConfig.command,
          this.serverConfig.args,
          this.serverConfig.env,
        );
      } else {
        if (!this.serverConfig.url) {
          throw new Error("url is required for sse transport");
        }
        this.transport = new SseTransport(this.serverConfig.url);
      }

      await this.transport.start();

      // Send MCP initialize request
      const initResponse = await this.request("initialize", {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "arc", version: "1.0.0" },
      });

      if (initResponse.error) {
        throw new Error(`MCP initialize failed: ${initResponse.error.message}`);
      }

      // Send initialized notification (no response expected, but we send as request for simplicity)
      try {
        await this.transport.send({
          jsonrpc: "2.0",
          id: this.nextId++,
          method: "notifications/initialized",
        });
      } catch {
        // Some servers don't respond to notifications, that's ok
      }

      this.setStatus("connected");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.setStatus("error", message);
      await this.cleanup();
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    await this.cleanup();
    this.setStatus("disconnected");
  }

  async listTools(): Promise<McpTool[]> {
    if (this._status !== "connected") {
      throw new Error("Not connected");
    }
    const response = await this.request("tools/list", {});
    if (response.error) {
      throw new Error(`tools/list failed: ${response.error.message}`);
    }
    const result = response.result as { tools?: McpTool[] };
    return result.tools || [];
  }

  async listResources(): Promise<McpResource[]> {
    if (this._status !== "connected") {
      throw new Error("Not connected");
    }
    const response = await this.request("resources/list", {});
    if (response.error) {
      throw new Error(`resources/list failed: ${response.error.message}`);
    }
    const result = response.result as { resources?: McpResource[] };
    return result.resources || [];
  }

  async readResource(uri: string): Promise<{ contents: Array<{ uri: string; text?: string; mimeType?: string }> }> {
    if (this._status !== "connected") {
      throw new Error("Not connected");
    }
    const response = await this.request("resources/read", { uri });
    if (response.error) {
      throw new Error(`resources/read failed: ${response.error.message}`);
    }
    return response.result as { contents: Array<{ uri: string; text?: string; mimeType?: string }> };
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    if (this._status !== "connected") {
      throw new Error("Not connected");
    }
    const response = await this.request("tools/call", { name, arguments: args });
    if (response.error) {
      throw new Error(`tools/call failed: ${response.error.message}`);
    }
    return response.result;
  }

  private async request(method: string, params: Record<string, unknown>): Promise<JsonRpcResponse> {
    if (!this.transport) {
      throw new Error("No transport available");
    }
    const id = this.nextId++;
    return this.transport.send({ jsonrpc: "2.0", id, method, params });
  }

  private async cleanup(): Promise<void> {
    if (this.transport) {
      try {
        await this.transport.close();
      } catch {
        // Ignore close errors
      }
      this.transport = null;
    }
  }
}
