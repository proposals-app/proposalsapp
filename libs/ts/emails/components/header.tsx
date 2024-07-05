import { Img, Section } from "@react-email/components";
import * as React from "react";
import { baseUrl } from "../src/const";

const Header = () => (
  <Section className="w-full py-4">
    <Section className="hidden w-fit rounded-lg lg:block" align="left">
      <Img
        src={`${baseUrl}/assets/email/logo-lettering.png`}
        width="250"
        alt="proposals.app"
      />
    </Section>

    <Section className="block w-fit rounded-lg lg:hidden" align="center">
      <Img
        src={`${baseUrl}/assets/email/logo-lettering.png`}
        width="250"
        alt="proposals.app"
      />
    </Section>
  </Section>
);

export default Header;
