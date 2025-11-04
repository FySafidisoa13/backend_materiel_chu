-- CreateEnum
CREATE TYPE "Type" AS ENUM ('DIRECTEUR', 'RESPONSABLE');

-- CreateEnum
CREATE TYPE "Etat" AS ENUM ('BON', 'MAUVAIS', 'PERDU', 'EPUISÉ');

-- CreateEnum
CREATE TYPE "Source" AS ENUM ('DON', 'ACHAT');

-- CreateTable
CREATE TABLE "Compte" (
    "id_compte" SERIAL NOT NULL,
    "pseudo" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "mdp" TEXT NOT NULL,
    "type" "Type" NOT NULL,
    "id_personne" INTEGER NOT NULL,

    CONSTRAINT "Compte_pkey" PRIMARY KEY ("id_compte")
);

-- CreateTable
CREATE TABLE "Personne" (
    "id_personne" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "cin" TEXT NOT NULL,
    "telephone" TEXT NOT NULL,
    "adress" TEXT NOT NULL,
    "fonction" TEXT NOT NULL,
    "id_service" INTEGER NOT NULL,

    CONSTRAINT "Personne_pkey" PRIMARY KEY ("id_personne")
);

-- CreateTable
CREATE TABLE "Service" (
    "id_service" SERIAL NOT NULL,
    "nom_service" TEXT NOT NULL,
    "localisation" TEXT NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id_service")
);

-- CreateTable
CREATE TABLE "UtilisateurMateriel" (
    "id_utilisateur" SERIAL NOT NULL,
    "nom_utilisateur" TEXT NOT NULL,
    "tel_utilisateur" TEXT NOT NULL,
    "adresse" TEXT NOT NULL,
    "poste" TEXT NOT NULL,

    CONSTRAINT "UtilisateurMateriel_pkey" PRIMARY KEY ("id_utilisateur")
);

-- CreateTable
CREATE TABLE "Pret" (
    "id_pret" SERIAL NOT NULL,
    "date_envoi" TIMESTAMP(3) NOT NULL,
    "date_retour" TIMESTAMP(3),
    "id_service" INTEGER NOT NULL,
    "id_utilisateur" INTEGER NOT NULL,

    CONSTRAINT "Pret_pkey" PRIMARY KEY ("id_pret")
);

-- CreateTable
CREATE TABLE "Materiels" (
    "id_materiel" SERIAL NOT NULL,
    "nom_materiel" TEXT NOT NULL,
    "etat" "Etat" NOT NULL,
    "quantiteMateriel" INTEGER NOT NULL,
    "source" "Source" NOT NULL,
    "codeQR" TEXT NOT NULL,
    "id_classe" INTEGER NOT NULL,
    "id_donneur" INTEGER NOT NULL,

    CONSTRAINT "Materiels_pkey" PRIMARY KEY ("id_materiel")
);

-- CreateTable
CREATE TABLE "Classe" (
    "id_classe" SERIAL NOT NULL,
    "nom_classe" TEXT NOT NULL,
    "id_categorie" INTEGER NOT NULL,

    CONSTRAINT "Classe_pkey" PRIMARY KEY ("id_classe")
);

-- CreateTable
CREATE TABLE "Categorie" (
    "id_categorie" SERIAL NOT NULL,
    "nom_categorie" TEXT NOT NULL,

    CONSTRAINT "Categorie_pkey" PRIMARY KEY ("id_categorie")
);

-- CreateTable
CREATE TABLE "Donneur" (
    "id_donneur" SERIAL NOT NULL,
    "nom_donneur" TEXT NOT NULL,
    "fonction_donneur" TEXT NOT NULL,

    CONSTRAINT "Donneur_pkey" PRIMARY KEY ("id_donneur")
);

-- CreateTable
CREATE TABLE "_MaterielsToPret" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_MaterielsToPret_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Compte_id_personne_key" ON "Compte"("id_personne");

-- CreateIndex
CREATE INDEX "_MaterielsToPret_B_index" ON "_MaterielsToPret"("B");

-- AddForeignKey
ALTER TABLE "Compte" ADD CONSTRAINT "Compte_id_personne_fkey" FOREIGN KEY ("id_personne") REFERENCES "Personne"("id_personne") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Personne" ADD CONSTRAINT "Personne_id_service_fkey" FOREIGN KEY ("id_service") REFERENCES "Service"("id_service") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pret" ADD CONSTRAINT "Pret_id_service_fkey" FOREIGN KEY ("id_service") REFERENCES "Service"("id_service") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pret" ADD CONSTRAINT "Pret_id_utilisateur_fkey" FOREIGN KEY ("id_utilisateur") REFERENCES "UtilisateurMateriel"("id_utilisateur") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Materiels" ADD CONSTRAINT "Materiels_id_classe_fkey" FOREIGN KEY ("id_classe") REFERENCES "Classe"("id_classe") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Materiels" ADD CONSTRAINT "Materiels_id_donneur_fkey" FOREIGN KEY ("id_donneur") REFERENCES "Donneur"("id_donneur") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Classe" ADD CONSTRAINT "Classe_id_categorie_fkey" FOREIGN KEY ("id_categorie") REFERENCES "Categorie"("id_categorie") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MaterielsToPret" ADD CONSTRAINT "_MaterielsToPret_A_fkey" FOREIGN KEY ("A") REFERENCES "Materiels"("id_materiel") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MaterielsToPret" ADD CONSTRAINT "_MaterielsToPret_B_fkey" FOREIGN KEY ("B") REFERENCES "Pret"("id_pret") ON DELETE CASCADE ON UPDATE CASCADE;
