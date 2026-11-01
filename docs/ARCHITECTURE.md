# Architecture de fiara.mdg

## Stack

| Couche | Choix | Pourquoi |
|---|---|---|
| Front | **Next.js (App Router) + React 19 + Tailwind CSS 4** | Listes et fiches rendues côté serveur (référencement), pages légères pour les connexions mobiles. |
| Langues | Dictionnaires typés `fr` / `mg`, langue dans le cookie `fiara_lang` | Pas de changement d'URL ; le malgache a exactement les mêmes clés que le français (contrôlé par TypeScript). |
| Session | JWT de l'API dans un cookie **httpOnly** `fiara_session` + proxy `/bff/*` | Le jeton n'est jamais lisible par le JavaScript du navigateur ; les uploads multipart passent par le proxy en flux. |
| API | **Node.js + Express 5 + TypeScript + Zod** | Une seule langue sur tout le projet, validation stricte, API réutilisable par une future app mobile. |
| Base | **PostgreSQL** (PGlite en dev) | Recherche plein texte, JSONB, enums ; migrations SQL versionnées dans `db/migrations/`. |
| Navigation | Barre d'onglets fixe sur mobile, mêmes 4 accès dans l'en-tête sur ordinateur (`components/app-nav.tsx`) | Accueil, Recherche, Discussion (pastille des non-lus), Profil : comme une application native. |
| Fichiers | Disque local (`/uploads`) | Interface `lib/uploads.ts` à remplacer par un stockage objet + CDN. |

## Modèle de données

```
provinces 1─n cities
users 1─0..1 dealer_profiles 1─n dealer_sites
dealer_profiles 1─n dealer_members n─1 users          (équipe : proprietaire / gestionnaire / commercial)
dealer_profiles 1─n dealer_subscriptions n─1 subscription_plans 1─n plan_tool_access
brands 1─n models ; users 1─n vehicles n─n equipment
vehicles 1─n ads 1─n ad_photos ; ads 1─n ad_daily_stats ; ads 1─n ad_quality_reports
ads 1─n conversations 1─n messages
dealer_profiles 1─n leads 1─n lead_activities         (lead ↔ conversation 0..1)
ads 1─n direct_offers 1─n direct_offer_recipients     (destinataires = utilisateurs ayant l'annonce en favori)
users n─n ads (favorites) ; users 1─n saved_searches
users 1─n search_history (20 dernières recherches, dédoublonnées) ; saved_searches = alertes
payments (purpose : sponsorisation | abonnement ; method : mobile_money | carte | paypal) 1─n payment_events
sponsorship_plans 1─n ad_sponsorships n─1 payments
```

Spécificités Madagascar : prix en `BIGINT` Ariary, 6 provinces et grandes villes avec nom d'usage, provenance
(`occasion_madagascar`, `import_europe`, `import_asie`, `import_autre`), statut douanier (`dedouane`, `non_dedouane`, `en_cours`),
téléphones 032/033/034/037/038 stockés en E.164.

## Formules professionnelles

| | Bronze — Essentiel | Silver — Développement | Gold — Professionnel | Platinum — Premium |
|---|---|---|---|---|
| Prix | 15 000 Ar / mois | 35 000 Ar / mois | 65 000 Ar / mois | 120 000 Ar / mois (devis au-delà de 60 véhicules ou pour un réseau) |
| Véhicules en ligne | 5 | 15 | 30 | 60 |
| Interlocuteurs commerciaux | 0 | 1 | 5 | 10 |
| Visibilité (tri « pertinence ») | standard (0) | renforcée (1) | élevée (2) | maximale (3) |
| Analyse de la demande | limitée (totaux) | complète (courbes 30 j, référence plateforme) | complète | complète |
| Comparaison du marché | — | limitée (statistiques) | complète (+ comparables, estimation IA) | complète |
| Lead Manager Pro | limité (50 prospects, sans attribution) | limité | complet (attribution, relances) | complet |
| Offre directe | 3 / mois | 10 / mois | 30 / mois | illimitée |
| Contrôle qualité IA | score + 1 recommandation | complet | complet | complet |
| Multi-sites, recommandations exclusives | — | — | — | oui |

