import {
  get_autre_user_materiel,
  create_autre_user_materiel,
  update_autre_user_materiel,
  delete_autre_user_materiel,
  get_one_autre_user_materiel,
  count_autre_user_materiel,
} from "../controllers/autre_user_materiel_controller.js";
import { Router } from "express";

const autre_user_materiel_router = Router();

autre_user_materiel_router.route("/").get(get_autre_user_materiel).post(create_autre_user_materiel);
autre_user_materiel_router.route("/count/count").get(count_autre_user_materiel);
autre_user_materiel_router
  .route("/:id")
  .put(update_autre_user_materiel)
  .delete(delete_autre_user_materiel)
  .get(get_one_autre_user_materiel);

export default autre_user_materiel_router;
