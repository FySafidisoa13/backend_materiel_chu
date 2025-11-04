import { Router } from "express";
import { update_pret_consommable2 } from "../controllers/pret_consommable_controller.js";

const isEpuise_router = Router();

isEpuise_router.route("/:id").put(update_pret_consommable2);

export default isEpuise_router;