Les droits sont des **données** (`plan_tool_access`) et non du code : changer une formule = une mise à jour SQL.
Côté API, `requireDealer` résout le compte pro (titulaire ou membre d'équipe) et `requireTool(outil)` vérifie la formule
(402 sans abonnement, 403 avec `details.upgrade` si l'outil n'est pas inclus). Un pro sans abonnement actif ne peut pas publier.

## Paiements

| Moyen | Prestataire | Parcours | Devise débitée |
|---|---|---|---|
| Mobile Money | MVola, Orange Money, Airtel Money | Demande poussée sur le téléphone, code secret | Ariary |
| Carte bancaire | Stripe Checkout | Redirection vers la page Stripe, webhook signé `checkout.session.completed` | EUR par défaut (`CARD_CURRENCY`) |
| PayPal | PayPal Orders v2 | Redirection vers PayPal, capture au retour (`/paiement/retour`) | EUR (PayPal ne gère pas l'Ariary) |

Le prix de référence reste toujours en Ariary (`amount_mga`) ; pour la carte et PayPal, le montant débité et le taux sont figés dans `payments`
(`charge_currency`, `charge_amount_minor`, `exchange_rate`). Stripe n'ouvre pas de compte marchand à Madagascar : il faudra une entité
dans un pays éligible (France, Maurice…), à confirmer avec Stripe. Sans clés, carte et PayPal fonctionnent en simulation.

### Flux

1. Création : `POST /api/payments/sponsor/:adId` ou `POST /api/pro/subscribe` → `payments` (avec `idempotency_key`).
2. **À brancher** : un connecteur par opérateur (`requestToPay`) pousse la demande sur le téléphone du payeur.
3. `POST /api/payments/callback/:provider` : chaque callback est d'abord enregistré tel quel dans `payment_events`.
4. `confirmPayment()` (idempotent) active la sponsorisation (`ads.sponsored_until`) ou l'abonnement (fin de l'ancien, début du nouveau).
5. L'interface interroge `GET /api/payments/:id` toutes les 3 s ; en développement, `POST /api/payments/:id/simulate` remplace l'opérateur.

## Endpoints

| Méthode | Route | Rôle |
|---|---|---|
| GET | `/api/ads`, `/api/ads/count` | Recherche détaillée, compteur en direct |
| GET | `/api/ads/:id` | Fiche (vue comptée dans `ad_daily_stats`) |
| POST | `/api/ads` | Création multipart, toutes catégories, 20 photos × 8 Mo ; plafond de la formule pour les pros |
| PATCH / DELETE | `/api/ads/:id`, `/api/ads/:id/status`, `/api/ads/:id/photos[/:photoId]` | Gestion par le vendeur ou son équipe |
| GET / PATCH | `/api/ads/:id/edit`, `/api/ads/:id/photos/order` | Formulaire de modification, ordre des photos |
| POST / DELETE | `/api/ads/:id/favorite` ; GET `/api/ads/favorites`, `/api/ads/mine` | Favoris, tableau de bord |
| POST | `/api/ads/:id/phone`, `/api/ads/:id/approve` | Numéro (tracé), modération |
| POST / GET / PATCH | `/api/auth/register`, `/api/auth/login`, `/api/auth/me` | Comptes |
| GET / POST | `/api/conversations…` | Messagerie |
| GET / POST | `/api/payments…`, `/api/payments/options`, `/api/payments/:id/return` | Paiements (Mobile Money, carte, PayPal) |
| POST | `/api/payments/webhooks/stripe` | Webhook Stripe (corps brut, signature vérifiée) |
| GET / DELETE / PUT | `/api/me/searches[/:id[/alert]]`, GET `/api/me/overview` | Profil : recherches récentes, alertes, compteurs |
| GET / POST | `/api/verifications/me`, `/api/verifications` (multipart `document`) | Vérification d'identité : statut, envoi du passeport |
| GET / POST | `/api/admin/verifications`, `/:id/document`, `/:id/decision` | Back-office : file, document déchiffré, validation / refus |
| POST | `/api/auth/password` ; GET `/api/conversations/unread` | Mot de passe, pastille des non-lus |
| GET | `/api/pro/plans` | Formules (public) |
| GET / POST | `/api/pro/me`, `/api/pro/subscribe`, `/api/pro/team`, `/api/pro/sites` | Compte pro |
| GET | `/api/pro/analytics`, `/api/pro/market/:adId`, `/api/pro/quality` | Outils d'analyse |
| GET / POST / PATCH | `/api/pro/leads…`, `/api/pro/offers` | Lead Manager, offre directe |

Hébergement et stockage : voir [HEBERGEMENT.md](HEBERGEMENT.md).

## Feuille de route vers le MVP

Ordre recommandé : chaque étape s'appuie sur la précédente.

1. ~~**Gestion des annonces dans le Profil**~~ — fait : modifier (prix sans repasser en modération), suspendre / remettre en ligne, marquer vendue, supprimer, photos (ajout, suppression, ordre, couverture).
2. **Back-office de modération** : file des annonces `en_attente`, validation ou refus motivé, signalements ; tâche planifiée qui fait expirer annonces, sponsorisations et abonnements.
3. **Comptes et sécurité** : vérification du téléphone par SMS (OTP), mot de passe oublié, limitation de débit sur `/auth`, `/phone` et la messagerie, journal d'audit.
4. **Photos en production** : ré-encodage WebP et suppression des métadonnées EXIF (sharp), miniatures, stockage objet et CDN.
5. **Connecteurs Mobile Money** : MVola, Orange Money, Airtel Money en bac à sable, webhooks signés et vérifiés, réconciliation quotidienne, reçus/factures avec NIF, renouvellement mensuel (rappel J-3, période de grâce).
6. **Notifications** : e-mail/SMS pour nouveaux messages, offres directes et fin d'abonnement ; messagerie temps réel (SSE ou WebSocket) à la place de l'interrogation toutes les 5 s.
7. **Recherches sauvegardées et alertes** (table `saved_searches` déjà en place).
8. **Espace pro, suite** : vitrine publique du garage, import de stock CSV, création de sites (Platinum), droits fins par rôle (gestionnaire / commercial), demande de devis Platinum intégrée.
9. **IA** : modèle d'estimation de prix entraîné sur l'historique des annonces (remplace `maquette-v0`), contrôle qualité par modèle (lecture des photos et de la description), détection de doublons et de fraude.
10. **Langues et référencement** : relecture du malgache par un locuteur natif, traduction des messages d'erreur de l'API via des codes, sitemap, métadonnées Open Graph, données structurées `Vehicle`.
11. **Qualité** : tests d'intégration de l'API (PGlite), tests de bout en bout (Playwright), intégration continue, supervision des erreurs, sauvegardes PostgreSQL.
12. **Mise en ligne** : PostgreSQL managé, conteneurs API et web, domaine et HTTPS, CGU et politique de confidentialité (protection des données personnelles, loi malgache n° 2014-038, à valider avec un juriste).
