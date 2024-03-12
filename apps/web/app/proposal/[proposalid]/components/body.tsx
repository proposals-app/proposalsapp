export default async function Body({ body }: { body: string }) {
  return (
    <div className="p-4 bg-[#121212] flex flex-col grow">
      <div
        className={`lg:text-[42px] text-[26px] font-extrabold text-white transition w-full text-center lg:text-start pb-2`}
      >
        Proposal
      </div>
      <div
        suppressHydrationWarning
        className="flex flex-col p-2 gap-2 border border-b-2 border-l-0 border-r-2 border-t-0 break-all text-white whitespace-pre-line max-h-screen overflow-y-scroll"
      >
        {body}
      </div>
    </div>
  );
}
