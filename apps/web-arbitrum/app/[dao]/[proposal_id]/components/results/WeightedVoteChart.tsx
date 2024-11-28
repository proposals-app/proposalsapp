import { useMemo } from "react";
import {
  Line,
  LineChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardTitle } from "@/shadcn/ui/card";
import { Proposal, Selectable, Vote } from "@proposalsapp/db";

interface ResultProps {
  proposal: Selectable<Proposal> & {
    votes: Selectable<Vote>[];
  };
}

export function WeightedVoteChart({ proposal }: ResultProps) {
  return (
    <Card className="bg-white">
      <CardContent className="flex h-64 items-center justify-center text-gray-500">
        Not implemented
      </CardContent>
    </Card>
  );
}
