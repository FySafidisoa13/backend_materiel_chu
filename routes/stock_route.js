import { get_stock_consommable } from "../controllers/stock_consommable_controller.js";
import { Router } from "express";

const stock_router = Router();

stock_router.route("/:id").get(get_stock_consommable);

export default stock_router;