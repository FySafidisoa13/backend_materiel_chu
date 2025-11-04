import { PrismaClient } from "@prisma/client";
import asyncHandler from "../Middleware/asyncHandler.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET;
const SALT_ROUNDS = parseInt(process.env.SALT_ROUNDS) || 10;

// ✅ GET ALL COMPTES
const get_compte = asyncHandler(async (req, res) => {
  const comptes = await prisma.compte.findMany({
    include: {
      personne: {
        select: {
          id_personne: true,
          nom: true,
        },
      },
    },
  });

  const comptesSansMdp = comptes.map(({ mdp, ...rest }) => rest);

  res.status(200).json(comptesSansMdp);
});

// ✅ COUNT COMPTES
const count_compte = asyncHandler(async (req, res) => {
  const count = await prisma.compte.count();
  res.status(200).json(count);
});

// ✅ LOGIN2
const login2 = asyncHandler(async (req, res) => {
  console.log("login2 called");

  const { pseudo, mdp } = req.body;

  if (!pseudo || !mdp) {
    return res.status(400).json({ message: "Pseudo et mot de passe requis" });
  }

  const compte = await prisma.compte.findUnique({
    where: { pseudo },
    include: { personne: true },
  });

  if (!compte) {
    return res.status(404).json({ message: "Pseudo introuvable" });
  }

  const isPasswordValid = await bcrypt.compare(mdp, compte.mdp);
  if (!isPasswordValid) {
    return res.status(401).json({ message: "Mot de passe incorrect" });
  }

  return res.status(200).json({
    message: "Connexion réussie",
  });
});
// ✅ LOGIN
const login = asyncHandler(async (req, res) => {
  const { pseudo, mdp } = req.body;

  if (!pseudo || !mdp) {
    return res.status(400).json({ message: "Pseudo et mot de passe requis" });
  }

  const compte = await prisma.compte.findUnique({
    where: { pseudo },
    include: { personne: true },
  });

  if (!compte) {
    return res.status(404).json({ message: "Pseudo introuvable" });
  }

  const isPasswordValid = await bcrypt.compare(mdp, compte.mdp);
  if (!isPasswordValid) {
    return res.status(401).json({ message: "Mot de passe incorrect" });
  }

  const token = jwt.sign(
    {
      id: compte.id_compte,
      pseudo: compte.pseudo,
      type: compte.type,
      personneId: compte.id_personne,
    },
    JWT_SECRET,
    { expiresIn: "12h" }
  );

  return res.status(200).json({
    message: "Connexion réussie",
    token,
    user: {
      id: compte.id_compte,
      pseudo: compte.pseudo,
      type: compte.type,
      personne: compte.personne,
    },
  });
});

// ✅ CREATE COMPTE
const create_compte = asyncHandler(async (req, res) => {
  const { pseudo, mdp, type, id_personne } = req.body;

  if (!pseudo || !mdp || !type || !id_personne) {
    return res.status(400).json({ message: "Tous les champs sont requis" });
  }

  if (
    !["DIRECTEUR", "RESPONSABLE", "SERVICE", "SERVICE_VUE"].includes(
      type.replace(/\s/g, "")
    )
  ) {
    return res.status(422).json({ message: "Type de compte invalide" });
  }

  const personne = await prisma.personne.findUnique({
    where: { id_personne },
  });
  if (!personne) {
    return res.status(404).json({ message: "Personne introuvable" });
  }

  const existingCompte = await prisma.compte.findFirst({
    where: {
      OR: [{ id_personne: id_personne }, { pseudo: pseudo }],
    },
  });

  if (existingCompte) {
    if (existingCompte.id_personne === parseInt(id_personne)) {
      return res
        .status(409)
        .json({ message: "Cette personne a déjà un compte" });
    }
    return res.status(409).json({ message: "Ce pseudo est déjà utilisé" });
  }

  const hashedPassword = await bcrypt.hash(mdp, SALT_ROUNDS);

  // Génération du code de récupération à 6 chiffres
  const code_recuperation = Math.floor(1000 + Math.random() * 9000);

  const compte = await prisma.compte.create({
    data: {
      pseudo,
      mdp: hashedPassword,
      type,
      id_personne: parseInt(id_personne),
      code_recuperation: code_recuperation,
    },
  });

  const token = jwt.sign(
    {
      id: compte.id_compte,
      pseudo: compte.pseudo,
      type: compte.type,
      personneId: compte.id_personne,
    },
    JWT_SECRET,
    { expiresIn: "12h" }
  );

  return res.status(201).json({
    message: "Compte créé avec succès",
    token,
    user: {
      id: compte.id_compte,
      pseudo: compte.pseudo,
      type: compte.type,
      code_recuperation: compte.code_recuperation,
    },
  });
});

