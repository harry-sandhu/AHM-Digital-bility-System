"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = authMiddleware;
const User_1 = __importDefault(require("../models/User"));
const tokenUtils_1 = require("../utils/tokenUtils");
function authMiddleware(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const token = (_a = req.header("Authorization")) === null || _a === void 0 ? void 0 : _a.split(" ")[1];
        if (!token) {
            return res.status(401).json({ error: "No token provided" });
        }
        try {
            const decoded = (0, tokenUtils_1.verifyToken)(token);
            const user = yield User_1.default.findById(decoded.id);
            if (!user) {
                return res.status(401).json({ error: "User not found" });
            }
            if (!user.isActive) {
                return res.status(403).json({ error: "Your account has been disabled" });
            }
            req.user = user;
            next();
        }
        catch (_b) {
            return res.status(401).json({ error: "Invalid token" });
        }
    });
}
