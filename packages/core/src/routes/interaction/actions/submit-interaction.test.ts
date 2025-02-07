import { Event } from '@logto/schemas';
import { mockEsm, pickDefault } from '@logto/shared/esm';

import { createMockLogContext } from '#src/test-utils/koa-audit-log.js';
import { createMockProvider } from '#src/test-utils/oidc-provider.js';
import { createContextWithRouteParameters } from '#src/utils/test-utils.js';

import type {
  Identifier,
  VerifiedRegisterInteractionResult,
  InteractionContext,
  VerifiedSignInInteractionResult,
  VerifiedForgotPasswordInteractionResult,
} from '../types/index.js';

const { jest } = import.meta;

const { getLogtoConnectorById } = mockEsm('#src/connectors/index.js', () => ({
  getLogtoConnectorById: jest
    .fn()
    .mockResolvedValue({ metadata: { target: 'logto' }, dbEntry: { syncProfile: true } }),
}));

const { assignInteractionResults } = mockEsm('#src/libraries/session.js', () => ({
  assignInteractionResults: jest.fn(),
}));

const { encryptUserPassword, generateUserId, insertUser } = mockEsm(
  '#src/libraries/user.js',
  () => ({
    encryptUserPassword: jest.fn().mockResolvedValue({
      passwordEncrypted: 'passwordEncrypted',
      passwordEncryptionMethod: 'plain',
    }),
    generateUserId: jest.fn().mockResolvedValue('uid'),
    insertUser: jest.fn(),
  })
);

mockEsm('#src/queries/user.js', () => ({
  findUserById: jest
    .fn()
    .mockResolvedValue({ identities: { google: { userId: 'googleId', details: {} } } }),
  updateUserById: jest.fn(),
}));

const { updateUserById } = await import('#src/queries/user.js');
const submitInteraction = await pickDefault(import('./submit-interaction.js'));
const now = Date.now();

jest.useFakeTimers().setSystemTime(now);

describe('submit action', () => {
  const provider = createMockProvider();
  const ctx: InteractionContext = {
    ...createContextWithRouteParameters(),
    ...createMockLogContext(),
    interactionPayload: { event: Event.SignIn },
  };
  const profile = {
    username: 'username',
    password: 'password',
    phone: '123456',
    email: 'email@logto.io',
    connectorId: 'logto',
  };

  const userInfo = { id: 'foo', name: 'foo_social', avatar: 'avatar' };
  const identifiers: Identifier[] = [
    {
      key: 'social',
      connectorId: 'logto',
      userInfo,
    },
  ];

  const upsertProfile = {
    username: 'username',
    primaryPhone: '123456',
    primaryEmail: 'email@logto.io',
    passwordEncrypted: 'passwordEncrypted',
    passwordEncryptionMethod: 'plain',
    identities: {
      logto: { userId: userInfo.id, details: userInfo },
    },
    name: userInfo.name,
    avatar: userInfo.avatar,
    lastSignInAt: now,
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('register', async () => {
    const interaction: VerifiedRegisterInteractionResult = {
      event: Event.Register,
      profile,
      identifiers,
    };

    await submitInteraction(interaction, ctx, provider);

    expect(generateUserId).toBeCalled();
    expect(encryptUserPassword).toBeCalledWith('password');
    expect(getLogtoConnectorById).toBeCalledWith('logto');

    expect(insertUser).toBeCalledWith({
      id: 'uid',
      ...upsertProfile,
    });
    expect(assignInteractionResults).toBeCalledWith(ctx, provider, { login: { accountId: 'uid' } });
  });

  it('sign-in', async () => {
    getLogtoConnectorById.mockResolvedValueOnce({
      metadata: { target: 'logto' },
      dbEntry: { syncProfile: false },
    });
    const interaction: VerifiedSignInInteractionResult = {
      event: Event.SignIn,
      accountId: 'foo',
      profile: { connectorId: 'logto', password: 'password' },
      identifiers,
    };

    await submitInteraction(interaction, ctx, provider);

    expect(encryptUserPassword).toBeCalledWith('password');
    expect(getLogtoConnectorById).toBeCalledWith('logto');

    expect(updateUserById).toBeCalledWith('foo', {
      passwordEncrypted: 'passwordEncrypted',
      passwordEncryptionMethod: 'plain',
      identities: {
        logto: { userId: userInfo.id, details: userInfo },
        google: { userId: 'googleId', details: {} },
      },
      lastSignInAt: now,
    });
    expect(assignInteractionResults).toBeCalledWith(ctx, provider, { login: { accountId: 'foo' } });
  });

  it('reset password', async () => {
    const interaction: VerifiedForgotPasswordInteractionResult = {
      event: Event.ForgotPassword,
      accountId: 'foo',
      profile: { password: 'password' },
    };
    await submitInteraction(interaction, ctx, provider);
    expect(encryptUserPassword).toBeCalledWith('password');
    expect(updateUserById).toBeCalledWith('foo', {
      passwordEncrypted: 'passwordEncrypted',
      passwordEncryptionMethod: 'plain',
    });
    expect(assignInteractionResults).not.toBeCalled();
  });
});
