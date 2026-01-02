import { Connector, ConnectorConfig, IngestStrategy } from './connector';
import { StandardizedActivity } from '../types/pb/standardized_activity';
import { CloudEventSource } from '../types/pb/events';
import { ActivitySource } from '../types/pb/activity';
import { FrameworkContext } from './index';

/**
 * BaseConnector provides a default implementation for common connector tasks.
 * It enforces configuration validation structure.
 */
export abstract class BaseConnector<TConfig extends ConnectorConfig = ConnectorConfig, TRawPayload = any>
  implements Connector<TConfig, TRawPayload> {
  protected _context: FrameworkContext;

  protected get context(): FrameworkContext {
    if (!this._context) {
      throw new Error(`Connector ${this.name}: FrameworkContext not set. Ensure context is passed in constructor.`);
    }
    return this._context;
  }

  abstract readonly name: string;
  abstract readonly strategy: IngestStrategy;
  abstract readonly cloudEventSource: CloudEventSource;
  abstract readonly activitySource: ActivitySource;

  constructor(context: FrameworkContext) {
    this._context = context;
  }

  /**
   * Default validation: checks if 'enabled' is present.
   * Override this to add specific config validation (e.g. API keys).
   * Always call super.validateConfig(config) when overriding.
   */
  validateConfig(config: TConfig): void {
    if (config.enabled === undefined) {
      throw new Error(`Connector ${this.name}: 'enabled' flag is missing`);
    }
  }

  /**
   * Abstract mapping function that must be implemented by the concrete connector.
   */
  abstract mapActivity(rawPayload: TRawPayload, context?: any): Promise<StandardizedActivity>;

  abstract extractId(payload: TRawPayload): string | null;

  abstract fetchAndMap(activityId: string, config: TConfig): Promise<StandardizedActivity[]>;

  /**
   * Health check. Defaults to true (stateless/assumed healthy).
   * Override to add vendor-specific health checks.
   * Default implementations for optional methods
   */
  async healthCheck(): Promise<boolean> {
    return true; // Stateless connectors are assumed healthy
  }

  async verifyRequest(_req: any, _res: any, _context: any): Promise<{ handled: boolean; response?: any } | undefined> {
    return undefined; // No custom verification by default
  }
}
