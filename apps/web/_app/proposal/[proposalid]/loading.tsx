export default async function Loading() {
  return (
    <div className="bg-[#1E1B20] flex flex-col">
      <div
        data-testid="header"
        className={`flex gap-4 h-[96px] w-full items-center justify-start border border-x-0 border-t-0 border-[#545454] bg-black px-4 transition-all lg:px-10`}
      >
        <svg
          width="48px"
          height="48px"
          viewBox="0 0 1024 1024"
          fill="#FFFFFF"
          version="1.1"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M669.6 849.6c8.8 8 22.4 7.2 30.4-1.6s7.2-22.4-1.6-30.4l-309.6-280c-8-7.2-8-17.6 0-24.8l309.6-270.4c8.8-8 9.6-21.6 2.4-30.4-8-8.8-21.6-9.6-30.4-2.4L360.8 480.8c-27.2 24-28 64-0.8 88.8l309.6 280z"
            fill=""
          />
        </svg>

        <div className="border border-b-2 border-l-0 border-r-2 border-t-0">
          <div className="h-[48px] w-[48px] animate-pulse bg-[#242424]" />
        </div>
        <div className="min-h-[30%] w-full animate-pulse bg-[#242424]" />
      </div>

      <div className="p-5 lg:p-10">
        <div className="flex min-h-screen w-full grow flex-col gap-4">
          <div className="flex flex-col-reverse lg:flex-row gap-4">
            <div className="w-full min-h-[50%] animate-pulse bg-[#242424]" />

            <div className="flex flex-col gap-4 lg:min-w-[30%] lg:max-w-[30%]">
              <div className="h-[320px] w-full animate-pulse bg-[#242424]" />

              <div className="h-[200px] w-full animate-pulse bg-[#242424]" />
            </div>
          </div>
          <div className="h-[200px] w-full animate-pulse bg-[#242424]" />
        </div>
      </div>
    </div>
  );
}
