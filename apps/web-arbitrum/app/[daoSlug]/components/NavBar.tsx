import Image from "next/image";
import Link from "next/link";

interface NavBarProps {
  dao: {
    name: string;
    picture: string;
  };
  daoSlug: string;
}

export function NavBar({ daoSlug, dao }: NavBarProps) {
  return (
    <div className="fixed left-0 top-0 z-20 flex min-h-screen flex-col items-center p-4">
      <Link href={`/${daoSlug}`}>
        <div className="h-16 w-16 overflow-hidden rounded-none">
          <Image
            src={`/${dao.picture}_large.png`}
            alt={dao.name}
            width={64}
            height={64}
            className="h-full w-full object-cover"
          />
          <div className="flex h-full w-full items-center justify-center text-lg font-bold">
            {dao.name.charAt(0)}
          </div>
        </div>
      </Link>
    </div>
  );
}
