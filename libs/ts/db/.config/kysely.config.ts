import { defineConfig } from "kysely-ctl";
import { db } from "../src/index";

export default defineConfig({ kysely: db });
