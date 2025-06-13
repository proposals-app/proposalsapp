import type { Selectable, DB, Dao, Kysely } from '@proposalsapp/db';
import type { IDaoRepository } from '../types/repositories';

export class DaoRepository implements IDaoRepository {
  constructor(private db: Kysely<DB>) {}

  async getEnabledDaos(): Promise<Selectable<Dao>[]> {
    const result = await this.db
      .selectFrom('dao')
      .selectAll()
      .where('dao.id', 'in', (qb) =>
        qb.selectFrom('daoGovernor').select('daoId').where('enabled', '=', true)
      )
      .execute();

    return result;
  }

  async getDaoBySlug(slug: string): Promise<Selectable<Dao> | undefined> {
    const result = await this.db
      .selectFrom('dao')
      .selectAll()
      .where('slug', '=', slug)
      .executeTakeFirst();

    return result;
  }
}
