export type LoginMode = "appstate" | "cookie" | "credentials";

export interface Cookie {
  key: string;
  value: string;
  domain?: string;
  path?: string;
  hostOnly?: boolean;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: string;
  expires?: number | null;
}

export interface Credentials {
  mode: LoginMode;
  appState?: Cookie[];
  cookie?: string;
  email?: string;
  password?: string;
  twoFactorSecret?: string | null;
  userAgent?: string | null;
  proxy?: unknown;
}

export interface ConnectionContext {
  attempt: number;
  generation: number;
  signal: AbortSignal;
}

export interface TransportDriver {
  listen(callback: (error: Error | null, event?: unknown) => void): (() => void) | void;
  disconnect?(): void | Promise<void>;
  getCurrentUserID?(): string | number | null | Promise<string | number | null>;
  sendMessage?(...args: unknown[]): unknown;
  getUserInfo?(...args: unknown[]): unknown;
  getThreadInfo?(...args: unknown[]): unknown;
  getThreadList?(...args: unknown[]): unknown;
  markAsRead?(...args: unknown[]): unknown;
  setMessageReaction?(...args: unknown[]): unknown;
  sendTypingIndicator?(...args: unknown[]): unknown;
  unsendMessage?(...args: unknown[]): unknown;
  changeNickname?(...args: unknown[]): unknown;
  addUserToGroup?(...args: unknown[]): unknown;
  removeUserFromGroup?(...args: unknown[]): unknown;
  createNewGroup?(...args: unknown[]): unknown;
  getThreadHistory?(...args: unknown[]): unknown;
  getMessage?(...args: unknown[]): unknown;
  getFriendsList?(...args: unknown[]): unknown;
  getUserID?(...args: unknown[]): unknown;
  sessionGuard?(...args: unknown[]): unknown;
  stopSessionGuard?(): unknown;
  setOptions?(options: Record<string, unknown>): unknown;
}

export interface ClientOptions {
  authenticate(context: {
    mode: LoginMode;
    credentials: Cookie[] | Record<string, unknown>;
    options: Record<string, unknown>;
    context: ConnectionContext;
    license: VerifiedLicense | null;
  }): Promise<TransportDriver> | TransportDriver;
  options?: Record<string, unknown>;
  reconnect?: {
    minDelayMs?: number;
    maxDelayMs?: number;
    factor?: number;
    jitter?: number;
    maxAttempts?: number;
  };
  license?: LicenseOptions;
  requireLicense?: boolean;
  onLicenseError?: (error: Error) => void;
}

export interface VerifiedLicense {
  licenseId: string;
  ownerId: string;
  installationId: string;
  features: string[];
  [key: string]: unknown;
}

export interface LicenseOptions {
  token?: string;
  publicKey?: string;
  installationId?: string;
  ownerId?: string;
  checkIntervalMs?: number;
  refresh?: () => string | Promise<string>;
}

export interface ClientApi {
  getCurrentUserID(): string | null;
  getConnectionState(): ConnectionSnapshot;
  getLicense(): VerifiedLicense | null;
  getCapabilities(): Readonly<{
    methods: readonly string[];
    events: boolean;
    sessionGuard: boolean;
    e2ee: false;
  }>;
  listen(callback: (event: unknown) => void): () => void;
  listenMqtt(callback: (error: Error | null, event?: unknown) => void): () => void;
  stopListening(callback?: () => void): boolean;
  sendMessage?: (...args: any[]) => any;
  getUserInfo?: (...args: any[]) => any;
  getThreadInfo?: (...args: any[]) => any;
  getThreadList?: (...args: any[]) => any;
  markAsRead?: (...args: any[]) => any;
  setMessageReaction?: (...args: any[]) => any;
  sendTypingIndicator?: (...args: any[]) => any;
  unsendMessage?: (...args: any[]) => any;
  changeNickname?: (...args: any[]) => any;
  addUserToGroup?: (...args: any[]) => any;
  removeUserFromGroup?: (...args: any[]) => any;
  createNewGroup?: (...args: any[]) => any;
  getThreadHistory?: (...args: any[]) => any;
  getMessage?: (...args: any[]) => any;
  getFriendsList?: (...args: any[]) => any;
  getUserID?: (...args: any[]) => any;
  sessionGuard?: (...args: any[]) => any;
  stopSessionGuard?: () => any;
  setOptions?: (options: Record<string, unknown>) => any;
}

export interface ConnectionSnapshot {
  state: "idle" | "connecting" | "reconnecting" | "connected" | "disconnected" | "failed" | "stopped";
  connected: boolean;
  generation: number;
}

