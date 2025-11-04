import { PrismaClient } from "@prisma/client";

import asyncHandler from "../Middleware/asyncHandler.js";

const prisma = new PrismaClient();

const get_stock_consommable = asyncHandler(async (req, res, next) => {
  try {
    const consommable = await prisma.consommable.findUnique({
      where: { id_consommable: Number(req.params.id) },
      include: {
        classe: {
          select: {
            id_classe: true,
            nom_classe: true
          }
        },
        lot_consommables: {
          select: {
            id_consommable: true,
            quantite_don: true,
            date_don_consommable: true
          }
        },
        prets: {
          include: {
            service: {
              select: {
                id_service: true,
                nom_service: true
              }
            }
          }
        }
      }
    });

    // Fonction pour générer le tableau de suivi de stock
    const generateStockTable = (data) => {
      if (!data) return [];
      
      const operations = [];
      let currentStock = 0;

      // Ajouter les entrées (lots)
      data.lot_consommables.forEach(lot => {
        operations.push({
          date: lot.date_don_consommable, // On garde la date telle quelle
          type: 'entree',
          quantite: lot.quantite_don,
          service: null
        });
      });

      // Ajouter les sorties (prets)
      data.prets.forEach(pret => {
        operations.push({
          date: pret.date_envoi, // On garde la date telle quelle
          type: 'sortie',
          quantite: pret.quantite_pret,
          service: pret.service.nom_service
        });
      });

      // Trier par date
      operations.sort((a, b) => new Date(a.date) - new Date(b.date));

      // Générer le tableau final
      const stockTable = [];
      operations.forEach(op => {
        if (op.type === 'entree') {
          stockTable.push({
            Date: op.date,
            'Nom Service': '-',
            Existants: currentStock,
            Entrees: op.quantite,
            Sorties: 0,
            Restes: currentStock + op.quantite
          });
          currentStock += op.quantite;
        } else {
          stockTable.push({
            Date: op.date,
            'Nom Service': op.service,
            Existants: currentStock,
            Entrees: 0,
            Sorties: op.quantite,
            Restes: currentStock - op.quantite
          });
          currentStock -= op.quantite;
        }
      });

      return stockTable;
    };

    const response = {
      entete: {
        'Nom Consommable': consommable.nom_consommable,
        'Unite': consommable.unite,
        'Classe': consommable.classe.nom_classe
      },
      tableau: generateStockTable(consommable)
    };

    res.status(200).json(response);
    
  } catch (error) {
    res.status(500).json({ 
      error: error.message,
      details: "Erreur lors de la récupération du stock consommable" 
    });
  }
});

export {
get_stock_consommable,
};
