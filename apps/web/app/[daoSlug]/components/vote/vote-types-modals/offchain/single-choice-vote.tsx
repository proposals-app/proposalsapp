'use client';

// NOTE: Single-choice voting is functionally identical to basic voting for the UI.
// We reuse the BasicVoteModalContent component.
// The handleSubmit logic inside OffchainBasicVoteModalContent already handles
// mapping the 'offchain-single-choice' type correctly for Snapshot.

import { OffchainBasicVoteModalContent } from './basic-vote';

// Just re-exporting the basic vote component, as it handles the UI and logic correctly.
// The attribution checkbox added to basic-vote.tsx will automatically be included here.
export const OffchainSingleChoiceVoteModalContent =
  OffchainBasicVoteModalContent;
