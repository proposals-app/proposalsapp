interface BasicEventProps {
  content: string;
  timestamp: Date;
}

export function BasicEvent({ content, timestamp }: BasicEventProps) {
  return (
    <div className="w-full rounded-lg bg-white p-1 shadow-md">
      <div>{content}</div>
    </div>
  );
}