// ✅ UPDATE ACCOUNT (pseudo + password)
const update_account = asyncHandler(async (req, res) => {
  const { id_personne, currentPassword, newPseudo, newPassword } = req.body;

  // ✅ Vérifier les champs obligatoires
  if (!id_personne || !currentPassword) {
    return res.status(400).json({
      message:
        "L'identifiant de la personne et le mot de passe actuel sont requis.",
    });
  }

  if (!newPseudo && !newPassword) {
    return res.status(400).json({
      message:
        "Vous devez fournir au moins un champ à modifier (pseudo ou mot de passe).",
    });
  }

  // ✅ Chercher le compte lié
  const compte = await prisma.compte.findUnique({
    where: { id_personne: parseInt(id_personne) },
    include: { personne: true },
  });

  if (!compte) {
    return res.status(404).json({ message: "Compte introuvable." });
  }

  // ✅ Vérifier le mot de passe actuel
  const passwordMatch = await bcrypt.compare(currentPassword, compte.mdp);
  if (!passwordMatch) {
    return res.status(401).json({ message: "Mot de passe actuel incorrect." });
  }

  // ✅ Vérifier que le nouveau pseudo est libre si fourni
  if (newPseudo && newPseudo !== compte.pseudo) {
    const pseudoExists = await prisma.compte.findUnique({
      where: { pseudo: newPseudo },
    });
    if (pseudoExists) {
      return res.status(409).json({ message: "Ce pseudo est déjà utilisé." });
    }
  }

  // ✅ Vérifier que le nouveau mot de passe est différent si fourni
  if (newPassword) {
    const isSamePassword = await bcrypt.compare(newPassword, compte.mdp);
    if (isSamePassword) {
      return res.status(400).json({
        message: "Le nouveau mot de passe doit être différent de l'actuel.",
      });
    }
  }

  // ✅ Construire les nouvelles données
  const updateData = {};
  if (newPseudo) updateData.pseudo = newPseudo;
  if (newPassword) updateData.mdp = await bcrypt.hash(newPassword, SALT_ROUNDS);

  // ✅ Faire la mise à jour
  const updatedCompte = await prisma.compte.update({
    where: { id_compte: compte.id_compte },
    data: updateData,
    include: { personne: true },
  });

  // ✅ Regénérer le token seulement si pseudo changé
  let newToken = null;
  if (newPseudo) {
    newToken = jwt.sign(
      {
        id: updatedCompte.id_compte,
        pseudo: updatedCompte.pseudo,
        type: updatedCompte.type,
        personneId: updatedCompte.id_personne,
      },
      JWT_SECRET,
      { expiresIn: "12h" }
    );
  }

  return res.status(200).json({
    message: "Compte mis à jour avec succès.",
    ...(newToken && { token: newToken }),
    user: {
      id: updatedCompte.id_compte,
      pseudo: updatedCompte.pseudo,
      type: updatedCompte.type,
      personne: updatedCompte.personne,
    },
  });
});

const checkCIN = asyncHandler(async (req, res) => {
  const { IM } = req.body;

  if (!IM) {
    return res.status(400).json({ message: "Le champ IM est requis" });
  }

  // Convert IM to number
  const imNumber = parseInt(IM, 10);

  // Check if the conversion was successful
  if (isNaN(imNumber)) {
    return res.status(400).json({ message: "IM doit être un nombre valide" });
  }

  // Vérifier si la personne existe
  const personne = await prisma.personne.findUnique({
    where: { IM: imNumber }, // Use the converted number here
  });

  if (!personne) {
    return res.status(404).json({ message: "IM n'existe pas" });
  }

  // Vérifier si la personne a déjà un compte
  const compte = await prisma.compte.findUnique({
    where: { id_personne: personne.id_personne },
  });

  if (compte) {
    return res.status(501).json({
      message: "IM existe mais déjà un compte",
    });
  }

  // Tout est OK : IM existe et aucun compte => renvoie aussi id_personne
  return res.status(200).json({
    message: "IM existe, aucun compte encore créé",
    id_personne: personne.id_personne,
  });
});

// ✅ UPDATE COMPTE
const update_compte = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const { pseudo, mdp, type } = req.body;

  const updateData = {};

  if (pseudo) updateData.pseudo = pseudo;
  if (type) {
    if (
      !["DIRECTEUR", "RESPONSABLE", "SERVICE", "SERVICE_VUE"].includes(type)
    ) {
      return res.status(400).json({ message: "Type de compte invalide" });
    }
    updateData.type = type;
  }

  if (mdp) {
    updateData.mdp = await bcrypt.hash(mdp, SALT_ROUNDS);
  }

  const compte = await prisma.compte.findUnique({ where: { id_compte: id } });
  if (!compte) {
    return res.status(404).json({ message: "Compte introuvable" });
  }

  const updatedCompte = await prisma.compte.update({
    where: { id_compte: id },
    data: updateData,
  });

  const { mdp: _, ...compteSansMdp } = updatedCompte;

  res.status(200).json(compteSansMdp);
});

