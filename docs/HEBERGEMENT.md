# Hébergement et stockage des données — fiara.mdg

## Réponse courte

**Séparez la base de données du site dès la mise en ligne**, sur un service PostgreSQL managé, dans un réseau privé.
Le site (Next.js) et l'API (Express) tournent dans des conteneurs sans état ; les photos vont dans un stockage objet servi par un CDN.
Un seul VPS « tout-en-un » coûte moins cher au départ, mais une panne, une faille ou une mise à jour du serveur web touche alors aussi les données,
et les sauvegardes restent artisanales. Le service managé apporte d'emblée sauvegardes, restauration à la minute près, chiffrement et mises à jour.

## Où va chaque donnée

| Donnée | Stockage | Protection |
|---|---|---|
| Comptes, profils pro, NIF/STAT | PostgreSQL (`users`, `dealer_profiles`) | Mots de passe hachés (bcrypt, coût 12), accès réseau privé uniquement |
| Favoris, recherches récentes, alertes | PostgreSQL (`favorites`, `search_history`, `saved_searches`) | Liés au compte : identiques sur tous les appareils ; 20 recherches max par utilisateur |
| Messagerie, prospects, historique | PostgreSQL (`conversations`, `messages`, `leads`, `lead_activities`) | Lecture limitée aux deux participants (et à l'équipe pro pour les prospects) |
| Paiements | PostgreSQL (`payments`, `payment_events`) | **Aucune donnée de carte** : Stripe et PayPal hébergent la saisie (périmètre PCI DSS minimal, SAQ A) ; seuls marque et 4 derniers chiffres sont gardés |
| Photos d'annonces | Stockage objet (S3, Cloudflare R2, GCS) + CDN | Fichiers ré-encodés en WebP, métadonnées EXIF (GPS) supprimées |
| Session | Cookie httpOnly signé (JWT), rien côté serveur | `Secure`, `SameSite=Lax`, 7 jours |
| Secrets (JWT, Stripe, PayPal, opérateurs) | Gestionnaire de secrets de l'hébergeur | Jamais dans le dépôt Git ; rotation possible |

## Contraintes propres à Madagascar

- **Accès surtout mobile, data chère** : priorité au CDN (images WebP redimensionnées, cache long), pages rendues côté serveur et JavaScript léger.
- **Latence** : le trafic international passe par les câbles sous-marins (EASSy, LION, METISS, 2Africa). Les régions cloud les plus proches sont en Afrique du Sud
  (Johannesburg, Le Cap) ; l'Europe (Paris, Francfort) reste une option. **Mesurez avant de choisir** : `ping` et temps de chargement depuis Antananarivo
  sur Telma, Orange et Airtel vers chaque région candidate.
- **Données personnelles** : la loi n° 2014-038 encadre leur traitement (déclaration à la CMIL, droits d'accès et de suppression, transferts hors de Madagascar).
  À valider avec un juriste avant le lancement, notamment si la base est hébergée à l'étranger.

## Architecture de déploiement recommandée

```
Utilisateurs (mobile 3G/4G, Antananarivo et régions)
        │ HTTPS
        ▼
CDN + pare-feu applicatif (WAF, anti-DDoS, cache des pages publiques et des photos)
        │
        ├──► Site Next.js  (conteneurs sans état, ≥ 2 instances)
        │        │ /bff → réseau privé
        │        ▼
        └──► API Express (conteneurs sans état, ≥ 2 instances) ──► Stockage objet (photos)
                 │                         │
                 │ réseau privé, TLS       └──► Worker (tâches planifiées : expirations, alertes, relances paiement)
                 ▼
        PostgreSQL managé (primaire + réplique de lecture, sauvegardes + PITR, chiffré)
                 ▲
        Redis managé (phase 2 : limitation de débit, temps réel de la messagerie)

Prestataires externes : Stripe, PayPal, MVola, Orange Money, Airtel Money → webhooks signés vers l'API
```

## Trois options concrètes

| Option | Composants | Pour qui |
|---|---|---|
| **A. Google Cloud, région Johannesburg** | Cloud Run (web + API), Cloud SQL PostgreSQL, Cloud Storage + Cloud CDN, Secret Manager | Proche de Madagascar, entièrement managé, montée en charge automatique |
| **B. AWS, région Le Cap** | ECS Fargate ou App Runner, RDS PostgreSQL, S3 + CloudFront, Secrets Manager | Même logique ; écosystème AWS |
| **C. Budget serré** | 1 VPS (web + API en conteneurs) + PostgreSQL managé séparé (DigitalOcean, Scaleway, OVHcloud ou Supabase) + Cloudflare R2 et CDN | Lancement à petit coût ; la base reste séparée et sauvegardée |

Supabase convient pour la base PostgreSQL : le schéma fiara.mdg y fonctionne tel quel avec `DATABASE_URL`. Ses régions les plus proches sont en Europe ;
vérifiez la latence depuis Madagascar. Inutile en revanche d'adopter son système d'authentification : fiara.mdg a déjà le sien.

## Montée en charge par étapes

1. **Lancement** : 1 à 2 instances web/API, PostgreSQL managé (petite instance, sauvegardes quotidiennes + PITR 7 jours), stockage objet + CDN.
2. **Croissance** : réplique de lecture pour la recherche, Redis, worker séparé, messagerie temps réel (SSE/WebSocket), supervision (erreurs, lenteurs).
3. **Grand volume** : moteur de recherche dédié (Meilisearch ou OpenSearch) si la recherche plein texte PostgreSQL ne suffit plus, partitionnement de `messages` et `ad_daily_stats`.

## Règles de sécurité à appliquer

- La base n'a **pas d'adresse publique** ; l'API s'y connecte en TLS avec un utilisateur sans droits de modification du schéma. Les migrations utilisent un autre compte.
- Sauvegardes chiffrées, copie dans une autre région, **test de restauration** chaque mois.
- Journaux sans données personnelles (pas de numéros ni de messages en clair dans les logs).
- Limitation de débit sur la connexion, l'affichage des numéros et l'envoi de messages.
- Suppression de compte : effacement ou anonymisation des messages, recherches et favoris (droit de suppression).
