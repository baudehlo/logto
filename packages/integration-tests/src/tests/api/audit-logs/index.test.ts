import { Event, interaction, SignInIdentifier } from '@logto/schemas';
import { assert } from '@silverhand/essentials';

import { deleteUser } from '#src/api/admin-user.js';
import { putInteraction } from '#src/api/interaction.js';
import { getLogs } from '#src/api/logs.js';
import MockClient from '#src/client/index.js';

import { enableAllPasswordSignInMethods } from '../interaction/utils/sign-in-experience.js';
import { generateNewUserProfile } from '../interaction/utils/user.js';

describe('audit logs for interaction', () => {
  beforeAll(async () => {
    await enableAllPasswordSignInMethods({
      identifiers: [SignInIdentifier.Username],
      password: true,
      verify: false,
    });
  });

  it('should insert log after interaction started and ended', async () => {
    const client = new MockClient();
    await client.initSession();
    const interactionId = client.parsedCookies.get('_interaction');

    assert(interactionId, new Error('No interaction found in cookie'));
    console.debug('Testing interaction', interactionId);

    // Expect interaction create log
    const createLogs = await getLogs(
      new URLSearchParams({ logType: `${interaction.prefix}.${interaction.Action.Create}` })
    );
    expect(createLogs.some((value) => value.payload.interactionId === interactionId)).toBeTruthy();

    // Process interaction with minimum effort
    const { username, password } = generateNewUserProfile({ username: true, password: true });
    const response = await putInteraction(
      {
        event: Event.Register,
        profile: { username, password },
      },
      client.interactionCookie
    );
    await client.processSession(response.redirectTo);

    // Expect interaction end log
    const endLogs = await getLogs(
      new URLSearchParams({ logType: `${interaction.prefix}.${interaction.Action.End}` })
    );
    expect(endLogs.some((value) => value.payload.interactionId === interactionId)).toBeTruthy();

    // Clean up
    const { sub: userId } = await client.getIdTokenClaims();
    await client.signOut();
    await deleteUser(userId);
  });
});
