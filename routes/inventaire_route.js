
import { inventaire_materiel_par_service } from "../controllers/inventaire_materiel_controller.js";
import { Router } from "express";

const inventaire_router = Router();

inventaire_router.route("/:id").get(inventaire_materiel_par_service);

export default inventaire_router;