import { validateRequest } from "@/lib/auth";

export default async function Home() {
  const { user } = await validateRequest();

  return (
    <div className="flex min-h-screen flex-col gap-12">
      <div className="flex flex-col gap-4">
        <div className="text-[24px] font-light leading-[30px] text-white">
          Your Account
        </div>

        {!user && (
          <div className="max-w-[580px] text-[18px] text-white">
            Please sign in
          </div>
        )}

        {user && (
          <div className="flex flex-col gap-4">
            <div className="max-w-[580px] text-[18px] text-white">
              Hello, {user.email}!
            </div>
            <div className="max-w-[580px] text-[18px] text-white">
              Here you can add voter addresses you want to follow and change
              your notification settings
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
