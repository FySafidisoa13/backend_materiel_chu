import {
  get_service,
  create_service,
  update_service,
  delete_service,
  get_one_service,
  count_service,
} from "../controllers/service_controller.js";
import { Router } from "express";

const service_router = Router();

service_router.route("/").get(get_service).post(create_service);
service_router.route("/count/count").get(count_service);
service_router
  .route("/:id")
  .put(update_service)
  .delete(delete_service)
  .get(get_one_service);

export default service_router;
