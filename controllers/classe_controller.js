import { PrismaClient } from "@prisma/client";

import asyncHandler from "../Middleware/asyncHandler.js";

const prisma = new PrismaClient();

const get_classe = asyncHandler(async (req, res, next) => {
  console.log("get classe");
  try {
    const classe = await prisma.classe.findMany({
      include: {
        _count: {
          select: {
            materiels: true,
            consommable: true,
          },
        },
        categorie: {
          select: {
            id_categorie: true,
            nom_categorie: true,
          },
        },
      },
    });
    res.status(200).json(classe);
  } catch (error) {
    res.status(500).json(error);
  }
});

const get_classe_by_service = asyncHandler(async (req, res, next) => {
  const { id_service } = req.params; 

  try {
  
    const prets = await prisma.pret.findMany({
      where: { id_service: parseInt(id_service) },
      select: {
        lot_materiels: {
          select: {
            Materiels: {
              select: {
                id_classe: true
              }
            }
          }
        },
        consommable: {
          select: {
            id_classe: true
          }
        }
      }
    });

    // Extraire les IDs de classe uniques
    const classeIds = new Set();
    prets.forEach(pret => {
      if (pret.lot_materiels) {
        classeIds.add(pret.lot_materiels.Materiels.id_classe);
      }
      if (pret.consommable) {
        classeIds.add(pret.consommable.id_classe);
      }
    });

    // Maintenant récupérer les classes correspondantes
    const classes = await prisma.classe.findMany({
      where: {
        id_classe: { in: [...classeIds] }
      },
      include: {
        _count: {
          select: {
            materiels: true,
            consommable: true,
          },
        },
        categorie: {
          select: {
            id_categorie: true,
            nom_categorie: true,
          },
        },
      },
    });

    res.status(200).json(classes);
  } catch (error) {
    res.status(500).json(error);
  }
});

const count_classe = asyncHandler(async (req, res, next) => {
  try {
    const count_classe = await prisma.classe.count();
    res.status(200).json(count_classe);
  } catch (error) {
    res.status(500).json(error);
  }
});

const create_classe = asyncHandler(async (req, res, next) => {
  try {
    const classe = await prisma.classe.create({
      data: { ...req.body },
    });
    res.status(200).json(classe);
  } catch (error) {
    res.status(500).json(error);
  }
});
const delete_classe = asyncHandler(async (req, res, next) => {
  try {
    const classe = await prisma.classe.delete({
      where: { id_classe: Number(req.params.id) },
    });
    res.status(200).json(classe);
  } catch (error) {
    res.status(500).send(error);
  }
});
const update_classe = asyncHandler(async (req, res, next) => {
  try {
    const classe = await prisma.classe.update({
      data: { ...req.body },
      where: { id_classe: Number(req.params.id) },
    });

    res.status(200).json(classe);
  } catch (error) {
    res.status(500).send(error);
  }
});

const get_one_classe = asyncHandler(async (req, res, next) => {
  try {
    const classe = await prisma.classe.findUnique({
      where: { id_classe: Number(req.params.id) },
    });
    res.status(200).json(classe);
  } catch (error) {
    res.status(500).send(error);
  }
});

export {
  get_classe,
  count_classe,
  delete_classe,
  update_classe,
  create_classe,
  get_classe_by_service,
  get_one_classe,
};
