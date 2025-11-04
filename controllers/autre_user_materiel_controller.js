import { PrismaClient } from '@prisma/client'


import asyncHandler from "../Middleware/asyncHandler.js";

const prisma = new PrismaClient();

const get_autre_user_materiel = asyncHandler(async (req, res, next) => {
  console.log("get autre_user_materiel");
  try {
    const autre_user_materiel = await prisma.utilisateurMateriel.findMany(
        
    );
    res.status(200).json(autre_user_materiel);
  } catch (error) {
    res.status(500).json(error);
  }
});

const count_autre_user_materiel = asyncHandler(async (req, res, next) => {
  try {
    const count_autre_user_materiel = await prisma.utilisateurMateriel.count();
    res.status(200).json(count_autre_user_materiel);
  } catch (error) {
    res.status(500).json(error);
  }
});


const create_autre_user_materiel = asyncHandler(async (req, res, next) => {
  try {
    const autre_user_materiel = await prisma.utilisateurMateriel.create({
      data: { ...req.body },
    });
    res.status(200).json(autre_user_materiel);
  } catch (error) {
    res.status(500).json(error);
  }
});
const delete_autre_user_materiel = asyncHandler(async (req, res, next) => {
  try {
    const autre_user_materiel = await prisma.utilisateurMateriel.delete({
      where: { id_utilisateur: Number(req.params.id) },
    });
    res.status(200).json(autre_user_materiel);
  } catch (error) {
    res.status(500).send(error);
  }
});
const update_autre_user_materiel = asyncHandler(async (req, res, next) => {
  console.log("get autre_user_materiel");
  try {
    const autre_user_materiel = await prisma.utilisateurMateriel.update({
      data: { ...req.body },
      where: { id_utilisateur: Number(req.params.id) },
    });

    res.status(200).json(autre_user_materiel);
  } catch (error) {
    res.status(500).send(error);
  }
});

const get_one_autre_user_materiel = asyncHandler(async (req, res, next) => {
  try {
    const autre_user_materiel = await prisma.utilisateurMateriel.findUnique({
      where: { id_utilisateur: Number(req.params.id)},
    });
    res.status(200).json(autre_user_materiel);
  } catch (error) {
    res.status(500).send(error);
  }
});

export {
  get_autre_user_materiel,
  count_autre_user_materiel,
  delete_autre_user_materiel,
  update_autre_user_materiel,
  create_autre_user_materiel,
  get_one_autre_user_materiel,
};
