import Image from "next/image";
import Link from "next/link";

interface SideBarProps {
  dao: {
    name: string;
    picture: string;
  };
}

export function SideBar({
  daoSlug,
  dao,
}: {
  daoSlug: string;
  dao: {
    name: string;
    picture: string;
  };
}) {
  return (
    <div className="fixed left-0 top-0 z-20 flex min-h-screen flex-col items-center bg-gray-300 p-2">
      <Link href={`/${daoSlug}`}>
        <Image
          className="aspect-square w-16 rounded-sm"
          src={`/${dao.picture}_large.png`}
          width={64}
          height={64}
          alt={dao.name}
        />
      </Link>
    </div>
  );
}
