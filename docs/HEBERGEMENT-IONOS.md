# Héberger fiara.mdg sur IONOS

## Quelle offre IONOS ?

fiara.mdg fait tourner deux serveurs Node.js en permanence (site Next.js et API Express) et une base PostgreSQL.
Un **hébergement web mutualisé** IONOS (pensé pour PHP / WordPress) ne convient pas : il faut un **VPS Linux** (ou un serveur cloud),
sur lequel on installe Docker. Tout le nécessaire est dans [`deploy/`](../deploy).

## Même serveur ou base séparée ?

| | Démarrage économique | Recommandé dès que le trafic décolle |
|---|---|---|
| Site + API | 1 VPS IONOS (Docker) | Le même VPS (ou 2 VPS derrière un répartiteur) |
| PostgreSQL | Conteneur sur le **même VPS**, sans port ouvert sur Internet | **IONOS DBaaS PostgreSQL** (base managée : sauvegardes, restauration à la minute, mises à jour) |
| Photos | Volume Docker sur le VPS | IONOS Object Storage (S3) + CDN |
| Pièces d'identité | Volume Docker **séparé et privé**, chiffré | Idem (ou bucket S3 privé dédié, chiffré côté serveur **et** par l'application) |
| Sauvegardes | `deploy/backup.sh` → IONOS Object Storage, chiffrées | Sauvegardes DBaaS + copie hors site |

**Pour démarrer, tout sur un seul VPS est acceptable** si trois conditions sont remplies : PostgreSQL n'est pas exposé sur Internet
(c'est le cas dans `docker-compose.yml`), les sauvegardes partent chiffrées vers un autre stockage chaque nuit, et la restauration est testée.
Passez la base sur DBaaS dès que vous dépendez des revenus de la plateforme : c'est le composant dont la perte coûte le plus.

Taille de VPS pour le lancement : 2 à 4 vCPU, 4 à 8 Go de RAM, 80 Go SSD minimum (Next.js et PostgreSQL sont les plus gourmands).
Choisissez le centre de données IONOS européen qui donne le meilleur temps de réponse depuis Antananarivo (à mesurer avec `ping` depuis Telma, Orange et Airtel).

## Où sont stockées les données

| Donnée | Où | Protection |
|---|---|---|
| Profils, comptes pro | PostgreSQL : `users`, `dealer_profiles` | Mots de passe hachés bcrypt ; base non exposée |
| Favoris | PostgreSQL : `favorites` (= « user_favorites ») | Clé primaire (utilisateur, annonce) : un clic ajoute, un clic retire |
| Recherches récentes | PostgreSQL : `search_history` (= « recent_searches ») | 20 dernières par utilisateur, dédoublonnées |
| Messages | PostgreSQL : `conversations`, `messages` | Lecture limitée aux deux participants |
| Photos d'annonces | Volume `photos` → servi par Caddy sous `/uploads/` | Public par nature |
| **Passeports** | Volume `identity`, monté **uniquement** dans le conteneur API | Voir ci-dessous |

## Pièces d'identité : les règles appliquées dans le code

1. **Jamais dans un dossier public** : le volume `identity` n'est monté ni dans Caddy ni dans le site ; aucune route ne le sert.
2. **Jamais en clair sur le disque** : le fichier reste en mémoire à la réception, puis il est chiffré en **AES-256-GCM**
   (`apps/api/src/lib/identity-vault.ts`) avant écriture, nom aléatoire, permissions `0600`.
3. **Clé hors de la base et du dépôt** : `IDENTITY_ENCRYPTION_KEY` dans `deploy/.env` (`chmod 600`), copie dans un gestionnaire de mots de passe.
   Un vol de la base ou du disque seul ne donne accès à aucun document.
4. **Accès minimal** : seul un compte `admin` peut afficher le document (`GET /api/admin/verifications/:id/document`), déchiffré à la volée,
   avec `Cache-Control: no-store`.
5. **Minimisation** : le fichier est **supprimé dès la décision** (validé ou refusé). La base ne garde que le nom déclaré, les 4 derniers caractères
   du numéro, l'empreinte SHA-256 (détection d'un même document envoyé depuis plusieurs comptes) et la décision.
6. **Pas de sauvegarde** des pièces d'identité : elles sont temporaires par conception.
7. **Cadre légal** : données personnelles sensibles au sens de la loi n° 2014-038 — déclaration à la CMIL et mention dans la politique
   de confidentialité, à valider avec un juriste.

## Mise en ligne pas à pas

```bash
# Sur le VPS (Ubuntu 24.04) : Docker + pare-feu limité à SSH, HTTP, HTTPS
sudo apt update && sudo apt install -y docker.io docker-compose-v2 ufw
sudo ufw allow OpenSSH && sudo ufw allow 80,443/tcp && sudo ufw enable

git clone <votre dépôt> /opt/fiara && cd /opt/fiara
cp deploy/.env.example deploy/.env && chmod 600 deploy/.env   # remplir les secrets (openssl rand -base64 32)
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build
docker compose -f deploy/docker-compose.yml --env-file deploy/.env run --rm api npm run migrate --workspace apps/api
```

Caddy obtient le certificat HTTPS tout seul dès que le DNS du domaine pointe vers le VPS.
Créez ensuite le premier compte administrateur (`UPDATE users SET role = 'admin' WHERE email = '…';`), puis planifiez `deploy/backup.sh`.

## Points de vigilance

- **Tuiles de carte** : OpenStreetMap convient au lancement, mais sa politique d'usage interdit un trafic soutenu sans accord.
  Prévoyez un fournisseur de tuiles (MapTiler, Stadia, Thunderforest…) via `NEXT_PUBLIC_MAP_TILE_URL` (à fournir au build du site).
- **Mises à jour** : `docker compose pull && docker compose up -d --build` chaque mois, et les mises à jour de sécurité du système (`unattended-upgrades`).
- **Supervision** : au minimum une alerte de disponibilité sur `https://votre-domaine/api/health`.
