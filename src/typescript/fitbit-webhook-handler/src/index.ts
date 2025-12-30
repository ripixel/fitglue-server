import { createCloudFunction, FrameworkContext } from '@fitglue/shared';
import { createHmac } from 'crypto';

const VERIFY_TOKEN_SECRET = 'FITBIT_VERIFICATION_CODE';
const CLIENT_SECRET_Name = 'FITBIT_CLIENT_SECRET';

const handler = async (req: any, res: any, ctx: FrameworkContext) => {
  const { logger, secrets, pubsub } = ctx;

  try {
    // 1. Verification Request (GET)
    if (req.method === 'GET') {
      const verifyCode = req.query.verify;
      if (!verifyCode) {
        logger.warn('Missing verify code in GET request');
        res.status(404).send('Not Found');
        return;
      }

      const expectedCode = await secrets.get(VERIFY_TOKEN_SECRET);
      if (verifyCode === expectedCode) {
        logger.info('Verification successful');
        res.status(204).send();
      } else {
        logger.warn('Invalid verification code');
        res.status(404).send('Not Found');
      }
      return;
    }

    // 2. Notification Request (POST)
    if (req.method === 'POST') {
      const signature = req.headers['x-fitbit-signature'];
      if (!signature) {
        logger.warn('Missing X-Fitbit-Signature header');
        res.status(400).send('Missing Signature');
        return;
      }

      const clientSecret = await secrets.get(CLIENT_SECRET_Name);

      // Fitbit signature verification: HMAC-SHA1(body, secret + "&")
      const rawBody = (req as any).rawBody;

      if (!rawBody) {
        logger.error('Raw body not available for verification');
        res.status(500).send('Internal Server Error');
        return;
      }

      const hmac = createHmac('sha1', `${clientSecret}&`);
      hmac.update(rawBody);
      const expectedSignature = hmac.digest('base64');

      if (signature !== expectedSignature) {
        logger.warn('Invalid Signature', { expected: expectedSignature, received: signature });
        res.status(404).send('Not Found');
        return;
      }

      const body = req.body || [];
      if (!Array.isArray(body)) {
        logger.warn('Invalid body format', { body });
        res.status(400).send('Bad Request');
        return;
      }

      logger.info(`Received ${body.length} updates`);

      // Filter and Publish
      const publishPromises = body.map(async (update: any) => {
        if (update.collectionType === 'activities') {
          await pubsub.topic('fitbit-updates').publishMessage({
            json: update,
          });
          logger.info('Published update', { ownerId: update.ownerId, date: update.date });
        }
      });

      await Promise.all(publishPromises);
      res.status(204).send();
      return;
    }

    res.status(405).send('Method Not Allowed');
  } catch (err) {
    logger.error('Handler error', { error: err });
    res.status(500).send('Internal Error');
  }
};

export const fitbitWebhookHandler = createCloudFunction(handler);
