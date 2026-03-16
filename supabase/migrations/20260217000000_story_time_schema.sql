-- =============================================================================
-- Story Time - Production PostgreSQL Schema for Supabase
-- Film industry platform: auth, projects, casting, crew, equipment, locations,
-- messaging, payments, reviews, analytics. RLS-enabled, UUID PKs, indexed.
-- =============================================================================

-- Extensions (Supabase has these by default; enable if not present)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- ENUMS
-- -----------------------------------------------------------------------------
CREATE TYPE user_role AS ENUM ('admin', 'creator', 'talent', 'vendor', 'agency');
CREATE TYPE verification_status AS ENUM ('pending', 'verified', 'rejected');
CREATE TYPE project_type AS ENUM ('film', 'series');
CREATE TYPE production_stage AS ENUM (
  'development', 'pre_production', 'production', 'post_production',
  'distribution', 'completed', 'on_hold', 'cancelled'
);
CREATE TYPE casting_status AS ENUM ('draft', 'open', 'shortlisting', 'closed', 'filled');
CREATE TYPE application_status AS ENUM ('submitted', 'shortlisted', 'rejected', 'hired');
CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled');
CREATE TYPE transaction_type AS ENUM (
  'escrow_hold', 'escrow_release', 'commission', 'vendor_payout',
  'refund', 'deposit', 'deposit_return', 'payment_in'
);
CREATE TYPE transaction_status AS ENUM ('pending', 'succeeded', 'failed', 'refunded', 'cancelled');
CREATE TYPE currency_code AS ENUM ('ZAR', 'USD', 'GBP', 'EUR', 'NGN'); -- extend as needed
CREATE TYPE conversation_type AS ENUM ('direct', 'project', 'booking', 'support');
CREATE TYPE message_status AS ENUM ('sent', 'delivered', 'read');

-- =============================================================================
-- AUTH & USERS
-- =============================================================================

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'creator',
  display_name TEXT,
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  country_code CHAR(2),
  timezone TEXT DEFAULT 'Africa/Johannesburg',
  locale TEXT DEFAULT 'en-ZA',
  verification_status verification_status NOT NULL DEFAULT 'pending',
  verification_document_url TEXT,
  verified_at TIMESTAMPTZ,
  stripe_account_id TEXT,
  paystack_customer_code TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_profiles_country ON public.profiles(country_code);
CREATE INDEX idx_profiles_verification ON public.profiles(verification_status);
CREATE INDEX idx_profiles_updated_at ON public.profiles(updated_at);

-- =============================================================================
-- PROJECTS
-- =============================================================================

CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_type project_type NOT NULL,
  title TEXT NOT NULL,
  slug TEXT,
  logline TEXT,
  synopsis TEXT,
  genre TEXT[],
  tags TEXT[],
  production_stage production_stage NOT NULL DEFAULT 'development',
  country_of_origin CHAR(2),
  target_release_date DATE,
  poster_url TEXT,
  trailer_url TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(slug)
);

CREATE INDEX idx_projects_owner ON public.projects(owner_id);
CREATE INDEX idx_projects_type ON public.projects(project_type);
CREATE INDEX idx_projects_stage ON public.projects(production_stage);
CREATE INDEX idx_projects_country ON public.projects(country_of_origin);
CREATE INDEX idx_projects_updated_at ON public.projects(updated_at);
CREATE INDEX idx_projects_genre ON public.projects USING GIN(genre);
CREATE INDEX idx_projects_tags ON public.projects USING GIN(tags);

-- Series-specific: seasons
CREATE TABLE public.project_seasons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  season_number INT NOT NULL,
  title TEXT,
  episode_count INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, season_number)
);

CREATE INDEX idx_project_seasons_project ON public.project_seasons(project_id);

