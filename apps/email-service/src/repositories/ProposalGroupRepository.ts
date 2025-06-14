import {
  sql,
  type Selectable,
  type DB,
  type ProposalGroup,
  type Kysely,
} from '@proposalsapp/db';
import type { IProposalGroupRepository } from '../types/repositories';

export class ProposalGroupRepository implements IProposalGroupRepository {
  constructor(private db: Kysely<DB>) {}

  async getProposalGroupsByDiscourseUrl(
    url: string
  ): Promise<Selectable<ProposalGroup>[]> {
    const result = await this.db
      .selectFrom('proposalGroup')
      .selectAll()
      .where(
        sql<boolean>`EXISTS (
          SELECT 1 FROM jsonb_array_elements(items) AS item
          WHERE item->>'href' = ${url}
        )`
      )
      .execute();

    return result;
  }
}
