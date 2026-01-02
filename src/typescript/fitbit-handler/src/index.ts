import { createCloudFunction, createWebhookProcessor, PayloadUserStrategy } from '@fitglue/shared';
import { FitbitConnector } from './connector';



export const fitbitWebhookHandler = createCloudFunction(
  createWebhookProcessor(FitbitConnector),
  {
    auth: {
      strategies: [new PayloadUserStrategy((payload, ctx) => {
        // Instantiate connector with the authentication context to use resolveUser
        const connector = new FitbitConnector(ctx);
        return connector.resolveUser(payload, ctx);
      })]
    }
  }
);
