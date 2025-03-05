export interface ProposalGroup {
  id?: string;
  name: string;
  items: ProposalGroupItem[];
  createdAt?: string;
}

export type ProposalGroupItem =
  | {
      type: 'topic';
      id: string;
      name: string;
      externalId: string;
      daoDiscourseId: string;
    }
  | {
      type: 'proposal';
      id: string;
      name: string;
      externalId: string;
      governorId: string;
    };
