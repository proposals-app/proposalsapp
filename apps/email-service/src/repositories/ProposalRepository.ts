import {
  sql,
  ProposalState,
  type Selectable,
  type DB,
  type Proposal,
  type Kysely,
} from '@proposalsapp/db';
import type { IProposalRepository } from '../types/repositories';

export class ProposalRepository implements IProposalRepository {
  constructor(private db: Kysely<DB>) {}

  async getNewProposals(
    timeFrameInMinutes: number,
    daoId: string
  ): Promise<Selectable<Proposal>[]> {
    // Calculate the cutoff time in JavaScript to avoid PostgreSQL interval issues
    const now = new Date();
    const cutoffTime = new Date(now.getTime() - timeFrameInMinutes * 60 * 1000);
    
    const result = await this.db
      .selectFrom('proposal')
      .selectAll()
      .where('daoId', '=', daoId)
      .where('proposalState', '=', ProposalState.ACTIVE)
      .where('markedSpam', '=', false)
      .where('createdAt', '>=', cutoffTime)
      .execute();

    return result;
  }

  async getEndingProposals(
    timeFrameInMinutes: number,
    daoId: string
  ): Promise<Selectable<Proposal>[]> {
    // Calculate the cutoff time in JavaScript to avoid PostgreSQL interval issues
    const now = new Date();
    const cutoffTime = new Date(now.getTime() + timeFrameInMinutes * 60 * 1000);
    
    const result = await this.db
      .selectFrom('proposal')
      .selectAll()
      .where('daoId', '=', daoId)
      .where('proposalState', '=', ProposalState.ACTIVE)
      .where('markedSpam', '=', false)
      .where('endAt', '<=', cutoffTime)
      .where('endAt', '>', now)
      .execute();

    return result;
  }
}
