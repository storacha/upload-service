"use strict";
/**
 * @storacha/ui-react-styled
 *
 * Styled authentication components for Storacha with console-exact UI.
 * These components wrap the headless @storacha/ui-react components with
 * pre-built styling that matches the Storacha console design.
 *
 * For custom styling, use @storacha/ui-react directly.
 */
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
exports.useStorachaAuthEnhanced = void 0;
__exportStar(require("./components/StorachaAuth.js"), exports);
var ui_react_1 = require("@storacha/ui-react");
Object.defineProperty(exports, "useStorachaAuthEnhanced", { enumerable: true, get: function () { return ui_react_1.useStorachaAuthEnhanced; } });
