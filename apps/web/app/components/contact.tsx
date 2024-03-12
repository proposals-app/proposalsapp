import Image from "next/image";
import Link from "next/link";

export const ContactIcons = () => {
  return (
    <div className="flex grow flex-row items-end justify-between justify-self-end pb-2 opacity-50">
      <Link href="https://twitter.com/proposalsapp">
        <Image
          loading="eager"
          priority={true}
          src="/assets/icons/web/twitter.svg"
          alt="twitter"
          width={24}
          height={24}
        />
      </Link>

      <Link href="https://discord.gg/QMvVbeKqBp">
        <Image
          loading="eager"
          priority={true}
          src="/assets/icons/web/discord.svg"
          alt="discord"
          width={24}
          height={24}
        />
      </Link>

      <Link href="https://github.com/proposal-app">
        <Image
          loading="eager"
          priority={true}
          src="/assets/icons/web/github.svg"
          alt="github"
          width={24}
          height={24}
        />
      </Link>
    </div>
  );
};
