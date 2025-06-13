import type { Selectable, DB, User, Kysely } from '@proposalsapp/db';
import type { IUserRepository } from '../types/repositories';

export class UserRepository implements IUserRepository {
  constructor(private daoDb: Kysely<DB>) {}

  async getUsersForNewProposalNotifications(
    _daoSlug: string
  ): Promise<Selectable<User>[]> {
    const result = await this.daoDb
      .selectFrom('user')
      .selectAll()
      .where('emailSettingsNewProposals', '=', true)
      .where('emailVerified', '=', true)
      .execute();

    return result;
  }

  async getUsersForNewDiscussionNotifications(
    _daoSlug: string
  ): Promise<Selectable<User>[]> {
    const result = await this.daoDb
      .selectFrom('user')
      .selectAll()
      .where('emailSettingsNewDiscussions', '=', true)
      .where('emailVerified', '=', true)
      .execute();

    return result;
  }

  async getUsersForEndingProposalNotifications(
    _daoSlug: string
  ): Promise<Selectable<User>[]> {
    const result = await this.daoDb
      .selectFrom('user')
      .selectAll()
      .where('emailSettingsEndingProposals', '=', true)
      .where('emailVerified', '=', true)
      .execute();

    return result;
  }
}
