import { PrismaClient } from "@prisma/client";

import asyncHandler from "../Middleware/asyncHandler.js";

const prisma = new PrismaClient();

const get_consommable = asyncHandler(async (req, res, next) => {
  console.log("get consommable");
  try {
    const consommable = await prisma.consommable.findMany({
      include: {
        classe: {
          select: {
            id_classe: true,
            nom_classe: true,
          },
        },
        prets: {
          select: {
            id_pret: true,
            date_envoi: true,
            quantite_pret: true,
            service: {
              select: {
                id_service: true,
                nom_service: true,
              },
            },
          },
        },
      },
      orderBy: { nom_consommable: "asc" },
    });
    res.status(200).json(consommable);
  } catch (error) {
    res.status(500).json(error);
  }
});

const count_consommable = asyncHandler(async (req, res, next) => {
  console.log("count consommable");

  try {
    const count_consommable = await prisma.consommable.count();
    res.status(200).json(count_consommable);
  } catch (error) {
    res.status(500).json(error);
  }
});

const create_consommable = asyncHandler(async (req, res, next) => {
  try {
    const consommable = await prisma.consommable.create({
      data: { ...req.body },
    });
    res.status(200).json(consommable);
  } catch (error) {
    res.status(500).json(error);
  }
});
const delete_consommable = asyncHandler(async (req, res, next) => {
  try {
    const consommable = await prisma.consommable.delete({
      where: { id_consommable: Number(req.params.id) },
    });
    res.status(200).json(consommable);
  } catch (error) {
    res.status(500).send(error);
  }
});
const update_consommable = asyncHandler(async (req, res, next) => {
  try {
    const consommable = await prisma.consommable.update({
      data: { ...req.body },
      where: { id_consommable: Number(req.params.id) },
    });

    res.status(200).json(consommable);
  } catch (error) {
    res.status(500).send(error);
  }
});

const get_one_consommable = asyncHandler(async (req, res, next) => {
  try {
    const consommable = await prisma.consommable.findUnique({
      where: { id_consommable: Number(req.params.id) },
    });
    res.status(200).json(consommable);
  } catch (error) {
    res.status(500).send(error);
  }
});
const get_pu_by_lot_consommable = asyncHandler(async (req, res, next) => {
  const id_consommable = req.params.id;
  try {
    const consommable = await prisma.lot_consommable.findMany({
      where: { id_consommable: Number(id_consommable) },
      select: {
        PU: true,
      },
    });
    res.status(200).json(consommable);
  } catch (error) {
    res.status(500).send(error);
  }
});

export {
  get_consommable,
  count_consommable,
  delete_consommable,
  update_consommable,
  create_consommable,
  get_one_consommable,
  get_pu_by_lot_consommable,
};