-- Budget tracking
CREATE TABLE public.project_budgets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  currency currency_code NOT NULL DEFAULT 'ZAR',
  total_budget_cents BIGINT NOT NULL DEFAULT 0,
  spent_cents BIGINT NOT NULL DEFAULT 0,
  version INT NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_project_budgets_project ON public.project_budgets(project_id);

-- Budget line items
CREATE TABLE public.project_budget_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  budget_id UUID NOT NULL REFERENCES public.project_budgets(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  description TEXT,
  amount_cents BIGINT NOT NULL,
  committed_cents BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_budget_lines_budget ON public.project_budget_lines(budget_id);

-- Revenue tracking
CREATE TABLE public.project_revenue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  amount_cents BIGINT NOT NULL,
  currency currency_code NOT NULL DEFAULT 'ZAR',
  received_at DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_project_revenue_project ON public.project_revenue(project_id);
CREATE INDEX idx_project_revenue_received ON public.project_revenue(received_at);

-- Rights ownership structure
CREATE TABLE public.project_rights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  right_type TEXT NOT NULL,
  territory TEXT,
  holder_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  share_percent NUMERIC(5,2),
  start_date DATE,
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_project_rights_project ON public.project_rights(project_id);
CREATE INDEX idx_project_rights_holder ON public.project_rights(holder_id);

-- =============================================================================
-- SCRIPTS (linked to storage)
-- =============================================================================

CREATE TABLE public.scripts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  uploader_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  version INT NOT NULL DEFAULT 1,
  storage_path TEXT NOT NULL,
  storage_bucket TEXT NOT NULL DEFAULT 'scripts',
  file_name TEXT,
  file_size_bytes BIGINT,
  mime_type TEXT,
  checksum_sha256 TEXT,
  is_latest BOOLEAN NOT NULL DEFAULT TRUE,
  ownership_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scripts_project ON public.scripts(project_id);
CREATE INDEX idx_scripts_uploader ON public.scripts(uploader_id);
CREATE INDEX idx_scripts_latest ON public.scripts(project_id, is_latest) WHERE is_latest = TRUE;

-- =============================================================================
-- CASTING
-- =============================================================================

CREATE TABLE public.casting_calls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status casting_status NOT NULL DEFAULT 'draft',
  opens_at TIMESTAMPTZ,
  closes_at TIMESTAMPTZ,
  location_preference TEXT,
  shoot_date_from DATE,
  shoot_date_to DATE,
  pay_range_cents_min BIGINT,
  pay_range_cents_max BIGINT,
  pay_currency currency_code DEFAULT 'ZAR',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_casting_calls_project ON public.casting_calls(project_id);
CREATE INDEX idx_casting_calls_created_by ON public.casting_calls(created_by);
CREATE INDEX idx_casting_calls_status ON public.casting_calls(status);
CREATE INDEX idx_casting_calls_closes_at ON public.casting_calls(closes_at);

CREATE TABLE public.casting_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  casting_call_id UUID NOT NULL REFERENCES public.casting_calls(id) ON DELETE CASCADE,
  role_name TEXT NOT NULL,
  character_name TEXT,
  description TEXT,
  gender_preference TEXT,
  age_min INT,
  age_max INT,
  ethnicity TEXT,
  skills_required TEXT[],
  union_required BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_casting_roles_call ON public.casting_roles(casting_call_id);

CREATE TABLE public.casting_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  casting_call_id UUID NOT NULL REFERENCES public.casting_calls(id) ON DELETE CASCADE,
  role_id UUID REFERENCES public.casting_roles(id) ON DELETE SET NULL,
  applicant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status application_status NOT NULL DEFAULT 'submitted',
  cover_message TEXT,
  reel_url TEXT,
  headshot_url TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  shortlisted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(casting_call_id, role_id, applicant_id)
);

CREATE INDEX idx_casting_applications_call ON public.casting_applications(casting_call_id);
CREATE INDEX idx_casting_applications_applicant ON public.casting_applications(applicant_id);
CREATE INDEX idx_casting_applications_status ON public.casting_applications(status);

