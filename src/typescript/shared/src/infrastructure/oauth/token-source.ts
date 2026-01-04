import { UserStore } from '../../storage/firestore';
import { getSecret } from '../secrets/manager';
import { PROJECT_ID } from '../../config';
import { UserIntegrations, FitbitIntegration, StravaIntegration } from '../../types/pb/user';

export interface Token {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export interface TokenSource {
  getToken(forceRefresh?: boolean): Promise<Token>;
}

export class FirestoreTokenSource implements TokenSource {
  constructor(
    private userStore: UserStore,
    private userId: string,
    private provider: 'fitbit' | 'strava'
  ) { }

  private getIntegration(integrations: UserIntegrations): FitbitIntegration | StravaIntegration | undefined {
    if (this.provider === 'fitbit') {
      return integrations.fitbit;
    } else if (this.provider === 'strava') {
      return integrations.strava;
    }
    return undefined;
  }

  async getToken(forceRefresh = false): Promise<Token> {
    // 1. Fetch current user from Firestore
    const user = await this.userStore.get(this.userId);
    if (!user) {
      throw new Error(`User ${this.userId} not found`);
    }

    if (!user.integrations) {
      throw new Error(`User ${this.userId} has no integrations`);
    }

    const integration = this.getIntegration(user.integrations);

    if (!integration || !integration.enabled) {
      throw new Error(`${this.provider} integration not enabled for user ${this.userId}`);
    }

    const accessToken = integration.accessToken;
    const refreshToken = integration.refreshToken;
    const expiresAtRaw = integration.expiresAt;

    if (!accessToken || !refreshToken) {
      throw new Error(`Missing tokens for ${this.provider}`);
    }

    // 2. Check Expiry
    // converters.ts guarantees this is a Date or undefined
    const expiresAt = expiresAtRaw || new Date(0);

    // 2. Check Expiry
    const now = new Date();
    const isExpired = expiresAt <= now;

    // Proactive refresh window (1 minute) to match Go implementation
    const isExpiringSoon = expiresAt.getTime() - now.getTime() < 60 * 1000;

    if (forceRefresh || isExpired || isExpiringSoon) {
      return this.refreshTokenFlow(refreshToken);
    }

    return {
      accessToken,
      refreshToken,
      expiresAt
    };
  }

  private async refreshTokenFlow(refreshToken: string): Promise<Token> {
    try {
      const clientId = await getSecret(PROJECT_ID, `${this.provider}-client-id`);
      const clientSecret = await getSecret(PROJECT_ID, `${this.provider}-client-secret`);

      let tokenUrl = '';
      let body: URLSearchParams;
      const headers: HeadersInit = {
        'Content-Type': 'application/x-www-form-urlencoded'
      };

      if (this.provider === 'fitbit') {
        tokenUrl = 'https://api.fitbit.com/oauth2/token';
        const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
        headers['Authorization'] = `Basic ${basicAuth}`;

        body = new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken
        });
      } else if (this.provider === 'strava') {
        tokenUrl = 'https://www.strava.com/oauth/token';
        body = new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'refresh_token',
          refresh_token: refreshToken
        });
      } else {
        throw new Error(`Unsupported provider for refresh: ${this.provider}`);
      }

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: headers,
        body: body
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Refresh failed with status ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      // Normalize response
      const newAccessToken = data.access_token;
      const newRefreshToken = data.refresh_token;
      const expiresIn = data.expires_in; // Seconds

      if (!newAccessToken || !newRefreshToken) {
        throw new Error(`Invalid refresh response from ${this.provider}`);
      }

      const newExpiresAt = new Date(Date.now() + expiresIn * 1000);

      // Fetch current state to merge
      const user = await this.userStore.get(this.userId);
      if (!user || !user.integrations) throw new Error("User lost during refresh");

      // Update Firestore
      const integrationData = user.integrations[this.provider];
      if (!integrationData) {
        throw new Error(`Integration ${this.provider} not found for user ${this.userId} while attempting to update`);
      }
      await this.userStore.setIntegration(this.userId, this.provider, {
        ...integrationData,
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresAt: newExpiresAt
      });

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresAt: newExpiresAt
      };

    } catch (error) {
      console.error(`[${this.provider}] Token refresh failed for user ${this.userId}`, error);
      throw error;
    }
  }
}
