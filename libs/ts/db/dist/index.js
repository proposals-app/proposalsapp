"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.jsonArrayFrom = void 0;
var kysely_1 = require("kysely");
var kysely_planetscale_1 = require("kysely-planetscale");
var kysely_2 = require("kysely");
var db = new kysely_1.Kysely({
    dialect: new kysely_planetscale_1.PlanetScaleDialect({
        url: process.env.DATABASE_URL,
    }),
    plugins: [new kysely_2.CamelCasePlugin(), new kysely_1.DeduplicateJoinsPlugin()],
});
exports.default = db;
__exportStar(require("./kysely"), exports);
var mysql_1 = require("kysely/helpers/mysql");
Object.defineProperty(exports, "jsonArrayFrom", { enumerable: true, get: function () { return mysql_1.jsonArrayFrom; } });
//# sourceMappingURL=index.js.map