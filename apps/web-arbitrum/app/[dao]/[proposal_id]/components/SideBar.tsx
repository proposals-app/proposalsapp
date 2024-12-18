import Image from "next/image";

interface SideBarProps {
  dao: {
    name: string;
    picture: string;
  };
}

export function SideBar(props: SideBarProps) {
  return (
    <div className="fixed left-0 top-0 z-20 flex min-h-screen flex-col items-center bg-gray-300 p-2">
      <Image
        className="aspect-square w-16 rounded-sm"
        src={`/${props.dao.picture}_large.png`}
        width={64}
        height={64}
        alt={props.dao.name}
      />
    </div>
  );
}
