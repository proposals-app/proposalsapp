import { Img, Section } from "@react-email/components";
import * as React from "react";
import { baseUrl } from "../../src/const";

export const Header = () => (
  <Section className="bg-black py-4">
    <Img src={`${baseUrl}/assets/icons/web/logo-lettering.svg`} width="200" />
  </Section>
);

export default Header;
