import { Voters } from "./components/voters";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col gap-10">
      <div className="flex flex-col gap-4">
        <div className="text-[24px] font-light leading-[30px] text-white">
          Your Other Addresses
        </div>

        <div className="max-w-[580px] text-[18px] text-white">
          Here you can add other addresses to your account, so that you can see
          the voting activity for those addresses as well.
        </div>
      </div>

      <Voters />
    </div>
  );
}
