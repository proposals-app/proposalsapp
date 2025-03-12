export interface ProposalGroup {
  id?: string;
  name: string;
  items: ProposalGroupItem[];
  createdAt?: string;
}

export type ProposalGroupItem =
  | {
      type: 'topic';
      name: string;
      externalId: string;
      daoDiscourseId: string;
    }
  | {
      type: 'proposal';
      name: string;
      externalId: string;
      governorId: string;
    };