// ✅ DELETE COMPTE
const delete_compte = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);

  const compte = await prisma.compte.findUnique({ where: { id_compte: id } });
  if (!compte) {
    return res.status(404).json({ message: "Compte introuvable" });
  }

  await prisma.compte.delete({ where: { id_compte: id } });

  res.status(200).json({ message: "Compte supprimé", id });
});

// ✅ GET ONE COMPTE
const get_one_compte = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);

  const compte = await prisma.compte.findUnique({
    where: { id_compte: id },
    include: { personne: true },
  });

  if (!compte) {
    return res.status(404).json({ message: "Compte introuvable" });
  }

  const { mdp: _, ...compteSansMdp } = compte;

  res.status(200).json(compteSansMdp);
});

const hasResponsableCompte = async (req, res) => {
  console.log("Vérification de l'existence d'un compte RESPONSABLE...");

  try {
    const responsableExists = await prisma.compte.findFirst({
      where: { type: "RESPONSABLE" },
    });
    res.status(200).json({ exists: !!responsableExists });
  } catch (error) {
    res.status(500).json({ error: "Erreur serveur", details: error.message });
  }
};

// POST /api/standard/check-code-recuperation
const checkCodeRecuperation = asyncHandler(async (req, res) => {
  const { pseudo, code_recuperation } = req.body;
  const compte = await prisma.compte.findUnique({ where: { pseudo } });

  if (!compte) return res.status(404).json({ message: "Pseudo introuvable" });
  if (compte.code_recuperation !== Number(code_recuperation))
    return res.status(401).json({ message: "Code de récupération incorrect" });

  return res.status(200).json({ message: "Code validé" });
});

const resetPassword = asyncHandler(async (req, res) => {
  const { pseudo, code_recuperation, nouveau_mdp } = req.body;

  // 1. Vérifie le compte
  const compte = await prisma.compte.findUnique({ where: { pseudo } });
  if (!compte) return res.status(404).json({ message: "Pseudo introuvable" });
  if (compte.code_recuperation !== Number(code_recuperation))
    return res.status(401).json({ message: "Code de récupération incorrect" });

  // 2. Hash le nouveau mot de passe
  const hash = await bcrypt.hash(nouveau_mdp, 10);

  // 3. Génère un nouveau code de récupération (ex: random 4 chiffres)
  const newCode = Math.floor(1000 + Math.random() * 9000);

  // 4. Modifie le mot de passe et le code de récupération
  await prisma.compte.update({
    where: { pseudo },
    data: { mdp: hash, code_recuperation: newCode },
  });

  return res.status(200).json({ message: "Mot de passe modifié avec succès" });
});

const update_type_compte = asyncHandler(async (req, res) => {
  const { id_personne, type } = req.body;

  // Validation des paramètres
  if (!id_personne || !type) {
    return res.status(400).json({ message: "id_personne et type sont requis" });
  }

  // Vérifie le type autorisé
  const ALLOWED_TYPES = ["DIRECTEUR", "RESPONSABLE", "SERVICE", "SERVICE_VUE"];
  if (!ALLOWED_TYPES.includes(type)) {
    return res.status(400).json({ message: "Type de compte invalide" });
  }

  // Cherche le compte lié à cette personne
  const compte = await prisma.compte.findUnique({
    where: { id_personne: Number(id_personne) },
  });
  if (!compte) {
    return res
      .status(404)
      .json({ message: "Compte introuvable pour cette personne" });
  }

  // Met à jour le type
  const updatedCompte = await prisma.compte.update({
    where: { id_compte: compte.id_compte },
    data: { type },
  });

  // On retire le mot de passe du retour
  const { mdp, ...compteSansMdp } = updatedCompte;

  res.status(200).json(compteSansMdp);
});

const check_type_compte = asyncHandler(async (req, res) => {
  const { id_personne, type } = req.body;

  // Vérification des paramètres
  if (!id_personne || !type) {
    return res.status(400).json({ message: "Paramètres manquants" });
  }

  // Récupère le compte lié à la personne
  const compte = await prisma.compte.findUnique({
    where: { id_personne: Number(id_personne) },
    select: { type: true },
  });

  if (!compte) {
    return res.status(404).json({ message: "Compte introuvable" });
  }

  const same = compte.type === type.trim();

  res.status(200).json({
    same,
    typeCompte: compte.type,
  });
});

export {
  get_compte,
  login,
  count_compte,
  create_compte,
  update_compte,
  delete_compte,
  get_one_compte,
  update_account,
  checkCIN,
  login2,
  checkCodeRecuperation,
  hasResponsableCompte,
  update_type_compte,
  resetPassword,
  check_type_compte,
};
