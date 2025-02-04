import { formatNumberWithSuffix } from '@/lib/utils';
import { ProcessedResults } from '@/lib/results_processing';

interface ResultsListProps {
  results: ProcessedResults;
  isExpanded?: boolean; // Optional prop to control expanded state
}

export function ResultsList({ results, isExpanded = false }: ResultsListProps) {
  const explicitOrder = ['For', 'Abstain', 'Against'];
  const totalVotingPower = results.totalVotingPower;
  const totalDelegatedVp = results.totalDelegatedVp;

  // Calculate voting power for each choice using finalResults
  const choicesWithPower = results.choices.map((choice, index) => ({
    choice,
    votingPower: results.finalResults[index] || 0,
    color: results.choiceColors[index],
    countsTowardsQuorum: results.quorumChoices.includes(index),
  }));

  // Sort by voting power descending
  const sortedChoices = explicitOrder
    ? choicesWithPower.sort((a, b) => {
        const indexA = explicitOrder.indexOf(a.choice);
        const indexB = explicitOrder.indexOf(b.choice);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        return b.votingPower - a.votingPower;
      })
    : choicesWithPower.sort((a, b) => b.votingPower - a.votingPower);

  // Determine which choices to show
  const topChoices = isExpanded ? sortedChoices : sortedChoices.slice(0, 5);
  const otherChoices = isExpanded ? [] : sortedChoices.slice(5);

  // Calculate total voting power for "Other" choices
  const otherVotingPower = otherChoices.reduce(
    (sum, choice) => sum + choice.votingPower,
    0
  );

  const quorumVotingPower = sortedChoices
    .filter((choice) => choice.countsTowardsQuorum)
    .reduce((sum, choice) => sum + choice.votingPower, 0);

  const participationPercentage = totalDelegatedVp
    ? (totalVotingPower / totalDelegatedVp) * 100
    : 0;

  // Find the choice with the highest voting power
  const majorityChoice = sortedChoices[0];

  // Check if the majority choice is "For"
  const hasMajoritySupport =
    majorityChoice &&
    majorityChoice.choice === 'For' &&
    majorityChoice.votingPower > totalVotingPower / 2;

  return (
    <div className='ml-6 w-64'>
      <div className='space-y-4'>
        <div className='space-y-2'>
          {topChoices.map(({ choice, votingPower, color }, index) => {
            const percentage = (votingPower / totalVotingPower) * 100;
            return (
              <ChoiceBar
                key={index}
                choice={choice}
                votingPower={votingPower}
                color={color}
                percentage={isNaN(percentage) ? null : percentage}
                choiceIndex={index}
                totalChoices={topChoices.length}
              />
            );
          })}

          {otherChoices.length > 0 && (
            <a
              href='?expand=true' // Link to expand the list
              className='cursor-pointer hover:opacity-80'
            >
              <ChoiceBar
                choice='Other'
                votingPower={otherVotingPower}
                color='#CBD5E1'
                percentage={(otherVotingPower / totalVotingPower) * 100}
                choiceIndex={topChoices.length}
                totalChoices={topChoices.length}
              />
            </a>
          )}
        </div>

        {isExpanded && (
          <a href='?expand=false' className='mt-2 text-sm'>
            Show less
          </a>
        )}

        {/* Majority Support Checkmark */}
        <div>
          {hasMajoritySupport && (
            <div>
              {results.quorum !== null && totalDelegatedVp && (
                <div
                  className='w-full text-sm font-semibold'
                  style={{
                    left: `${(results.quorum / totalDelegatedVp) * 100}%`,
                  }}
                >
                  ✓ Majority support
                </div>
              )}
            </div>
          )}
        </div>

        {/* Quorum Bar */}
        <div>
          {results.quorum !== null && totalDelegatedVp && (
            <div className='mb-4'>
              <div className='relative h-4 w-full overflow-hidden rounded-lg'>
                {/* Quorum Line */}
                <div
                  className='absolute -top-1 z-10 h-6 w-0.5 bg-neutral-700'
                  style={{
                    left: `${(results.quorum / totalDelegatedVp) * 100}%`,
                  }}
                />

                {/* Choices that count towards quorum */}
                <div className='absolute inset-0 flex overflow-hidden rounded-lg border border-neutral-300 bg-white'>
                  {sortedChoices
                    .filter((choice) => choice.countsTowardsQuorum)
                    .map((choice, index) => (
                      <div
                        key={index}
                        className={`h-full ${index === 0 ? 'rounded-l-lg' : ''}`}
                        style={{
                          width: `${(choice.votingPower / totalDelegatedVp) * 100}%`,
                          backgroundColor: choice.color,
                        }}
                      />
                    ))}
                </div>
              </div>
              {/* Quorum Text */}
              <div className='mt-2 text-sm'>
                <span className='font-semibold'>
                  {quorumVotingPower > results.quorum && '✓'}{' '}
                  {formatNumberWithSuffix(quorumVotingPower)}
                </span>{' '}
                of{' '}
                <span className='font-semibold'>
                  {formatNumberWithSuffix(results.quorum)}
                </span>{' '}
                Quorum
              </div>
            </div>
          )}
        </div>

        {/* Delegated Voting Power */}
        <div>
          {totalDelegatedVp && (
            <div className='mt-4'>
              <div className='border-neutral-350 relative h-2 w-full rounded-full border'>
                <div
                  className='absolute top-0 left-0 h-full rounded-full bg-neutral-600'
                  style={{
                    width: `${participationPercentage}%`,
                  }}
                />
              </div>

              <div className='mt-2 text-xs'>
                <span className='font-semibold'>
                  {participationPercentage.toFixed(0)}%
                </span>{' '}
                of all delegated ARB has voted
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface ChoiceBarProps {
  choice: string;
  votingPower: number;
  color: string;
  percentage: number | null;
  choiceIndex: number; // Index of the current choice
  totalChoices: number; // Total number of choices
}

function ChoiceBar({
  choice,
  votingPower,
  color,
  percentage,
  choiceIndex,
  totalChoices,
}: ChoiceBarProps) {
  const pixelSize = 8.5; // Size of each pixel in pixels
  const barPixelsHeight = 5; // Number of rows in the grid
  const barPixelsWidth = 25;
  const totalPixels = barPixelsHeight * barPixelsWidth;

  // Calculate the pixel grid on the server
  const pixels = Array.from({ length: barPixelsHeight }, () =>
    Array.from({ length: barPixelsWidth }, () => false)
  );

  if (percentage !== null) {
    let filledPixels =
      (percentage / 100) * totalPixels > 0.1 &&
      (percentage / 100) * totalPixels < 1
        ? 1
        : Math.round((percentage / 100) * totalPixels);

    // Adjust the filled pixels for the last choice to ensure the total adds up to 100%
    if (choiceIndex === totalChoices - 1) {
      const totalFilledPixelsSoFar = totalPixels - filledPixels;
      filledPixels = totalPixels - totalFilledPixelsSoFar;
    }

    let filledCount = 0;
    let lastFilledColumn = 0;
    for (let col = 0; col < barPixelsWidth; col++) {
      for (let row = 0; row < barPixelsHeight; row++) {
        if (filledCount < filledPixels) {
          pixels[row][col] = true;
          filledCount++;
          lastFilledColumn = col;
        }
      }
    }

    // Determine the last 2 filled columns and check if there's an empty column after them
    const startCol = Math.max(0, lastFilledColumn - 1); // Start from the second-to-last filled column
    const endCol = lastFilledColumn; // End at the last filled column

    // Check if there's an empty column after the last filled column
    const hasEmptyColumnAfter = endCol + 1 < barPixelsWidth;

    // Extract the last 2 filled columns and the empty column (if available)
    const columnsToShuffle = hasEmptyColumnAfter
      ? pixels.map((row) => row.slice(startCol, endCol + 2)) // Include the empty column
      : pixels.map((row) => row.slice(startCol, endCol + 1)); // Only last 2 filled columns

    // Flatten the columns to make shuffling easier
    const flatColumnsToShuffle = columnsToShuffle.flat();

    // Shuffle the flattened columns
    for (let i = flatColumnsToShuffle.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [flatColumnsToShuffle[i], flatColumnsToShuffle[j]] = [
        flatColumnsToShuffle[j],
        flatColumnsToShuffle[i],
      ];
    }

    // Convert the flattened array back to the columns
    for (let i = 0; i < flatColumnsToShuffle.length; i++) {
      const row = Math.floor(i / (hasEmptyColumnAfter ? 3 : 2)); // 2 or 3 columns
      const col = startCol + (i % (hasEmptyColumnAfter ? 3 : 2)); // Last 2 filled columns + empty column (if available)
      pixels[row][col] = flatColumnsToShuffle[i];
    }
  }

  return (
    <div className='relative w-fit overflow-hidden border border-neutral-300 bg-white'>
      {/* Pixelated Grid */}
      <div
        className='top-0 left-0 w-fit'
        style={{
          height: barPixelsHeight * pixelSize,
          width: barPixelsWidth * pixelSize,
        }}
      >
        {pixels.map((row, rowIndex) => (
          <div key={rowIndex} className='flex'>
            {row.map((filled, colIndex) => (
              <div
                key={colIndex}
                style={{
                  backgroundColor: filled ? color : 'transparent',
                  width: pixelSize,
                  height: pixelSize,
                }}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Text content */}
      <div className='absolute inset-0 flex items-center justify-between px-3'>
        {/* Left side - Choice name */}
        <span className='max-w-[50%] truncate text-sm font-bold'>{choice}</span>

        {/* Right side - Percentage and voting power */}
        <span className='text-xs font-light'>
          {percentage === null ? '???%' : `${percentage.toFixed(1)}%`}{' '}
          <span className='font-bold'>
            {formatNumberWithSuffix(votingPower)}
          </span>
        </span>
      </div>
    </div>
  );
}

export function LoadingList() {
  return (
    <div className='ml-6 w-64 rounded-lg border border-neutral-300 bg-white p-4'>
      <div className='space-y-4'>
        {[...Array(3)].map((_, index) => (
          <div
            key={index}
            className='h-10 w-full animate-pulse rounded-lg bg-neutral-200'
          />
        ))}
      </div>
    </div>
  );
}
