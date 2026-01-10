import { createCloudFunction, FrameworkContext, FirebaseAuthStrategy, generateOAuthState, getSecret } from '@fitglue/shared';
import { Request, Response } from 'express';

export const handler = async (req: Request, res: Response, ctx: FrameworkContext) => {
  const userId = ctx.userId;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { logger } = ctx;

  try {
    // Route based on path and method
    const pathParts = req.path.split('/').filter(p => p !== '');

    // GET /users/me/integrations - List all integrations
    if (req.method === 'GET' && pathParts.length === 0) {
      return await handleListIntegrations(userId, res, ctx);
    }

    // POST /users/me/integrations/{provider}/connect - Generate OAuth URL
    if (req.method === 'POST' && pathParts.length >= 2 && pathParts[1] === 'connect') {
      const provider = pathParts[0];
      return await handleConnect(userId, provider, res, ctx);
    }

    // DELETE /users/me/integrations/{provider} - Disconnect integration
    if (req.method === 'DELETE' && pathParts.length >= 1) {
      const provider = pathParts[0];
      return await handleDisconnect(userId, provider, res, ctx);
    }

    res.status(404).json({ error: 'Not found' });
  } catch (err) {
    logger.error('Failed to handle integrations request', { error: err });
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

async function handleListIntegrations(userId: string, res: Response, ctx: FrameworkContext) {
  const user = await ctx.services.user.get(userId);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const integrations = user.integrations || {};

  // Build masked summary
  const summary: Record<string, { connected: boolean; externalUserId?: string; lastUsedAt?: Date }> = {};

  if (integrations.hevy) {
    summary.hevy = {
      connected: !!integrations.hevy.enabled,
      externalUserId: integrations.hevy.userId ? `***${integrations.hevy.userId.slice(-4)}` : undefined,
      lastUsedAt: integrations.hevy.lastUsedAt
    };
  }

  if (integrations.strava) {
    summary.strava = {
      connected: !!integrations.strava.enabled,
      externalUserId: integrations.strava.athleteId?.toString(),
      lastUsedAt: integrations.strava.lastUsedAt
    };
  }

  if (integrations.fitbit) {
    summary.fitbit = {
      connected: !!integrations.fitbit.enabled,
      externalUserId: integrations.fitbit.fitbitUserId,
      lastUsedAt: integrations.fitbit.lastUsedAt
    };
  }

  res.status(200).json(summary);
}

async function handleConnect(userId: string, provider: string, res: Response, ctx: FrameworkContext) {
  const { logger } = ctx;

  // Validate provider
  if (!['strava', 'fitbit'].includes(provider)) {
    res.status(400).json({ error: `Invalid OAuth provider: ${provider}. Hevy uses API key configuration.` });
    return;
  }

  try {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT || '';
    const env = projectId.includes('-prod') ? 'prod' : projectId.includes('-test') ? 'test' : 'dev';
    const baseUrl = env === 'prod' ? 'https://fitglue.tech' : `https://${env}.fitglue.tech`;

    // Get client ID from secrets
    const clientId = await getSecret(projectId, `${provider}-client-id`);

    // Generate state token
    const state = await generateOAuthState(userId);

    let authUrl: string;
    if (provider === 'strava') {
      authUrl = `https://www.strava.com/oauth/authorize?` +
        `client_id=${clientId}&` +
        `redirect_uri=${encodeURIComponent(`${baseUrl}/auth/strava/callback`)}&` +
        `response_type=code&` +
        `scope=read,activity:read_all,activity:write&` +
        `state=${state}`;
    } else {
      authUrl = `https://www.fitbit.com/oauth2/authorize?` +
        `client_id=${clientId}&` +
        `redirect_uri=${encodeURIComponent(`${baseUrl}/auth/fitbit/callback`)}&` +
        `response_type=code&` +
        `scope=${encodeURIComponent('activity heartrate profile location')}&` +
        `state=${state}`;
    }

    logger.info('Generated OAuth URL', { userId, provider });
    res.status(200).json({ url: authUrl });

  } catch (err) {
    logger.error('Failed to generate OAuth URL', { error: err, provider });
    res.status(500).json({ error: 'Failed to generate authorization URL' });
  }
}

async function handleDisconnect(userId: string, provider: string, res: Response, ctx: FrameworkContext) {
  const { logger } = ctx;

  // Validate provider
  if (!['strava', 'fitbit', 'hevy'].includes(provider)) {
    res.status(400).json({ error: `Invalid provider: ${provider}` });
    return;
  }

  try {
    // Get current user to build disabled integration with required fields
    const user = await ctx.services.user.get(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const integrations = user.integrations || {};

    // Build disabled integration with all required fields per provider type
    if (provider === 'strava') {
      const current = integrations.strava;
      await ctx.stores.users.setIntegration(userId, 'strava', {
        enabled: false,
        accessToken: '',
        refreshToken: '',
        athleteId: current?.athleteId || 0,
        expiresAt: current?.expiresAt,
        createdAt: current?.createdAt,
        lastUsedAt: current?.lastUsedAt,
      });
    } else if (provider === 'fitbit') {
      const current = integrations.fitbit;
      await ctx.stores.users.setIntegration(userId, 'fitbit', {
        enabled: false,
        accessToken: '',
        refreshToken: '',
        fitbitUserId: current?.fitbitUserId || '',
        expiresAt: current?.expiresAt,
        createdAt: current?.createdAt,
        lastUsedAt: current?.lastUsedAt,
      });
    } else if (provider === 'hevy') {
      const current = integrations.hevy;
      await ctx.stores.users.setIntegration(userId, 'hevy', {
        enabled: false,
        apiKey: '',
        userId: current?.userId || '',
        createdAt: current?.createdAt,
        lastUsedAt: current?.lastUsedAt,
      });
    }

    logger.info('Disconnected integration', { userId, provider });
    res.status(200).json({ message: `Disconnected ${provider}` });

  } catch (err) {
    logger.error('Failed to disconnect integration', { error: err, provider });
    res.status(500).json({ error: 'Failed to disconnect integration' });
  }
}

export const userIntegrationsHandler = createCloudFunction(handler, {
  auth: {
    strategies: [new FirebaseAuthStrategy()]
  }
});
