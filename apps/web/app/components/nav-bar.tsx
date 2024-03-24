"use client";

import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { ContactIcons } from "./contact";
import { useState } from "react";

interface NavItemProps {
  path: string;
  isActive?: boolean;
  activeIcon: string;
  inactiveIcon: string;
  label: string;
  onClick: () => void;
}

const NavItem: React.FC<NavItemProps> = ({
  path,
  isActive,
  activeIcon,
  inactiveIcon,
  label,
  onClick,
}) => {
  return (
    <a
      href={path}
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
    >
      <div className="flex flex-col items-center">
        <Image
          loading="eager"
          priority={true}
          src={isActive ? activeIcon : inactiveIcon}
          width={64}
          height={64}
          alt={`${label} button`}
        />
        <p
          className={`text-[13px] ${isActive ? "text-white" : "text-gray-600"}`}
        >
          {label}
        </p>
      </div>
    </a>
  );
};

export const NavBar: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const [activePath, setActivePath] = useState(pathname);

  const handleNavClick = (path: string) => {
    setActivePath(path);
    router.push(path);
  };

  const isExcludedPath = ["verify", "signin", "signout", "outofservice"].some(
    (excluded) => pathname?.includes(excluded),
  );

  if (isExcludedPath) return null;

  return (
    <div
      data-testid="navbar"
      className="flex min-h-screen min-w-[92px] flex-col items-center border border-y-0 border-l-0 border-[#545454] bg-black"
    >
      <a
        href="/"
        onClick={(e) => {
          e.preventDefault();
          router.push("/");
        }}
        className="my-[4rem]"
      >
        <Image
          loading="eager"
          priority={true}
          src="/assets/icons/web/logo.svg"
          width={64}
          height={64}
          alt="proposals.app logo"
        />
      </a>

      <div className="flex flex-col gap-5">
        <NavItem
          path={`/proposals/active`}
          isActive={activePath?.includes("proposals")}
          activeIcon="/assets/icons/nav/proposals-active.svg"
          inactiveIcon="/assets/icons/nav/proposals-inactive.svg"
          label="Proposals"
          onClick={() => handleNavClick("/proposals/active")}
        />

        {/* <NavItem
          path={`/daos`}
          isActive={activePath?.includes("daos")}
          activeIcon="/assets/icons/nav/daos-active.svg"
          inactiveIcon="/assets/icons/nav/daos-inactive.svg"
          label="DAOs"
          onClick={() => handleNavClick("/daos")}
        /> */}

        <NavItem
          path={`/settings/account`}
          isActive={activePath?.includes("settings")}
          activeIcon="/assets/icons/nav/settings-active.svg"
          inactiveIcon="/assets/icons/nav/settings-inactive.svg"
          label="Settings"
          onClick={() => handleNavClick("/settings")}
        />
      </div>

      <ContactIcons />
    </div>
  );
};
