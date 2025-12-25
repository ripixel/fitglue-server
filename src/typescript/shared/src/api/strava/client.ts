import { createAuthenticatedClient } from '../factory';
import { UserService } from '../../services/user_service';
import type { paths } from "./schema";

export function createStravaClient(userService: UserService, userId: string) {
  return createAuthenticatedClient<paths>(
    'https://www.strava.com/api/v3',
    userService,
    userId,
    'strava'
  );
}
