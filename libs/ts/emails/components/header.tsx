import { Img, Section } from "@react-email/components";
import * as React from "react";
import { baseUrl } from "../src/const";

const Header = () => (
  <Section className="w-full py-12">
    <Section className="py-3 px-4 w-fit bg-[#2C2927] rounded-lg" align="left">
      <Img
        src={`${baseUrl}/assets/icons/web/logo-lettering.svg`}
        width="200"
        alt="proposals.app"
      />
    </Section>
  </Section>
);

export default Header;
