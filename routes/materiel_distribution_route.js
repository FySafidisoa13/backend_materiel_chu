import { Router } from "express";
import { get_materiel_distribution } from "../controllers/materiel_controller.js";


const distribution_router = Router();

distribution_router.route("/:id").get(get_materiel_distribution);

export default distribution_router;
