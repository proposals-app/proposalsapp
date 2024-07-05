import { Img, Section } from "@react-email/components";
import * as React from "react";
import { baseUrl } from "../src/const";

const Header = () => (
  <Section className="w-full py-4">
    <Section
      className="hidden w-fit rounded-lg bg-[#2C2927] px-4 py-3 lg:block"
      align="left"
    >
      <Img
        src={`${baseUrl}/assets/icons/web/logo-lettering.png`}
        width="200"
        alt="proposals.app"
      />
    </Section>

    <Section
      className="block w-fit rounded-lg bg-[#2C2927] px-4 py-3 lg:hidden"
      align="center"
    >
      <Img
        src={`${baseUrl}/assets/icons/web/logo-lettering.png`}
        width="200"
        alt="proposals.app"
      />
    </Section>
  </Section>
);

export default Header;
