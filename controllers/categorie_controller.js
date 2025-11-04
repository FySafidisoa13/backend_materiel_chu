import { PrismaClient } from "@prisma/client";

import asyncHandler from "../Middleware/asyncHandler.js";

const prisma = new PrismaClient();  

const get_categorie = asyncHandler(async (req, res, next) => {
  console.log("get categorie");
  try {
    const categorie = await prisma.categorie.findMany({
      include: {
        classes: {
          select: {
            nom_classe: true,
            id_classe: true,
            _count: {
              select: {
                materiels: true,
              },
            },
          },
        },
        _count: {
          select: {
            classes: true,
          },
        },
      },
    });
    res.status(200).json(categorie);
  } catch (error) {
    res.status(500).json(error);
  }
});

const count_categorie = asyncHandler(async (req, res, next) => {
  console.log("count categorie");

  try {
    const count_categorie = await prisma.categorie.count();
    res.status(200).json(count_categorie);
  } catch (error) {
    res.status(500).json(error);
  }
});

const create_categorie = asyncHandler(async (req, res, next) => {
  try {
    const categorie = await prisma.categorie.create({
      data: { ...req.body },
    });
    res.status(200).json(categorie);
  } catch (error) {
    res.status(500).json(error);
  }
});
const delete_categorie = asyncHandler(async (req, res, next) => {
  try {
    const categorie = await prisma.categorie.delete({
      where: { id_categorie: Number(req.params.id) },
    });
    res.status(200).json(categorie);
  } catch (error) {
    res.status(500).send(error);
  }
});
const update_categorie = asyncHandler(async (req, res, next) => {
  try {
    const categorie = await prisma.categorie.update({
      data: { ...req.body },
      where: { id_categorie: Number(req.params.id) },
    });

    res.status(200).json(categorie);
  } catch (error) {
    res.status(500).send(error);
  }
});

const get_one_categorie = asyncHandler(async (req, res, next) => {
  try {
    const categorie = await prisma.categorie.findUnique({
      where: { id_categorie: Number(req.params.id) },
    });
    res.status(200).json(categorie);
  } catch (error) {
    res.status(500).send(error);
  }
});

export {
  get_categorie,
  count_categorie,
  delete_categorie,
  update_categorie,
  create_categorie,
  get_one_categorie,
};
