import { PrismaClient } from "@prisma/client";

import asyncHandler from "../Middleware/asyncHandler.js";

const prisma = new PrismaClient();

const get_service = asyncHandler(async (req, res, next) => {
  console.log("get service");
  try {
    const services = await prisma.service.findMany({
      orderBy: { nom_service: "asc" },
      include: {
        personnes: {
          select: {
            id_personne: true,
            nom: true,
          },
        },
        prets: {
          select: {
            id_pret: true,
            id_service: true,
            date_envoi: true,
            lot_materiels: {
              select: {
                id_lot: true,
                etat: true,
                numero: true,
                Materiels: {
                  select: {
                    id_materiel: true,
                    nom_materiel: true,
                    classe: {
                      select: {
                        nom_classe: true
                        
                      }
                    }
                  },
                },
              },
            },
          },
        },
        _count: {
          select: {
            personnes: true,
          },
        },
      },
    });

    // Maintenant on ajoute manuellement le count filtré
    const servicesWithCount = await Promise.all(
      services.map(async (service) => {
        const countPretsLot = await prisma.pret.count({
          where: {
            id_service: service.id_service,
            id_lot: {
              not: null,
            },
          },
        });

        return {
          ...service,
          count_prets_lot: countPretsLot,
        };
      })
    );

    res.status(200).json(servicesWithCount);
  } catch (error) {
    res.status(500).json(error);
  }
});

const count_service = asyncHandler(async (req, res, next) => {
  try {
    const count_service = await prisma.service.count();
    res.status(200).json(count_service);
  } catch (error) {
    res.status(500).json(error);
  }
});

const create_service = asyncHandler(async (req, res, next) => {
  try {
    const service = await prisma.service.create({
      data: { ...req.body },
    });
    res.status(200).json(service);
  } catch (error) {
    res.status(500).json(error);
  }
});
const delete_service = asyncHandler(async (req, res, next) => {
  try {
    const serviceId = Number(req.params.id);

    // Vérifier s'il existe des personnes dans le service
    const personneCount = await prisma.personne.count({
      where: { id_service: serviceId },
    });

    if (personneCount > 0) {
      return res.status(400).json({
        error: "Impossible de supprimer ce service car il existe des personnes associées.",
      });
    }

    // Vérifier s'il existe des prêts pour ce service
    const pretCount = await prisma.pret.count({
      where: { id_service: serviceId },
    });

    if (pretCount > 0) {
      return res.status(400).json({
        error: "Impossible de supprimer ce service car il existe des prêts associés.",
      });
    }

    // Suppression du service si aucune personne ou prêt associé
    const service = await prisma.service.delete({
      where: { id_service: serviceId },
    });

    res.status(200).json(service);
  } catch (error) {
    res.status(500).send(error);
  }
});
const update_service = asyncHandler(async (req, res, next) => {
  try {
    const service = await prisma.service.update({
      data: { ...req.body },
      where: { id_service: Number(req.params.id) },
    });

    res.status(200).json(service);
  } catch (error) {
    res.status(500).send(error);
  }
});

const get_one_service = asyncHandler(async (req, res, next) => {
  try {
    const service = await prisma.service.findUnique({
      where: { id_service: Number(req.params.id) },
    });
    res.status(200).json(service);
  } catch (error) {
    res.status(500).send(error);
  }
});
const get_materiel_par_service = asyncHandler(async (req, res, next) => {
  try {
    const { id } = req.params; // ID du compte

    // 1. Récupérer le service de la personne via son compte
    const compte = await prisma.compte.findUnique({
      where: { id_compte: parseInt(id) },
      include: {
        personne: {
          include: {
            service: true
          }
        }
      }
    });

    if (!compte) {
      return res.status(404).json({ message: "Compte non trouvé" });
    }

    const idService = compte.personne.id_service;

    // 2. Récupérer tous les prêts de matériels pour ce service
    const prets = await prisma.pret.findMany({
      where: {
        id_service: idService,
        id_lot: { not: null } // Seulement les prêts de matériels
      },
      include: {
        lot_materiels: {
          include: {
            Materiels: {
              include: {
                classe: {
                  include: {
                    categorie: true
                  }
                }
              }
            },
            donneur: true
          }
        }
      }
    });

    // 3. Formater les données pour le chart
    const dataForChart = prets.map(pret => ({
      id_pret: pret.id_pret,
      date_envoi: pret.date_envoi,
      date_retour: pret.date_retour,
      materiel: {
        id: pret.lot_materiels.Materiels.id_materiel,
        nom: pret.lot_materiels.Materiels.nom_materiel,
        code: pret.lot_materiels.Materiels.code_materiel,
        reference: pret.lot_materiels.Materiels.ref_materiel,
        classe: pret.lot_materiels.Materiels.classe.nom_classe,
        categorie: pret.lot_materiels.Materiels.classe.categorie.nom_categorie
      },
      lot: {
        id: pret.lot_materiels.id_lot,
        numero: pret.lot_materiels.numero,
        etat: pret.lot_materiels.etat,
        donneur: pret.lot_materiels.donneur.nom_donneur
      }
    }));

    // 4. Statistiques pour le chart (exemple: matériels par catégorie)
    const statsByCategory = dataForChart.reduce((acc, item) => {
      const category = item.materiel.categorie;
      if (!acc[category]) {
        acc[category] = 0;
      }
      acc[category]++;
      return acc;
    }, {});

    res.status(200).json({
      service: compte.personne.service,
      prets: dataForChart,
      stats: {
        byCategory: statsByCategory,
        total: prets.length
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur serveur", error: error.message });
  }
});

export {
  get_service,
  count_service,
  delete_service,
  update_service,
  create_service,
  get_one_service,
};
