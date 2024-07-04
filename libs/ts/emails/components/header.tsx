import { Img, Section } from "@react-email/components";
import * as React from "react";
import { baseUrl } from "../src/const";

const Header = () => (
  <Section className="w-full py-4">
    <Section
      className="py-3 px-4 w-fit hidden lg:block bg-[#2C2927] rounded-lg"
      align="left"
    >
      <Img
        src={`${baseUrl}/assets/icons/web/logo-lettering.svg`}
        width="200"
        alt="proposals.app"
      />
    </Section>

    <Section
      className="py-3 px-4 w-fit block lg:hidden bg-[#2C2927] rounded-lg"
      align="center"
    >
      <Img
        src={`${baseUrl}/assets/icons/web/logo-lettering.svg`}
        width="200"
        alt="proposals.app"
      />
    </Section>
  </Section>
);

export default Header;
