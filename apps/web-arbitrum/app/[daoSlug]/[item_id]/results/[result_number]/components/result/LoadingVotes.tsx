const messages = [
  "Counting votes...",
  "Consulting the DAO oracle...",
  "Deciphering blockchain hieroglyphs...",
  "Summoning consensus spirits...",
  "Brewing governance tea...",
  "Polishing the voting crystals...",
  "Aligning the decentralized stars...",
  "Calibrating the trust machine...",
  "Decrypting the will of the people...",
  "Finalizing the immutable truth...",
];

export function LoadingVotes() {
  // Select a random message to display
  const randomMessage = messages[Math.floor(Math.random() * messages.length)];

  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-primary" />
        <p className="text-lg font-medium text-gray-600">{randomMessage}</p>
      </div>
    </div>
  );
}
