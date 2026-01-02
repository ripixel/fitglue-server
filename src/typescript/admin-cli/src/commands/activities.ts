import { Command } from 'commander';
import { UserService } from '@fitglue/shared/dist/domain/services/user';

export function addActivitiesCommands(program: Command, userService: UserService) {
  program.command('activities:list-processed <userId>')
    .description('List processed activities for a user')
    .action(async (userId) => {
      try {
        console.log(`Fetching processed activities for user: ${userId} `);
        const activities = await userService.listProcessedActivities(userId);

        if (activities.length === 0) {
          console.log('No processed activities found.');
          return;
        }

        console.log('\nFound ' + activities.length + ' activities:');
        console.log('--------------------------------------------------');
        activities.forEach(data => {
          // Raw Firestore data has snake_case
          const date = data.processed_at?.toDate?.()?.toISOString() || 'Unknown';
          const extId = data.externalId || data.external_id;
          console.log(`[${data.source}] ${extId} (Processed: ${date})`);
        });
        console.log('--------------------------------------------------\n');

      } catch (error) {
        console.error('Failed to list activities:', error);
        process.exit(1);
      }
    });

  program.command('activities:delete-processed <userId> <source> <activityId>')
    .description('Delete a processed activity record to allow re-ingestion')
    .action(async (userId, source, activityId) => {
      try {
        const id = `${source}_${activityId}`;
        await userService.deleteProcessedActivity(userId, id);
        console.log(`✅ Deleted processed activity record: ${id} `);
      } catch (error) {
        console.error('Failed to delete processed activity:', error);
        process.exit(1);
      }
    });
}
