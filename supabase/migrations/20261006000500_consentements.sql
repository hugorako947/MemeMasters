-- =============================================================================
-- MemeMasters – Consentements à l'inscription
-- Comptes réservés aux 18 ans et plus (attestation par case à cocher) et
-- acceptation des conditions, horodatées avec la version des textes acceptée.
-- =============================================================================

alter table public.player_private
  add column age_confirmed_at  timestamptz,
  add column terms_accepted_at timestamptz,
  add column terms_version     text check (char_length(terms_version) <= 20),
  add constraint player_private_terms_consistency
    check ((terms_accepted_at is null) = (terms_version is null));
