"use client";

import { type getOwnVotesType, type getVotesType } from "../actions";
import {
  CategoryScale,
  Chart as ChartJS,
  type ChartOptions,
  Colors,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
} from "chart.js";
import annotationPlugin from "chartjs-plugin-annotation";
import { Line } from "react-chartjs-2";
import { Color } from "do0dle-colors";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Colors,
  annotationPlugin,
);

interface Vote {
  choice: any;
  votingPower: number;
  blockCreated: number | null;
  timeCreated: Date | null;
}

interface VotesProps {
  votes: getVotesType;
  ownVotes: getOwnVotesType;
  choices: any[];
  quorum: number;
}

export default function Votes({
  votes,
  ownVotes,
  choices,
  quorum,
}: VotesProps) {
  const sortedVotes = votes.sort(
    (a, b) => (a.blockCreated ?? 0) - (b.blockCreated ?? 0),
  );

  const chartData = getChartData(sortedVotes, choices, quorum);

  return (
    <div className="p-4 bg-[#121212] flex flex-col">
      <div
        className={`lg:text-[42px] text-[26px] font-extrabold text-white transition w-full text-center lg:text-start pb-2`}
      >
        {votes.length} Votes
      </div>
      <div className="h-72 flex flex-col p-2 gap-2 text-white w-full">
        <Line data={chartData} options={options(quorum, ownVotes)} />
      </div>
    </div>
  );
}
const options = (
  quorum: number,
  ownVotes: getOwnVotesType,
): ChartOptions<"line"> => {
  let options: ChartOptions<"line"> = {
    responsive: true,
    animation: false,
    normalized: true,
    maintainAspectRatio: false,
    elements: {
      point: {
        radius: 0,
      },
    },
    plugins: {
      decimation: { enabled: true, algorithm: "lttb" },
      colors: {
        enabled: true,
      },
      legend: {
        position: "top" as const,
      },
      annotation: {
        annotations: [],
      },
    },
    scales: { x: { display: false } },
  };

  if (quorum > 0) {
    options.plugins!.annotation!.annotations = {
      ...options.plugins!.annotation!.annotations,
      quroumline: {
        type: "line",
        yMin: quorum,
        yMax: quorum,
        borderColor: "brown",
        borderWidth: 2,
      },
    };
  }

  ownVotes.forEach((vote_item, index) => {
    options.plugins!.annotation!.annotations = {
      ...options.plugins!.annotation!.annotations,
      [`vote_${index}`]: {
        type: "box",
        xMin: vote_item.blockCreated
          ? vote_item.blockCreated
          : vote_item.timeCreated!.toUTCString(),
        xMax: vote_item.blockCreated
          ? vote_item.blockCreated
          : vote_item.timeCreated!.toUTCString(),
        borderColor: "rgb(255,255,255,0.5)",
        borderWidth: 2,
      },
    };
  });

  return options;
};

interface ChartData {
  labels: (string | number)[];
  datasets: {
    label: string;
    data: number[];
    borderColor: string;
    backgroundColor: string;
  }[];
  quorum?: number;
}

const getChartData = (
  votes: Vote[],
  choices: any[],
  quorum: number,
): ChartData => {
  const color = new Color("#D1EAF0");

  const colors = color.getColorScheme(choices.length, "monochromatic");

  const datasets = choices.map((choice) => {
    const choiceVotes = votes.filter((vote) =>
      typeof vote.choice === "number"
        ? vote.choice === choices.indexOf(choice)
        : vote.choice.hasOwnProperty(choices.indexOf(choice)),
    );
    const cumulativeData = getAccumulativeData(choiceVotes);

    let color = colors[choices.indexOf(choice)]!.getCssRgb();

    if (
      choice.toString().toLowerCase().includes("yes") ||
      choice.toString().toLowerCase().includes("yae") ||
      choice.toString().toLowerCase().includes("yay") ||
      choice.toString().toLowerCase().includes("agree") ||
      choice.toString().toLowerCase().includes("for") ||
      choice.toString().toLowerCase().includes("approve")
    ) {
      color = new Color("#00AA00").getCssRgb();
    } else if (
      choice.toString().toLowerCase().includes("nay") ||
      choice.toString().toLowerCase().includes("no") ||
      choice.toString().toLowerCase().includes("against")
    ) {
      color = new Color("#AA0000").getCssRgb();
    } else if (choice.toString().toLowerCase().includes("abstain")) {
      color = new Color("#AA5500").getCssRgb();
    }

    return {
      choice: choice,
      label: `${choice}`,
      data: cumulativeData,
      fill: true,
      borderColor: color,
      backgroundColor: color,
    };
  });

  let longestDataset = datasets.reduce((prev, current) =>
    prev.data.length > current.data.length ? prev : current,
  );

  const labels = votes
    .filter((vote) =>
      typeof vote.choice === "number"
        ? vote.choice === choices.indexOf(longestDataset.choice)
        : vote.choice.hasOwnProperty(choices.indexOf(longestDataset.choice)),
    )
    .map((vote) =>
      vote.blockCreated ? vote.blockCreated : vote.timeCreated!.toUTCString(),
    );

  console.log(datasets);
  return {
    labels,
    datasets,
    quorum,
  };
};

const getAccumulativeData = (votes: Vote[]): number[] => {
  let cumulativeVotingPower = 0;
  return votes.map((vote) => {
    cumulativeVotingPower += vote.votingPower;
    return cumulativeVotingPower;
  });
};
