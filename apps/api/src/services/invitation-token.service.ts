import { createHash, createHmac } from 'node:crypto';

const TOKEN_DOMAIN = 'league-app:controlled-beta-administrator-invitation:v1';

export class InvitationTokenService {
  private readonly signingKey: Buffer;

  constructor(secret: string) {
    if (secret.length < 32) {
      throw new Error('Invitation token key material must contain at least 32 characters.');
    }
    this.signingKey = createHmac('sha256', secret).update(TOKEN_DOMAIN).digest();
  }

  tokenFor(invitationId: string): string {
    return createHmac('sha256', this.signingKey).update(invitationId).digest('base64url');
  }

  digest(token: string): string {
    return createHash('sha256').update(token, 'utf8').digest('hex');
  }
}
