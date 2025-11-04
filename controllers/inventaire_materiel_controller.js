import { PrismaClient } from "@prisma/client";
import asyncHandler from "../Middleware/asyncHandler.js";

const prisma = new PrismaClient();

const inventaire_materiel_par_service = asyncHandler(async (req, res, next) => {
  try {
    // Validation des paramètres
    const id_service = parseInt(req.params.id);
    if (isNaN(id_service)) {
      return res.status(400).json({ message: "L'ID du service doit être un nombre valide" });
    }

    const id_classe = req.params.id_classe ? parseInt(req.params.id_classe) : undefined;
    const { annee } = req.query;

    // Construire les conditions de date si l'année est fournie - CORRECTION ICI
    const dateCondition = annee ? {
      gte: new Date(`${annee}-01-01T00:00:00.000Z`),
      lt: new Date(`${Number(annee) + 1}-01-01T00:00:00.000Z`)
    } : undefined;

    // Construire la condition de classe si fournie
    const classeCondition = id_classe ? {
      lot_materiels: {
        Materiels: {
          id_classe: id_classe
        }
      }
    } : undefined;

    // Combiner les conditions - CORRECTION ICI
    const whereCondition = {
      ...(dateCondition && { date_envoi: dateCondition }),
      ...(classeCondition && { ...classeCondition }),
      lot_materiels: { isNot: null } // S'assurer qu'il y a un lot matériel
    };

    // Récupérer le service avec les prêts et matériels associés
    const service = await prisma.service.findUnique({
      where: { 
        id_service: id_service 
      },
      select: {
        id_service: true,
        nom_service: true,
        prets: {
          where: whereCondition,
          select: {
            lot_materiels: {
              select: {
                etat: true,
                Materiels: {
                  select: {
                    id_materiel: true,
                    nom_materiel: true,
                    classe: {
                      select: {
                        id_classe: true,
                        nom_classe: true
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!service) {
      return res.status(404).json({ message: "Service non trouvé" });
    }

    // Traiter les données pour le format d'inventaire
    const inventaire = {};

    service.prets.forEach(pret => {
      if (!pret.lot_materiels) return;

      const materiel = pret.lot_materiels.Materiels;
      const etat = pret.lot_materiels.etat;

      if (!inventaire[materiel.id_materiel]) {
        inventaire[materiel.id_materiel] = {
          designation: `${materiel.nom_materiel}`,
          id_classe: materiel.classe.id_classe,
          classe: materiel.classe.nom_classe,
          etats: {
            BON: 0,
            MOYEN: 0,
            MAUVAIS: 0,
            EN_PANNE: 0,
            PERDU: 0
          },
          total: 0
        };
      }

      // Compter par état
      inventaire[materiel.id_materiel].etats[etat]++;
      inventaire[materiel.id_materiel].total++;
    });

    // Convertir en tableau et trier par classe/designation
    const resultat = Object.values(inventaire).sort((a, b) => {
      if (a.classe < b.classe) return -1;
      if (a.classe > b.classe) return 1;
      return a.designation.localeCompare(b.designation);
    });

    // Format de réponse final
    const response = {
      entete: {
        titre: "INVENTAIRE MATERIEL",
        annee: annee || 'Toutes années',
        service: service.nom_service,
        classe: id_classe ? resultat[0]?.classe : 'Toutes classes'
      },
      inventaire: resultat,
      totaux: resultat.reduce((acc, item) => {
        Object.keys(item.etats).forEach(etat => {
          acc[etat] = (acc[etat] || 0) + item.etats[etat];
        });
        acc.TOTAL = (acc.TOTAL || 0) + item.total;
        return acc;
      }, {})
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("Erreur lors de la récupération de l'inventaire:", error);
    res.status(500).json({ 
      error: error.message,
      details: "Erreur lors de la récupération de l'inventaire"
    });
  }
});

export { inventaire_materiel_par_service };