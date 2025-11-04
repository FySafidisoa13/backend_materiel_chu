import {
  checkCIN,
  login,
  update_account
} from "../controllers/compte_controller.js";
import { Router } from "express";

const authentification_routes = Router();

authentification_routes.route("/").post(login);
authentification_routes.route("/cin").post(checkCIN);
authentification_routes.route("/update_account").post(update_account);

export default authentification_routes;
