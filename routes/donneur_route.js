import {
  get_donneur,
  create_donneur,
  update_donneur,
  delete_donneur,
  get_one_donneur,
  count_donneur,
} from "../controllers/donneur_controller.js";
import { Router } from "express";

const donneur_router = Router();

donneur_router.route("/").get(get_donneur).post(create_donneur);
donneur_router.route("/count/count").get(count_donneur);
donneur_router
  .route("/:id")
  .put(update_donneur)
  .delete(delete_donneur)
  .get(get_one_donneur);

export default donneur_router;
