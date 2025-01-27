import { Proposal, Selectable } from '@proposalsapp/db';

export type ProposalMetadata = {
  quorumChoices?: number[];
  voteType?:
    | 'single-choice'
    | 'weighted'
    | 'approval'
    | 'basic'
    | 'quadratic'
    | 'ranked-choice';
  totalDelegatedVp?: string;
  hiddenVote: boolean;
  scoresState: string;
};

export interface ProposalWithMetadata
  extends Omit<Selectable<Proposal>, 'metadata'> {
  metadata: ProposalMetadata;
}
