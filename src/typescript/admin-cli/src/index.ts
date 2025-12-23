import * as admin from 'firebase-admin';
import { Command } from 'commander';
import inquirer from 'inquirer';
import { UserService } from '@fitglue/shared/dist/services/user_service';

// Initialize Firebase
if (admin.apps.length === 0) {
    admin.initializeApp({
        credential: admin.credential.applicationDefault()
    });
}
const db = admin.firestore();
const userService = new UserService(db);

const program = new Command();

program
    .name('fitglue-admin')
    .description('CLI for FitGlue administration')
    .version('1.0.0');

import { randomUUID } from 'crypto';

program.command('users:create')
    .argument('[userId]', 'User ID to create (optional, will generate UUID if omitted)')
    .description('Create a new user and generating an Ingress API Key')
    .action(async (userId) => {
        try {
            if (!userId) {
                userId = randomUUID();
                console.log(`Generated User ID: ${userId}`);
            }

            console.log(`Creating user ${userId}...`);
            await userService.createUser(userId);
            console.log(`User ${userId} created/ensured.`);

            const answers = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'createIngressKey',
                    message: 'Generate an Ingress API Key?',
                    default: true
                },
                {
                    type: 'input',
                    name: 'label',
                    message: 'Key Label:',
                    default: 'Default Key',
                    when: (answers) => answers.createIngressKey
                },
                {
                    type: 'checkbox',
                    name: 'scopes',
                    message: 'Select Scopes:',
                    choices: ['write:activity', 'read:activity', 'test:mock_fetch'],
                    default: ['write:activity'],
                    when: (answers) => answers.createIngressKey
                }
            ]);

            if (answers.createIngressKey) {
                const key = await userService.createIngressApiKey(userId, answers.label, answers.scopes);
                console.log('\n==========================================');
                console.log(`INGRESS API KEY (${answers.label}):`);
                console.log(key);
                console.log('==========================================\n');
            }

            const hevyAnswers = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'configureHevy',
                    message: 'Configure Hevy Integration?',
                    default: false
                },
                {
                    type: 'password',
                    name: 'apiKey',
                    message: 'Hevy API Key:',
                    when: (answers) => answers.configureHevy
                }
            ]);

            if (hevyAnswers.configureHevy) {
                await userService.setHevyIntegration(userId, hevyAnswers.apiKey);
                console.log('Hevy integration configured.');
            }

        } catch (error) {
            console.error('Error creating user:', error);
            process.exit(1);
        }
    });

program.command('users:update')
    .argument('<userId>', 'User ID to update')
    .description('Update an existing user configuration')
    .action(async (userId) => {
        try {
            const hevyAnswers = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'updateHevy',
                    message: 'Update Hevy Integration?',
                    default: true
                },
                {
                    type: 'password',
                    name: 'apiKey',
                    message: 'New Hevy API Key:',
                    when: (answers) => answers.updateHevy
                }
            ]);

            if (hevyAnswers.updateHevy) {
                await userService.setHevyIntegration(userId, hevyAnswers.apiKey);
                console.log('Hevy integration updated.');
            }
        } catch (error) {
            console.error('Error updating user:', error);
            process.exit(1);
        }
    });

program.command('users:delete')
    .argument('<userId>', 'User ID to delete')
    .description('Delete a user and their associated data')
    .action(async (userId) => {
        try {
            const confirm = await inquirer.prompt([{
                type: 'confirm',
                name: 'delete',
                message: `Are you sure you want to PERMANENTLY delete user ${userId}?`,
                default: false
            }]);

            if (!confirm.delete) {
                console.log('Aborted.');
                return;
            }

            await db.collection('users').doc(userId).delete();
            // Note: In a real app we might want to recursively delete subcollections or related data
            console.log(`User ${userId} deleted.`);
        } catch (error) {
            console.error('Error deleting user:', error);
            process.exit(1);
        }
    });

program.command('users:list')
    .description('List all users in the system')
    .action(async () => {
        try {
            console.log('Fetching users...');
            const snapshot = await db.collection('users').get();
            if (snapshot.empty) {
                console.log('No users found.');
                return;
            }

            console.log('\nFound ' + snapshot.size + ' users:');
            console.log('--------------------------------------------------');
            snapshot.forEach(doc => {
                const data = doc.data();
                const integrations = [];
                if (data.integrations?.hevy?.apiKey) integrations.push('Hevy');
                if (data.integrations?.keiser?.enabled) integrations.push('Keiser');

                console.log(`ID: ${doc.id}`);
                console.log(`   Created: ${data.createdAt?.toDate?.()?.toISOString() || 'Unknown'}`);
                console.log(`   Integrations: ${integrations.join(', ') || 'None'}`);
                console.log('--------------------------------------------------');
            });
            console.log('');
        } catch (error) {
            console.error('Error listing users:', error);
            process.exit(1);
        }
    });

program.command('users:clean')
    .description('Delete ALL users from the system')
    .action(async () => {
        try {
            const confirm = await inquirer.prompt([{
                type: 'confirm',
                name: 'delete',
                message: 'Are you sure you want to PERMANENTLY DELETE ALL USERS? This cannot be undone.',
                default: false
            }]);

            if (!confirm.delete) {
                console.log('Aborted.');
                return;
            }

            // Double confirmation for safety
            const doubleConfirm = await inquirer.prompt([{
                type: 'input',
                name: 'confirmation',
                message: 'Type "DELETE ALL" to confirm:',
            }]);

            if (doubleConfirm.confirmation !== 'DELETE ALL') {
                console.log('Confirmation failed. Aborted.');
                return;
            }

            console.log('Fetching users to delete...');
            const snapshot = await db.collection('users').get();

            if (snapshot.empty) {
                console.log('No users to delete.');
                return;
            }

            console.log(`Deleting ${snapshot.size} users...`);
            const batch = db.batch();
            snapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });

            await batch.commit();
            console.log('All users deleted.');

        } catch (error) {
            console.error('Error cleaning users:', error);
            process.exit(1);
        }
    });

program.parse();