export interface ConnectionSupervisorOptions {
  connect(context: ConnectionContext): Promise<TransportDriver> | TransportDriver;
  disconnect?(driver: TransportDriver): void | Promise<void>;
  options?: {
    minDelayMs?: number;
    maxDelayMs?: number;
    factor?: number;
    jitter?: number;
    maxAttempts?: number;
  };
  random?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
}

export class ConnectionSupervisor {
  constructor(options: ConnectionSupervisorOptions);
  start(): Promise<TransportDriver | null>;
  stop(): Promise<void>;
  listen(callback: (event: unknown) => void): () => void;
  snapshot(): ConnectionSnapshot;
  on(event: string, listener: (...args: any[]) => void): this;
  off(event: string, listener: (...args: any[]) => void): this;
}

export class EventDispatcher {
  constructor(options?: Record<string, unknown>);
  [key: string]: unknown;
}

export class CookieJar {
  constructor(cookies?: Cookie[]);
  [key: string]: unknown;
}

export function createClient(options: ClientOptions): {
  login(credentials: Credentials, options?: Record<string, unknown>): Promise<ClientApi>;
  logout(): Promise<void>;
  getConnectionState(): ConnectionSnapshot;
  getLicense(): VerifiedLicense | null;
};

export function createGoatBotLogin(client: ReturnType<typeof createClient>): (
  credentials: Record<string, unknown>,
  options: Record<string, unknown> | ((error: Error | null, api?: ClientApi | null) => void),
  callback?: (error: Error | null, api?: ClientApi | null) => void
) => Promise<ClientApi | null>;

export function normalizeCookies(input: Cookie[]): Cookie[];
export function validateSessionCookies(input: Cookie[]): Cookie[];
export function parseCookieHeader(header: string): Cookie[];
export function parseNetscapeCookies(text: string): Cookie[];
export function redactSecrets<T>(value: T): T;
export function classifySessionState(input: unknown): string;
export function describeError(error: unknown): string;
export function encryptSession(session: unknown, key: string | Uint8Array): Record<string, unknown>;
export function decryptSession(envelope: Record<string, unknown>, key: string | Uint8Array): unknown;
export function saveSession(filePath: string, session: unknown, key: string | Uint8Array): string;
export function loadSession(filePath: string, key: string | Uint8Array): unknown;
export function deleteSession(filePath: string): void;
export function createRequestClient(options?: Record<string, unknown>): (input: string | URL, options?: Record<string, unknown> & { retryable?: boolean }) => Promise<any>;
export function retryAfterMs(value: string | null, now?: number): number | null;
export function isRetryableStatus(status: number): boolean;
export function verifyLicenseToken(token: string, publicKey: string, options?: Record<string, unknown>): VerifiedLicense;
export function createLicenseProvider(options?: Record<string, unknown>): (...args: unknown[]) => unknown;
export function validateTransportDriver(driver: TransportDriver): TransportDriver;
export function createTransportFactory(provider: (context: ConnectionContext) => Promise<TransportDriver> | TransportDriver): (context: ConnectionContext) => Promise<TransportDriver>;

export interface MetaMessengerTransportOptions {
  pageAccessToken: string;
  pageId: string;
  apiVersion: string;
  appSecret?: string;
  fetchImpl?: (...args: any[]) => Promise<any>;
  timeoutMs?: number;
}

export interface MetaMessengerTransport {
  getCurrentUserID(): string;
  sendMessage(recipientId: string, message: Record<string, unknown>): Promise<Record<string, unknown>>;
  listen(callback: (error: Error | null, event?: MetaWebhookEvent) => void): () => void;
  publishWebhook(rawBody: Uint8Array, signature: string): number;
  disconnect(): Promise<void>;
  getCapabilities(): Readonly<Record<string, string | boolean>>;
}

export interface MetaWebhookEvent {
  object: "page";
  pageID: string;
  senderID: string | null;
  recipientID: string | null;
  timestamp: number | null;
  type: "message" | "postback" | "delivery" | "read" | "account_linking" | "referral";
  [key: string]: unknown;
}

export function createMetaMessengerTransport(options: MetaMessengerTransportOptions): MetaMessengerTransport;
export function normalizeWebhookPayload(payload: unknown): MetaWebhookEvent[];
export function verifyWebhookSignature(rawBody: Uint8Array, signature: string, appSecret: string): boolean;
export function verifyWebhookChallenge(query: Record<string, unknown>, verifyToken: string): string | null;
export function parseVersion(value: string): number[];
export function compareVersions(left: string, right: string): number;
export function verifyUpdateManifest(manifest: unknown, options?: Record<string, unknown>): unknown;
export function verifyArtifactDigest(data: string | Uint8Array, digest: string): boolean;

export const version: string;