CREATE TABLE public.casting_contracts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID NOT NULL REFERENCES public.casting_applications(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  talent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_id UUID REFERENCES public.casting_roles(id) ON DELETE SET NULL,
  contract_document_path TEXT,
  start_date DATE,
  end_date DATE,
  fee_cents BIGINT,
  fee_currency currency_code DEFAULT 'ZAR',
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_casting_contracts_application ON public.casting_contracts(application_id);
CREATE INDEX idx_casting_contracts_project ON public.casting_contracts(project_id);
CREATE INDEX idx_casting_contracts_talent ON public.casting_contracts(talent_id);

-- =============================================================================
-- CREW
-- =============================================================================

CREATE TABLE public.crew_listings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  headline TEXT NOT NULL,
  department TEXT NOT NULL,
  role_title TEXT,
  bio TEXT,
  skills TEXT[],
  certifications TEXT[],
  day_rate_cents BIGINT,
  currency currency_code DEFAULT 'ZAR',
  country_code CHAR(2),
  city TEXT,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_crew_listings_user ON public.crew_listings(user_id);
CREATE INDEX idx_crew_listings_department ON public.crew_listings(department);
CREATE INDEX idx_crew_listings_available ON public.crew_listings(is_available);
CREATE INDEX idx_crew_listings_skills ON public.crew_listings USING GIN(skills);

CREATE TABLE public.crew_availability (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  crew_listing_id UUID NOT NULL REFERENCES public.crew_listings(id) ON DELETE CASCADE,
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_crew_availability_listing ON public.crew_availability(crew_listing_id);
CREATE INDEX idx_crew_availability_dates ON public.crew_availability(date_from, date_to);

CREATE TABLE public.crew_bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  crew_listing_id UUID NOT NULL REFERENCES public.crew_listings(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  booker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  status booking_status NOT NULL DEFAULT 'pending',
  agreed_rate_cents BIGINT,
  currency currency_code DEFAULT 'ZAR',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_crew_bookings_listing ON public.crew_bookings(crew_listing_id);
CREATE INDEX idx_crew_bookings_project ON public.crew_bookings(project_id);
CREATE INDEX idx_crew_bookings_booker ON public.crew_bookings(booker_id);
CREATE INDEX idx_crew_bookings_status ON public.crew_bookings(status);

-- =============================================================================
-- EQUIPMENT MARKETPLACE
-- =============================================================================

CREATE TABLE public.equipment_listings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  daily_rate_cents BIGINT NOT NULL,
  weekly_rate_cents BIGINT,
  currency currency_code NOT NULL DEFAULT 'ZAR',
  deposit_cents BIGINT DEFAULT 0,
  country_code CHAR(2),
  city TEXT,
  image_urls TEXT[],
  metadata JSONB DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_equipment_listings_vendor ON public.equipment_listings(vendor_id);
CREATE INDEX idx_equipment_listings_category ON public.equipment_listings(category);
CREATE INDEX idx_equipment_listings_active ON public.equipment_listings(is_active);

CREATE TABLE public.equipment_availability (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  equipment_listing_id UUID NOT NULL REFERENCES public.equipment_listings(id) ON DELETE CASCADE,
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  available BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_equipment_availability_listing ON public.equipment_availability(equipment_listing_id);
CREATE INDEX idx_equipment_availability_dates ON public.equipment_availability(date_from, date_to);

CREATE TABLE public.equipment_bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  equipment_listing_id UUID NOT NULL REFERENCES public.equipment_listings(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  booker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  status booking_status NOT NULL DEFAULT 'pending',
  total_cents BIGINT NOT NULL,
  deposit_cents BIGINT NOT NULL DEFAULT 0,
  deposit_returned_at TIMESTAMPTZ,
  currency currency_code NOT NULL DEFAULT 'ZAR',
  damage_notes TEXT,
  damage_charged_cents BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_equipment_bookings_listing ON public.equipment_bookings(equipment_listing_id);
CREATE INDEX idx_equipment_bookings_booker ON public.equipment_bookings(booker_id);
CREATE INDEX idx_equipment_bookings_status ON public.equipment_bookings(status);

-- =============================================================================
-- LOCATIONS
-- =============================================================================

CREATE TABLE public.location_listings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  location_type TEXT NOT NULL,
  address_line TEXT,
  city TEXT,
  region TEXT,
  country_code CHAR(2) NOT NULL,
  daily_rate_cents BIGINT NOT NULL,
  half_day_rate_cents BIGINT,
  weekly_rate_cents BIGINT,
  currency currency_code NOT NULL DEFAULT 'ZAR',
  pricing_tier TEXT,
  permit_required BOOLEAN DEFAULT FALSE,
  permit_notes TEXT,
  image_urls TEXT[],
  metadata JSONB DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_location_listings_owner ON public.location_listings(owner_id);
CREATE INDEX idx_location_listings_type ON public.location_listings(location_type);
CREATE INDEX idx_location_listings_country ON public.location_listings(country_code);
CREATE INDEX idx_location_listings_active ON public.location_listings(is_active);

CREATE TABLE public.location_availability (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  location_listing_id UUID NOT NULL REFERENCES public.location_listings(id) ON DELETE CASCADE,
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  available BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_location_availability_listing ON public.location_availability(location_listing_id);
CREATE INDEX idx_location_availability_dates ON public.location_availability(date_from, date_to);

CREATE TABLE public.location_bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  location_listing_id UUID NOT NULL REFERENCES public.location_listings(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  booker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  status booking_status NOT NULL DEFAULT 'pending',
  total_cents BIGINT NOT NULL,
  currency currency_code NOT NULL DEFAULT 'ZAR',
  permit_submitted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_location_bookings_listing ON public.location_bookings(location_listing_id);
CREATE INDEX idx_location_bookings_booker ON public.location_bookings(booker_id);
CREATE INDEX idx_location_bookings_status ON public.location_bookings(status);

-- =============================================================================
-- MESSAGING (Realtime-compatible)
-- =============================================================================

CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_type conversation_type NOT NULL DEFAULT 'direct',
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  booking_reference_type TEXT,
  booking_reference_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_conversations_project ON public.conversations(project_id);
CREATE INDEX idx_conversations_updated ON public.conversations(updated_at);

CREATE TABLE public.conversation_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  UNIQUE(conversation_id, user_id)
);

CREATE INDEX idx_conversation_participants_conversation ON public.conversation_participants(conversation_id);
CREATE INDEX idx_conversation_participants_user ON public.conversation_participants(user_id);

CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body TEXT,
  status message_status NOT NULL DEFAULT 'sent',
  attachment_url TEXT,
  attachment_name TEXT,
  attachment_mime_type TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation ON public.messages(conversation_id);
CREATE INDEX idx_messages_sender ON public.messages(sender_id);
CREATE INDEX idx_messages_created_at ON public.messages(conversation_id, created_at DESC);

CREATE TABLE public.message_read_receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(message_id, user_id)
);

CREATE INDEX idx_message_read_receipts_message ON public.message_read_receipts(message_id);
CREATE INDEX idx_message_read_receipts_user ON public.message_read_receipts(user_id);

-- =============================================================================
-- PAYMENTS
-- =============================================================================

CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type transaction_type NOT NULL,
  status transaction_status NOT NULL DEFAULT 'pending',
  amount_cents BIGINT NOT NULL,
  currency currency_code NOT NULL DEFAULT 'ZAR',
  fee_cents BIGINT DEFAULT 0,
  commission_cents BIGINT DEFAULT 0,
  net_payout_cents BIGINT,
  payer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  payee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reference_type TEXT,
  reference_id UUID,
  stripe_payment_intent_id TEXT,
  stripe_transfer_id TEXT,
  paystack_reference TEXT,
  paystack_transfer_code TEXT,
  escrow_released_at TIMESTAMPTZ,
  refunded_transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transactions_payer ON public.transactions(payer_id);
CREATE INDEX idx_transactions_payee ON public.transactions(payee_id);
CREATE INDEX idx_transactions_status ON public.transactions(status);
CREATE INDEX idx_transactions_type ON public.transactions(type);
CREATE INDEX idx_transactions_reference ON public.transactions(reference_type, reference_id);
CREATE INDEX idx_transactions_created_at ON public.transactions(created_at DESC);

CREATE TABLE public.escrow_holds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  booking_type TEXT NOT NULL,
  booking_id UUID NOT NULL,
  amount_cents BIGINT NOT NULL,
  currency currency_code NOT NULL DEFAULT 'ZAR',
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_escrow_holds_transaction ON public.escrow_holds(transaction_id);
CREATE INDEX idx_escrow_holds_booking ON public.escrow_holds(booking_type, booking_id);

CREATE TABLE public.vendor_payouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  amount_cents BIGINT NOT NULL,
  currency currency_code NOT NULL DEFAULT 'ZAR',
  status transaction_status NOT NULL DEFAULT 'pending',
  stripe_payout_id TEXT,
  paystack_transfer_code TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vendor_payouts_vendor ON public.vendor_payouts(vendor_id);
CREATE INDEX idx_vendor_payouts_status ON public.vendor_payouts(status);
CREATE INDEX idx_vendor_payouts_created ON public.vendor_payouts(created_at DESC);

-- =============================================================================
-- REVIEWS
-- =============================================================================

CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reviewer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reviewee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reviewable_type TEXT NOT NULL,
  reviewable_id UUID NOT NULL,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title TEXT,
  body TEXT,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(reviewer_id, reviewable_type, reviewable_id)
);

CREATE INDEX idx_reviews_reviewee ON public.reviews(reviewee_id);
CREATE INDEX idx_reviews_reviewer ON public.reviews(reviewer_id);
CREATE INDEX idx_reviews_reviewable ON public.reviews(reviewable_type, reviewable_id);
CREATE INDEX idx_reviews_rating ON public.reviews(rating);

CREATE TABLE public.review_aggregates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reviewee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reviewable_type TEXT NOT NULL,
  review_count INT NOT NULL DEFAULT 0,
  avg_rating NUMERIC(3,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(reviewee_id, reviewable_type)
);

CREATE INDEX idx_review_aggregates_reviewee ON public.review_aggregates(reviewee_id);

-- =============================================================================
-- ANALYTICS
-- =============================================================================

CREATE TABLE public.view_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  viewer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  viewable_type TEXT NOT NULL,
  viewable_id UUID NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  session_id TEXT,
  device_type TEXT,
  country_code CHAR(2),
  duration_seconds INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_view_events_viewable ON public.view_events(viewable_type, viewable_id);
CREATE INDEX idx_view_events_viewer ON public.view_events(viewer_id);
CREATE INDEX idx_view_events_project ON public.view_events(project_id);
CREATE INDEX idx_view_events_created_at ON public.view_events(created_at DESC);

CREATE TABLE public.engagement_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_engagement_events_user ON public.engagement_events(user_id);
CREATE INDEX idx_engagement_events_target ON public.engagement_events(target_type, target_id);
CREATE INDEX idx_engagement_events_created_at ON public.engagement_events(created_at DESC);

CREATE TABLE public.platform_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  metric_date DATE NOT NULL,
  metric_name TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  dimensions JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(metric_date, metric_name, dimensions)
);

CREATE INDEX idx_platform_metrics_date ON public.platform_metrics(metric_date);
CREATE INDEX idx_platform_metrics_name ON public.platform_metrics(metric_name);

-- =============================================================================
-- UPDATED_AT TRIGGER
-- =============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables with updated_at (examples; add more as needed)
CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
CREATE TRIGGER set_projects_updated_at BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
CREATE TRIGGER set_scripts_updated_at BEFORE UPDATE ON public.scripts
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
CREATE TRIGGER set_casting_calls_updated_at BEFORE UPDATE ON public.casting_calls
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
CREATE TRIGGER set_messages_updated_at BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
CREATE TRIGGER set_transactions_updated_at BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_budget_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_revenue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_rights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.casting_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.casting_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.casting_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.casting_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crew_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crew_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crew_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_read_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escrow_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_aggregates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.view_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engagement_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_metrics ENABLE ROW LEVEL SECURITY;

-- Helper: current user's profile id (assumes auth.uid() is set)
-- RLS policies reference public.get_my_profile_id() for clarity where needed

CREATE OR REPLACE FUNCTION public.get_my_profile_id()
RETURNS UUID AS $$
  SELECT id FROM public.profiles WHERE id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS user_role AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ----- PROFILES -----
CREATE POLICY "Users can read all profiles" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can update any profile" ON public.profiles
  FOR UPDATE USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

-- ----- PROJECTS -----
CREATE POLICY "Anyone can read published or own projects" ON public.projects
  FOR SELECT USING (
    owner_id = auth.uid()
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Creators and admins can create projects" ON public.projects
  FOR INSERT WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('creator', 'admin')
  );

CREATE POLICY "Owner or admin can update project" ON public.projects
  FOR UPDATE USING (
    owner_id = auth.uid()
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Owner or admin can delete project" ON public.projects
  FOR DELETE USING (
    owner_id = auth.uid()
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- Project child tables: same as project access
CREATE POLICY "Project child read" ON public.project_seasons FOR SELECT USING (
  project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid()) OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);
CREATE POLICY "Project child modify" ON public.project_seasons FOR ALL USING (
  project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid()) OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);
CREATE POLICY "Budget read" ON public.project_budgets FOR SELECT USING (
  project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid()) OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);
CREATE POLICY "Budget modify" ON public.project_budgets FOR ALL USING (
  project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid()) OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);
CREATE POLICY "Budget lines read" ON public.project_budget_lines FOR SELECT USING (
  budget_id IN (SELECT id FROM public.project_budgets WHERE project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid()))
  OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);
