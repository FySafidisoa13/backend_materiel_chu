import {
  get_materiel,
  create_materiel,
  update_materiel,
  delete_materiel,
  get_one_materiel,
  count_materiel,
} from "../controllers/materiel_controller.js";
import { Router } from "express";

const materiel_router = Router();

materiel_router.route("/").get(get_materiel).post(create_materiel);
materiel_router.route("/count/count").get(count_materiel);
materiel_router
  .route("/:id")
  .put(update_materiel)
  .delete(delete_materiel)
  .get(get_one_materiel);


export default materiel_router;
