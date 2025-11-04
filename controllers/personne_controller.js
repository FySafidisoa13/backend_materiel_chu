import { PrismaClient } from "@prisma/client";

import asyncHandler from "../Middleware/asyncHandler.js";

const prisma = new PrismaClient();

const get_personne = asyncHandler(async (req, res, next) => {
  console.log("get personne");
  try {
    const personnes = await prisma.personne.findMany({
      orderBy: { nom: "asc" },
      include: {
        compte: {
          select: {
            id_compte: true,
            code_recuperation: true,
          }
        },
        service: {
          select: {
            nom_service: true,
          }
        }
      }
    });

    // Transformer les résultats pour ajouter un champ hasCompte
    const personnesWithCompteStatus = personnes.map(personne => ({
      ...personne,
      hasCompte: !!personne.compte, // true si compte existe, false sinon
    }));

    res.status(200).json(personnesWithCompteStatus);
  } catch (error) {
    res.status(500).json(error);
  }
});
const get_personnes_du_meme_service = asyncHandler(async (req, res, next) => {
  console.log("get personnes du même service");
  const { id } = req.params; // ID d'une personne
  
  try {
    // Trouver d'abord la personne pour obtenir son service
    const personne = await prisma.personne.findUnique({
      where: { id_personne: parseInt(id) }
    });

    if (!personne) {
      return res.status(404).json({ message: "Personne non trouvée" });
    }

    // Récupérer toutes les personnes du même service
    const personnes = await prisma.personne.findMany({
      where: { id_service: personne.id_service },
    });

    res.status(200).json(personnes);
  } catch (error) {
    console.error("Erreur:", error);
    res.status(500).json({ 
      message: "Une erreur est survenue",
      error: error.message 
    });
  }
});
const get_count_personnes_du_meme_service = asyncHandler(async (req, res, next) => {
  console.log("get COUNT personnes du même service");
  const { id } = req.params; // ID d'une personne
  
  try {
    // Trouver d'abord la personne pour obtenir son service
    const personne = await prisma.personne.findUnique({
      where: { id_personne: parseInt(id) },
      select: { id_service: true } // On ne récupère que l'id_service pour optimiser
    });

    if (!personne) {
      return res.status(404).json({ message: "Personne non trouvée" });
    }

    // Compter directement le nombre de personnes (sans récupérer la liste)
    const count = await prisma.personne.count({
      where: { id_service: personne.id_service },
    });
    

    res.status(200).json({"count":count});
  } catch (error) {
    console.error("Erreur:", error);
    res.status(500).json({ 
      success: false,
      message: "Une erreur est survenue",
      error: error.message 
    });
  }
});

const count_personne = asyncHandler(async (req, res, next) => {
  try {
    const count_personne = await prisma.personne.count();
    res.status(200).json(count_personne);
  } catch (error) {
    res.status(500).json(error);
  }
});

const create_personne = asyncHandler(async (req, res, next) => {
  console.log("test");
  
  try {
    const personne = await prisma.personne.create({
      data: { ...req.body },
    });
    res.status(200).json(personne);
  } catch (error) {
    res.status(500).json(error);
  }
});
const delete_personne = asyncHandler(async (req, res, next) => {
  try {
    const personne = await prisma.personne.delete({
      where: { id_personne: Number(req.params.id) },
    });
    res.status(200).json(personne);
  } catch (error) {
    res.status(500).send(error);
  }
});
const update_personne = asyncHandler(async (req, res, next) => {
  try {
    const personne = await prisma.personne.update({
      data: { ...req.body },
      where: { id_personne: Number(req.params.id) },
    });

    res.status(200).json(personne);
  } catch (error) {
    res.status(500).send(error);
  }
});

const get_one_personne = asyncHandler(async (req, res, next) => {
  console.log("get one personne");
  try {
    const personne = await prisma.personne.findUnique({
      where: { id_personne: Number(req.params.id) },
      include: {
        compte: {
          select: {
            id_compte: true,
            code_recuperation: true,
            type: true,
          }
        },
        service: {
          select: {
            nom_service: true,
          }
        }
      },
      
    });
    res.status(200).json(personne);
  } catch (error) {
    res.status(500).send(error);
  }
});

export {
  get_personne,
  count_personne,
  delete_personne,
  update_personne,
  create_personne,
  get_one_personne,
  get_personnes_du_meme_service,
  get_count_personnes_du_meme_service,
};