CREATE POLICY "Budget lines modify" ON public.project_budget_lines FOR ALL USING (
  budget_id IN (SELECT id FROM public.project_budgets WHERE project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid()))
  OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);
CREATE POLICY "Scripts read" ON public.scripts FOR SELECT USING (
  project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid()) OR uploader_id = auth.uid() OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);
CREATE POLICY "Scripts insert" ON public.scripts FOR INSERT WITH CHECK (uploader_id = auth.uid());
CREATE POLICY "Scripts update" ON public.scripts FOR UPDATE USING (uploader_id = auth.uid() OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');
CREATE POLICY "Project revenue read" ON public.project_revenue FOR SELECT USING (
  project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid()) OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);
CREATE POLICY "Project revenue modify" ON public.project_revenue FOR ALL USING (
  project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid()) OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);
CREATE POLICY "Project rights read" ON public.project_rights FOR SELECT USING (
  project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid()) OR holder_id = auth.uid() OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);
CREATE POLICY "Project rights modify" ON public.project_rights FOR ALL USING (
  project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid()) OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

-- ----- CASTING -----
CREATE POLICY "Read casting calls for own projects or as participant" ON public.casting_calls
  FOR SELECT USING (
    created_by = auth.uid()
    OR project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Project owner or admin can manage casting calls" ON public.casting_calls
  FOR ALL USING (
    created_by = auth.uid()
    OR project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Read applications for own casting or as applicant" ON public.casting_applications
  FOR SELECT USING (
    applicant_id = auth.uid()
    OR casting_call_id IN (SELECT id FROM public.casting_calls WHERE created_by = auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Applicant can insert own application" ON public.casting_applications
  FOR INSERT WITH CHECK (applicant_id = auth.uid());

CREATE POLICY "Casting owner can update application status" ON public.casting_applications
  FOR UPDATE USING (
    casting_call_id IN (SELECT id FROM public.casting_calls WHERE created_by = auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Read casting roles with call" ON public.casting_roles
  FOR SELECT USING (
    casting_call_id IN (SELECT id FROM public.casting_calls WHERE created_by = auth.uid() OR project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid()))
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );
CREATE POLICY "Casting owner manage roles" ON public.casting_roles FOR ALL USING (
  casting_call_id IN (SELECT id FROM public.casting_calls WHERE created_by = auth.uid()) OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

CREATE POLICY "Read casting contracts" ON public.casting_contracts FOR SELECT USING (
  talent_id = auth.uid() OR project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid()) OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);
CREATE POLICY "Project owner manage contracts" ON public.casting_contracts FOR ALL USING (
  project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid()) OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

-- ----- CREW -----
CREATE POLICY "Read crew availability" ON public.crew_availability FOR SELECT USING (
  crew_listing_id IN (SELECT id FROM public.crew_listings WHERE user_id = auth.uid()) OR true
);
CREATE POLICY "Crew owner manage availability" ON public.crew_availability FOR ALL USING (
  crew_listing_id IN (SELECT id FROM public.crew_listings WHERE user_id = auth.uid())
);
CREATE POLICY "Read crew bookings" ON public.crew_bookings FOR SELECT USING (
  booker_id = auth.uid() OR crew_listing_id IN (SELECT id FROM public.crew_listings WHERE user_id = auth.uid())
);
CREATE POLICY "Booker create crew booking" ON public.crew_bookings FOR INSERT WITH CHECK (booker_id = auth.uid());
CREATE POLICY "Parties update crew booking" ON public.crew_bookings FOR UPDATE USING (
  booker_id = auth.uid() OR crew_listing_id IN (SELECT id FROM public.crew_listings WHERE user_id = auth.uid())
);

-- ----- EQUIPMENT / LOCATION AVAILABILITY & BOOKINGS -----
CREATE POLICY "Read equipment availability" ON public.equipment_availability FOR SELECT USING (true);
CREATE POLICY "Vendor manage equipment availability" ON public.equipment_availability FOR ALL USING (
  equipment_listing_id IN (SELECT id FROM public.equipment_listings WHERE vendor_id = auth.uid())
);
CREATE POLICY "Vendor update equipment booking" ON public.equipment_bookings FOR UPDATE USING (
  equipment_listing_id IN (SELECT id FROM public.equipment_listings WHERE vendor_id = auth.uid())
);
CREATE POLICY "Read location availability" ON public.location_availability FOR SELECT USING (true);
CREATE POLICY "Owner manage location availability" ON public.location_availability FOR ALL USING (
  location_listing_id IN (SELECT id FROM public.location_listings WHERE owner_id = auth.uid())
);
CREATE POLICY "Read location bookings" ON public.location_bookings FOR SELECT USING (
  booker_id = auth.uid() OR location_listing_id IN (SELECT id FROM public.location_listings WHERE owner_id = auth.uid())
);
CREATE POLICY "Booker create location booking" ON public.location_bookings FOR INSERT WITH CHECK (booker_id = auth.uid());
CREATE POLICY "Parties update location booking" ON public.location_bookings FOR UPDATE USING (
  booker_id = auth.uid() OR location_listing_id IN (SELECT id FROM public.location_listings WHERE owner_id = auth.uid())
);

-- ----- PAYMENTS (escrow, vendor payouts) -----
CREATE POLICY "Read own escrow" ON public.escrow_holds FOR SELECT USING (
  transaction_id IN (SELECT id FROM public.transactions WHERE payer_id = auth.uid() OR payee_id = auth.uid())
);
CREATE POLICY "Read own vendor payouts" ON public.vendor_payouts FOR SELECT USING (vendor_id = auth.uid());
CREATE POLICY "Admin read vendor payouts" ON public.vendor_payouts FOR SELECT USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

-- ----- REVIEW AGGREGATES -----
CREATE POLICY "Read review aggregates" ON public.review_aggregates FOR SELECT USING (true);

-- ----- ENGAGEMENT EVENTS -----
CREATE POLICY "Read own engagement" ON public.engagement_events FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Insert engagement" ON public.engagement_events FOR INSERT WITH CHECK (true);

-- ----- MESSAGING -----
CREATE POLICY "Participants can read conversation" ON public.conversations
  FOR SELECT USING (
    id IN (SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid())
  );

CREATE POLICY "Authenticated users can create conversation" ON public.conversations
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Participants can read participant list" ON public.conversation_participants
  FOR SELECT USING (conversation_id IN (SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid()));

CREATE POLICY "Participants can add self or conversation creator can add" ON public.conversation_participants
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Participants can read messages" ON public.messages
  FOR SELECT USING (
    conversation_id IN (SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid())
  );

CREATE POLICY "Participants can send messages" ON public.messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND conversation_id IN (SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid())
  );

-- ----- TRANSACTIONS (restrict to own rows) -----
CREATE POLICY "Users see own transactions as payer or payee" ON public.transactions
  FOR SELECT USING (payer_id = auth.uid() OR payee_id = auth.uid());

CREATE POLICY "Admins see all transactions" ON public.transactions
  FOR SELECT USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

-- ----- REVIEWS -----
CREATE POLICY "Anyone can read public reviews" ON public.reviews
  FOR SELECT USING (is_public = true OR reviewer_id = auth.uid() OR reviewee_id = auth.uid());

CREATE POLICY "Users can create reviews" ON public.reviews
  FOR INSERT WITH CHECK (reviewer_id = auth.uid());

CREATE POLICY "Reviewer can update own review" ON public.reviews
  FOR UPDATE USING (reviewer_id = auth.uid());

-- ----- EQUIPMENT / LOCATIONS / CREW (listing owner or booker) -----
CREATE POLICY "Read equipment listings" ON public.equipment_listings
  FOR SELECT USING (true);

CREATE POLICY "Vendor manages own equipment" ON public.equipment_listings
  FOR ALL USING (vendor_id = auth.uid());

CREATE POLICY "Read equipment bookings as vendor or booker" ON public.equipment_bookings
  FOR SELECT USING (
    booker_id = auth.uid()
    OR equipment_listing_id IN (SELECT id FROM public.equipment_listings WHERE vendor_id = auth.uid())
  );

CREATE POLICY "Booker can create equipment booking" ON public.equipment_bookings
  FOR INSERT WITH CHECK (booker_id = auth.uid());

CREATE POLICY "Read location listings" ON public.location_listings
  FOR SELECT USING (true);

CREATE POLICY "Owner manages own locations" ON public.location_listings
  FOR ALL USING (owner_id = auth.uid());

CREATE POLICY "Read crew listings" ON public.crew_listings
  FOR SELECT USING (true);

CREATE POLICY "User manages own crew listing" ON public.crew_listings
  FOR ALL USING (user_id = auth.uid());

-- ----- ANALYTICS (admin or own) -----
CREATE POLICY "Admins read all platform metrics" ON public.platform_metrics
  FOR SELECT USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Users read own view events" ON public.view_events
  FOR SELECT USING (viewer_id = auth.uid() OR viewer_id IS NULL);

CREATE POLICY "Service can insert view events" ON public.view_events
  FOR INSERT WITH CHECK (true);

-- =============================================================================
-- PROFILE AUTO-CREATE ON AUTH SIGNUP (optional)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, display_name)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
