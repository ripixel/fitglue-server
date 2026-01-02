import { createCloudFunction, createWebhookProcessor, PayloadUserStrategy } from '@fitglue/shared';
import { FitbitConnector } from './connector';

const connector = new FitbitConnector();

export const fitbitWebhookHandler = createCloudFunction(
  createWebhookProcessor(connector),
  {
    auth: {
      strategies: [new PayloadUserStrategy((payload, ctx) => connector.resolveUser!(payload, ctx))]
    }
  }
);
