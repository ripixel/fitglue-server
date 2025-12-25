import { createAuthenticatedClient } from '../factory';
import { UserService } from '../../services/user_service';
import type { paths } from "./schema";

export function createFitbitClient(userService: UserService, userId: string) {
  return createAuthenticatedClient<paths>(
    'https://api.fitbit.com',
    userService,
    userId,
    'fitbit'
  );
}
